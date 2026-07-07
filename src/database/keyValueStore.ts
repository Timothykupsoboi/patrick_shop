import { Platform } from 'react-native';
import { db } from './driver';

export const keyValueStore = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        console.error('LocalStorage failed, falling back to in-memory', e);
      }
    }
    
    // SQLite implementation
    try {
      const result = await db.execute('SELECT value FROM local_settings WHERE key = ? LIMIT 1', [key]);
      if (result.rows.length > 0) {
        return result.rows[0].value;
      }
    } catch (e) {
      console.error(`Failed to get item for key: ${key}`, e);
    }
    return null;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (e) {
        console.error('LocalStorage set failed', e);
      }
    }

    // SQLite implementation
    try {
      // Upsert: Try insert, if fails (due to PK conflict), update.
      // Since SQLite supports INSERT OR REPLACE, this is clean.
      await db.execute('INSERT OR REPLACE INTO local_settings (key, value) VALUES (?, ?)', [key, value]);
    } catch (e) {
      console.error(`Failed to set item for key: ${key}`, e);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch (e) {
        console.error('LocalStorage remove failed', e);
      }
    }

    // SQLite implementation
    try {
      await db.execute('DELETE FROM local_settings WHERE key = ?', [key]);
    } catch (e) {
      console.error(`Failed to remove item for key: ${key}`, e);
    }
  }
};
