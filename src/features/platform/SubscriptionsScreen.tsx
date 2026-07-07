import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../components/ThemeProvider';
import { db } from '../../database/driver';
import { generateUUID } from '../../utils/uuid';
import { supabase } from '../../api/supabase';
import { CreditCard, RefreshCw, Search, X, Calendar, Check, AlertTriangle, Building2 } from 'lucide-react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Subscription {
  id: string;          // supermarket_id
  name: string;
  subscription_plan: 'free_trial' | 'monthly' | 'annual';
  subscription_status: 'trial' | 'active' | 'expired' | 'suspended';
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
}

const PLAN_LABELS: Record<string, string> = { free_trial: 'Free Trial', monthly: 'Monthly', annual: 'Annual' };
const STATUS_COLORS: Record<string, string> = { trial: '#f59e0b', active: '#10b981', expired: '#ef4444', suspended: '#6b7280' };

interface RenewModalProps {
  visible: boolean;
  subscription: Subscription | null;
  onClose: () => void;
  onRenew: (smId: string, plan: 'monthly' | 'annual', months: number) => Promise<void>;
}

const RenewModal: React.FC<RenewModalProps> = ({ visible, subscription, onClose, onRenew }) => {
  const { colors, spacing, borderRadius } = useTheme();
  const [plan, setPlan]     = useState<'monthly' | 'annual'>('monthly');
  const [months, setMonths] = useState('1');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) { setPlan('monthly'); setMonths('1'); } }, [visible]);

  const handleRenew = async () => {
    const m = parseInt(months, 10);
    if (isNaN(m) || m < 1) { Alert.alert('Validation', 'Enter a valid number of months.'); return; }
    if (!subscription) return;
    setSaving(true);
    try {
      await onRenew(subscription.id, plan, m);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setSaving(false); }
  };

  const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
    sheet: { width: '100%', maxWidth: 400, backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl },
    title: { fontSize: 20, fontWeight: '700', color: colors.onSurface, marginBottom: 4 },
    subTitle: { fontSize: 14, color: colors.onSurfaceVariant, marginBottom: spacing.lg },
    label: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant, marginBottom: 6 },
    input: { borderWidth: 1, borderColor: colors.surfaceVariant, borderRadius: borderRadius.md, backgroundColor: colors.background, color: colors.onSurface, paddingHorizontal: spacing.md, paddingVertical: 12, marginBottom: spacing.md, fontSize: 15 },
    planRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
    planBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 2, borderRadius: borderRadius.md },
    planText: { fontSize: 13, fontWeight: '700' },
    row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.surfaceVariant, borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center' },
    saveBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center' },
    btnText: { fontSize: 15, fontWeight: '700' },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <Text style={s.title}>Renew Subscription</Text>
          <Text style={s.subTitle}>{subscription?.name}</Text>

          <Text style={s.label}>Plan</Text>
          <View style={s.planRow}>
            {(['monthly', 'annual'] as const).map(p => (
              <TouchableOpacity key={p} style={[s.planBtn, { borderColor: plan === p ? colors.primary : colors.surfaceVariant, backgroundColor: plan === p ? colors.primary + '22' : colors.background }]} onPress={() => setPlan(p)}>
                <Text style={[s.planText, { color: plan === p ? colors.primary : colors.onSurfaceVariant }]}>{PLAN_LABELS[p]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Duration (months)</Text>
          <TextInput style={s.input} value={months} onChangeText={setMonths} keyboardType="number-pad" placeholder="1" placeholderTextColor={colors.onSurfaceVariant} />

          <View style={s.row}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={[s.btnText, { color: colors.onSurfaceVariant }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleRenew} disabled={saving}>
              {saving ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[s.btnText, { color: '#fff' }]}>Renewing...</Text>
                </View>
              ) : (
                <Text style={[s.btnText, { color: '#fff' }]}>Renew</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Main Subscriptions Screen
// ---------------------------------------------------------------------------

export const SubscriptionsScreen: React.FC = () => {
  const { colors, spacing, borderRadius } = useTheme();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [renewTarget, setRenewTarget]     = useState<Subscription | null>(null);
  const [refreshing, setRefreshing]       = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await db.execute(
        `SELECT id, name, subscription_plan, subscription_status, trial_ends_at, subscription_ends_at FROM supermarkets WHERE deleted = 0 ORDER BY name`,
        []
      );
      setSubscriptions(res.rows as Subscription[]);
    } catch (e) { console.error('Failed to load subscriptions', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRenew = async (smId: string, plan: 'monthly' | 'annual', months: number) => {
    const now  = new Date();
    const end  = new Date(now);
    end.setMonth(end.getMonth() + months);
    const endStr = end.toISOString();
    const nowStr = now.toISOString();

    await db.execute(
      `UPDATE supermarkets SET subscription_plan=?, subscription_status='active', subscription_ends_at=?, updated_at=?, version=version+1, synced=0, sync_status='pending' WHERE id=?`,
      [plan, endStr, nowStr, smId]
    );
    const { error } = await supabase.from('supermarkets').update({ subscription_plan: plan, subscription_status: 'active', subscription_ends_at: endStr, updated_at: nowStr }).eq('id', smId);
    if (error) throw new Error(error.message);
    Alert.alert('Success', `Subscription renewed until ${endStr.split('T')[0]}`);
    await loadData();
  };

  const filtered = subscriptions.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  const expiredCount  = subscriptions.filter(s => s.subscription_status === 'expired').length;
  const trialCount    = subscriptions.filter(s => s.subscription_status === 'trial').length;
  const activeCount   = subscriptions.filter(s => s.subscription_status === 'active').length;

  const renderItem = ({ item }: { item: Subscription }) => {
    const statusColor = STATUS_COLORS[item.subscription_status] || '#6b7280';
    const isExpiredOrSuspended = item.subscription_status === 'expired' || item.subscription_status === 'suspended';

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderColor: colors.surfaceVariant, borderLeftColor: statusColor, borderLeftWidth: 4 }]}>
        <View style={styles.cardContent}>
          <View style={styles.cardMain}>
            <View style={styles.nameRow}>
              <Building2 size={14} color={statusColor} />
              <Text style={[styles.smName, { color: colors.onSurface }]}>{item.name}</Text>
            </View>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
                <Text style={[styles.badgeText, { color: statusColor }]}>{item.subscription_status.toUpperCase()}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>{PLAN_LABELS[item.subscription_plan]}</Text>
              </View>
            </View>
            {item.trial_ends_at && item.subscription_status === 'trial' && (
              <View style={styles.dateRow}>
                <Calendar size={11} color={colors.error} />
                <Text style={[styles.dateText, { color: colors.error }]}>Trial ends: {item.trial_ends_at.split('T')[0]}</Text>
              </View>
            )}
            {item.subscription_ends_at && (
              <View style={styles.dateRow}>
                <Calendar size={11} color={colors.onSurfaceVariant} />
                <Text style={[styles.dateText, { color: colors.onSurfaceVariant }]}>Subscription ends: {item.subscription_ends_at.split('T')[0]}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.renewBtn, { backgroundColor: isExpiredOrSuspended ? colors.primary : colors.primary + '22', borderRadius: borderRadius.md }]}
            onPress={() => setRenewTarget(item)}>
            <CreditCard size={14} color={isExpiredOrSuspended ? '#fff' : colors.primary} />
            <Text style={[styles.renewText, { color: isExpiredOrSuspended ? '#fff' : colors.primary }]}>Renew</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.surfaceVariant }]}>
        <View style={styles.headerLeft}>
          <CreditCard size={22} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Subscriptions</Text>
        </View>
      </View>

      {/* Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.statsRow, { borderBottomColor: colors.surfaceVariant }]}>
        {[
          { label: 'Total', value: subscriptions.length, color: colors.primary },
          { label: 'Active', value: activeCount, color: '#10b981' },
          { label: 'Trial', value: trialCount, color: '#f59e0b' },
          { label: 'Expired', value: expiredCount, color: '#ef4444' },
        ].map(s => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: s.color + '15', borderRadius: borderRadius.lg }]}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>{s.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Alerts */}
      {expiredCount > 0 && (
        <View style={[styles.alertBanner, { backgroundColor: '#ef4444' + '15', borderColor: '#ef4444' }]}>
          <AlertTriangle size={16} color="#ef4444" />
          <Text style={[styles.alertText, { color: '#ef4444' }]}>{expiredCount} supermarket{expiredCount > 1 ? 's have' : ' has'} expired subscriptions.</Text>
        </View>
      )}

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
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centered}>
              <CreditCard size={48} color={colors.onSurfaceVariant} />
              <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>No subscriptions found.</Text>
            </View>
          }
        />
      )}

      <RenewModal visible={!!renewTarget} subscription={renewTarget} onClose={() => setRenewTarget(null)} onRenew={handleRenew} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10, padding: 16, borderBottomWidth: 1 },
  statCard: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, minWidth: 80 },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 0, padding: 12, borderWidth: 1, borderRadius: 8 },
  alertText: { fontSize: 13, fontWeight: '600' },
  searchBar: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  list: { padding: 16, gap: 10 },
  card: { borderWidth: 1, overflow: 'hidden' },
  cardContent: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  cardMain: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  smName: { fontSize: 15, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dateText: { fontSize: 11 },
  renewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  renewText: { fontSize: 13, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, minHeight: 200 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
});
