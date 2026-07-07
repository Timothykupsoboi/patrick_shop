import { db } from '../driver';
import { syncQueue } from '../../api/sync/syncQueue';
import { syncEngine } from '../../api/sync/syncEngine';
import { generateUUID } from '../../utils/uuid';

export interface Product {
  id?: string;
  supermarket_id?: string;
  branch_id?: string;
  name: string;
  sku: string;
  barcode?: string;
  qr_code?: string;
  unit: string;
  buying_price: number;
  selling_price: number;
  wholesale_price?: number;
  minimum_price?: number;
  current_stock: number;
  minimum_stock: number;
  maximum_stock: number;
  supplier_id?: string;
  image_url?: string;
  description?: string;
  expiry_date?: string;
  tax_rate: number;
  discount_rate: number;
  location?: string;
  created_at?: string;
  updated_at?: string;
  deleted?: boolean;
  version?: number;
}

export const productRepository = {

  /**
   * Fetch all active products scoped to a supermarket (and optional branch).
   */
  async getAll(supermarketId: string, branchId?: string | null): Promise<Product[]> {
    let sql = `SELECT * FROM products WHERE deleted = 0 AND supermarket_id = ? ORDER BY name ASC`;
    const params: any[] = [supermarketId];

    if (branchId) {
      sql = `SELECT * FROM products WHERE deleted = 0 AND supermarket_id = ? AND branch_id = ? ORDER BY name ASC`;
      params.push(branchId);
    }

    const result = await db.execute(sql, params);
    return result.rows.map(this.mapFromSqlite);
  },

  /**
   * Search products by text (name, SKU, barcode) — scoped to supermarket.
   */
  async search(query: string, supermarketId: string, branchId?: string | null): Promise<Product[]> {
    const term = `%${query}%`;
    let sql = `SELECT * FROM products
       WHERE deleted = 0 AND supermarket_id = ?
       AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)
       ORDER BY name ASC`;
    const params: any[] = [supermarketId, term, term, term];

    if (branchId) {
      sql = `SELECT * FROM products
         WHERE deleted = 0 AND supermarket_id = ? AND branch_id = ?
         AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)
         ORDER BY name ASC`;
      params.splice(1, 0, branchId);
    }

    const result = await db.execute(sql, params);
    return result.rows.map(this.mapFromSqlite);
  },

  /**
   * Find product by barcode/SKU — scoped to supermarket.
   */
  async getByBarcode(barcode: string, supermarketId: string): Promise<Product | null> {
    const result = await db.execute(
      `SELECT * FROM products WHERE (barcode = ? OR sku = ?) AND supermarket_id = ? AND deleted = 0 LIMIT 1`,
      [barcode, barcode, supermarketId]
    );
    if (result.rows.length > 0) {
      return this.mapFromSqlite(result.rows[0]);
    }
    return null;
  },

  /**
   * Get low-stock products — scoped to supermarket.
   */
  async getLowStock(supermarketId: string): Promise<Product[]> {
    const result = await db.execute(
      `SELECT * FROM products WHERE deleted = 0 AND supermarket_id = ? AND current_stock <= minimum_stock ORDER BY current_stock ASC`,
      [supermarketId]
    );
    return result.rows.map(this.mapFromSqlite);
  },

  /**
   * Create new product — offline-first, auto-scoped.
   */
  async create(product: Product, supermarketId: string, branchId?: string | null): Promise<Product> {
    const id = product.id || generateUUID();
    const now = new Date().toISOString();
    const finalProduct: Product = {
      ...product,
      id,
      supermarket_id: supermarketId,
      branch_id: branchId || undefined,
      current_stock: product.current_stock || 0,
      created_at: now,
      updated_at: now,
      deleted: false,
      version: 1
    };

    const keys = Object.keys(finalProduct);
    const values = keys.map(k => {
      const val = (finalProduct as any)[k];
      return typeof val === 'boolean' ? (val ? 1 : 0) : val;
    });

    const placeholders = keys.map(() => '?').join(', ');
    await db.execute(
      `INSERT INTO products (${keys.join(', ')}) VALUES (${placeholders})`,
      values
    );

    await syncQueue.addToQueue('products', id, 'INSERT', finalProduct);
    syncEngine.sync();

    return finalProduct;
  },

  /**
   * Update an existing product — offline-first.
   */
  async update(id: string, productUpdate: Partial<Product>): Promise<void> {
    const now = new Date().toISOString();
    const existingRes = await db.execute(`SELECT version FROM products WHERE id = ? LIMIT 1`, [id]);
    if (existingRes.rows.length === 0) throw new Error('Product not found');
    const newVersion = (existingRes.rows[0].version || 1) + 1;

    const finalUpdate = { ...productUpdate, updated_at: now, version: newVersion };
    const keys = Object.keys(finalUpdate);
    const values = keys.map(k => {
      const val = (finalUpdate as any)[k];
      return typeof val === 'boolean' ? (val ? 1 : 0) : val;
    });

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    await db.execute(`UPDATE products SET ${setClause} WHERE id = ?`, [...values, id]);

    const updatedRes = await db.execute(`SELECT * FROM products WHERE id = ? LIMIT 1`, [id]);
    const completeProduct = this.mapFromSqlite(updatedRes.rows[0]);

    await syncQueue.addToQueue('products', id, 'UPDATE', completeProduct);
    syncEngine.sync();
  },

  /**
   * Soft-delete a product.
   */
  async delete(id: string): Promise<void> {
    await this.update(id, { deleted: true });
  },

  /**
   * Decrement stock after a sale (called inside a transaction).
   */
  async decrementStock(productId: string, quantity: number): Promise<void> {
    await db.execute(
      `UPDATE products SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?`,
      [quantity, new Date().toISOString(), productId]
    );
  },

  /**
   * Increment stock after receiving delivery.
   */
  async incrementStock(productId: string, quantity: number): Promise<void> {
    await db.execute(
      `UPDATE products SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?`,
      [quantity, new Date().toISOString(), productId]
    );
  },

  mapFromSqlite(row: any): Product {
    return {
      ...row,
      deleted: row.deleted === 1,
      buying_price: Number(row.buying_price),
      selling_price: Number(row.selling_price),
      wholesale_price: row.wholesale_price ? Number(row.wholesale_price) : undefined,
      minimum_price: row.minimum_price ? Number(row.minimum_price) : undefined,
      current_stock: Number(row.current_stock),
      minimum_stock: Number(row.minimum_stock),
      maximum_stock: Number(row.maximum_stock),
      tax_rate: Number(row.tax_rate),
      discount_rate: Number(row.discount_rate),
    };
  }
};
