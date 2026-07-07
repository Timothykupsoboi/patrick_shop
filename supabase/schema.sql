-- ============================================================================
-- Supabase PostgreSQL Schema - Production Ready Supermarket POS System
-- ============================================================================
-- Description: Complete schema for a multi-tenant, multi-branch, offline-first
--              supermarket POS system.
-- Safe to run in Supabase SQL Editor.
-- Supports versioned synchronization, triggers, RLS, and Auth integration.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean up existing triggers / tables if needed (Safe running)
-- Dropping triggers first if they exist to prevent errors on multiple runs
DROP TRIGGER IF EXISTS trigger_stock_transaction_reconcile ON stock_transactions;
DROP TRIGGER IF EXISTS trigger_customer_credit_update ON customer_credits;

-- ============================================================================
-- 1. BUSINESS STRUCTURE
-- ============================================================================

-- Supermarkets Table (Root Tenant)
CREATE TABLE IF NOT EXISTS supermarkets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    logo_url TEXT,
    subscription_plan VARCHAR(50) NOT NULL DEFAULT 'free_trial' CHECK (subscription_plan IN ('free_trial', 'monthly', 'annual')),
    subscription_status VARCHAR(50) NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'expired', 'suspended')),
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    subscription_ends_at TIMESTAMP WITH TIME ZONE,
    license_key VARCHAR(100) UNIQUE,
    max_branches INTEGER NOT NULL DEFAULT 1,
    max_users INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Branches Table
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    location TEXT,
    phone VARCHAR(50),
    is_main_branch BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Users (Profiles) Table - Links directly to Supabase auth.users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY, -- Maps directly to auth.users.id
    supermarket_id UUID REFERENCES supermarkets(id) ON DELETE CASCADE, -- NULL for platform_owner
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(50) NOT NULL CHECK (role IN ('platform_owner', 'super_admin', 'admin', 'manager', 'cashier', 'store_keeper', 'accountant')),
    phone VARCHAR(50),
    pin VARCHAR(6), -- 4-6 digit numeric pin code for fast cashier switching / offline mode
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- ============================================================================
-- 2. PRODUCT MANAGEMENT
-- ============================================================================

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Brands Table
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Units Table (e.g. Kg, Litre, Pack, Piece)
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    abbreviation VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Taxes Table
CREATE TABLE IF NOT EXISTS taxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    rate DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (rate >= 0.00),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Discounts Table
CREATE TABLE IF NOT EXISTS discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed_amount')),
    value DECIMAL(15,2) NOT NULL DEFAULT 0.00 CHECK (value >= 0.00),
    starts_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    payment_terms TEXT,
    notes TEXT,
    outstanding_balance DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    tax_id UUID REFERENCES taxes(id) ON DELETE SET NULL,
    discount_id UUID REFERENCES discounts(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    qr_code VARCHAR(255),
    unit VARCHAR(50) NOT NULL DEFAULT 'Piece', -- Kept for local backwards compatibility
    buying_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    selling_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    wholesale_price DECIMAL(15,2),
    minimum_price DECIMAL(15,2),
    current_stock DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
    minimum_stock DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
    maximum_stock DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
    reorder_level DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    image_url TEXT,
    description TEXT,
    expiry_date DATE,
    tax_rate DECIMAL(5,2) DEFAULT 0.00 NOT NULL, -- Kept for local backwards compatibility
    discount_rate DECIMAL(5,2) DEFAULT 0.00 NOT NULL, -- Kept for local backwards compatibility
    location VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Product Images Table (Supports multiple images per product)
CREATE TABLE IF NOT EXISTS product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- ============================================================================
-- 3. INVENTORY & STOCK MANAGEMENT
-- ============================================================================

-- Stock Transactions Ledger (Master Inventory Flow)
CREATE TABLE IF NOT EXISTS stock_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('in', 'out', 'adjustment_add', 'adjustment_sub', 'transfer_in', 'transfer_out', 'damaged', 'expired')),
    quantity DECIMAL(15,2) NOT NULL,
    unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    reference_id VARCHAR(100), -- References sale_id, purchase_id, transfer_id, etc.
    notes TEXT,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Stock Adjustments Table
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    adjusted_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Stock Adjustment Items
CREATE TABLE IF NOT EXISTS stock_adjustment_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adjustment_id UUID NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    system_qty DECIMAL(15,2) NOT NULL,
    physical_qty DECIMAL(15,2) NOT NULL,
    variance DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Stock Transfers Table (Inter-branch transfers)
