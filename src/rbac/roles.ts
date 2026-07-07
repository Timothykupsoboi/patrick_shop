/**
 * RBAC — Roles & Permissions
 *
 * This is the SINGLE SOURCE OF TRUTH for all role-based access control.
 * Every screen, navigation item, API call, and repository operation must
 * reference this file instead of checking roles manually.
 */

// ---------------------------------------------------------------------------
// Role Types
// ---------------------------------------------------------------------------

/** All valid roles in the platform. */
export type UserRole =
  | 'platform_owner'  // Software developer/company — full platform access
  | 'super_admin'     // Supermarket owner — full access to their own store
  | 'admin'           // Daily business administration
  | 'manager'         // Daily store operations
  | 'cashier'         // Sales only
  | 'store_keeper'    // Inventory only
  | 'accountant';     // Finance only

/** Roles that belong to a specific supermarket (have supermarket_id). */
export const STORE_ROLES: UserRole[] = [
  'super_admin',
  'admin',
  'manager',
  'cashier',
  'store_keeper',
  'accountant',
];

/** Roles that operate at the platform level (no supermarket_id). */
export const PLATFORM_ROLES: UserRole[] = ['platform_owner'];

// ---------------------------------------------------------------------------
// Permission Actions
// ---------------------------------------------------------------------------

/**
 * Every protected action in the system.
 * Group comments describe the domain each action belongs to.
 */
export type PermissionAction =
  // ── Sales / POS ──────────────────────────────────────────────────────────
  | 'checkout_sale'        // Complete a sale / process payment
  | 'hold_sale'            // Put a sale on hold
  | 'resume_sale'          // Resume a held sale
  | 'void_sale'            // Void / cancel a completed sale
  | 'refund_sale'          // Issue a refund
  | 'override_price'       // Change the selling price on a cart item
  | 'apply_discount'       // Apply item or global discount
  | 'print_receipt'        // Print / reprint receipts
  | 'view_own_sales'       // View sales made by the current cashier
  | 'view_all_sales'       // View sales from all cashiers

  // ── Inventory ────────────────────────────────────────────────────────────
  | 'view_inventory'       // View product stock levels
  | 'adjust_stock'         // Manual stock adjustment
  | 'receive_stock'        // Receive new stock from a delivery/purchase order
  | 'transfer_stock'       // Move stock between branches
  | 'record_damaged'       // Record damaged items
  | 'record_expired'       // Record expired items

  // ── Products ─────────────────────────────────────────────────────────────
  | 'create_product'       // Add new product
  | 'edit_product'         // Modify existing product
  | 'delete_product'       // Soft-delete a product
  | 'view_product_cost'    // See buying/cost prices (hidden from cashiers)

  // ── Suppliers ────────────────────────────────────────────────────────────
  | 'manage_suppliers'     // Create, edit, view suppliers
  | 'manage_purchases'     // Create purchase orders and receive deliveries

  // ── Customers ────────────────────────────────────────────────────────────
  | 'manage_customers'     // Create, edit customers
  | 'view_customer_credit' // See customer credit balances
  | 'record_customer_payment' // Accept credit repayments
  | 'blacklist_customer'   // Flag a customer

  // ── Reports ──────────────────────────────────────────────────────────────
  | 'view_reports'         // Access reporting screens
  | 'export_reports'       // Export CSV/Excel reports
  | 'view_profit_loss'     // Access profit/loss figures

  // ── Expenses ─────────────────────────────────────────────────────────────
  | 'manage_expenses'      // Record and view business expenses

  // ── Shifts ───────────────────────────────────────────────────────────────
  | 'open_shift'           // Start a cashier shift
  | 'close_shift'          // End and reconcile a shift

  // ── Users / Employees ────────────────────────────────────────────────────
  | 'manage_employees'     // Create, edit, deactivate store staff
  | 'reset_user_pin'       // Reset another user's PIN (within their supermarket)
  | 'view_audit_logs'      // View the audit trail

  // ── Store Settings ───────────────────────────────────────────────────────
  | 'manage_store_settings'  // Edit supermarket name, branches, tax rates, etc.
  | 'manage_branches'        // Create / edit branches within the supermarket

  // ── Platform (platform_owner only) ───────────────────────────────────────
  | 'manage_supermarkets'  // Create/delete/suspend supermarkets
  | 'manage_subscriptions' // Change subscription plans & statuses
  | 'manage_licenses'      // Issue and revoke license keys
  | 'view_platform_analytics' // Platform-wide analytics
  | 'reset_any_password'   // Reset any user's password across all stores
  | 'manage_platform_settings' // Global platform configuration
  | 'backup_restore';      // Database backup and restore

// ---------------------------------------------------------------------------
// Role → Permissions Matrix
// ---------------------------------------------------------------------------

