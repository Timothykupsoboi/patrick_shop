import { db } from './driver';

export const TABLE_QUERIES = [
  // 0. Supermarkets Table (Multi-Tenant Root)
  `CREATE TABLE IF NOT EXISTS supermarkets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    logo_url TEXT,
    subscription_plan TEXT NOT NULL DEFAULT 'free_trial', -- 'free_trial' | 'monthly' | 'annual'
    subscription_status TEXT NOT NULL DEFAULT 'trial',    -- 'trial' | 'active' | 'expired' | 'suspended'
    trial_ends_at TEXT,
    subscription_ends_at TEXT,
    license_key TEXT UNIQUE,
    max_branches INTEGER NOT NULL DEFAULT 1,
    max_users INTEGER NOT NULL DEFAULT 5,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    synced INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );`,

  // 1. Branches Table
  `CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    supermarket_id TEXT NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    phone TEXT,
    is_main_branch INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    synced INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );`,

  // 2. Users (Employees) Table
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    supermarket_id TEXT,           -- NULL for platform_owner
    branch_id TEXT,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL,            -- 'platform_owner'|'super_admin'|'admin'|'manager'|'cashier'|'store_keeper'|'accountant'
    phone TEXT,
    pin TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    synced INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );`,

  // 3. Categories Table
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    supermarket_id TEXT NOT NULL,
    branch_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    synced INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );`,

  // 4. Products Table
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    supermarket_id TEXT NOT NULL,
    branch_id TEXT,
    name TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    qr_code TEXT,
    unit TEXT NOT NULL,
    buying_price REAL NOT NULL,
    selling_price REAL NOT NULL,
    wholesale_price REAL,
    minimum_price REAL,
    current_stock REAL NOT NULL DEFAULT 0,
    minimum_stock REAL NOT NULL DEFAULT 0,
    maximum_stock REAL NOT NULL DEFAULT 0,
    supplier_id TEXT,
    image_url TEXT,
    description TEXT,
    expiry_date TEXT,
    tax_rate REAL NOT NULL DEFAULT 0,
    discount_rate REAL NOT NULL DEFAULT 0,
    location TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    synced INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );`,

  // 5. Suppliers Table
  `CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    supermarket_id TEXT NOT NULL,
    branch_id TEXT,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    payment_terms TEXT,
    notes TEXT,
    outstanding_balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    synced INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );`,

  // 6. Customers Table
  `CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    supermarket_id TEXT NOT NULL,
    branch_id TEXT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    national_id TEXT,
    credit_limit REAL NOT NULL DEFAULT 0,
    balance REAL NOT NULL DEFAULT 0,
    loyalty_points INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    birthday TEXT,
    photo_url TEXT,
    group_name TEXT,
    is_blacklisted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    synced INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );`,

  // 7. Customer Credit Ledger Table
  `CREATE TABLE IF NOT EXISTS customer_credits (
    id TEXT PRIMARY KEY,
    supermarket_id TEXT NOT NULL,
    branch_id TEXT,
    customer_id TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'charge' | 'payment'
    amount REAL NOT NULL,
    description TEXT,
    due_date TEXT,
    recorded_by TEXT,    -- user_id of accountant/cashier
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    synced INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );`,

  // 8. Sales Transactions Table
  `CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    supermarket_id TEXT NOT NULL,
    branch_id TEXT,
    cashier_id TEXT NOT NULL,
    customer_id TEXT,
    total_amount REAL NOT NULL,
    discount_amount REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL,   -- 'paid' | 'unpaid' | 'partial'
    payment_method TEXT NOT NULL,   -- 'cash' | 'mpesa' | 'card' | 'credit' | 'split'
    amount_paid REAL NOT NULL DEFAULT 0,
    change_amount REAL NOT NULL DEFAULT 0,
    mpesa_ref TEXT,
    notes TEXT,
    hold_status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'held' | 'voided' | 'refunded'
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    synced INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );`,

  // 9. Sale Items Table
  `CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    supermarket_id TEXT NOT NULL,
    branch_id TEXT,
    sale_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    buying_price REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    synced INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );`,

  // 10. Stock Transactions (Inventory Ledger) Table
  `CREATE TABLE IF NOT EXISTS stock_transactions (
    id TEXT PRIMARY KEY,
    supermarket_id TEXT NOT NULL,
    branch_id TEXT,
    product_id TEXT NOT NULL,
    type TEXT NOT NULL,     -- 'in' | 'out' | 'adjustment' | 'transfer' | 'damaged' | 'expired'
    quantity REAL NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0,
    reference_id TEXT,      -- sale_id, purchase_id, etc.
    notes TEXT,
    performed_by TEXT,      -- user_id
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    synced INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );`,

  // 11. Supplier Purchases Table
  `CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    supermarket_id TEXT NOT NULL,
    branch_id TEXT,
    supplier_id TEXT NOT NULL,
    total_amount REAL NOT NULL,
    amount_paid REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL,   -- 'ordered' | 'received' | 'partial' | 'returned'
    received_by TEXT,       -- user_id
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    synced INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );`,

  // 12. Purchase Items Table
  `CREATE TABLE IF NOT EXISTS purchase_items (
    id TEXT PRIMARY KEY,
    supermarket_id TEXT NOT NULL,
    branch_id TEXT,
    purchase_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity REAL NOT NULL,
    cost_price REAL NOT NULL,
    total_cost REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    synced INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );`,

  // 13. Expenses Table
  `CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    supermarket_id TEXT NOT NULL,
    branch_id TEXT,
    category TEXT NOT NULL,  -- 'rent'|'electricity'|'water'|'transport'|'salary'|'maintenance'|'internet'|'other'
    amount REAL NOT NULL,
    description TEXT,
    reference TEXT,          -- receipt/reference number
    expense_date TEXT NOT NULL,
    recorded_by TEXT,        -- user_id
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    synced INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );`,

  // 14. Audit Logs Table (Security Trail)
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    supermarket_id TEXT,     -- NULL for platform-level actions
    branch_id TEXT,
    user_id TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,    -- e.g. 'price_override' | 'void_sale' | 'user_created' | 'stock_adjustment'
    table_name TEXT,
    record_id TEXT,
    old_values TEXT,         -- JSON string
    new_values TEXT,         -- JSON string
    ip_address TEXT,
    device_info TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    synced INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending'
  );`,

  // 15. Synchronization Queue (Outbound Sync queue)
  `CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY,
    supermarket_id TEXT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL,    -- 'INSERT' | 'UPDATE' | 'DELETE'
    payload TEXT NOT NULL,   -- JSON String
    created_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    status TEXT NOT NULL DEFAULT 'pending'  -- 'pending' | 'failed'
  );`,

  // 16. Inbound Sync State (Stores last updated_at pulled per table)
  `CREATE TABLE IF NOT EXISTS sync_state (
    table_name TEXT PRIMARY KEY,
    last_sync_time TEXT NOT NULL
  );`,

  // 17. Local Settings Table (Key-Value configuration storage)
  `CREATE TABLE IF NOT EXISTS local_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );`
];

