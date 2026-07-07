import { syncEngine } from '../sync/syncEngine';
import { db } from '../../database/driver';
import { supabase } from '../../api/supabase';
import { syncQueue } from '../sync/syncQueue';

// Mock dependencies
jest.mock('../../database/driver', () => ({
  db: {
    execute: jest.fn(),
    transaction: jest.fn((cb) => cb({ execute: jest.fn() }))
  }
}));

jest.mock('../../api/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(),
          single: jest.fn()
        }))
      })),
      upsert: jest.fn()
    }))
  }
}));

jest.mock('../sync/syncQueue', () => ({
  syncQueue: {
    getPendingQueue: jest.fn(),
    remove: jest.fn(),
    markFailed: jest.fn()
  }
}));

describe('Sync Engine Conflict Resolution Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should overwrite cloud if local version is newer (Client Wins)', async () => {
    // 1. Arrange mock queue item
    const mockQueueItem = {
      id: 'q1',
      table_name: 'products',
      record_id: 'p1',
      action: 'UPDATE' as const,
      payload: JSON.stringify({ id: 'p1', name: 'New Fresh Milk 1L', version: 3 }),
      created_at: new Date().toISOString(),
      attempts: 0,
      last_error: null,
      status: 'pending' as const
    };

    (syncQueue.getPendingQueue as jest.Mock).mockResolvedValue([mockQueueItem]);

    // Remote has an older version (version: 2)
    const mockSupabaseQuery = {
      data: { version: 2, updated_at: '2026-07-04T00:00:00Z' },
      error: null
    };

    const maybeSingleMock = jest.fn().mockResolvedValue(mockSupabaseQuery);
    (supabase.from as jest.Mock).mockImplementation(() => ({
      select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
      upsert: jest.fn().mockResolvedValue({ error: null })
    }));

    // 2. Act
    await syncEngine.syncOutbound();

    // 3. Assert
    // Check that we resolved client-wins and performed the cloud upsert
    expect(maybeSingleMock).toHaveBeenCalled();
    expect(syncQueue.remove).toHaveBeenCalledWith('q1');
    expect(db.execute).toHaveBeenCalledWith(
      "UPDATE products SET synced = 1, sync_status = 'synced' WHERE id = ?",
      ['p1']
    );
  });

  it('should pull from cloud and overwrite local if cloud version is newer (Server Wins)', async () => {
    // 1. Arrange mock queue item
    const mockQueueItem = {
      id: 'q1',
      table_name: 'products',
      record_id: 'p1',
      action: 'UPDATE' as const,
      payload: JSON.stringify({ id: 'p1', name: 'Fresh Milk 1L', version: 2 }),
      created_at: new Date().toISOString(),
      attempts: 0,
      last_error: null,
      status: 'pending' as const
    };

    (syncQueue.getPendingQueue as jest.Mock).mockResolvedValue([mockQueueItem]);

    // Remote has a newer version (version: 4)
    const mockSupabaseQuery = {
      data: { version: 4, updated_at: '2026-07-04T08:00:00Z' },
      error: null
    };

    const mockFullRemoteRecord = {
      id: 'p1',
      name: 'Fresh Milk 1L Extra Brand',
      buying_price: 90,
      selling_price: 130,
      version: 4,
      updated_at: '2026-07-04T08:00:00Z'
    };

    const maybeSingleMock = jest.fn().mockResolvedValue(mockSupabaseQuery);
    const singleMock = jest.fn().mockResolvedValue({ data: mockFullRemoteRecord });

    (supabase.from as jest.Mock).mockImplementation(() => ({
      select: (fields: string) => ({
        eq: () => ({
          maybeSingle: maybeSingleMock,
          single: singleMock
        })
      })
    }));

    // Local DB mock checks for exist check query
    (db.execute as jest.Mock).mockResolvedValue({ rows: [{ version: 2, synced: 0 }] });

    // 2. Act
    await syncEngine.syncOutbound();

    // 3. Assert
    expect(maybeSingleMock).toHaveBeenCalled();
    expect(singleMock).toHaveBeenCalled();
    // Verify that we applied server-wins: deleted the sync queue item and overwrote local DB
    expect(syncQueue.remove).toHaveBeenCalledWith('q1');
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE products SET'),
      expect.any(Array)
    );
  });
});
