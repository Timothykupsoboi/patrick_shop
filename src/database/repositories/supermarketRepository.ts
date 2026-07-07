import { db } from '../driver';
import { syncQueue } from '../../api/sync/syncQueue';
import { syncEngine } from '../../api/sync/syncEngine';
import { generateUUID } from '../../utils/uuid';

export interface Supermarket {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  logo_url?: string;
  subscription_plan: 'free_trial' | 'monthly' | 'annual';
  subscription_status: 'trial' | 'active' | 'expired' | 'suspended';
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  license_key?: string;
  max_branches?: number;
  max_users?: number;
  created_at?: string;
  updated_at?: string;
  deleted?: boolean;
  version?: number;
}

export const supermarketRepository = {

  /**
   * Get all supermarkets (platform_owner only).
   */
  async getAll(): Promise<Supermarket[]> {
    const result = await db.execute(
      `SELECT * FROM supermarkets WHERE deleted = 0 ORDER BY name ASC`
    );
    return result.rows.map(this.mapFromSqlite);
  },

  /**
   * Get a single supermarket by ID.
   */
  async getById(id: string): Promise<Supermarket | null> {
    const result = await db.execute(
      `SELECT * FROM supermarkets WHERE id = ? AND deleted = 0 LIMIT 1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return this.mapFromSqlite(result.rows[0]);
  },

  /**
   * Create a new supermarket.
   */
  async create(data: Omit<Supermarket, 'id' | 'created_at' | 'updated_at'>): Promise<Supermarket> {
    const id = generateUUID();
    const now = new Date().toISOString();
    const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const licenseKey = `AGP-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const supermarket: Supermarket = {
      ...data,
      id,
      license_key: data.license_key || licenseKey,
      trial_ends_at: data.trial_ends_at || trialEnd,
      max_branches: data.max_branches || 1,
      max_users: data.max_users || 5,
      created_at: now,
      updated_at: now,
      deleted: false,
      version: 1
    };

    const keys = Object.keys(supermarket);
    const values = keys.map(k => {
      const val = (supermarket as any)[k];
      return typeof val === 'boolean' ? (val ? 1 : 0) : val;
    });

    const placeholders = keys.map(() => '?').join(', ');
    await db.execute(
      `INSERT INTO supermarkets (${keys.join(', ')}) VALUES (${placeholders})`,
      values
    );

    await syncQueue.addToQueue('supermarkets', id, 'INSERT', supermarket);
    syncEngine.sync();

    return supermarket;
  },

  /**
   * Update a supermarket.
   */
  async update(id: string, updates: Partial<Supermarket>): Promise<void> {
    const now = new Date().toISOString();
    const existingRes = await db.execute(`SELECT version FROM supermarkets WHERE id = ? LIMIT 1`, [id]);
    if (existingRes.rows.length === 0) throw new Error('Supermarket not found');
    const newVersion = (existingRes.rows[0].version || 1) + 1;

    const finalUpdate = { ...updates, updated_at: now, version: newVersion };
    const keys = Object.keys(finalUpdate);
    const values = keys.map(k => {
      const val = (finalUpdate as any)[k];
      return typeof val === 'boolean' ? (val ? 1 : 0) : val;
    });

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    await db.execute(`UPDATE supermarkets SET ${setClause} WHERE id = ?`, [...values, id]);

    const updatedRes = await db.execute(`SELECT * FROM supermarkets WHERE id = ? LIMIT 1`, [id]);
    await syncQueue.addToQueue('supermarkets', id, 'UPDATE', this.mapFromSqlite(updatedRes.rows[0]));
    syncEngine.sync();
  },

  /**
   * Update subscription plan and status.
   */
  async updateSubscription(
    id: string,
    plan: Supermarket['subscription_plan'],
    status: Supermarket['subscription_status'],
    endsAt?: string
  ): Promise<void> {
    await this.update(id, {
      subscription_plan: plan,
      subscription_status: status,
      subscription_ends_at: endsAt || null,
    });
  },

  /**
   * Suspend a supermarket.
   */
  async suspend(id: string): Promise<void> {
    await this.update(id, { subscription_status: 'suspended' });
  },

  /**
   * Reactivate a suspended or expired supermarket.
   */
  async activate(id: string, plan: Supermarket['subscription_plan'] = 'monthly'): Promise<void> {
    const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await this.update(id, {
      subscription_status: 'active',
      subscription_plan: plan,
      subscription_ends_at: endsAt,
    });
  },

  /**
   * Soft-delete a supermarket.
   */
  async delete(id: string): Promise<void> {
    await this.update(id, { deleted: true });
  },

  /**
   * Get summary stats (for platform dashboard).
   */
  async getPlatformStats(): Promise<{
    total: number;
    active: number;
    trial: number;
    expired: number;
    suspended: number;
  }> {
    const result = await db.execute(
      `SELECT subscription_status, COUNT(*) as count FROM supermarkets WHERE deleted = 0 GROUP BY subscription_status`
    );

    const stats = { total: 0, active: 0, trial: 0, expired: 0, suspended: 0 };
    for (const row of result.rows) {
      const count = Number(row.count);
      stats.total += count;
      if (row.subscription_status === 'active') stats.active = count;
      else if (row.subscription_status === 'trial') stats.trial = count;
      else if (row.subscription_status === 'expired') stats.expired = count;
      else if (row.subscription_status === 'suspended') stats.suspended = count;
    }
    return stats;
  },

  mapFromSqlite(row: any): Supermarket {
    return {
      ...row,
      deleted: row.deleted === 1,
      max_branches: Number(row.max_branches || 1),
      max_users: Number(row.max_users || 5),
    };
  }
};
