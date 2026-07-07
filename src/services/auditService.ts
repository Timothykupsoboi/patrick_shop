/**
 * Audit Service — Centralized audit logging.
 *
 * Call this from repositories and screens whenever a sensitive action occurs.
 * Automatically injects supermarket_id and branch_id from context.
 */
import { db } from '../database/driver';
import { syncQueue } from '../api/sync/syncQueue';
import { generateUUID } from '../utils/uuid';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'pin_lock'
  | 'price_override'
  | 'apply_discount'
  | 'void_sale'
  | 'refund_sale'
  | 'stock_adjustment'
  | 'receive_stock'
  | 'transfer_stock'
  | 'record_damaged'
  | 'record_expired'
  | 'product_created'
  | 'product_updated'
  | 'product_deleted'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'user_activated'
  | 'user_deactivated'
  | 'customer_blacklisted'
  | 'permission_changed'
  | 'subscription_changed'
  | 'supermarket_created'
  | 'supermarket_updated'
  | 'supermarket_suspended'
  | 'supermarket_activated'
  | 'supermarket_deleted'
  | 'expense_recorded'
  | 'expense_deleted'
  | 'supplier_created'
  | 'supplier_updated'
  | 'customer_payment_recorded'
  | 'report_exported';

export interface AuditLogEntry {
  action: AuditAction;
  /** Optional — if omitted, uses the currently active user set via setAuditUser() */
  userId?: string;
  /** Optional — if omitted, uses the currently active user set via setAuditUser() */
  userRole?: string;
  supermarketId?: string | null;
  branchId?: string | null;
  /** Alias for tableName (camelCase preferred) */
  tableName?: string;
  /** Legacy snake_case alias — maps to tableName internally */
  table_name?: string;
  /** Alias for recordId */
  recordId?: string;
  /** Legacy alias */
  record_id?: string;
  oldValues?: Record<string, any> | null;
  /** Legacy alias */
  old_values?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  /** Legacy alias */
  new_values?: Record<string, any> | null;
  ipAddress?: string;
  deviceInfo?: string;
}

// ---------------------------------------------------------------------------
// Active user — set by authSlice on login, cleared on logout
// ---------------------------------------------------------------------------

let _activeUserId: string   = 'system';
let _activeUserRole: string = 'system';
let _activeSupermarketId: string | null = null;
let _activeBranchId: string | null      = null;

export function setAuditUser(userId: string, userRole: string, supermarketId: string | null, branchId: string | null): void {
  _activeUserId        = userId;
  _activeUserRole      = userRole;
  _activeSupermarketId = supermarketId;
  _activeBranchId      = branchId;
}

export function clearAuditUser(): void {
  _activeUserId = 'system'; _activeUserRole = 'system';
  _activeSupermarketId = null; _activeBranchId = null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const auditService = {
  /**
   * Log a sensitive action to the local audit_logs table.
   * Queues for cloud sync automatically.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const id  = generateUUID();
      const now = new Date().toISOString();

      // Resolve userId/userRole from module state if not provided
      const userId      = entry.userId      || _activeUserId;
      const userRole    = entry.userRole    || _activeUserRole;
      const smId        = entry.supermarketId !== undefined ? entry.supermarketId : _activeSupermarketId;
      const branchId    = entry.branchId !== undefined ? entry.branchId : _activeBranchId;
      // Support both camelCase and snake_case field names
      const tableName   = entry.tableName   || entry.table_name   || null;
      const recordId    = entry.recordId    || entry.record_id    || null;
      const newValues   = entry.newValues   || entry.new_values   || null;
      const oldValues   = entry.oldValues   || entry.old_values   || null;

      const row = {
        id,
        supermarket_id: smId || null,
        branch_id: branchId || null,
        user_id: userId,
        user_role: userRole,
        action: entry.action,
        table_name: tableName,
        record_id: recordId,
        old_values: oldValues ? JSON.stringify(oldValues) : null,
        new_values: newValues ? JSON.stringify(newValues) : null,
        ip_address: entry.ipAddress || null,
        device_info: entry.deviceInfo || null,
        created_at: now,
        updated_at: now,
        deleted: 0,
        version: 1,
      };

      const keys = Object.keys(row);
      const values = keys.map(k => (row as any)[k]);
      const placeholders = keys.map(() => '?').join(', ');

      await db.execute(
        `INSERT INTO audit_logs (${keys.join(', ')}) VALUES (${placeholders})`,
        values
      );

      await syncQueue.addToQueue('audit_logs', id, 'INSERT', row);
    } catch (e) {
      // Audit logging should never break the main flow
      console.error('AuditService: Failed to write audit log:', e);
    }
  }
};