CREATE TABLE IF NOT EXISTS stock_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    from_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    to_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shipped', 'received', 'cancelled')),
    shipped_at TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Stock Transfer Items
CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(15,2) NOT NULL CHECK (quantity > 0.00),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Damaged Stock Log Table
CREATE TABLE IF NOT EXISTS damaged_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(15,2) NOT NULL CHECK (quantity > 0.00),
    reason TEXT,
    reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Expired Products Table
CREATE TABLE IF NOT EXISTS expired_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(15,2) NOT NULL CHECK (quantity > 0.00),
    expiry_date DATE NOT NULL,
    disposed BOOLEAN DEFAULT FALSE NOT NULL,
    disposal_notes TEXT,
    reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- ============================================================================
-- 4. SUPPLIERS & PURCHASING
-- ============================================================================

-- Purchase Orders Table (Supplier Orders)
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(15,2) NOT NULL CHECK (quantity > 0.00),
    unit_cost DECIMAL(15,2) NOT NULL CHECK (unit_cost >= 0.00),
    subtotal DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Purchases Table (Invoices / Supplier Deliveries)
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    amount_paid DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('ordered', 'received', 'partial', 'returned')),
    received_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Purchase Items (Invoice items)
CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(15,2) NOT NULL,
    cost_price DECIMAL(15,2) NOT NULL,
    total_cost DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Goods Received Notes Table (GRN)
CREATE TABLE IF NOT EXISTS goods_received_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
    delivery_note_no VARCHAR(100),
    received_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    received_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- ============================================================================
-- 5. CUSTOMERS & LOYALTY
-- ============================================================================

-- Customer Groups Table (e.g. VIP, Wholesalers, Regular)
CREATE TABLE IF NOT EXISTS customer_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0.00 NOT NULL CHECK (discount_percentage >= 0.00),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    customer_group_id UUID REFERENCES customer_groups(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    national_id VARCHAR(50),
    credit_limit DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
    loyalty_points INTEGER DEFAULT 0 NOT NULL,
    notes TEXT,
    birthday DATE,
    photo_url TEXT,
    group_name VARCHAR(100), -- Kept for local backwards compatibility
    is_blacklisted BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Customer Credit Ledger / Accounts Table
CREATE TABLE IF NOT EXISTS customer_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('charge', 'payment')),
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    due_date DATE,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Customer Payments Table
CREATE TABLE IF NOT EXISTS customer_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'mpesa', 'card', 'bank_transfer')),
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0.00),
    reference_no VARCHAR(100),
    received_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- ============================================================================
-- 6. SALES TRANSACTIONS
-- ============================================================================

-- Sales Transactions Table
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    discount_amount DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
    payment_status VARCHAR(50) NOT NULL CHECK (payment_status IN ('paid', 'unpaid', 'partial')),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'mpesa', 'card', 'credit', 'split')),
    amount_paid DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
    change_amount DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
    mpesa_ref VARCHAR(100),
    notes TEXT,
    hold_status VARCHAR(50) DEFAULT 'active' CHECK (hold_status IN ('active', 'held', 'voided', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Sale Items Table
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity DECIMAL(15,2) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    buying_price DECIMAL(15,2) DEFAULT 0.00 NOT NULL, -- Added to track exact profit margins at sale time
    subtotal DECIMAL(15,2) NOT NULL,
    discount DECIMAL(15,2) DEFAULT 0.00 NOT NULL, -- Item level discount
    tax DECIMAL(15,2) DEFAULT 0.00 NOT NULL, -- Item level tax
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Sale Payments Table (Supports split payments)
CREATE TABLE IF NOT EXISTS sale_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'mpesa', 'card', 'credit')),
    amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0.00),
    reference_no VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Held Sales Table (Suspended checkout queues)
CREATE TABLE IF NOT EXISTS held_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    payload JSONB NOT NULL, -- Full shopping cart snapshot for retrieval
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Returns and Refunds Table
CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    returned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    total_refunded DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Returned Items
CREATE TABLE IF NOT EXISTS returned_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity DECIMAL(15,2) NOT NULL CHECK (quantity > 0.00),
    refund_amount DECIMAL(15,2) NOT NULL,
    restocked BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================================================
-- 7. EXPENSES
-- ============================================================================

