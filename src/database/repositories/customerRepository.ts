import { db } from '../driver';
import { syncQueue } from '../../api/sync/syncQueue';
import { syncEngine } from '../../api/sync/syncEngine';
import { generateUUID } from '../../utils/uuid';

export interface Customer {
  id?: string;
  supermarket_id?: string;
  branch_id?: string;
  name: string;
  phone?: string;
  email?: string;
  national_id?: string;
  credit_limit: number;
  balance: number;
  loyalty_points: number;
  notes?: string;
  birthday?: string;
  photo_url?: string;
  group_name?: string;
  is_blacklisted?: boolean;
  created_at?: string;
  updated_at?: string;
  deleted?: boolean;
  version?: number;
}

export interface CreditLedgerEntry {
  id?: string;
  supermarket_id?: string;
  branch_id?: string;
  customer_id: string;
  type: 'charge' | 'payment';
  amount: number;
  description?: string;
  due_date?: string;
  recorded_by?: string;
  created_at?: string;
  updated_at?: string;
  deleted?: boolean;
  version?: number;
}

export const customerRepository = {

  /**
   * Fetches all active customers scoped to a supermarket.
   */
  async getAll(supermarketId: string): Promise<Customer[]> {
    const result = await db.execute(
      `SELECT * FROM customers WHERE deleted = 0 AND supermarket_id = ? ORDER BY name ASC`,
      [supermarketId]
    );
    return result.rows.map(this.mapCustomerFromSqlite);
  },

  /**
   * Search customers by name or phone — scoped to supermarket.
   */
  async search(query: string, supermarketId: string): Promise<Customer[]> {
    const term = `%${query}%`;
    const result = await db.execute(
      `SELECT * FROM customers
       WHERE deleted = 0 AND supermarket_id = ?
       AND (name LIKE ? OR phone LIKE ?)
       ORDER BY name ASC`,
      [supermarketId, term, term]
    );
    return result.rows.map(this.mapCustomerFromSqlite);
  },

  /**
   * Creates a new customer — offline-first, tenant-scoped.
   */
  async create(customer: Customer, supermarketId: string, branchId?: string | null): Promise<Customer> {
    const id = customer.id || generateUUID();
    const now = new Date().toISOString();
    const finalCustomer: Customer = {
      ...customer,
      id,
      supermarket_id: supermarketId,
      branch_id: branchId || undefined,
      balance: customer.balance || 0,
      loyalty_points: customer.loyalty_points || 0,
      created_at: now,
      updated_at: now,
      deleted: false,
      version: 1
    };

    const keys = Object.keys(finalCustomer);
    const values = keys.map(k => {
      const val = (finalCustomer as any)[k];
      return typeof val === 'boolean' ? (val ? 1 : 0) : val;
    });

    const placeholders = keys.map(() => '?').join(', ');
    await db.execute(
      `INSERT INTO customers (${keys.join(', ')}) VALUES (${placeholders})`,
      values
    );

    await syncQueue.addToQueue('customers', id, 'INSERT', finalCustomer);
    syncEngine.sync();

    return finalCustomer;
  },

  /**
   * Update a customer record.
   */
  async update(id: string, customerUpdate: Partial<Customer>): Promise<void> {
    const now = new Date().toISOString();
    const existingRes = await db.execute(`SELECT version FROM customers WHERE id = ? LIMIT 1`, [id]);
    if (existingRes.rows.length === 0) throw new Error('Customer not found');
    const newVersion = (existingRes.rows[0].version || 1) + 1;

    const finalUpdate = { ...customerUpdate, updated_at: now, version: newVersion };
    const keys = Object.keys(finalUpdate);
    const values = keys.map(k => {
      const val = (finalUpdate as any)[k];
      return typeof val === 'boolean' ? (val ? 1 : 0) : val;
    });

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    await db.execute(`UPDATE customers SET ${setClause} WHERE id = ?`, [...values, id]);

    const updatedRes = await db.execute(`SELECT * FROM customers WHERE id = ? LIMIT 1`, [id]);
    await syncQueue.addToQueue('customers', id, 'UPDATE', this.mapCustomerFromSqlite(updatedRes.rows[0]));
    syncEngine.sync();
  },

  /**
   * Records a credit transaction (charge or payment) — offline-first.
   */
  async recordCreditTransaction(
    entry: CreditLedgerEntry,
    supermarketId: string,
    branchId?: string | null,
    recordedBy?: string
  ): Promise<CreditLedgerEntry> {
    const id = entry.id || generateUUID();
    const now = new Date().toISOString();
    const finalEntry: CreditLedgerEntry = {
      ...entry,
      id,
      supermarket_id: supermarketId,
      branch_id: branchId || undefined,
      recorded_by: recordedBy,
      created_at: now,
      updated_at: now,
      deleted: false,
      version: 1
    };

    await db.transaction(async (tx) => {
      const custRes = await tx.execute(
        'SELECT balance, version FROM customers WHERE id = ? LIMIT 1',
        [entry.customer_id]
      );
      if (custRes.rows.length === 0) throw new Error('Customer does not exist');

      const currentBalance = Number(custRes.rows[0].balance || 0);
      const nextVersion = (custRes.rows[0].version || 1) + 1;

      const newBalance = entry.type === 'charge'
        ? currentBalance + entry.amount
        : currentBalance - entry.amount;

      await tx.execute(
        'UPDATE customers SET balance = ?, version = ?, updated_at = ? WHERE id = ?',
        [newBalance, nextVersion, now, entry.customer_id]
      );

      const entryKeys = Object.keys(finalEntry);
      const entryValues = entryKeys.map(k => {
        const val = (finalEntry as any)[k];
        return typeof val === 'boolean' ? (val ? 1 : 0) : val;
      });
      const placeholders = entryKeys.map(() => '?').join(', ');
      await tx.execute(
        `INSERT INTO customer_credits (${entryKeys.join(', ')}) VALUES (${placeholders})`,
        entryValues
      );
    });

    const updatedCustRes = await db.execute('SELECT * FROM customers WHERE id = ? LIMIT 1', [entry.customer_id]);
    await syncQueue.addToQueue('customers', entry.customer_id, 'UPDATE', this.mapCustomerFromSqlite(updatedCustRes.rows[0]));
    await syncQueue.addToQueue('customer_credits', id, 'INSERT', finalEntry);
    syncEngine.sync();

    return finalEntry;
  },

  /**
   * Adjusts loyalty points.
   */
  async addLoyaltyPoints(id: string, points: number): Promise<void> {
    const now = new Date().toISOString();
    const custRes = await db.execute('SELECT loyalty_points, version FROM customers WHERE id = ? LIMIT 1', [id]);
    if (custRes.rows.length === 0) throw new Error('Customer not found');

    const newPoints = Number(custRes.rows[0].loyalty_points || 0) + points;
    const nextVersion = (custRes.rows[0].version || 1) + 1;

    await db.execute(
      'UPDATE customers SET loyalty_points = ?, version = ?, updated_at = ? WHERE id = ?',
      [newPoints, nextVersion, now, id]
    );

    const updatedRes = await db.execute('SELECT * FROM customers WHERE id = ? LIMIT 1', [id]);
    await syncQueue.addToQueue('customers', id, 'UPDATE', this.mapCustomerFromSqlite(updatedRes.rows[0]));
    syncEngine.sync();
  },

  /**
   * Fetches credit ledger history for a customer.
   */
  async getCreditHistory(customerId: string, supermarketId: string): Promise<CreditLedgerEntry[]> {
    const result = await db.execute(
      `SELECT * FROM customer_credits WHERE customer_id = ? AND supermarket_id = ? AND deleted = 0 ORDER BY created_at DESC`,
      [customerId, supermarketId]
    );
    return result.rows.map(row => ({
      ...row,
      deleted: row.deleted === 1,
      amount: Number(row.amount)
    }));
  },

  mapCustomerFromSqlite(row: any): Customer {
    return {
      ...row,
      deleted: row.deleted === 1,
      is_blacklisted: row.is_blacklisted === 1,
      credit_limit: Number(row.credit_limit),
      balance: Number(row.balance),
      loyalty_points: Number(row.loyalty_points)
    };
  }
};