/** Migration queries — safe to run on existing databases (ADD COLUMN IF NOT EXISTS via try/catch). */
const MIGRATION_QUERIES = [
  // Suppliers — add payment_terms and notes columns
  `ALTER TABLE suppliers ADD COLUMN payment_terms TEXT`,
  `ALTER TABLE suppliers ADD COLUMN notes TEXT`,
  // Expenses — add reference column and expense_date alias
  `ALTER TABLE expenses ADD COLUMN reference TEXT`,
  `ALTER TABLE expenses ADD COLUMN expense_date TEXT`,
  // Sync queue — ensure supermarket_id column exists
  `ALTER TABLE sync_queue ADD COLUMN supermarket_id TEXT`,
];

export async function initLocalSchema(): Promise<void> {
  console.log('Initializing local database schema...');
  for (const query of TABLE_QUERIES) {
    try {
      await db.execute(query);
    } catch (e) {
      console.error('Failed to execute local schema query:', query, e);
      throw e;
    }
  }
  // Run migrations — errors are silenced because columns may already exist
  for (const migration of MIGRATION_QUERIES) {
    try {
      await db.execute(migration);
    } catch (_) {
      // Column already exists — this is expected on first run after schema is current
    }
  }
  await seedMockData();
  console.log('Local database schema initialized successfully.');
}