-- Expense Categories Table
CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    expense_category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL, -- Kept for local backwards compatibility
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    reference VARCHAR(100),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- ============================================================================
-- 8. FINANCE & CASH DRAWER
-- ============================================================================

-- Cash Drawers (Terminal Registrations)
CREATE TABLE IF NOT EXISTS cash_drawers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'closed' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Cash Sessions (Registers cash per-shift / per-cashier)
CREATE TABLE IF NOT EXISTS cash_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    cash_drawer_id UUID NOT NULL REFERENCES cash_drawers(id) ON DELETE RESTRICT,
    cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    opening_balance DECIMAL(15,2) NOT NULL CHECK (opening_balance >= 0.00),
    closing_balance DECIMAL(15,2),
    expected_closing_balance DECIMAL(15,2),
    difference DECIMAL(15,2),
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Daily Closings / Cash reconciliations
CREATE TABLE IF NOT EXISTS daily_closings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    closing_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_sales DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_cash DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_mpesa DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_card DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_expenses DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- ============================================================================
-- 9. EMPLOYEES & WORKFLOW
-- ============================================================================

-- Employee Shifts Table
CREATE TABLE IF NOT EXISTS employee_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL, -- e.g. Morning Shift, Evening Shift
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Employee Attendance Table
CREATE TABLE IF NOT EXISTS employee_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES employee_shifts(id) ON DELETE SET NULL,
    check_in TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    check_out TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- ============================================================================
-- 10. SYSTEM & SYNCHRONIZATION
-- ============================================================================

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID REFERENCES supermarkets(id) ON DELETE CASCADE, -- NULL for platform level actions
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_role VARCHAR(50) NOT NULL,
    action VARCHAR(255) NOT NULL,
    table_name VARCHAR(100),
    record_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    device_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID REFERENCES supermarkets(id) ON DELETE CASCADE, -- Nullable for platform notices
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Nullable for all-users announcements
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'stock_alert', 'payment_alert')),
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL
);

-- Sync Queue Table
CREATE TABLE IF NOT EXISTS sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID REFERENCES supermarkets(id) ON DELETE CASCADE,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    attempts INTEGER DEFAULT 0 NOT NULL,
    last_error TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'failed'))
);

-- Sync State Table
CREATE TABLE IF NOT EXISTS sync_state (
    table_name VARCHAR(100) PRIMARY KEY,
    last_sync_time TIMESTAMP WITH TIME ZONE NOT NULL
);

-- App Configurations / Settings Table
CREATE TABLE IF NOT EXISTS app_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    CONSTRAINT unique_tenant_config UNIQUE (supermarket_id, branch_id, key)
);

-- Device-Specific Local Settings
CREATE TABLE IF NOT EXISTS local_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
);

-- ============================================================================
-- 11. INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_products_branch ON products(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_product ON stock_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);

-- ============================================================================
-- 12. DATABASE TRIGGERS & FUNCTIONS
-- ============================================================================

-- Function to update the updated_at column automatically and increment version
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all system entities
CREATE OR REPLACE PROCEDURE register_updated_at_trigger(table_name TEXT) AS $$
BEGIN
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_update_%I ON %I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER trigger_update_%I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', table_name, table_name);
END;
$$ LANGUAGE plpgsql;

CALL register_updated_at_trigger('supermarkets');
CALL register_updated_at_trigger('branches');
CALL register_updated_at_trigger('users');
CALL register_updated_at_trigger('categories');
CALL register_updated_at_trigger('brands');
CALL register_updated_at_trigger('units');
CALL register_updated_at_trigger('taxes');
CALL register_updated_at_trigger('discounts');
CALL register_updated_at_trigger('suppliers');
CALL register_updated_at_trigger('products');
CALL register_updated_at_trigger('product_images');
CALL register_updated_at_trigger('stock_transactions');
CALL register_updated_at_trigger('stock_adjustments');
CALL register_updated_at_trigger('stock_transfers');
CALL register_updated_at_trigger('damaged_stock');
CALL register_updated_at_trigger('expired_products');
CALL register_updated_at_trigger('purchase_orders');
CALL register_updated_at_trigger('purchases');
CALL register_updated_at_trigger('purchase_items');
CALL register_updated_at_trigger('goods_received_notes');
CALL register_updated_at_trigger('customer_groups');
CALL register_updated_at_trigger('customers');
CALL register_updated_at_trigger('customer_credits');
CALL register_updated_at_trigger('customer_payments');
CALL register_updated_at_trigger('sales');
CALL register_updated_at_trigger('sale_items');
CALL register_updated_at_trigger('sale_payments');
CALL register_updated_at_trigger('held_sales');
CALL register_updated_at_trigger('returns');
CALL register_updated_at_trigger('expense_categories');
CALL register_updated_at_trigger('expenses');
CALL register_updated_at_trigger('cash_drawers');
CALL register_updated_at_trigger('cash_sessions');
CALL register_updated_at_trigger('daily_closings');
CALL register_updated_at_trigger('employee_shifts');
CALL register_updated_at_trigger('employee_attendance');
CALL register_updated_at_trigger('audit_logs');
CALL register_updated_at_trigger('notifications');
CALL register_updated_at_trigger('app_configurations');

