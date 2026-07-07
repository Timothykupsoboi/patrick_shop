import { db } from '../driver';
import { syncQueue } from '../../api/sync/syncQueue';
import { syncEngine } from '../../api/sync/syncEngine';
import { generateUUID } from '../../utils/uuid';
import { CartItem } from '../../features/pos/posSlice';

export interface Sale {
  id?: string;
  supermarket_id?: string;
  branch_id?: string;
  cashier_id: string;
  customer_id: string | null;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  payment_status: 'paid' | 'unpaid' | 'partial';
  payment_method: 'cash' | 'mpesa' | 'card' | 'credit' | 'split';
  amount_paid?: number;
  change_amount?: number;
  mpesa_ref?: string;
  notes?: string;
  hold_status?: 'active' | 'held' | 'voided' | 'refunded';
  created_at?: string;
  updated_at?: string;
  deleted?: boolean;
  version?: number;
}

export const salesRepository = {

  /**
   * Finalizes a checkout transaction — offline-first, tenant-scoped.
   * Decrements stock, updates customer credit, queues sync.
   */
  async checkout(
    sale: Sale,
    cartItems: CartItem[],
    supermarketId: string,
    branchId?: string | null
  ): Promise<Sale> {
    const saleId = sale.id || generateUUID();
    const now = new Date().toISOString();

    const finalSale: Sale = {
      ...sale,
      id: saleId,
      supermarket_id: supermarketId,
      branch_id: branchId || undefined,
      hold_status: 'active',
      created_at: now,
      updated_at: now,
      deleted: false,
      version: 1
    };

    const syncOperations: Array<{ table: string; recordId: string; action: 'INSERT' | 'UPDATE'; payload: any }> = [];

    await db.transaction(async (tx) => {
      // 1. Write Sale record
      const saleKeys = Object.keys(finalSale);
      const saleValues = saleKeys.map(k => {
        const val = (finalSale as any)[k];
        return typeof val === 'boolean' ? (val ? 1 : 0) : val;
      });
      const salePlaceholders = saleKeys.map(() => '?').join(', ');
      await tx.execute(
        `INSERT INTO sales (${saleKeys.join(', ')}) VALUES (${salePlaceholders})`,
        saleValues
      );
      syncOperations.push({ table: 'sales', recordId: saleId, action: 'INSERT', payload: finalSale });

      // 2. Write Sale Items and decrement stock
      for (const item of cartItems) {
        const saleItemId = generateUUID();
        const unitPrice = item.overridePrice ?? item.product.selling_price;
        const lineDiscount = (unitPrice * item.quantity) * (item.discountRate / 100);
        const subtotal = (unitPrice * item.quantity) - lineDiscount;
        const taxAmount = subtotal * (item.product.tax_rate / 100);

        const saleItem = {
          id: saleItemId,
          supermarket_id: supermarketId,
          branch_id: branchId || undefined,
          sale_id: saleId,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: unitPrice,
          buying_price: item.product.buying_price,
          subtotal,
          discount: lineDiscount,
          tax: taxAmount,
          created_at: now,
          updated_at: now,
          deleted: 0,
          version: 1
        };

        const itemKeys = Object.keys(saleItem);
        const itemValues = itemKeys.map(k => (saleItem as any)[k]);
        const itemPlaceholders = itemKeys.map(() => '?').join(', ');
        await tx.execute(
          `INSERT INTO sale_items (${itemKeys.join(', ')}) VALUES (${itemPlaceholders})`,
          itemValues
        );
        syncOperations.push({ table: 'sale_items', recordId: saleItemId, action: 'INSERT', payload: saleItem });

        // Decrement product stock
        await tx.execute(
          `UPDATE products SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?`,
          [item.quantity, now, item.product.id]
        );

        // Write stock transaction ledger entry
        const stockTxId = generateUUID();
        const stockTx = {
          id: stockTxId,
          supermarket_id: supermarketId,
          branch_id: branchId || undefined,
          product_id: item.product.id,
          type: 'out',
          quantity: item.quantity,
          unit_cost: item.product.buying_price,
          reference_id: saleId,
          notes: `Sale: ${saleId}`,
          performed_by: sale.cashier_id,
          created_at: now,
          updated_at: now,
          deleted: 0,
          version: 1
        };
        const stxKeys = Object.keys(stockTx);
        const stxValues = stxKeys.map(k => (stockTx as any)[k]);
        await tx.execute(
          `INSERT INTO stock_transactions (${stxKeys.join(', ')}) VALUES (${stxKeys.map(() => '?').join(', ')})`,
          stxValues
        );
        syncOperations.push({ table: 'stock_transactions', recordId: stockTxId, action: 'INSERT', payload: stockTx });
      }

      // 3. Handle credit account payment
      if (sale.payment_method === 'credit' && sale.customer_id) {
        const custRes = await tx.execute(
          'SELECT balance, version, credit_limit FROM customers WHERE id = ? LIMIT 1',
          [sale.customer_id]
        );
        if (custRes.rows.length > 0) {
          const currentBalance = Number(custRes.rows[0].balance);
          const creditLimit = Number(custRes.rows[0].credit_limit);
          const nextBalance = currentBalance + sale.total_amount;

          if (nextBalance > creditLimit) {
            throw new Error(`Credit limit exceeded. Limit: KES ${creditLimit}, Balance would be: KES ${nextBalance}`);
          }

          const nextVersion = (custRes.rows[0].version || 1) + 1;
          await tx.execute(
            'UPDATE customers SET balance = ?, version = ?, updated_at = ? WHERE id = ?',
            [nextBalance, nextVersion, now, sale.customer_id]
          );

          // Write credit ledger entry
          const creditEntryId = generateUUID();
          const creditEntry = {
            id: creditEntryId,
            supermarket_id: supermarketId,
            branch_id: branchId || undefined,
            customer_id: sale.customer_id,
            type: 'charge',
            amount: sale.total_amount,
            description: `Sale #${saleId.substring(0, 8)}`,
            recorded_by: sale.cashier_id,
            created_at: now,
            updated_at: now,
            deleted: 0,
            version: 1
          };
          const ceKeys = Object.keys(creditEntry);
          await tx.execute(
            `INSERT INTO customer_credits (${ceKeys.join(', ')}) VALUES (${ceKeys.map(() => '?').join(', ')})`,
            ceKeys.map(k => (creditEntry as any)[k])
          );
          syncOperations.push({ table: 'customer_credits', recordId: creditEntryId, action: 'INSERT', payload: creditEntry });
        }
      }

      // 4. Add loyalty points (1 point per 10 KES)
      if (sale.customer_id) {
        const pointsEarned = Math.floor(sale.total_amount / 10);
        if (pointsEarned > 0) {
          await tx.execute(
            'UPDATE customers SET loyalty_points = loyalty_points + ?, updated_at = ? WHERE id = ?',
            [pointsEarned, now, sale.customer_id]
          );
        }
      }
    });

    // Queue all sync operations after transaction succeeds
    for (const op of syncOperations) {
      await syncQueue.addToQueue(op.table, op.recordId, op.action, op.payload);
    }
    syncEngine.sync();

    return finalSale;
  },

  /**
   * Fetch recent sales — scoped to supermarket.
   */
  async getRecent(supermarketId: string, limit: number = 50): Promise<Sale[]> {
    const result = await db.execute(
      `SELECT * FROM sales WHERE deleted = 0 AND supermarket_id = ? ORDER BY created_at DESC LIMIT ?`,
      [supermarketId, limit]
    );
    return result.rows.map(row => ({
      ...row,
      deleted: row.deleted === 1,
      total_amount: Number(row.total_amount),
      discount_amount: Number(row.discount_amount),
      tax_amount: Number(row.tax_amount),
      amount_paid: Number(row.amount_paid || 0),
      change_amount: Number(row.change_amount || 0),
    }));
  },

  /**
   * Fetch today's sales — scoped to supermarket.
   */
  async getToday(supermarketId: string, branchId?: string | null): Promise<Sale[]> {
    const today = new Date().toISOString().substring(0, 10);
    const start = `${today}T00:00:00.000Z`;
    const end = `${today}T23:59:59.999Z`;

    let sql = `SELECT * FROM sales WHERE deleted = 0 AND supermarket_id = ? AND hold_status = 'active' AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC`;
    const params: any[] = [supermarketId, start, end];

    if (branchId) {
      sql = `SELECT * FROM sales WHERE deleted = 0 AND supermarket_id = ? AND branch_id = ? AND hold_status = 'active' AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC`;
      params.splice(1, 0, branchId);
    }

    const result = await db.execute(sql, params);
    return result.rows.map(row => ({
      ...row,
      deleted: row.deleted === 1,
      total_amount: Number(row.total_amount),
      discount_amount: Number(row.discount_amount),
      tax_amount: Number(row.tax_amount),
    }));
  },

  /**
   * Void a sale — marks as voided and restores stock.
   */
  async voidSale(saleId: string, voidedBy: string): Promise<void> {
    const now = new Date().toISOString();

    // Get sale items first
    const itemsRes = await db.execute(
      `SELECT product_id, quantity FROM sale_items WHERE sale_id = ? AND deleted = 0`,
      [saleId]
    );

    await db.transaction(async (tx) => {
      // Mark sale as voided
      await tx.execute(
        `UPDATE sales SET hold_status = 'voided', updated_at = ?, version = version + 1 WHERE id = ?`,
        [now, saleId]
      );

      // Restore stock for each item
      for (const item of itemsRes.rows) {
        await tx.execute(
          `UPDATE products SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?`,
          [item.quantity, now, item.product_id]
        );
      }
    });

    // Queue sync
    const saleRes = await db.execute(`SELECT * FROM sales WHERE id = ? LIMIT 1`, [saleId]);
    if (saleRes.rows.length > 0) {
      await syncQueue.addToQueue('sales', saleId, 'UPDATE', saleRes.rows[0]);
    }
    syncEngine.sync();
  },
};
