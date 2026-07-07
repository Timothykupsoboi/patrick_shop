import { db } from '../../database/driver';
import { supabase } from '../supabase';
import { syncQueue, SyncQueueItem } from './syncQueue';
import { networkMonitor } from './networkMonitor';

/** Tables that belong to a specific supermarket (have supermarket_id column). */
const TENANT_SYNC_TABLES = [
  'branches',
  'users',
  'categories',
  'suppliers',
  'products',
  'customers',
  'customer_credits',
  'sales',
  'sale_items',
  'stock_transactions',
  'purchases',
  'purchase_items',
  'expenses',
  'audit_logs'
];

/** Tables that are platform-wide (no supermarket_id filter needed). */
const PLATFORM_SYNC_TABLES = [
  'supermarkets',
];

const SYNC_TABLES = [...PLATFORM_SYNC_TABLES, ...TENANT_SYNC_TABLES];

/** Active supermarket_id for the current session. Updated by the auth flow. */
let _activeSupermarketId: string | null = null;

export function setActiveSyncSupermarketId(id: string | null): void {
  _activeSupermarketId = id;
}

export const syncEngine = {
  isSyncing: false,

  /**
   * Starts a full bidirectional sync if online and not currently running.
   */
  async sync(): Promise<void> {
    if (this.isSyncing) return;
    
    const online = await networkMonitor.isOnline();
    if (!online) {
      console.log('Sync skipped: offline');
      return;
    }

    this.isSyncing = true;
    console.log('=== STARTING SYNC CYCLE ===');

    try {
      // 1. Process local changes first (Outbound)
      await this.syncOutbound();

      // 2. Fetch cloud updates (Inbound)
      await this.syncInbound();

      console.log('=== SYNC CYCLE COMPLETED SUCCESSFUL ===');
    } catch (e) {
      console.error('=== SYNC CYCLE FAILED ===', e);
    } finally {
      this.isSyncing = false;
    }
  },

  /**
   * Push local modifications to Supabase.
   */
  async syncOutbound(): Promise<void> {
    const queue = await syncQueue.getPendingQueue();
    if (queue.length === 0) {
      console.log('Outbound Sync: No pending changes.');
      return;
    }

    console.log(`Outbound Sync: Processing ${queue.length} queue items...`);

    for (const item of queue) {
      try {
        await this.syncQueueItem(item);
      } catch (err: any) {
        console.error(`Failed to sync queue item ${item.id} on table ${item.table_name}:`, err);
        await syncQueue.markFailed(item.id, err.message || 'Unknown network error');
        // Stop outbound processing on connection errors to preserve queue order
        const stillOnline = await networkMonitor.isOnline();
        if (!stillOnline) break;
      }
    }
  },

  /**
   * Syncs a single queue item with conflict resolution.
   */
  async syncQueueItem(item: SyncQueueItem): Promise<void> {
    const localPayload = JSON.parse(item.payload);
    
    // Check current remote record state in Supabase
    const { data: remoteRecord, error: fetchError } = await supabase
      .from(item.table_name)
      .select('version, updated_at')
      .eq('id', item.record_id)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Supabase read failed: ${fetchError.message}`);
    }

    if (remoteRecord) {
      // Conflict Resolution: Check versions
      if (remoteRecord.version > localPayload.version) {
        console.log(`Conflict detected on ${item.table_name} [${item.record_id}]. Cloud version (${remoteRecord.version}) is higher than local version (${localPayload.version}). Applying Server Wins.`);
        
        // Fetch full remote record and write locally, overwriting local
        const { data: fullRemote } = await supabase
          .from(item.table_name)
          .select('*')
          .eq('id', item.record_id)
          .single();

        if (fullRemote) {
          await this.saveRemoteToLocal(item.table_name, fullRemote);
        }
        
        await syncQueue.remove(item.id);
        return;
      }
    }

    // Server version is older or doesn't exist: proceed with local data overwrite
    // Update local data status to synced = 1
    const { error: upsertError } = await supabase
      .from(item.table_name)
      .upsert({ ...localPayload, synced: undefined, sync_status: undefined }, { onConflict: 'id' });

    if (upsertError) {
      throw new Error(`Supabase upsert failed: ${upsertError.message}`);
    }

    // Mark as synced locally
    await db.execute(
      `UPDATE ${item.table_name} SET synced = 1, sync_status = 'synced' WHERE id = ?`,
      [item.record_id]
    );

    // Remove from queue
    await syncQueue.remove(item.id);
  },

  /**
   * Pull remote database changes from Supabase.
   * Scopes inbound sync by supermarket_id for store users, ensuring
   * that one supermarket never pulls another's data.
   */
  async syncInbound(): Promise<void> {
    console.log('Inbound Sync: Checking cloud updates...');

    const allTables = SYNC_TABLES;

    for (const tableName of allTables) {
      try {
        // Fetch last sync timestamp for this table
        const stateRes = await db.execute(
          'SELECT last_sync_time FROM sync_state WHERE table_name = ? LIMIT 1',
          [tableName]
        );
        const lastSyncTime = stateRes.rows.length > 0 
          ? stateRes.rows[0].last_sync_time 
          : '1970-01-01T00:00:00.000Z';

        // Build query — tenant tables are scoped to active supermarket_id
        const isTenantTable = TENANT_SYNC_TABLES.includes(tableName);
        let query = supabase
          .from(tableName)
          .select('*')
          .gt('updated_at', lastSyncTime)
          .order('updated_at', { ascending: true });

        if (isTenantTable && _activeSupermarketId) {
          query = query.eq('supermarket_id', _activeSupermarketId) as any;
        }

        const { data: remoteRecords, error } = await query;

        if (error) {
          throw new Error(`Supabase pull failed on ${tableName}: ${error.message}`);
        }

        if (remoteRecords && remoteRecords.length > 0) {
          console.log(`Inbound Sync: Pulling ${remoteRecords.length} records for table [${tableName}]`);
          
          let maxUpdatedAt = lastSyncTime;
          for (const remoteRow of remoteRecords) {
            await this.saveRemoteToLocal(tableName, remoteRow);
            if (remoteRow.updated_at > maxUpdatedAt) {
              maxUpdatedAt = remoteRow.updated_at;
            }
          }

          // Save new sync timestamp
          await db.execute(
            'INSERT OR REPLACE INTO sync_state (table_name, last_sync_time) VALUES (?, ?)',
            [tableName, maxUpdatedAt]
          );
        }
      } catch (err) {
        console.error(`Inbound Sync failed for table ${tableName}:`, err);
      }
    }
  },

  /**
   * Helper to write fetched cloud records directly to local database tables.
   */
  async saveRemoteToLocal(tableName: string, remoteRow: any): Promise<void> {
    // 1. Check if record exists locally
    const localRes = await db.execute(`SELECT version, synced FROM ${tableName} WHERE id = ? LIMIT 1`, [remoteRow.id]);
    
    // Set sync status columns locally
    const rowToWrite = {
      ...remoteRow,
      synced: 1,
      sync_status: 'synced'
    };

    const keys = Object.keys(rowToWrite).filter(k => k !== 'synced' && k !== 'sync_status');
    // Map booleans to numbers for SQLite compatibility
    const values = keys.map(k => {
      const v = rowToWrite[k];
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (v && typeof v === 'object') return JSON.stringify(v); // JSONB to string mapping
      return v;
    });
    
    // Add SQLite sync status columns manually
    keys.push('synced', 'sync_status');
    values.push(1, 'synced');

    if (localRes.rows.length === 0) {
      // Record doesn't exist locally: INSERT
      const placeholders = keys.map(() => '?').join(', ');
      const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
      await db.execute(sql, values);
    } else {
      const localVersion = localRes.rows[0].version;
      const isLocalSynced = localRes.rows[0].synced === 1;

      // Overwrite local record only if cloud version is higher, OR local record was already in sync.
      // If local record is unsynced and has same/newer version, let outbound sync resolve it.
      if (remoteRow.version > localVersion || isLocalSynced) {
        const updateAssignments = keys.map(k => `${k} = ?`).join(', ');
        const sql = `UPDATE ${tableName} SET ${updateAssignments} WHERE id = ?`;
        await db.execute(sql, [...values, remoteRow.id]);
      }
    }
  },

  /**
   * Initializes automatic sync listeners.
   * Runs sync immediately on startup, on network restore, and every 60 seconds.
   */
  initialize(): () => void {
    // 1. Initial Sync
    this.sync();

    // 2. Subscribe to network status changes
    const unsubscribeNetwork = networkMonitor.subscribe((online) => {
      if (online) {
        console.log('Network connected: triggering sync...');
        this.sync();
      }
    });

    // 3. Periodic sync timer (every 60 seconds)
    const timerId = setInterval(() => {
      console.log('Periodic sync trigger...');
      this.sync();
    }, 60000);

    // Return cleanup function
    return () => {
      unsubscribeNetwork();
      clearInterval(timerId);
    };
  }
};