DROP PROCEDURE register_updated_at_trigger;

-- ----------------------------------------------------
-- Automatic Inventory Reconciliation Trigger
-- ----------------------------------------------------
CREATE OR REPLACE FUNCTION reconcile_inventory_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- If adding inventory
    IF NEW.type IN ('in', 'adjustment_add', 'transfer_in') THEN
        UPDATE products
        SET current_stock = current_stock + NEW.quantity,
            updated_at = NOW(),
            version = version + 1
        WHERE id = NEW.product_id;
    -- If reducing inventory
    ELSIF NEW.type IN ('out', 'adjustment_sub', 'transfer_out', 'damaged', 'expired') THEN
        UPDATE products
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW(),
            version = version + 1
        WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_stock_transaction_reconcile
AFTER INSERT ON stock_transactions
FOR EACH ROW EXECUTE FUNCTION reconcile_inventory_on_transaction();

-- ----------------------------------------------------
-- Automatic Customer Credit Balance Reconciliation
-- ----------------------------------------------------
CREATE OR REPLACE FUNCTION update_customer_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type = 'charge' THEN
        UPDATE customers
        SET balance = balance + NEW.amount,
            updated_at = NOW(),
            version = version + 1
        WHERE id = NEW.customer_id;
    ELSIF NEW.type = 'payment' THEN
        UPDATE customers
        SET balance = balance - NEW.amount,
            updated_at = NOW(),
            version = version + 1
        WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_customer_credit_update
AFTER INSERT ON customer_credits
FOR EACH ROW EXECUTE FUNCTION update_customer_credit_balance();

-- ============================================================================
-- 13. REPORTING VIEWS
-- ============================================================================

-- Daily Sales Performance View
CREATE OR REPLACE VIEW view_daily_sales AS
SELECT 
    supermarket_id,
    branch_id,
    DATE_TRUNC('day', created_at)::DATE AS sale_date,
    COUNT(id) AS transactions_count,
    SUM(total_amount) AS revenue,
    SUM(tax_amount) AS total_tax,
    SUM(discount_amount) AS total_discounts
FROM sales
WHERE hold_status = 'active' AND deleted = FALSE
GROUP BY supermarket_id, branch_id, DATE_TRUNC('day', created_at)::DATE;

-- Monthly Sales Performance View
CREATE OR REPLACE VIEW view_monthly_sales AS
SELECT 
    supermarket_id,
    branch_id,
    DATE_TRUNC('month', created_at)::DATE AS sale_month,
    COUNT(id) AS transactions_count,
    SUM(total_amount) AS revenue,
    SUM(tax_amount) AS total_tax,
    SUM(discount_amount) AS total_discounts
FROM sales
WHERE hold_status = 'active' AND deleted = FALSE
GROUP BY supermarket_id, branch_id, DATE_TRUNC('month', created_at)::DATE;

-- Product Sales & Performance Profit View
CREATE OR REPLACE VIEW view_product_performance AS
SELECT 
    si.supermarket_id,
    si.branch_id,
    p.id AS product_id,
    p.name AS product_name,
    p.sku,
    SUM(si.quantity) AS quantity_sold,
    SUM(si.subtotal) AS gross_sales_amount,
    SUM(si.discount) AS discounts_given,
    SUM(si.subtotal - (si.buying_price * si.quantity)) AS profit_margin
FROM sale_items si
JOIN products p ON si.product_id = p.id
JOIN sales s ON si.sale_id = s.id
WHERE s.hold_status = 'active' AND si.deleted = FALSE
GROUP BY si.supermarket_id, si.branch_id, p.id, p.name, p.sku;

