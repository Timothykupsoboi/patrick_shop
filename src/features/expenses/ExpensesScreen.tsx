import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../components/ThemeProvider';
import { useTenant } from '../../context/TenantContext';
import { usePermission } from '../../rbac/usePermission';
import { useAppSelector } from '../../store';
import { db } from '../../database/driver';
import { generateUUID } from '../../utils/uuid';
import { auditService } from '../../services/auditService';
import { syncQueue } from '../../api/sync/syncQueue';
import { DollarSign, Plus, Search, X, TrendingDown, Calendar, Tag, Trash2 } from 'lucide-react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  reference: string | null;
  recorded_by: string | null;
  expense_date: string;
  created_at: string;
  branch_id: string | null;
}

const EXPENSE_CATEGORIES = [
  'Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies', 'Maintenance',
  'Marketing', 'Insurance', 'Taxes', 'Miscellaneous',
];

// ---------------------------------------------------------------------------
// Expense Form Modal
// ---------------------------------------------------------------------------

interface ExpenseFormProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: Omit<Expense, 'id' | 'created_at' | 'recorded_by'>) => Promise<void>;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ visible, onClose, onSave }) => {
  const { colors, spacing, borderRadius } = useTheme();
  const [description, setDescription] = useState('');
  const [amount, setAmount]           = useState('');
  const [category, setCategory]       = useState(EXPENSE_CATEGORIES[0]);
  const [reference, setReference]     = useState('');
  const [date, setDate]               = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving]           = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setDescription(''); setAmount(''); setReference('');
      setCategory(EXPENSE_CATEGORIES[0]);
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [visible]);

  const handleSave = async () => {
    if (!description.trim()) { alert('Validation: Description is required.'); return; }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) { alert('Validation: Enter a valid amount.'); return; }
    setSaving(true);
    try {
      await onSave({
        description: description.trim(),
        amount: amountNum,
        category,
        reference: reference.trim() || null,
        expense_date: date,
        branch_id: null,
      });
      onClose();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
    sheet: { width: '100%', maxWidth: 480, backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl },
    title: { fontSize: 20, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.lg },
    label: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant, marginBottom: 6 },
    input: {
      borderWidth: 1, borderColor: colors.surfaceVariant, borderRadius: borderRadius.md,
      backgroundColor: colors.background, color: colors.onSurface,
      paddingHorizontal: spacing.md, paddingVertical: 12, marginBottom: spacing.md, fontSize: 15,
    },
    pickerBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderColor: colors.surfaceVariant, borderRadius: borderRadius.md,
      backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingVertical: 12, marginBottom: spacing.md,
    },
    pickerText: { fontSize: 15, color: colors.onSurface },
    pickerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 99 },
    pickerBox: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, width: 300, maxHeight: 400, overflow: 'hidden' },
    pickerItem: { paddingVertical: 14, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.surfaceVariant },
    pickerItemText: { fontSize: 15, color: colors.onSurface },
    row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.surfaceVariant, borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center' },
    saveBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center' },
    btnText: { fontSize: 15, fontWeight: '700' },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <ScrollView style={{ width: '100%', maxWidth: 480 }} contentContainerStyle={s.sheet} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>Record Expense</Text>

          <Text style={s.label}>Description *</Text>
          <TextInput style={s.input} value={description} onChangeText={setDescription} placeholder="e.g. Monthly electricity bill" placeholderTextColor={colors.onSurfaceVariant} />

          <Text style={s.label}>Category *</Text>
          <TouchableOpacity style={s.pickerBtn} onPress={() => setShowCatPicker(true)}>
            <Text style={s.pickerText}>{category}</Text>
            <Tag size={16} color={colors.onSurfaceVariant} />
          </TouchableOpacity>

          <Text style={s.label}>Amount (KES) *</Text>
          <TextInput style={s.input} value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor={colors.onSurfaceVariant} keyboardType="decimal-pad" />

          <Text style={s.label}>Date *</Text>
          <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.onSurfaceVariant} />

          <Text style={s.label}>Reference / Receipt No.</Text>
          <TextInput style={s.input} value={reference} onChangeText={setReference} placeholder="Optional" placeholderTextColor={colors.onSurfaceVariant} />

          <View style={s.row}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={[s.btnText, { color: colors.onSurfaceVariant }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[s.btnText, { color: '#fff' }]}>Recording...</Text>
                </View>
              ) : (
                <Text style={[s.btnText, { color: '#fff' }]}>Record</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {showCatPicker && (
          <View style={s.pickerOverlay}>
            <ScrollView style={s.pickerBox}>
              {EXPENSE_CATEGORIES.map(c => (
                <TouchableOpacity key={c} style={s.pickerItem} onPress={() => { setCategory(c); setShowCatPicker(false); }}>
                  <Text style={[s.pickerItemText, c === category && { color: colors.primary, fontWeight: '700' }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Main Expenses Screen
// ---------------------------------------------------------------------------

export const ExpensesScreen: React.FC = () => {
  const { colors, spacing, borderRadius } = useTheme();
  const { supermarketId, branchId } = useTenant();
  const currentUser = useAppSelector(state => state.auth.currentUser);
  const canManage  = usePermission('manage_expenses');

  const [expenses, setExpenses]   = useState<Expense[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [totalMonth, setTotalMonth]     = useState(0);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await db.execute(
        `SELECT * FROM expenses WHERE supermarket_id = ? AND deleted = 0 ORDER BY expense_date DESC, created_at DESC`,
        [supermarketId]
      );
      const rows = res.rows as Expense[];
      setExpenses(rows);

      // Calculate current month total
      const thisMonth = new Date().toISOString().slice(0, 7);
      const monthTotal = rows
        .filter(e => e.expense_date.startsWith(thisMonth))
        .reduce((sum, e) => sum + e.amount, 0);
      setTotalMonth(monthTotal);
    } catch (e) {
      console.error('Failed to load expenses', e);
    } finally {
      setLoading(false);
    }
  }, [supermarketId]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const handleSave = async (data: Omit<Expense, 'id' | 'created_at' | 'recorded_by'>) => {
    const id  = generateUUID();
    const now = new Date().toISOString();
    try {
      await db.execute(
        `INSERT INTO expenses (id,supermarket_id,branch_id,description,amount,category,reference,recorded_by,expense_date,created_at,updated_at,deleted,version,synced,sync_status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,0,1,0,'pending')`,
        [id, supermarketId, branchId || null, data.description, data.amount, data.category, data.reference, currentUser?.id || null, data.expense_date, now, now]
      );

      const insertedRes = await db.execute(`SELECT * FROM expenses WHERE id = ? LIMIT 1`, [id]);
      if (insertedRes.rows.length > 0) {
        await syncQueue.addToQueue('expenses', id, 'INSERT', insertedRes.rows[0]);
      }
      
      await auditService.log({ action: 'expense_recorded', table_name: 'expenses', record_id: id, new_values: data });
      alert('Success: Expense recorded successfully.');
      setModalVisible(false);
    } catch (e: any) {
      console.error('Failed to save expense', e);
      alert('Save Failed: ' + (e.message || 'An unknown error occurred while saving the expense.'));
    }
    await loadExpenses();
  };

  const handleDelete = (exp: Expense) => {
    Alert.alert('Delete Expense', `Delete "${exp.description}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const now = new Date().toISOString();
            await db.execute(
              `UPDATE expenses SET deleted=1, updated_at=?, synced=0, sync_status='pending' WHERE id=?`,
              [now, exp.id]
            );
            
            const updatedRes = await db.execute(`SELECT * FROM expenses WHERE id = ? LIMIT 1`, [exp.id]);
            if (updatedRes.rows.length > 0) {
              await syncQueue.addToQueue('expenses', exp.id, 'UPDATE', updatedRes.rows[0]);
            }
            
            await auditService.log({ action: 'expense_deleted', table_name: 'expenses', record_id: exp.id });
            alert('Success: Expense deleted successfully.');
            await loadExpenses();
          } catch (e: any) {
            alert('Error: ' + (e.message || 'Failed to delete expense.'));
          }
        },
      },
    ]);
  };

  const filtered = expenses.filter(e =>
    !search || e.description.toLowerCase().includes(search.toLowerCase())
      || e.category.toLowerCase().includes(search.toLowerCase())
      || (e.reference || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalFiltered = filtered.reduce((sum, e) => sum + e.amount, 0);

  const renderExpense = ({ item }: { item: Expense }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderColor: colors.surfaceVariant }]}>
      <View style={[styles.catDot, { backgroundColor: colors.primary }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={[styles.expDesc, { color: colors.onSurface }]} numberOfLines={1}>{item.description}</Text>
          <Text style={[styles.expAmount, { color: colors.error }]}>-KES {item.amount.toLocaleString()}</Text>
        </View>
        <View style={styles.cardRow}>
          <View style={[styles.catBadge, { backgroundColor: colors.primary + '22' }]}>
            <Text style={[styles.catText, { color: colors.primary }]}>{item.category}</Text>
          </View>
          <View style={styles.dateRow}>
            <Calendar size={11} color={colors.onSurfaceVariant} />
            <Text style={[styles.dateText, { color: colors.onSurfaceVariant }]}>{item.expense_date}</Text>
          </View>
        </View>
        {item.reference && <Text style={[styles.refText, { color: colors.onSurfaceVariant }]}>Ref: {item.reference}</Text>}
      </View>
      {canManage && (
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
          <Trash2 size={16} color={colors.error} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.surfaceVariant }]}>
        <View style={styles.headerLeft}>
          <DollarSign size={22} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Expenses</Text>
        </View>
        {canManage && (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            onPress={() => setModalVisible(true)}>
            <Plus size={16} color="#fff" />
            <Text style={styles.addBtnText}>Record Expense</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Summary Cards */}
      <View style={[styles.summaryRow, { backgroundColor: colors.surface, borderBottomColor: colors.surfaceVariant }]}>
        <View style={[styles.summaryCard, { backgroundColor: colors.error + '15', borderRadius: borderRadius.lg }]}>
          <TrendingDown size={18} color={colors.error} />
          <View>
            <Text style={[styles.summaryLabel, { color: colors.onSurfaceVariant }]}>This Month</Text>
            <Text style={[styles.summaryValue, { color: colors.error }]}>KES {totalMonth.toLocaleString()}</Text>
          </View>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.primary + '15', borderRadius: borderRadius.lg }]}>
          <DollarSign size={18} color={colors.primary} />
          <View>
            <Text style={[styles.summaryLabel, { color: colors.onSurfaceVariant }]}>Showing</Text>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>KES {totalFiltered.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.surfaceVariant }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}>
          <Search size={16} color={colors.onSurfaceVariant} />
          <TextInput
            style={[styles.searchInput, { color: colors.onSurface }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search expenses..."
            placeholderTextColor={colors.onSurfaceVariant}
          />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><X size={16} color={colors.onSurfaceVariant} /></TouchableOpacity>}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <DollarSign size={48} color={colors.onSurfaceVariant} />
          <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
            {search ? 'No expenses match your search.' : 'No expenses recorded yet.'}
          </Text>
          {canManage && !search && <Text style={[styles.emptySubText, { color: colors.onSurfaceVariant }]}>Tap "Record Expense" to add one.</Text>}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderExpense}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ExpenseForm visible={modalVisible} onClose={() => setModalVisible(false)} onSave={handleSave} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  summaryRow: { flexDirection: 'row', gap: 12, padding: 16, borderBottomWidth: 1 },
  summaryCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  summaryLabel: { fontSize: 11, fontWeight: '600' },
  summaryValue: { fontSize: 18, fontWeight: '800' },
  searchBar: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  list: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, overflow: 'hidden' },
  catDot: { width: 4, alignSelf: 'stretch' },
  cardBody: { flex: 1, padding: 14 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  expDesc: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  expAmount: { fontSize: 15, fontWeight: '800' },
  catBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  catText: { fontSize: 11, fontWeight: '700' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 11 },
  refText: { fontSize: 11, marginTop: 4 },
  deleteBtn: { padding: 14 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubText: { fontSize: 14, marginTop: 6 },
});
