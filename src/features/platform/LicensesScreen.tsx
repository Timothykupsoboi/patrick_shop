import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, Alert, ScrollView, ActivityIndicator, Clipboard,
} from 'react-native';
import { useTheme } from '../../components/ThemeProvider';
import { db } from '../../database/driver';
import { generateUUID } from '../../utils/uuid';
import { supabase } from '../../api/supabase';
import { Key, Plus, Search, X, RefreshCw, Copy, CheckCircle, XCircle, Building2 } from 'lucide-react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface License {
  id: string;
  supermarket_id: string;
  supermarket_name: string;
  license_key: string;
  subscription_status: string;
  subscription_plan: string;
}

// ---------------------------------------------------------------------------
// License Screen
// ---------------------------------------------------------------------------

export const LicensesScreen: React.FC = () => {
  const { colors, spacing, borderRadius } = useTheme();
  const [licenses, setLicenses]         = useState<License[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [generating, setGenerating]     = useState<string | null>(null);
  const [copiedKey, setCopiedKey]       = useState<string | null>(null);
  const [revoking, setRevoking]         = useState<string | null>(null);

  const loadLicenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await db.execute(
        `SELECT id, name, license_key, subscription_status, subscription_plan FROM supermarkets WHERE deleted = 0 ORDER BY name`,
        []
      );
      setLicenses(res.rows.map((r: any) => ({
        id: r.id,
        supermarket_id: r.id,
        supermarket_name: r.name,
        license_key: r.license_key || '',
        subscription_status: r.subscription_status,
        subscription_plan: r.subscription_plan,
      })));
    } catch (e) { console.error('Failed to load licenses', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadLicenses(); }, [loadLicenses]);

  const generateLicenseKey = (): string => {
    const chars  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segment = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${segment(5)}-${segment(5)}-${segment(5)}-${segment(5)}`;
  };

  const handleGenerate = async (smId: string, smName: string) => {
    Alert.alert(
      'Generate License Key',
      `Generate a new license key for ${smName}? This will replace any existing key.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            setGenerating(smId);
            try {
              const key = generateLicenseKey();
              const now = new Date().toISOString();
              await db.execute(
                `UPDATE supermarkets SET license_key=?, subscription_status='active', updated_at=?, version=version+1, synced=0, sync_status='pending' WHERE id=?`,
                [key, now, smId]
              );
              const { error } = await supabase.from('supermarkets').update({ license_key: key, subscription_status: 'active', updated_at: now }).eq('id', smId);
              if (error) throw new Error(error.message);
              await loadLicenses();
              Alert.alert('License Generated', `Key: ${key}\nStore is now Active!`);
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setGenerating(null);
            }
          },
        },
      ]
    );
  };

  const handleCopy = (key: string) => {
    try {
      Clipboard.setString(key);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      Alert.alert('Copied', key);
    }
  };

  const handleRevoke = async (smId: string, smName: string) => {
    Alert.alert(
      'Revoke License',
      `Revoke the license key for ${smName}? The store will lose access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke', style: 'destructive',
          onPress: async () => {
            setRevoking(smId);
            try {
              const now = new Date().toISOString();
              await db.execute(
                `UPDATE supermarkets SET license_key=null, subscription_status='suspended', updated_at=?, version=version+1, synced=0, sync_status='pending' WHERE id=?`,
                [now, smId]
              );
              const { error } = await supabase.from('supermarkets').update({ license_key: null, subscription_status: 'suspended', updated_at: now }).eq('id', smId);
              if (error) throw new Error(error.message);
              Alert.alert('Success', 'License revoked. Store is now Suspended.');
              await loadLicenses();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to revoke license.');
            } finally {
              setRevoking(null);
            }
          },
        },
      ]
    );
  };

  const STATUS_COLORS: Record<string, string> = {
    trial: '#f59e0b', active: '#10b981', expired: '#ef4444', suspended: '#6b7280',
  };

  const filtered = licenses.filter(l =>
    !search || l.supermarket_name.toLowerCase().includes(search.toLowerCase())
      || (l.license_key || '').toLowerCase().includes(search.toLowerCase())
  );

  const withKeyCount    = licenses.filter(l => !!l.license_key).length;
  const withoutKeyCount = licenses.filter(l => !l.license_key).length;

  const renderItem = ({ item }: { item: License }) => {
    const hasKey     = !!item.license_key;
    const statusColor = STATUS_COLORS[item.subscription_status] || '#6b7280';
    const isCopied   = copiedKey === item.license_key;

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderColor: colors.surfaceVariant }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: hasKey ? colors.primary + '22' : colors.error + '15' }]}>
            {hasKey
              ? <Key size={16} color={colors.primary} />
              : <XCircle size={16} color={colors.error} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.smName, { color: colors.onSurface }]}>{item.supermarket_name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{item.subscription_status.toUpperCase()} · {item.subscription_plan.replace('_', ' ').toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {hasKey && (
          <View style={[styles.keyBox, { backgroundColor: colors.background, borderColor: colors.surfaceVariant }]}>
            <Text style={[styles.keyText, { color: colors.primary }]} selectable>{item.license_key}</Text>
            <TouchableOpacity onPress={() => handleCopy(item.license_key)}>
              {isCopied
                ? <CheckCircle size={16} color={colors.success || '#10b981'} />
                : <Copy size={16} color={colors.onSurfaceVariant} />}
            </TouchableOpacity>
          </View>
        )}

        {!hasKey && (
          <Text style={[styles.noKeyText, { color: colors.error }]}>No license key assigned</Text>
        )}

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            onPress={() => handleGenerate(item.supermarket_id, item.supermarket_name)}
            disabled={generating === item.supermarket_id || revoking === item.supermarket_id}>
            {generating === item.supermarket_id ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.actionBtnText}>Generating...</Text>
              </View>
            ) : (
              <>
                <RefreshCw size={13} color="#fff" />
                <Text style={styles.actionBtnText}>{hasKey ? 'Regenerate' : 'Generate Key'}</Text>
              </>
            )}
          </TouchableOpacity>
          {hasKey && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.error + '15', borderRadius: borderRadius.md, opacity: (revoking === item.supermarket_id || generating === item.supermarket_id) ? 0.5 : 1 }]}
              onPress={() => handleRevoke(item.supermarket_id, item.supermarket_name)}
              disabled={generating === item.supermarket_id || revoking === item.supermarket_id}>
              {revoking === item.supermarket_id ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator size="small" color={colors.error} />
                  <Text style={[styles.actionBtnText, { color: colors.error }]}>Revoking...</Text>
                </View>
              ) : (
                <>
                  <XCircle size={13} color={colors.error} />
                  <Text style={[styles.actionBtnText, { color: colors.error }]}>Revoke</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.surfaceVariant }]}>
        <View style={styles.headerLeft}>
          <Key size={22} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Licenses</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={[styles.statsRow, { borderBottomColor: colors.surfaceVariant }]}>
        <View style={[styles.statCard, { backgroundColor: colors.primary + '15', borderRadius: borderRadius.lg }]}>
          <CheckCircle size={16} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.primary }]}>{withKeyCount}</Text>
          <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Licensed</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.error + '15', borderRadius: borderRadius.lg }]}>
          <XCircle size={16} color={colors.error} />
          <Text style={[styles.statValue, { color: colors.error }]}>{withoutKeyCount}</Text>
          <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>No License</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.lg }]}>
          <Building2 size={16} color={colors.onSurfaceVariant} />
          <Text style={[styles.statValue, { color: colors.onSurface }]}>{licenses.length}</Text>
          <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Total</Text>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.surfaceVariant }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}>
          <Search size={16} color={colors.onSurfaceVariant} />
          <TextInput style={[styles.searchInput, { color: colors.onSurface }]} value={search} onChangeText={setSearch} placeholder="Search by store or key..." placeholderTextColor={colors.onSurfaceVariant} />
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
              <Key size={48} color={colors.onSurfaceVariant} />
              <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>No licenses found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 12, padding: 16, borderBottomWidth: 1 },
  statCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600' },
  searchBar: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  list: { padding: 16, gap: 12 },
  card: { borderWidth: 1, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  smName: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: '700' },
  keyBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, gap: 8 },
  keyText: { fontSize: 13, fontWeight: '700', fontFamily: 'monospace', flex: 1 },
  noKeyText: { fontSize: 13, fontStyle: 'italic', marginBottom: 10 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, minHeight: 200 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
});