-- Inventory Valuation View
CREATE OR REPLACE VIEW view_inventory_valuation AS
SELECT 
    supermarket_id,
    branch_id,
    COUNT(id) AS total_products,
    SUM(current_stock) AS total_stock_volume,
    SUM(current_stock * buying_price) AS valuation_cost_price,
    SUM(current_stock * selling_price) AS valuation_selling_price,
    SUM(current_stock * (selling_price - buying_price)) AS potential_profit
FROM products
WHERE deleted = FALSE
GROUP BY supermarket_id, branch_id;

-- Customer Credit & Loyalty Point Balance View
CREATE OR REPLACE VIEW view_customer_loyalty AS
SELECT 
    id AS customer_id,
    supermarket_id,
    name AS customer_name,
    phone,
    loyalty_points,
    balance AS outstanding_credit,
    credit_limit
FROM customers
WHERE deleted = FALSE;

-- Supplier Purchase and Outstanding Debts View
CREATE OR REPLACE VIEW view_supplier_debts AS
SELECT 
    id AS supplier_id,
    supermarket_id,
    name AS supplier_name,
    phone,
    email,
    outstanding_balance
FROM suppliers
WHERE deleted = FALSE;

-- Financial Profitability / P&L View
CREATE OR REPLACE VIEW view_financial_profitability AS
SELECT 
    s.supermarket_id,
    s.branch_id,
    COALESCE(SUM(s.total_amount), 0.00) AS total_sales,
    COALESCE((
        SELECT SUM(amount) 
        FROM expenses e 
        WHERE e.supermarket_id = s.supermarket_id AND e.deleted = FALSE
    ), 0.00) AS total_expenses,
    COALESCE(SUM(s.total_amount), 0.00) - COALESCE((
        SELECT SUM(amount) 
        FROM expenses e 
        WHERE e.supermarket_id = s.supermarket_id AND e.deleted = FALSE
    ), 0.00) AS net_profit
FROM sales s
WHERE s.hold_status = 'active' AND s.deleted = FALSE
GROUP BY s.supermarket_id, s.branch_id;

-- ============================================================================
-- 14. AUTHENTICATION & MULTI-TENANCY HELPERS (RPCs)
-- ============================================================================

-- Security Definer Function to safely register a supermarket and admin user atomic
CREATE OR REPLACE FUNCTION create_supermarket_with_admin(
  p_supermarket_id UUID,
  p_name VARCHAR(255),
  p_phone VARCHAR(50),
  p_email VARCHAR(255),
  p_address TEXT,
  p_subscription_plan VARCHAR(50),
  p_trial_ends_at TIMESTAMP WITH TIME ZONE,
  p_admin_id UUID,
  p_admin_name VARCHAR(255),
  p_admin_email VARCHAR(255),
  p_admin_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_exists BOOLEAN;
  v_encrypted_password TEXT;
BEGIN
  -- 1. Check if user already exists in auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = p_admin_email) INTO v_user_exists;
  
  IF v_user_exists THEN
    RAISE EXCEPTION 'A user with email % already exists.', p_admin_email;
  END IF;

  -- 2. Insert Supermarket
  INSERT INTO public.supermarkets (
    id, name, phone, email, address, subscription_plan, subscription_status, trial_ends_at, created_at, updated_at
  ) VALUES (
    p_supermarket_id, p_name, p_phone, p_email, p_address, p_subscription_plan, 'trial', p_trial_ends_at, NOW(), NOW()
  );

  -- 3. Encrypt the password using crypt/bf for auth compatibility
  v_encrypted_password := crypt(p_admin_password, gen_salt('bf', 10));

  -- 4. Create user in Supabase auth schema
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, 
    recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', p_admin_id, 'authenticated', 'authenticated', 
    p_admin_email, v_encrypted_password, NOW(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('name', p_admin_name),
    NOW(), NOW(), '', '', '', ''
  );

  -- 5. Insert local user profile in public users table
  INSERT INTO public.users (
    id, supermarket_id, branch_id, name, email, role, is_active, created_at, updated_at
  ) VALUES (
    p_admin_id, p_supermarket_id, NULL, p_admin_name, p_admin_email, 'super_admin', TRUE, NOW(), NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'supermarket_id', p_supermarket_id,
    'admin_id', p_admin_id
  );
END;
$$;