async function seedMockData(): Promise<void> {
  try {
    const userCheck = await db.execute("SELECT COUNT(*) as count FROM users");
    const count = userCheck.rows[0]?.count || 0;
    if (count > 0) {
      return; // Database is already seeded
    }

    console.log("Seeding local database with default data...");

    const now = new Date().toISOString();
    const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    // ── Seed Platform Owner (no supermarket_id) ───────────────────────────
    await db.execute(
      `INSERT INTO users (id, supermarket_id, branch_id, name, email, role, phone, pin, is_active, created_at, updated_at, deleted, version)
       VALUES (?, NULL, NULL, ?, ?, ?, ?, NULL, 1, ?, ?, 0, 1)`,
      ['platform-owner-001', 'Platform Admin', 'admin@antigravitypos.com', 'platform_owner', '+254700000001', now, now]
    );

    // ── Seed Supermarket ──────────────────────────────────────────────────
    await db.execute(
      `INSERT INTO supermarkets (id, name, phone, email, address, subscription_plan, subscription_status, trial_ends_at, license_key, created_at, updated_at, deleted, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      ['sm-001', 'Nairobi Mini Supermarket', '+254711000001', 'nairobi@minisuper.co.ke',
       'Nairobi Central, Moi Avenue', 'free_trial', 'trial', trialEnd, 'AGP-2026-SM001', now, now]
    );

    // ── Seed Main Branch ──────────────────────────────────────────────────
    await db.execute(
      `INSERT INTO branches (id, supermarket_id, name, location, phone, is_main_branch, created_at, updated_at, deleted, version)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, 0, 1)`,
      ['br-001', 'sm-001', 'Main Branch', 'Nairobi Central', '+254711000001', now, now]
    );

    // ── Seed Store Users ──────────────────────────────────────────────────
    // Super Admin (Store Owner) — PIN: 9999
    await db.execute(
      `INSERT INTO users (id, supermarket_id, branch_id, name, email, role, phone, pin, is_active, created_at, updated_at, deleted, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, 1)`,
      ['u-superadmin-001', 'sm-001', 'br-001', 'Mary Wanjiku', 'mary@minisuper.co.ke', 'super_admin', '+254722000001', '9999', now, now]
    );

    // Admin — PIN: 8888
    await db.execute(
      `INSERT INTO users (id, supermarket_id, branch_id, name, email, role, phone, pin, is_active, created_at, updated_at, deleted, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, 1)`,
      ['u-admin-001', 'sm-001', 'br-001', 'David Kamau', 'david@minisuper.co.ke', 'admin', '+254722000002', '8888', now, now]
    );

    // Manager — PIN: 0000
    await db.execute(
      `INSERT INTO users (id, supermarket_id, branch_id, name, email, role, phone, pin, is_active, created_at, updated_at, deleted, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, 1)`,
      ['u-manager-001', 'sm-001', 'br-001', 'Jane Smith', 'jane@minisuper.co.ke', 'manager', '+254722334455', '0000', now, now]
    );

    // Cashier — PIN: 1234
    await db.execute(
      `INSERT INTO users (id, supermarket_id, branch_id, name, email, role, phone, pin, is_active, created_at, updated_at, deleted, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, 1)`,
      ['u-cashier-001', 'sm-001', 'br-001', 'John Doe', 'john@minisuper.co.ke', 'cashier', '+254711223344', '1234', now, now]
    );

    // Store Keeper — PIN: 5678
    await db.execute(
      `INSERT INTO users (id, supermarket_id, branch_id, name, email, role, phone, pin, is_active, created_at, updated_at, deleted, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, 1)`,
      ['u-storekeeper-001', 'sm-001', 'br-001', 'Peter Omondi', 'peter@minisuper.co.ke', 'store_keeper', '+254711223355', '5678', now, now]
    );

    // Accountant — PIN: 4321
    await db.execute(
      `INSERT INTO users (id, supermarket_id, branch_id, name, email, role, phone, pin, is_active, created_at, updated_at, deleted, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, 1)`,
      ['u-accountant-001', 'sm-001', 'br-001', 'Grace Otieno', 'grace@minisuper.co.ke', 'accountant', '+254711223366', '4321', now, now]
    );

    // ── Seed Supplier ─────────────────────────────────────────────────────
    await db.execute(
      `INSERT INTO suppliers (id, supermarket_id, branch_id, name, contact_person, phone, email, outstanding_balance, created_at, updated_at, deleted, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 1)`,
      ['sup-001', 'sm-001', 'br-001', 'Naivas Distributors', 'James Kariuki', '+254720000001', 'supply@naivas.co.ke', now, now]
    );

    // ── Seed Products ─────────────────────────────────────────────────────
    const products = [
      ['p-001', 'sm-001', 'br-001', 'Fresh Milk 1L',     'MILK-1L',    '600123', 'Pack', 90,  120, 16.0, 45,  10, 100, 'Aisle A'],
      ['p-002', 'sm-001', 'br-001', 'Premium Sugar 1Kg', 'SUG-1KG',    '600456', 'Kg',   170, 210, 16.0, 12,  5,  50,  'Aisle B'],
      ['p-003', 'sm-001', 'br-001', 'Sweet Bread 400g',  'BREAD-400G', '600789', 'Loaf', 65,  85,  16.0, 30,  8,  60,  'Bakery'],
      ['p-004', 'sm-001', 'br-001', 'Cooking Oil 1L',    'OIL-1L',     '600321', 'Litre',195, 250, 16.0, 8,   3,  40,  'Aisle B'],
      ['p-005', 'sm-001', 'br-001', 'Maize Flour 2Kg',   'FLOUR-2KG',  '600654', 'Bag',  145, 180, 0.0,  20,  5,  80,  'Aisle A'],
      ['p-006', 'sm-001', 'br-001', 'Drinking Water 500ml', 'WATER-500', '600987', 'Bottle', 15, 25, 0.0, 48, 12, 120, 'Aisle C'],
    ];

    for (const p of products) {
      await db.execute(
        `INSERT INTO products (id, supermarket_id, branch_id, name, sku, barcode, unit, buying_price, selling_price, tax_rate, current_stock, minimum_stock, maximum_stock, location, supplier_id, created_at, updated_at, deleted, version, discount_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 0.0)`,
        [...p, 'sup-001', now, now]
      );
    }

    // ── Seed Customers ────────────────────────────────────────────────────
    await db.execute(
      `INSERT INTO customers (id, supermarket_id, branch_id, name, phone, email, credit_limit, balance, loyalty_points, created_at, updated_at, deleted, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      ['c-001', 'sm-001', 'br-001', 'Alex Mwangi', '+254712345678', 'alex@gmail.com', 10000, 1500, 150, now, now]
    );

    await db.execute(
      `INSERT INTO customers (id, supermarket_id, branch_id, name, phone, email, credit_limit, balance, loyalty_points, created_at, updated_at, deleted, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      ['c-002', 'sm-001', 'br-001', 'Sarah Cherono', '+254723456789', 'sarah@gmail.com', 15000, 0, 400, now, now]
    );

    console.log("Database seeded successfully.");
  } catch (e) {
    console.error("Database seed error", e);
  }
}

export async function resetLocalDatabase(): Promise<void> {
  console.log('Resetting local database...');
  const tables = [
    'supermarkets', 'branches', 'users', 'categories', 'products', 'suppliers', 'customers',
    'customer_credits', 'sales', 'sale_items', 'stock_transactions',
    'purchases', 'purchase_items', 'expenses', 'audit_logs', 'sync_queue', 'sync_state', 'local_settings'
  ];
  for (const table of tables) {
    try {
      await db.execute(`DROP TABLE IF EXISTS ${table};`);
    } catch (e) {
      console.error(`Failed to drop table ${table}:`, e);
    }
  }
  await initLocalSchema();
}
