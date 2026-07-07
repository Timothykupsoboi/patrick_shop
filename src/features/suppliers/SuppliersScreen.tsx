import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../components/ThemeProvider';
import { useTenant } from '../../context/TenantContext';
import { usePermission } from '../../rbac/usePermission';
import { db } from '../../database/driver';
import { generateUUID } from '../../utils/uuid';
import { auditService } from '../../services/auditService';
import { syncQueue } from '../../api/sync/syncQueue';
import { Truck, Plus, Search, X, Phone, Mail, MapPin, Edit3, Package } from 'lucide-react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  notes: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Supplier Form Modal
// ---------------------------------------------------------------------------

interface SupplierFormProps {
  visible: boolean;
  supplier: Supplier | null;
  onClose: () => void;
  onSave: (data: Partial<Supplier>) => Promise<void>;
}

const SupplierForm: React.FC<SupplierFormProps> = ({ visible, supplier, onClose, onSave }) => {
  const { colors, spacing, borderRadius } = useTheme();
  const [name, setName]             = useState('');
  const [contactPerson, setContact] = useState('');
  const [phone, setPhone]           = useState('');
  const [email, setEmail]           = useState('');
  const [address, setAddress]       = useState('');
  const [paymentTerms, setPayment]  = useState('');
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (supplier) {
      setName(supplier.name);
      setContact(supplier.contact_person || '');
      setPhone(supplier.phone || '');
      setEmail(supplier.email || '');
      setAddress(supplier.address || '');
      setPayment(supplier.payment_terms || '');
      setNotes(supplier.notes || '');
    } else {
      setName(''); setContact(''); setPhone(''); setEmail('');
      setAddress(''); setPayment(''); setNotes('');
    }
  }, [supplier, visible]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Validation', 'Supplier name is required.'); return; }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        contact_person: contactPerson.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        payment_terms: paymentTerms.trim() || null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
    sheet: { width: '100%', maxWidth: 500, backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl },
    title: { fontSize: 20, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.lg },
    label: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant, marginBottom: 6 },
    input: {
      borderWidth: 1, borderColor: colors.surfaceVariant, borderRadius: borderRadius.md,
      backgroundColor: colors.background, color: colors.onSurface,
      paddingHorizontal: spacing.md, paddingVertical: 12, marginBottom: spacing.md, fontSize: 15,
    },
    row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.surfaceVariant, borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center' },
    saveBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center' },
    btnText: { fontSize: 15, fontWeight: '700' },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <ScrollView style={{ width: '100%', maxWidth: 500 }} contentContainerStyle={s.sheet} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>{supplier ? 'Edit Supplier' : 'Add Supplier'}</Text>

          <Text style={s.label}>Supplier Name *</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Unilever Kenya Ltd" placeholderTextColor={colors.onSurfaceVariant} />

          <Text style={s.label}>Contact Person</Text>
          <TextInput style={s.input} value={contactPerson} onChangeText={setContact} placeholder="e.g. John Kariuki" placeholderTextColor={colors.onSurfaceVariant} />

          <Text style={s.label}>Phone</Text>
          <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="+254 700 000 000" placeholderTextColor={colors.onSurfaceVariant} keyboardType="phone-pad" />

          <Text style={s.label}>Email</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="supplier@example.com" placeholderTextColor={colors.onSurfaceVariant} keyboardType="email-address" autoCapitalize="none" />

          <Text style={s.label}>Address</Text>
          <TextInput style={s.input} value={address} onChangeText={setAddress} placeholder="e.g. Industrial Area, Nairobi" placeholderTextColor={colors.onSurfaceVariant} />

          <Text style={s.label}>Payment Terms</Text>
          <TextInput style={s.input} value={paymentTerms} onChangeText={setPayment} placeholder="e.g. Net 30 days" placeholderTextColor={colors.onSurfaceVariant} />

          <Text style={s.label}>Notes</Text>
          <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder="Additional notes..." placeholderTextColor={colors.onSurfaceVariant} multiline />

          <View style={s.row}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={[s.btnText, { color: colors.onSurfaceVariant }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[s.btnText, { color: '#fff' }]}>Saving...</Text>
                </View>
              ) : (
                <Text style={[s.btnText, { color: '#fff' }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Main Suppliers Screen
// ---------------------------------------------------------------------------

export const SuppliersScreen: React.FC = () => {
  const { colors, spacing, borderRadius } = useTheme();
  const { supermarketId } = useTenant();
  const canManage = usePermission('manage_suppliers');

  const [suppliers, setSuppliers]       = useState<Supplier[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSupplier, setEditing]   = useState<Supplier | null>(null);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await db.execute(
        `SELECT * FROM suppliers WHERE supermarket_id = ? AND deleted = 0 ORDER BY name`,
        [supermarketId]
      );
      setSuppliers(res.rows as Supplier[]);
    } catch (e) {
      console.error('Failed to load suppliers', e);
    } finally {
      setLoading(false);
    }
  }, [supermarketId]);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const handleSave = async (data: Partial<Supplier>) => {
    const now = new Date().toISOString();
    if (editingSupplier) {
      await db.execute(
        `UPDATE suppliers SET name=?,contact_person=?,phone=?,email=?,address=?,payment_terms=?,notes=?,updated_at=?,version=version+1,synced=0,sync_status='pending' WHERE id=?`,
        [data.name, data.contact_person, data.phone, data.email, data.address, data.payment_terms, data.notes, now, editingSupplier.id]
      );
      const updatedRes = await db.execute(`SELECT * FROM suppliers WHERE id = ? LIMIT 1`, [editingSupplier.id]);
      if (updatedRes.rows.length > 0) {
        await syncQueue.addToQueue('suppliers', editingSupplier.id, 'UPDATE', updatedRes.rows[0]);
      }
      await auditService.log({ action: 'supplier_updated', table_name: 'suppliers', record_id: editingSupplier.id, new_values: data });
    } else {
      const id = generateUUID();
      await db.execute(
        `INSERT INTO suppliers (id,supermarket_id,name,contact_person,phone,email,address,payment_terms,notes,created_at,updated_at,deleted,version,synced,sync_status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,0,1,0,'pending')`,
        [id, supermarketId, data.name, data.contact_person, data.phone, data.email, data.address, data.payment_terms, data.notes, now, now]
      );
      const insertedRes = await db.execute(`SELECT * FROM suppliers WHERE id = ? LIMIT 1`, [id]);
      if (insertedRes.rows.length > 0) {
        await syncQueue.addToQueue('suppliers', id, 'INSERT', insertedRes.rows[0]);
      }
      await auditService.log({ action: 'supplier_created', table_name: 'suppliers', record_id: id, new_values: data });
    }
    Alert.alert('Success', 'Supplier saved successfully.');
    await loadSuppliers();
  };

  const filtered = suppliers.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
      || (s.contact_person || '').toLowerCase().includes(search.toLowerCase())
      || (s.phone || '').includes(search)
  );

  const renderSupplier = ({ item }: { item: Supplier }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderColor: colors.surfaceVariant }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.primary + '22' }]}>
        <Truck size={20} color={colors.primary} />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.supplierName, { color: colors.onSurface }]} numberOfLines={1}>{item.name}</Text>
        {item.contact_person && (
          <Text style={[styles.contactText, { color: colors.onSurfaceVariant }]}>{item.contact_person}</Text>
        )}
        <View style={styles.detailsRow}>
          {item.phone && (
            <View style={styles.detail}>
              <Phone size={11} color={colors.onSurfaceVariant} />
              <Text style={[styles.detailText, { color: colors.onSurfaceVariant }]}>{item.phone}</Text>
            </View>
          )}
          {item.email && (
            <View style={styles.detail}>
              <Mail size={11} color={colors.onSurfaceVariant} />
              <Text style={[styles.detailText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{item.email}</Text>
            </View>
          )}
          {item.address && (
            <View style={styles.detail}>
              <MapPin size={11} color={colors.onSurfaceVariant} />
              <Text style={[styles.detailText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{item.address}</Text>
            </View>
          )}
        </View>
        {item.payment_terms && (
          <View style={[styles.termsBadge, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.termsText, { color: colors.primary }]}>{item.payment_terms}</Text>
          </View>
        )}
      </View>
      {canManage && (
        <TouchableOpacity
          style={[styles.editBtn, { borderColor: colors.surfaceVariant }]}
          onPress={() => { setEditing(item); setModalVisible(true); }}>
          <Edit3 size={15} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.surfaceVariant }]}>
        <View style={styles.headerLeft}>
          <Truck size={22} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Suppliers</Text>
        </View>
        {canManage && (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            onPress={() => { setEditing(null); setModalVisible(true); }}>
            <Plus size={16} color="#fff" />
            <Text style={styles.addBtnText}>Add Supplier</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.surfaceVariant }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}>
          <Search size={16} color={colors.onSurfaceVariant} />
          <TextInput
            style={[styles.searchInput, { color: colors.onSurface }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search suppliers..."
            placeholderTextColor={colors.onSurfaceVariant}
          />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><X size={16} color={colors.onSurfaceVariant} /></TouchableOpacity>}
        </View>
      </View>

      {/* Stats bar */}
      <View style={[styles.statsBar, { backgroundColor: colors.surface, borderBottomColor: colors.surfaceVariant }]}>
        <Text style={[styles.statsText, { color: colors.onSurfaceVariant }]}>{filtered.length} supplier{filtered.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Package size={48} color={colors.onSurfaceVariant} />
          <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
            {search ? 'No suppliers match your search.' : 'No suppliers added yet.'}
          </Text>
          {canManage && !search && <Text style={[styles.emptySubText, { color: colors.onSurfaceVariant }]}>Tap "Add Supplier" to add your first supplier.</Text>}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderSupplier}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <SupplierForm
        visible={modalVisible}
        supplier={editingSupplier}
        onClose={() => { setModalVisible(false); setEditing(null); }}
        onSave={handleSave}
      />
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
  searchBar: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  statsBar: { paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1 },
  statsText: { fontSize: 13 },
  list: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, padding: 14, gap: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  supplierName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  contactText: { fontSize: 13, marginBottom: 6 },
  detailsRow: { gap: 4 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailText: { fontSize: 12 },
  termsBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 6 },
  termsText: { fontSize: 11, fontWeight: '600' },
  editBtn: { padding: 8, borderWidth: 1, borderRadius: 8, marginLeft: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubText: { fontSize: 14, marginTop: 6 },
});