-- ============================================================================
-- 15. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all system tables
ALTER TABLE supermarkets ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE damaged_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE expired_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_received_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE held_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_drawers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_configurations ENABLE ROW LEVEL SECURITY;

-- Helper to verify auth and read current user's role
CREATE OR REPLACE FUNCTION get_auth_role()
RETURNS VARCHAR AS $$
BEGIN
  RETURN (SELECT role FROM public.users WHERE id = auth.uid() AND deleted = FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper to check current user's supermarket association
CREATE OR REPLACE FUNCTION get_auth_supermarket()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT supermarket_id FROM public.users WHERE id = auth.uid() AND deleted = FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper to check current user's branch association
CREATE OR REPLACE FUNCTION get_auth_branch()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT branch_id FROM public.users WHERE id = auth.uid() AND deleted = FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------
-- Supermarket Tenants RLS Policy
-- ----------------------------------------------------
CREATE POLICY tenant_supermarket_policy ON supermarkets
    FOR ALL
    USING (
        get_auth_role() = 'platform_owner'
        OR id = get_auth_supermarket()
    );

-- ----------------------------------------------------
-- Branches RLS Policy
-- ----------------------------------------------------
CREATE POLICY tenant_branches_policy ON branches
    FOR ALL
    USING (
        get_auth_role() = 'platform_owner'
        OR (supermarket_id = get_auth_supermarket() AND get_auth_role() IN ('super_admin', 'admin', 'manager', 'accountant', 'store_keeper'))
        OR (id = get_auth_branch())
    );

-- ----------------------------------------------------
-- Users / Profiles RLS Policy
-- ----------------------------------------------------
CREATE POLICY users_profile_policy ON users
    FOR ALL
    USING (
        get_auth_role() = 'platform_owner'
        OR (supermarket_id = get_auth_supermarket() AND get_auth_role() IN ('super_admin', 'admin', 'manager'))
        OR (id = auth.uid())
    );

-- ----------------------------------------------------
-- Product Catalog RLS Policies (Categories, Brands, Units, Taxes, Discounts, Products)
-- ----------------------------------------------------

CREATE POLICY product_catalog_policy ON products
    FOR ALL
    USING (
        get_auth_role() = 'platform_owner'
        OR (supermarket_id = get_auth_supermarket() AND get_auth_role() IN ('super_admin', 'admin', 'manager', 'cashier', 'store_keeper', 'accountant'))
    )
    WITH CHECK (
        get_auth_role() IN ('platform_owner', 'super_admin', 'admin', 'manager', 'store_keeper')
        AND supermarket_id = get_auth_supermarket()
    );

-- Helper policy builder pattern
CREATE OR REPLACE PROCEDURE apply_tenant_read_write_rls(table_name TEXT, allowed_roles_write TEXT[]) AS $$
BEGIN
    EXECUTE format('DROP POLICY IF EXISTS tenant_read_write_policy ON %I', table_name);
    EXECUTE format(
        'CREATE POLICY tenant_read_write_policy ON %I FOR ALL USING (
            get_auth_role() = ''platform_owner''
            OR (supermarket_id = get_auth_supermarket())
         ) WITH CHECK (
            (get_auth_role() = ''platform_owner'' OR (supermarket_id = get_auth_supermarket() AND get_auth_role() = ANY(%L)))
         )',
        table_name, allowed_roles_write
    );
END;
$$ LANGUAGE plpgsql;

CALL apply_tenant_read_write_rls('categories', ARRAY['super_admin', 'admin', 'manager', 'store_keeper']);
CALL apply_tenant_read_write_rls('brands', ARRAY['super_admin', 'admin', 'manager', 'store_keeper']);
CALL apply_tenant_read_write_rls('units', ARRAY['super_admin', 'admin', 'manager', 'store_keeper']);
CALL apply_tenant_read_write_rls('taxes', ARRAY['super_admin', 'admin', 'manager', 'accountant']);
CALL apply_tenant_read_write_rls('discounts', ARRAY['super_admin', 'admin', 'manager', 'accountant']);
CALL apply_tenant_read_write_rls('suppliers', ARRAY['super_admin', 'admin', 'manager', 'store_keeper']);
CALL apply_tenant_read_write_rls('product_images', ARRAY['super_admin', 'admin', 'manager', 'store_keeper']);

