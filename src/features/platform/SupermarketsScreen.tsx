import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, Alert, ScrollView, ActivityIndicator, Switch,
} from 'react-native';
import { useTheme } from '../../components/ThemeProvider';
import { db } from '../../database/driver';
import { generateUUID } from '../../utils/uuid';
import { auditService } from '../../services/auditService';
import { supabase } from '../../api/supabase';
import {
  Building2, Plus, Search, X, RefreshCw, ToggleLeft, ToggleRight,
  Phone, Mail, MapPin, CreditCard, Calendar, Eye, Edit3, Trash2,
} from 'lucide-react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Supermarket {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  subscription_plan: 'free_trial' | 'monthly' | 'annual';
  subscription_status: 'trial' | 'active' | 'expired' | 'suspended';
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  license_key: string | null;
  max_branches: number;
  max_users: number;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  trial:     '#f59e0b',
  active:    '#10b981',
  expired:   '#ef4444',
  suspended: '#6b7280',
};

const PLAN_LABELS: Record<string, string> = {
  free_trial: 'Free Trial',
  monthly:    'Monthly',
  annual:     'Annual',
};

// ---------------------------------------------------------------------------
// Add Supermarket Modal
// ---------------------------------------------------------------------------

interface AddSupermarketModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: Partial<Supermarket> & { admin_name: string; admin_email: string; admin_password: string }) => Promise<void>;
}

