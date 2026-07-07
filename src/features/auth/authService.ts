import { supabase } from '../../api/supabase';
import { db } from '../../database/driver';
import { keyValueStore } from '../../database/keyValueStore';
import { UserRole, hasPermission, PermissionAction } from '../../rbac/roles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: string;
  supermarket_id: string | null;  // NULL for platform_owner
  branch_id: string | null;
  name: string;
  email: string | null;
  role: UserRole;
  phone: string | null;
  pin: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted?: boolean;
}

export interface ActiveSupermarket {
  id: string;
  name: string;
  subscription_plan: 'free_trial' | 'monthly' | 'annual';
  subscription_status: 'trial' | 'active' | 'expired' | 'suspended';
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  logo_url: string | null;
}

// ---------------------------------------------------------------------------
// Auth Service
// ---------------------------------------------------------------------------

export const authService = {

  /**
   * Email + password login for Platform Owner (connects to Supabase cloud).
   * Platform Owner has no supermarket_id.
   */
  async loginWithEmail(email: string, password: string): Promise<UserProfile> {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error('No user data returned.');

    // Fetch user profile from Supabase
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) throw new Error(`Failed to load user profile: ${profileError.message}`);

    // Cache user profile locally in SQLite
    const keys = Object.keys(profile);
    const values = keys.map(k => {
      const v = profile[k];
      return typeof v === 'boolean' ? (v ? 1 : 0) : v;
    });

    await db.execute(
      `INSERT OR REPLACE INTO users (${keys.join(', ')}, synced, sync_status) VALUES (${keys.map(() => '?').join(', ')}, 1, 'synced')`,
      [...values]
    );

    await keyValueStore.setItem('active_user_id', profile.id);

    return this._mapUserFromRow(profile);
  },

  /**
   * Fast offline PIN authentication for store users (cashiers, managers, etc.).
   * Platform owners cannot log in via PIN.
   */
  async loginWithPIN(pin: string, supermarketId?: string): Promise<UserProfile> {
    // Build query — optionally filter by supermarket to prevent cross-tenant PIN collisions
    let sql = `SELECT * FROM users WHERE pin = ? AND deleted = 0 AND is_active = 1 AND role != 'platform_owner' LIMIT 1`;
    const params: any[] = [pin];

    if (supermarketId) {
      sql = `SELECT * FROM users WHERE pin = ? AND supermarket_id = ? AND deleted = 0 AND is_active = 1 AND role != 'platform_owner' LIMIT 1`;
      params.push(supermarketId);
    }

    const result = await db.execute(sql, params);

    if (result.rows.length === 0) {
      throw new Error('Invalid PIN. Access denied.');
    }

    const profile = this._mapUserFromRow(result.rows[0]);
    await keyValueStore.setItem('active_user_id', profile.id);

    return profile;
  },

  /**
   * Checks if there is an active cached user session in local storage.
   */
  async getCachedSession(): Promise<UserProfile | null> {
    const userId = await keyValueStore.getItem('active_user_id');
    if (!userId) return null;

    const result = await db.execute(
      'SELECT * FROM users WHERE id = ? AND deleted = 0 AND is_active = 1 LIMIT 1',
      [userId]
    );

    if (result.rows.length > 0) {
      return this._mapUserFromRow(result.rows[0]);
    }
    return null;
  },

  /**
   * Fetches the supermarket profile for a store user.
   * Returns null for platform_owner (they have no supermarket).
   */
  async getActiveSupermarket(supermarketId: string | null): Promise<ActiveSupermarket | null> {
    if (!supermarketId) return null;

    const result = await db.execute(
      'SELECT * FROM supermarkets WHERE id = ? AND deleted = 0 LIMIT 1',
      [supermarketId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      subscription_plan: row.subscription_plan,
      subscription_status: row.subscription_status,
      trial_ends_at: row.trial_ends_at || null,
      subscription_ends_at: row.subscription_ends_at || null,
      logo_url: row.logo_url || null,
    };
  },

  /**
   * Logs out the user and clears cached credentials.
   */
  async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (_) {
      // Ignore — may fail offline
    }
    await keyValueStore.removeItem('active_user_id');
  },

  /**
   * Check if a specific role has permission to perform an action.
   * In components, use the usePermission() hook instead.
   */
  hasPermission(role: UserRole, action: PermissionAction): boolean {
    return hasPermission(role, action);
  },

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  _mapUserFromRow(row: any): UserProfile {
    return {
      id: row.id,
      supermarket_id: row.supermarket_id || null,
      branch_id: row.branch_id || null,
      name: row.name,
      email: row.email || null,
      role: row.role as UserRole,
      phone: row.phone || null,
      pin: row.pin || null,
      is_active: row.is_active === 1 || row.is_active === true,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted: row.deleted === 1 || row.deleted === true,
    };
  }
};
