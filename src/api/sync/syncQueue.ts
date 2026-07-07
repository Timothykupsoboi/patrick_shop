import { db } from '../../database/driver';
import { generateUUID } from '../../utils/uuid';

export interface SyncQueueItem {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: string; // JSON string of values
  created_at: string;
  attempts: number;
  last_error: string | null;
  status: 'pending' | 'failed';
}

export const syncQueue = {
  /**
   * Adds a database modification event to the sync queue.
   */
  async addToQueue(
    tableName: string,
    recordId: string,
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: any
  ): Promise<void> {
    const id = generateUUID();
    const createdAt = new Date().toISOString();
    const payloadStr = JSON.stringify(payload);

    await db.execute(
      `INSERT INTO sync_queue (id, table_name, record_id, action, payload, created_at, attempts, last_error, status)
       VALUES (?, ?, ?, ?, ?, ?, 0, NULL, 'pending')`,
      [id, tableName, recordId, action, payloadStr, createdAt]
    );
  },

  /**
   * Fetches all pending queue items sorted chronologically.
   */
  async getPendingQueue(): Promise<SyncQueueItem[]> {
    const result = await db.execute(
      `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC`
    );
    return result.rows as SyncQueueItem[];
  },

  /**
   * Increments the attempt counter and logs the latest error for a queue item.
   */
  async markFailed(id: string, error: string): Promise<void> {
    await db.execute(
      `UPDATE sync_queue
       SET attempts = attempts + 1, last_error = ?, status = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'pending' END
       WHERE id = ?`,
      [error, id]
    );
  },

  /**
   * Removes a processed queue item.
   */
  async remove(id: string): Promise<void> {
    await db.execute(`DELETE FROM sync_queue WHERE id = ?`, [id]);
  },

  /**
   * Clears the entire sync queue (useful for testing or resyncing).
   */
  async clearQueue(): Promise<void> {
    await db.execute(`DELETE FROM sync_queue`);
  }
};