export const ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {

  platform_owner: [
    // Full platform access — everything
    'checkout_sale', 'hold_sale', 'resume_sale', 'void_sale', 'refund_sale',
    'override_price', 'apply_discount', 'print_receipt', 'view_own_sales', 'view_all_sales',
    'view_inventory', 'adjust_stock', 'receive_stock', 'transfer_stock', 'record_damaged', 'record_expired',
    'create_product', 'edit_product', 'delete_product', 'view_product_cost',
    'manage_suppliers', 'manage_purchases',
    'manage_customers', 'view_customer_credit', 'record_customer_payment', 'blacklist_customer',
    'view_reports', 'export_reports', 'view_profit_loss',
    'manage_expenses',
    'open_shift', 'close_shift',
    'manage_employees', 'reset_user_pin', 'view_audit_logs',
    'manage_store_settings', 'manage_branches',
    // Platform-exclusive
    'manage_supermarkets', 'manage_subscriptions', 'manage_licenses',
    'view_platform_analytics', 'reset_any_password', 'manage_platform_settings', 'backup_restore',
  ],

  super_admin: [
    // Full supermarket access — all store actions, no platform actions
    'checkout_sale', 'hold_sale', 'resume_sale', 'void_sale', 'refund_sale',
    'override_price', 'apply_discount', 'print_receipt', 'view_own_sales', 'view_all_sales',
    'view_inventory', 'adjust_stock', 'receive_stock', 'transfer_stock', 'record_damaged', 'record_expired',
    'create_product', 'edit_product', 'delete_product', 'view_product_cost',
    'manage_suppliers', 'manage_purchases',
    'manage_customers', 'view_customer_credit', 'record_customer_payment', 'blacklist_customer',
    'view_reports', 'export_reports', 'view_profit_loss',
    'manage_expenses',
    'open_shift', 'close_shift',
    'manage_employees', 'reset_user_pin', 'view_audit_logs',
    'manage_store_settings', 'manage_branches',
  ],

  admin: [
    // Daily administration — no user management, no platform settings
    'view_all_sales', 'view_own_sales',
    'view_inventory', 'adjust_stock', 'receive_stock', 'record_damaged', 'record_expired',
    'create_product', 'edit_product', 'view_product_cost',
    'manage_suppliers', 'manage_purchases',
    'manage_customers', 'view_customer_credit', 'record_customer_payment', 'blacklist_customer',
    'view_reports', 'export_reports', 'view_profit_loss',
    'manage_expenses',
    'print_receipt',
  ],

  manager: [
    // Daily operations — can sell, can approve discounts/refunds, cannot manage staff
    'checkout_sale', 'hold_sale', 'resume_sale', 'void_sale', 'refund_sale',
    'override_price', 'apply_discount', 'print_receipt', 'view_own_sales', 'view_all_sales',
    'view_inventory', 'receive_stock',
    'view_product_cost',
    'manage_customers', 'view_customer_credit', 'record_customer_payment',
    'view_reports',
    'open_shift', 'close_shift',
  ],

  cashier: [
    // Sales only
    'checkout_sale', 'hold_sale', 'resume_sale',
    'apply_discount', 'print_receipt', 'view_own_sales',
    'manage_customers',
    'open_shift', 'close_shift',
  ],

  store_keeper: [
    // Inventory only
    'view_inventory', 'adjust_stock', 'receive_stock', 'transfer_stock',
    'record_damaged', 'record_expired',
    'view_product_cost',
    // Product management (Add, edit, update)
    'create_product', 'edit_product', 'delete_product',
    // Purchases from suppliers (Receive stock)
    'manage_purchases',
  ],

  accountant: [
    // Finance only
    'view_all_sales', 'view_own_sales',
    'view_reports', 'export_reports', 'view_profit_loss',
    'manage_expenses',
    'view_customer_credit', 'record_customer_payment',
  ],
};

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Check if a given role has permission to perform an action.
 * Use the `usePermission` hook in components instead of calling this directly.
 */
export function hasPermission(role: UserRole | undefined | null, action: PermissionAction): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(action) : false;
}

/**
 * Returns a human-readable label for a role.
 */
export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    platform_owner: 'Platform Owner',
    super_admin: 'Super Admin',
    admin: 'Admin',
    manager: 'Manager',
    cashier: 'Cashier',
    store_keeper: 'Store Keeper',
    accountant: 'Accountant',
  };
  return labels[role] || role;
}

/**
 * Returns true if the role is a store-level role (has a supermarket).
 */
export function isStoreRole(role: UserRole | undefined | null): boolean {
  if (!role) return false;
  return STORE_ROLES.includes(role);
}

/**
 * Returns true if the role is a platform-level role.
 */
export function isPlatformRole(role: UserRole | undefined | null): boolean {
  if (!role) return false;
  return PLATFORM_ROLES.includes(role);
}

/**
 * Returns the list of roles that a given role is allowed to create.
 * Used in the Employees screen to filter role assignment dropdowns.
 */
export function getCreatableRoles(creatorRole: UserRole): UserRole[] {
  switch (creatorRole) {
    case 'platform_owner':
      return ['super_admin', 'admin', 'manager', 'cashier', 'store_keeper', 'accountant'];
    case 'super_admin':
      return ['admin', 'manager', 'cashier', 'store_keeper', 'accountant'];
    case 'admin':
      return []; // Admins cannot create users
    default:
      return [];
  }
}
