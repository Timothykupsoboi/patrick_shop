import { IDatabase, DBResult } from './driver';

let nativeDb: any = null;

const getNativeDb = () => {
  if (!nativeDb) {
    const SQLite = require('expo-sqlite');
    nativeDb = SQLite.openDatabaseSync('pos_local.db');
  }
  return nativeDb;
};

class NativeDatabase implements IDatabase {
  async execute(sql: string, params: any[] = []): Promise<DBResult> {
    const db = getNativeDb();
    
    // Normalize SQL parameters
    const normalizedParams = params.map(p => typeof p === 'boolean' ? (p ? 1 : 0) : p);
    
    const results = await db.getAllAsync(sql, normalizedParams);
    
    let rowsAffected = 0;
    let insertId: number | undefined;
    
    const isWrite = /^\s*(insert|update|delete|create|drop|alter)/i.test(sql);
    if (isWrite) {
      const execResult = await db.runAsync(sql, normalizedParams);
      rowsAffected = execResult.changes;
      insertId = execResult.lastInsertRowId;
    }
    
    return {
      rows: results || [],
      rowsAffected,
      insertId,
    };
  }

  async transaction<T>(callback: (tx: IDatabase) => Promise<T>): Promise<T> {
    const db = getNativeDb();
    let result: T;
    
    await db.withTransactionAsync(async () => {
      result = await callback(this);
    });
    
    return result!;
  }
}

export const db: IDatabase = new NativeDatabase();