const AddSupermarketModal: React.FC<AddSupermarketModalProps> = ({ visible, onClose, onSave }) => {
  const { colors, spacing, borderRadius } = useTheme();
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [email, setEmail]       = useState('');
  const [address, setAddress]   = useState('');
  const [plan, setPlan]         = useState<'free_trial' | 'monthly' | 'annual'>('free_trial');
  const [adminName, setAdminName]       = useState('');
  const [adminEmail, setAdminEmail]     = useState('');
  const [adminPassword, setAdminPass]   = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (visible) {
      setName(''); setPhone(''); setEmail(''); setAddress('');
      setPlan('free_trial'); setAdminName(''); setAdminEmail(''); setAdminPass('');
    }
  }, [visible]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Validation', 'Supermarket name is required.'); return; }
    if (!adminName.trim() || !adminEmail.trim() || adminPassword.length < 6) {
      Alert.alert('Validation', 'Admin name, email and password (min 6 chars) are required.'); return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, address: address.trim() || null, subscription_plan: plan, admin_name: adminName.trim(), admin_email: adminEmail.trim(), admin_password: adminPassword });
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setSaving(false); }
  };

  const planOptions: Array<'free_trial' | 'monthly' | 'annual'> = ['free_trial', 'monthly', 'annual'];

  const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
    sheet: { width: '100%', maxWidth: 520, backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl },
    title: { fontSize: 20, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.lg },
    section: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 10, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 },
    label: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant, marginBottom: 6 },
    input: {
      borderWidth: 1, borderColor: colors.surfaceVariant, borderRadius: borderRadius.md,
      backgroundColor: colors.background, color: colors.onSurface,
      paddingHorizontal: spacing.md, paddingVertical: 12, marginBottom: spacing.md, fontSize: 15,
    },
    planRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
    planBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 2, borderRadius: borderRadius.md },
    planText: { fontSize: 13, fontWeight: '700' },
    row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.surfaceVariant, borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center' },
    saveBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center' },
    btnText: { fontSize: 15, fontWeight: '700' },
    divider: { height: 1, backgroundColor: colors.surfaceVariant, marginVertical: 16 },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <ScrollView style={{ width: '100%', maxWidth: 520 }} contentContainerStyle={s.sheet} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>Create Supermarket</Text>

          <Text style={s.section}>Store Details</Text>
          <Text style={s.label}>Supermarket Name *</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Kenyatta Supermarket" placeholderTextColor={colors.onSurfaceVariant} />
          <Text style={s.label}>Phone</Text>
          <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="+254 700 000 000" placeholderTextColor={colors.onSurfaceVariant} keyboardType="phone-pad" />
          <Text style={s.label}>Email</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="store@example.com" placeholderTextColor={colors.onSurfaceVariant} keyboardType="email-address" autoCapitalize="none" />
          <Text style={s.label}>Address</Text>
          <TextInput style={s.input} value={address} onChangeText={setAddress} placeholder="Town, County" placeholderTextColor={colors.onSurfaceVariant} />

          <Text style={s.label}>Subscription Plan</Text>
          <View style={s.planRow}>
            {planOptions.map(p => (
              <TouchableOpacity key={p} style={[s.planBtn, { borderColor: plan === p ? colors.primary : colors.surfaceVariant, backgroundColor: plan === p ? colors.primary + '22' : colors.background }]} onPress={() => setPlan(p)}>
                <Text style={[s.planText, { color: plan === p ? colors.primary : colors.onSurfaceVariant }]}>{PLAN_LABELS[p]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.divider} />
          <Text style={s.section}>Super Admin Account</Text>
          <Text style={s.label}>Admin Full Name *</Text>
          <TextInput style={s.input} value={adminName} onChangeText={setAdminName} placeholder="e.g. Jane Wanjiru" placeholderTextColor={colors.onSurfaceVariant} />
          <Text style={s.label}>Admin Email *</Text>
          <TextInput style={s.input} value={adminEmail} onChangeText={setAdminEmail} placeholder="admin@store.com" placeholderTextColor={colors.onSurfaceVariant} keyboardType="email-address" autoCapitalize="none" />
          <Text style={s.label}>Admin Password * (min 6 characters)</Text>
          <TextInput style={s.input} value={adminPassword} onChangeText={setAdminPass} placeholder="••••••••" placeholderTextColor={colors.onSurfaceVariant} secureTextEntry />

          <View style={s.row}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={[s.btnText, { color: colors.onSurfaceVariant }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[s.btnText, { color: '#fff' }]}>Creating...</Text>
                </View>
              ) : (
                <Text style={[s.btnText, { color: '#fff' }]}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Main Supermarkets Screen
// ---------------------------------------------------------------------------

export const SupermarketsScreen: React.FC = () => {
  const { colors, spacing, borderRadius } = useTheme();
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing]     = useState(false);

  const loadSupermarkets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await db.execute('SELECT * FROM supermarkets WHERE deleted = 0 ORDER BY name', []);
      setSupermarkets(res.rows as Supermarket[]);
    } catch (e) {
      console.error('Failed to load supermarkets', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSupermarkets(); }, [loadSupermarkets]);

  const handleRefreshFromCloud = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.from('supermarkets').select('*').eq('deleted', false).order('name');
      if (error) throw new Error(error.message);
      if (data) {
        for (const row of data) {
          const now = new Date().toISOString();
          await db.execute(
            `INSERT OR REPLACE INTO supermarkets (id,name,phone,email,address,subscription_plan,subscription_status,trial_ends_at,subscription_ends_at,license_key,max_branches,max_users,created_at,updated_at,deleted,version,synced,sync_status)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,1,'synced')`,
            [row.id, row.name, row.phone, row.email, row.address, row.subscription_plan, row.subscription_status, row.trial_ends_at, row.subscription_ends_at, row.license_key, row.max_branches || 1, row.max_users || 5, row.created_at, row.updated_at || now, row.version || 1]
          );
        }
        await loadSupermarkets();
        Alert.alert('Synced', `${data.length} supermarkets refreshed from cloud.`);
      }
    } catch (e: any) {
      Alert.alert('Sync Failed', e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreate = async (data: Partial<Supermarket> & { admin_name: string; admin_email: string; admin_password: string }) => {
    const now      = new Date().toISOString();
    const smId     = generateUUID() as string;
    const adminId  = generateUUID() as string;
    const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    // Generate a 4-digit PIN for quick local login
    const adminPin = String(Math.floor(1000 + Math.random() * 9000));

    let cloudSuccess = false;

    // 1. Try server-side RPC (creates auth.users + supermarket + admin atomically)
    try {
      const { error: rpcError } = await supabase.rpc('create_supermarket_with_admin', {
        p_supermarket_id:    smId,
        p_name:              data.name,
        p_phone:             data.phone ?? null,
        p_email:             data.email ?? null,
        p_address:           data.address ?? null,
        p_subscription_plan: data.subscription_plan,
        p_trial_ends_at:     trialEnd,
        p_admin_id:          adminId,
        p_admin_name:        data.admin_name,
        p_admin_email:       data.admin_email,
        p_admin_password:    data.admin_password,
      });
      if (!rpcError) {
        cloudSuccess = true;
      } else {
        console.warn('RPC failed, falling back to direct insert:', rpcError.message);
      }
    } catch (e) {
      console.warn('RPC not available, using fallback:', e);
    }

    // 2. Fallback: direct Supabase inserts (if RPC not deployed)
    if (!cloudSuccess) {
      try {
        await supabase.from('supermarkets').upsert({
          id: smId, name: data.name, phone: data.phone, email: data.email,
          address: data.address, subscription_plan: data.subscription_plan,
          subscription_status: 'trial', trial_ends_at: trialEnd,
          max_branches: 1, max_users: 5,
          created_at: now, updated_at: now, deleted: false, version: 1,
        });
        await supabase.from('users').upsert({
          id: adminId, supermarket_id: smId, name: data.admin_name,
          email: data.admin_email, role: 'super_admin', pin: adminPin,
          is_active: true, created_at: now, updated_at: now, deleted: false, version: 1,
        });
      } catch (e) {
        console.warn('Cloud fallback also failed - saving locally only');
      }
    }

    // 3. Save supermarket locally
    await db.execute(
      `INSERT OR REPLACE INTO supermarkets
         (id,name,phone,email,address,subscription_plan,subscription_status,trial_ends_at,max_branches,max_users,created_at,updated_at,deleted,version,synced,sync_status)
       VALUES (?,?,?,?,?,?,?,?,1,5,?,?,0,1,1,'synced')`,
      [smId, data.name, data.phone ?? null, data.email ?? null, data.address ?? null, data.subscription_plan, 'trial', trialEnd, now, now]
    );

    // 4. Save admin user profile locally (with PIN for quick login)
    await db.execute(
      `INSERT OR REPLACE INTO users
         (id,supermarket_id,branch_id,name,email,role,pin,is_active,created_at,updated_at,deleted,version,synced,sync_status)
       VALUES (?,?,null,?,?,'super_admin',?,1,?,?,0,1,1,'synced')`,
      [adminId, smId, data.admin_name, data.admin_email, adminPin, now, now]
    );

    await auditService.log({ action: 'supermarket_created', table_name: 'supermarkets', record_id: smId, new_values: { name: data.name } });
    await loadSupermarkets();

    // 5. Show credentials to platform owner
    Alert.alert(
      '✅ Supermarket Created!',
      `${data.name} has been created successfully.\n\n` +
      `📧 Admin Email: ${data.admin_email}\n` +
      `🔑 Admin Password: ${data.admin_password}\n` +
      `🔢 Quick PIN: ${adminPin}\n\n` +
      `The admin can log in via Email Login tab or use the PIN: ${adminPin}`,
      [{ text: 'OK' }]
    );
  };

  const handleToggleStatus = async (sm: Supermarket) => {
    const isActive  = sm.subscription_status === 'active' || sm.subscription_status === 'trial';
    const newStatus = isActive ? 'suspended' : 'active';
    Alert.alert(
      isActive ? 'Suspend Supermarket' : 'Activate Supermarket',
      `Are you sure you want to ${isActive ? 'suspend' : 'activate'} ${sm.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', style: isActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const now = new Date().toISOString();
              await db.execute(
                `UPDATE supermarkets SET subscription_status=?, updated_at=?, version=version+1, synced=0, sync_status='pending' WHERE id=?`,
                [newStatus, now, sm.id]
              );
              const { error } = await supabase.from('supermarkets').update({ subscription_status: newStatus, updated_at: now }).eq('id', sm.id);
              if (error) throw new Error(error.message);
              await auditService.log({ action: isActive ? 'supermarket_suspended' : 'supermarket_activated', table_name: 'supermarkets', record_id: sm.id });
              Alert.alert('Success', `Supermarket status updated to ${newStatus}.`);
              await loadSupermarkets();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to update status.');
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (sm: Supermarket) => {
    Alert.alert(
      'Delete Supermarket',
      `Are you sure you want to completely delete ${sm.name}?\n\nThis will also delete all users and data associated with it. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              const now = new Date().toISOString();
              
              // 1. Soft delete supermarket locally
              await db.execute(
                `UPDATE supermarkets SET deleted=1, updated_at=?, version=version+1, synced=0, sync_status='pending' WHERE id=?`,
                [now, sm.id]
              );
              
              // 2. Soft delete all associated users locally
              await db.execute(
                `UPDATE users SET deleted=1, updated_at=?, version=version+1, synced=0, sync_status='pending' WHERE supermarket_id=?`,
                [now, sm.id]
              );

              // 3. Update Supabase directly (cascade might handle it on the server, but we do it manually to be safe)
              await supabase.from('supermarkets').update({ deleted: true, updated_at: now }).eq('id', sm.id);
              await supabase.from('users').update({ deleted: true, updated_at: now }).eq('supermarket_id', sm.id);
              
              await auditService.log({ action: 'supermarket_deleted', table_name: 'supermarkets', record_id: sm.id });
              Alert.alert('Success', `${sm.name} has been deleted.`);
              await loadSupermarkets();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete supermarket.');
            }
          },
        },
      ]
    );
  };

  const filtered = supermarkets.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const renderSupermarket = ({ item }: { item: Supermarket }) => {
    const statusColor = STATUS_COLORS[item.subscription_status] || '#6b7280';
    const isActive    = item.subscription_status === 'active' || item.subscription_status === 'trial';
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: borderRadius.xl, borderColor: colors.surfaceVariant, borderLeftColor: statusColor, borderLeftWidth: 4 }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.iconCircle, { backgroundColor: statusColor + '22' }]}>
              <Building2 size={18} color={statusColor} />
            </View>
            <View>
              <Text style={[styles.smName, { color: colors.onSurface }]}>{item.name}</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{item.subscription_status.toUpperCase()}</Text>
                <Text style={[styles.planText, { color: colors.onSurfaceVariant }]}>· {PLAN_LABELS[item.subscription_plan]}</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.toggleBtn, { borderColor: colors.error, backgroundColor: colors.error + '11' }]} onPress={() => handleDelete(item)}>
              <Trash2 size={16} color={colors.error} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, { borderColor: colors.surfaceVariant }]} onPress={() => handleToggleStatus(item)}>
              {isActive ? <ToggleRight size={20} color={statusColor} /> : <ToggleLeft size={20} color={colors.onSurfaceVariant} />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.cardDivider, { backgroundColor: colors.surfaceVariant }]} />

        <View style={styles.detailsGrid}>
          {item.phone && (
            <View style={styles.detail}><Phone size={11} color={colors.onSurfaceVariant} /><Text style={[styles.detailText, { color: colors.onSurfaceVariant }]}>{item.phone}</Text></View>
          )}
          {item.email && (
            <View style={styles.detail}><Mail size={11} color={colors.onSurfaceVariant} /><Text style={[styles.detailText, { color: colors.onSurfaceVariant }]}>{item.email}</Text></View>
          )}
          {item.address && (
            <View style={styles.detail}><MapPin size={11} color={colors.onSurfaceVariant} /><Text style={[styles.detailText, { color: colors.onSurfaceVariant }]}>{item.address}</Text></View>
          )}
          {item.trial_ends_at && item.subscription_status === 'trial' && (
            <View style={styles.detail}><Calendar size={11} color={colors.error} /><Text style={[styles.detailText, { color: colors.error }]}>Trial ends {item.trial_ends_at.split('T')[0]}</Text></View>
          )}
          {item.subscription_ends_at && (
            <View style={styles.detail}><Calendar size={11} color={colors.onSurfaceVariant} /><Text style={[styles.detailText, { color: colors.onSurfaceVariant }]}>Sub ends {item.subscription_ends_at.split('T')[0]}</Text></View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <Text style={[styles.footerText, { color: colors.onSurfaceVariant }]}>Max branches: {item.max_branches} · Max users: {item.max_users}</Text>
          <Text style={[styles.footerText, { color: colors.onSurfaceVariant }]}>Created: {item.created_at.split('T')[0]}</Text>
        </View>
      </View>
    );
  };

  const countByStatus = (status: string) => supermarkets.filter(s => s.subscription_status === status).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.surfaceVariant }]}>
        <View style={styles.headerLeft}>
          <Building2 size={22} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Supermarkets</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.iconBtn, { borderColor: colors.surfaceVariant }]} onPress={handleRefreshFromCloud} disabled={refreshing}>
            <RefreshCw size={16} color={refreshing ? colors.onSurfaceVariant : colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            onPress={() => setModalVisible(true)}>
            <Plus size={16} color="#fff" />
            <Text style={styles.addBtnText}>Add Supermarket</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.statsRow, { borderBottomColor: colors.surfaceVariant }]}>
        {[
          { label: 'Total', value: supermarkets.length, color: colors.primary },
          { label: 'Active', value: countByStatus('active'), color: '#10b981' },
          { label: 'Trial', value: countByStatus('trial'), color: '#f59e0b' },
          { label: 'Expired', value: countByStatus('expired'), color: '#ef4444' },
          { label: 'Suspended', value: countByStatus('suspended'), color: '#6b7280' },
        ].map(stat => (
          <View key={stat.label} style={[styles.statCard, { backgroundColor: stat.color + '15', borderRadius: borderRadius.lg }]}>
            <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>{stat.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.surfaceVariant }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}>
          <Search size={16} color={colors.onSurfaceVariant} />
          <TextInput style={[styles.searchInput, { color: colors.onSurface }]} value={search} onChangeText={setSearch} placeholder="Search supermarkets..." placeholderTextColor={colors.onSurfaceVariant} />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><X size={16} color={colors.onSurfaceVariant} /></TouchableOpacity>}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Building2 size={48} color={colors.onSurfaceVariant} />
          <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
            {search ? 'No supermarkets match your search.' : 'No supermarkets yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderSupermarket}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <AddSupermarketModal visible={modalVisible} onClose={() => setModalVisible(false)} onSave={handleCreate} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 10, borderWidth: 1, borderRadius: 8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 10, padding: 16, borderBottomWidth: 1 },
  statCard: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, minWidth: 80 },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  searchBar: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  list: { padding: 16, gap: 12 },
  card: { borderWidth: 1, padding: 16, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  smName: { fontSize: 16, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  planText: { fontSize: 11 },
  toggleBtn: { padding: 8, borderWidth: 1, borderRadius: 8 },
  cardDivider: { height: 1, marginBottom: 12 },
  detailsGrid: { gap: 6 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  footerText: { fontSize: 11 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
});