-- ----------------------------------------------------
-- Inventory RLS (Stock Transactions, Adjustments, Transfers, Expired, Damaged)
-- ----------------------------------------------------
CALL apply_tenant_read_write_rls('stock_transactions', ARRAY['super_admin', 'admin', 'manager', 'store_keeper', 'cashier']);
CALL apply_tenant_read_write_rls('stock_adjustments', ARRAY['super_admin', 'admin', 'manager', 'store_keeper']);
CALL apply_tenant_read_write_rls('stock_transfers', ARRAY['super_admin', 'admin', 'manager', 'store_keeper']);
CALL apply_tenant_read_write_rls('damaged_stock', ARRAY['super_admin', 'admin', 'manager', 'store_keeper']);
CALL apply_tenant_read_write_rls('expired_products', ARRAY['super_admin', 'admin', 'manager', 'store_keeper']);

-- ----------------------------------------------------
-- Purchasing RLS Policies
-- ----------------------------------------------------
CALL apply_tenant_read_write_rls('purchase_orders', ARRAY['super_admin', 'admin', 'manager', 'store_keeper']);
CALL apply_tenant_read_write_rls('purchases', ARRAY['super_admin', 'admin', 'manager', 'store_keeper']);
CALL apply_tenant_read_write_rls('purchase_items', ARRAY['super_admin', 'admin', 'manager', 'store_keeper']);
CALL apply_tenant_read_write_rls('goods_received_notes', ARRAY['super_admin', 'admin', 'manager', 'store_keeper']);

-- ----------------------------------------------------
-- Customers & Loyalty RLS
-- ----------------------------------------------------
CALL apply_tenant_read_write_rls('customer_groups', ARRAY['super_admin', 'admin', 'manager', 'accountant']);
CALL apply_tenant_read_write_rls('customers', ARRAY['super_admin', 'admin', 'manager', 'cashier', 'accountant']);
CALL apply_tenant_read_write_rls('customer_credits', ARRAY['super_admin', 'admin', 'manager', 'cashier', 'accountant']);
CALL apply_tenant_read_write_rls('customer_payments', ARRAY['super_admin', 'admin', 'manager', 'cashier', 'accountant']);

-- ----------------------------------------------------
-- Sales Transactions RLS (Sales, Held Sales, Returns, Payments)
-- ----------------------------------------------------
CALL apply_tenant_read_write_rls('sales', ARRAY['super_admin', 'admin', 'manager', 'cashier']);
CALL apply_tenant_read_write_rls('sale_items', ARRAY['super_admin', 'admin', 'manager', 'cashier']);
CALL apply_tenant_read_write_rls('sale_payments', ARRAY['super_admin', 'admin', 'manager', 'cashier']);
CALL apply_tenant_read_write_rls('held_sales', ARRAY['super_admin', 'admin', 'manager', 'cashier']);
CALL apply_tenant_read_write_rls('returns', ARRAY['super_admin', 'admin', 'manager', 'cashier']);

-- ----------------------------------------------------
-- Financial RLS (Expenses, Cash Sessions, Daily Closings)
-- ----------------------------------------------------
CALL apply_tenant_read_write_rls('expense_categories', ARRAY['super_admin', 'admin', 'manager', 'accountant']);
CALL apply_tenant_read_write_rls('expenses', ARRAY['super_admin', 'admin', 'manager', 'accountant']);
CALL apply_tenant_read_write_rls('cash_drawers', ARRAY['super_admin', 'admin', 'manager']);
CALL apply_tenant_read_write_rls('cash_sessions', ARRAY['super_admin', 'admin', 'manager', 'cashier']);
CALL apply_tenant_read_write_rls('daily_closings', ARRAY['super_admin', 'admin', 'manager', 'accountant']);

-- ----------------------------------------------------
-- Employee Attendance / Shift Planning RLS
-- ----------------------------------------------------
CALL apply_tenant_read_write_rls('employee_shifts', ARRAY['super_admin', 'admin', 'manager']);
CALL apply_tenant_read_write_rls('employee_attendance', ARRAY['super_admin', 'admin', 'manager', 'cashier', 'store_keeper', 'accountant']);

-- ----------------------------------------------------
-- System Control RLS (Audit Logs, App Config, Sync)
-- ----------------------------------------------------
CREATE POLICY app_configurations_policy ON app_configurations
    FOR ALL USING (
        get_auth_role() = 'platform_owner'
        OR (supermarket_id = get_auth_supermarket())
    );

