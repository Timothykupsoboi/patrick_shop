import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Modal, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '../../components/ThemeProvider';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { db } from '../../database/driver';
import { csvExporter } from '../../utils/csvExporter';
import { generateUUID } from '../../utils/uuid';
import { syncQueue } from '../../api/sync/syncQueue';
import { syncEngine } from '../../api/sync/syncEngine';
import { BarChart, Landmark, TrendingUp, AlertTriangle, FileSpreadsheet, Plus, RefreshCw, X, Receipt, Wallet } from 'lucide-react-native';

export const ReportingScreen: React.FC = () => {
  const { colors, spacing, borderRadius, typography } = useTheme();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 768;

  // Report statistics states
  const [salesSum, setSalesSum] = useState<number>(0);
  const [expensesSum, setExpensesSum] = useState<number>(0);
  const [valuationSum, setValuationSum] = useState<number>(0);
  const [expenses, setExpenses] = useState<any[]>([]);

  // Add Expense Modal states
  const [isExpenseModalVisible, setIsExpenseModalVisible] = useState<boolean>(false);
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseCategory, setExpenseCategory] = useState<'rent' | 'electricity' | 'water' | 'transport' | 'salary' | 'maintenance' | 'internet' | 'other'>('other');
  const [expenseDesc, setExpenseDesc] = useState<string>('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState<boolean>(false);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    loadReportsData();
  }, []);

  const loadReportsData = async () => {
    try {
      // 1. Calculate sales summary
      const salesRes = await db.execute("SELECT SUM(total_amount) as total FROM sales WHERE deleted = 0 AND hold_status = 'active'");
      setSalesSum(Number(salesRes.rows[0]?.total || 0));

      // 2. Fetch all expenses
      const expRes = await db.execute("SELECT * FROM expenses WHERE deleted = 0 ORDER BY date DESC");
      setExpenses(expRes.rows);
      let sumExp = 0;
      expRes.rows.forEach(r => sumExp += Number(r.amount));
      setExpensesSum(sumExp);

      // 3. Calculate stock valuation
      const valRes = await db.execute("SELECT SUM(buying_price * current_stock) as val FROM products WHERE deleted = 0");
      setValuationSum(Number(valRes.rows[0]?.val || 0));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddExpense = async () => {
    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    setIsSubmittingExpense(true);
    const id = generateUUID();
    const today = new Date().toISOString().substring(0, 10);
    const now = new Date().toISOString();

    const finalExpense = {
      id,
      category: expenseCategory,
      amount: amt,
      description: expenseDesc || `Shop ${expenseCategory} payment`,
      date: today,
      created_at: now,
      updated_at: now,
      deleted: 0,
      version: 1
    };

    const keys = Object.keys(finalExpense);
    const values = keys.map(k => (finalExpense as any)[k]);

    try {
      // Write to local SQLite
      const placeholders = keys.map(() => '?').join(', ');
      await db.execute(
        `INSERT INTO expenses (${keys.join(', ')}) VALUES (${placeholders})`,
        values
      );

      // Add to sync queue
      await syncQueue.addToQueue('expenses', id, 'INSERT', finalExpense);
      syncEngine.sync();

      Alert.alert('Success', 'Expense recorded successfully.');
      setIsExpenseModalVisible(false);
      setExpenseAmount('');
      setExpenseDesc('');
      loadReportsData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to record expense.');
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  // ----------------------------------------------------
  // CSV Exporter Triggers
  // ----------------------------------------------------
  const handleExportSales = async () => {
    setExporting('sales');
    try {
      const res = await db.execute("SELECT id, total_amount, payment_method, payment_status, created_at FROM sales WHERE deleted = 0");
      const headers = ['Sale ID', 'Total Amount (KES)', 'Payment Method', 'Status', 'Date'];
      const rows = res.rows.map(s => [s.id, s.total_amount, s.payment_method, s.payment_status, s.created_at]);
      await csvExporter.export(`sales_report_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
      Alert.alert('Success', 'Sales register report exported successfully.');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to export sales register.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportStock = async () => {
    setExporting('stock');
    try {
      const res = await db.execute("SELECT sku, name, current_stock, buying_price, selling_price FROM products WHERE deleted = 0");
      const headers = ['SKU', 'Product Name', 'Stock Count', 'Buying Price', 'Selling Price', 'Total Valuation'];
      const rows = res.rows.map(p => [p.sku, p.name, p.current_stock, p.buying_price, p.selling_price, p.current_stock * p.buying_price]);
      await csvExporter.export(`inventory_valuation_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
      Alert.alert('Success', 'Inventory valuation report exported successfully.');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to export inventory valuation.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportExpenses = async () => {
    setExporting('expenses');
    try {
      const res = await db.execute("SELECT category, amount, description, date FROM expenses WHERE deleted = 0");
      const headers = ['Category', 'Amount (KES)', 'Description', 'Date'];
      const rows = res.rows.map(e => [e.category, e.amount, e.description, e.date]);
      await csvExporter.export(`expenses_report_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
      Alert.alert('Success', 'Overhead expenses report exported successfully.');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message || 'Failed to export overhead expenses.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.contentContainer}>
      
      <View style={styles.header}>
        <View>
          <Text style={{ fontSize: typography.sizes.h2, fontWeight: 'bold', color: colors.onSurface }}>
            Financial Reports & Audits
          </Text>
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 14 }}>
            Review mini-supermarket margins, catalog valuations, and operational overhead expenses.
          </Text>
        </View>

        <Button
          title="Log Business Expense"
          icon={<Plus size={16} color={colors.onPrimary} style={{ marginRight: 6 }} />}
          onPress={() => setIsExpenseModalVisible(true)}
        />
      </View>

      {/* Overview Cards Row */}
      <View style={[styles.statsRow, isDesktop && styles.statsRowDesktop]}>
        
        {/* Sales */}
        <Card style={styles.statCard}>
          <TrendingUp size={24} color={colors.primary} />
          <Text style={{ fontSize: 13, color: colors.onSurfaceVariant, marginTop: 8 }}>Cumulative Sales Turnover</Text>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.primary, marginTop: 4 }}>
            KES {salesSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        </Card>

        {/* Expenses */}
        <Card style={styles.statCard}>
          <Wallet size={24} color={colors.error} />
          <Text style={{ fontSize: 13, color: colors.onSurfaceVariant, marginTop: 8 }}>Logged Business Expenses</Text>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.error, marginTop: 4 }}>
            KES {expensesSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        </Card>

        {/* Valuation */}
        <Card style={styles.statCard}>
          <Landmark size={24} color={colors.secondary} />
          <Text style={{ fontSize: 13, color: colors.onSurfaceVariant, marginTop: 8 }}>Total Inventory Valuation (Cost)</Text>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.success, marginTop: 4 }}>
            KES {valuationSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        </Card>

      </View>

      <View style={[styles.mainLayout, isDesktop && styles.mainLayoutDesktop]}>
        
        {/* Left Side: CSV Export Panel */}
        <View style={styles.leftCol}>
          <Card style={[styles.card, { minHeight: 300 }]}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.onSurface, marginBottom: 16 }}>
              CSV Data Exporters
            </Text>
            
            <View style={styles.exportList}>
              <TouchableOpacity 
                onPress={handleExportSales} 
                disabled={exporting !== null}
                style={[styles.exportBtn, { borderColor: colors.surfaceVariant, opacity: exporting !== null ? 0.5 : 1 }]}
              >
                {exporting === 'sales' ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 12 }} />
                ) : (
                  <FileSpreadsheet size={20} color={colors.primary} style={{ marginRight: 12 }} />
                )}
                <Text style={{ color: colors.onSurface, fontWeight: '500' }}>
                  {exporting === 'sales' ? 'Exporting Sales...' : 'Export Sales Register'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleExportStock} 
                disabled={exporting !== null}
                style={[styles.exportBtn, { borderColor: colors.surfaceVariant, opacity: exporting !== null ? 0.5 : 1 }]}
              >
                {exporting === 'stock' ? (
                  <ActivityIndicator size="small" color={colors.success} style={{ marginRight: 12 }} />
                ) : (
                  <FileSpreadsheet size={20} color={colors.success} style={{ marginRight: 12 }} />
                )}
                <Text style={{ color: colors.onSurface, fontWeight: '500' }}>
                  {exporting === 'stock' ? 'Exporting Stock...' : 'Export Stock Valuation'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleExportExpenses} 
                disabled={exporting !== null}
                style={[styles.exportBtn, { borderColor: colors.surfaceVariant, opacity: exporting !== null ? 0.5 : 1 }]}
              >
                {exporting === 'expenses' ? (
                  <ActivityIndicator size="small" color={colors.error} style={{ marginRight: 12 }} />
                ) : (
                  <FileSpreadsheet size={20} color={colors.error} style={{ marginRight: 12 }} />
                )}
                <Text style={{ color: colors.onSurface, fontWeight: '500' }}>
                  {exporting === 'expenses' ? 'Exporting Expenses...' : 'Export Overhead Expenses'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* Right Side: Expense Ledger Log */}
        <View style={styles.rightCol}>
          <Card style={[styles.card, { minHeight: 300 }]}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.onSurface, marginBottom: 16 }}>
              Expense Ledger Log
            </Text>

            <ScrollView style={{ maxHeight: 350 }}>
              {expenses.length === 0 ? (
                <Text style={{ color: colors.outline, textAlign: 'center', marginTop: 40 }}>
                  No operational expenses logged.
                </Text>
              ) : (
                expenses.map((item) => (
                  <View key={item.id} style={[styles.expenseRow, { borderBottomColor: colors.surfaceVariant }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '500', color: colors.onSurface }}>
                        {item.description}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.outline, marginTop: 2 }}>
                        Category: {item.category.toUpperCase()} • Date: {item.date}
                      </Text>
                    </View>
                    <Text style={{ color: colors.error, fontWeight: 'bold' }}>
                      -KES {Number(item.amount).toFixed(2)}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </Card>
        </View>

      </View>

      {/* LOG EXPENSE MODAL */}
      <Modal visible={isExpenseModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <Card elevation="lg" style={[styles.modalCard, { width: isDesktop ? 480 : '95%' }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: typography.sizes.h3, fontWeight: 'bold', color: colors.onSurface }}>
                Record Shop Expense
              </Text>
              <TouchableOpacity onPress={() => setIsExpenseModalVisible(false)}>
                <X size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <View style={styles.categoryDropdownRow}>
              {(['rent', 'electricity', 'water', 'salary', 'internet', 'other'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setExpenseCategory(cat)}
                  style={[
                    styles.catTab,
                    {
                      borderColor: expenseCategory === cat ? colors.primary : colors.outline,
                      backgroundColor: expenseCategory === cat ? colors.primaryContainer : 'transparent',
                      borderRadius: borderRadius.sm
                    }
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.onSurface }}>
                    {cat.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Expense Amount (KES)"
              value={expenseAmount}
              onChangeText={setExpenseAmount}
              keyboardType="decimal-pad"
              placeholder="e.g. 3500"
              style={{ marginBottom: 12 }}
            />

            <Input
              label="Expense Description / Details"
              value={expenseDesc}
              onChangeText={setExpenseDesc}
              placeholder="e.g. June Internet Subscription"
              style={{ marginBottom: 20 }}
            />

            <Button
              title="Record Expense"
              onPress={handleAddExpense}
              loading={isSubmittingExpense}
              style={{ width: '100%', height: 48 }}
            />
          </Card>
        </View>
      </Modal>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'column',
    rowGap: 16,
    marginBottom: 24,
  },
  statsRowDesktop: {
    flexDirection: 'row',
    columnGap: 16,
    rowGap: 0,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  mainLayout: {
    flexDirection: 'column',
    rowGap: 24,
  },
  mainLayoutDesktop: {
    flexDirection: 'row',
    columnGap: 24,
    rowGap: 0,
  },
  leftCol: {
    flex: 1,
  },
  rightCol: {
    flex: 1.2,
  },
  card: {
    padding: 20,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  exportList: {
    rowGap: 12,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    padding: 24,
    borderWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  categoryDropdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 6,
    rowGap: 8,
    marginBottom: 16,
  },
  catTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