CREATE POLICY audit_logs_policy ON audit_logs
    FOR ALL USING (
        get_auth_role() = 'platform_owner'
        OR (supermarket_id = get_auth_supermarket() AND get_auth_role() IN ('super_admin', 'admin', 'manager'))
    );

CREATE POLICY notifications_policy ON notifications
    FOR ALL USING (
        get_auth_role() = 'platform_owner'
        OR (supermarket_id = get_auth_supermarket())
    );

CREATE POLICY sync_queue_policy ON sync_queue
    FOR ALL USING (
        get_auth_role() = 'platform_owner'
        OR (supermarket_id = get_auth_supermarket())
    );

DROP PROCEDURE apply_tenant_read_write_rls;

-- ============================================================================
-- Helper RPC: Create Supermarket + Admin Auth User Atomically
-- ============================================================================
-- This function creates:
--   1. A supermarket record
--   2. A Supabase auth.users entry for the admin (using pgcrypto)
--   3. A users profile record for the admin
-- Run this in the Supabase SQL Editor (requires SECURITY DEFINER).
-- ============================================================================

CREATE OR REPLACE FUNCTION create_supermarket_with_admin(
  p_supermarket_id    UUID,
  p_name              TEXT,
  p_phone             TEXT DEFAULT NULL,
  p_email             TEXT DEFAULT NULL,
  p_address           TEXT DEFAULT NULL,
  p_subscription_plan TEXT DEFAULT 'free_trial',
  p_trial_ends_at     TIMESTAMPTZ DEFAULT NULL,
  p_admin_id          UUID DEFAULT NULL,
  p_admin_name        TEXT DEFAULT NULL,
  p_admin_email       TEXT DEFAULT NULL,
  p_admin_password    TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now             TIMESTAMPTZ := NOW();
  v_trial_end       TIMESTAMPTZ := COALESCE(p_trial_ends_at, NOW() + INTERVAL '30 days');
  v_admin_id        UUID := COALESCE(p_admin_id, uuid_generate_v4());
  v_auth_user_id    UUID;
BEGIN
  -- 1. Insert Supermarket record
  INSERT INTO supermarkets (
    id, name, phone, email, address,
    subscription_plan, subscription_status,
    trial_ends_at, max_branches, max_users,
    created_at, updated_at, deleted, version
  ) VALUES (
    p_supermarket_id, p_name, p_phone, p_email, p_address,
    p_subscription_plan, 'trial',
    v_trial_end, 1, 5,
    v_now, v_now, FALSE, 1
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Create Supabase Auth user for the admin
  --    (inserts into auth.users directly using service role permissions)
  BEGIN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role
    ) VALUES (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      p_admin_email,
      crypt(p_admin_password, gen_salt('bf')),
      v_now,
      v_now,
      v_now,
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('name', p_admin_name, 'supermarket_id', p_supermarket_id),
      FALSE,
      'authenticated'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Also insert into auth.identities
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      created_at,
      updated_at,
      last_sign_in_at
    ) VALUES (
      v_admin_id,
      v_admin_id,
      jsonb_build_object('sub', v_admin_id::text, 'email', p_admin_email),
      'email',
      v_now,
      v_now,
      v_now
    )
    ON CONFLICT DO NOTHING;

    v_auth_user_id := v_admin_id;
  EXCEPTION WHEN OTHERS THEN
    -- If auth.users insert fails (e.g. email already exists), try to find existing user
    SELECT id INTO v_auth_user_id FROM auth.users WHERE email = p_admin_email LIMIT 1;
    IF v_auth_user_id IS NULL THEN
      v_auth_user_id := v_admin_id;
    END IF;
  END;

  -- 3. Insert admin profile into public.users
  INSERT INTO users (
    id, supermarket_id, branch_id,
    name, email, role,
    phone, pin, is_active,
    created_at, updated_at,
    deleted, version
  ) VALUES (
    v_auth_user_id, p_supermarket_id, NULL,
    p_admin_name, p_admin_email, 'super_admin',
    NULL, NULL, TRUE,
    v_now, v_now,
    FALSE, 1
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN json_build_object(
    'supermarket_id', p_supermarket_id,
    'admin_id', v_auth_user_id,
    'success', TRUE
  );
END;
$$;

-- Grant execute to authenticated users (platform owner will call this)
GRANT EXECUTE ON FUNCTION create_supermarket_with_admin TO authenticated;

-- ============================================================================
-- End of Supabase Schema Script
-- ============================================================================
