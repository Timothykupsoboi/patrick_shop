import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  useWindowDimensions, ActivityIndicator, Alert
} from 'react-native';
import { useTheme } from '../../components/ThemeProvider';
import { Card } from '../../components/Card';
import { supermarketRepository } from '../../database/repositories/supermarketRepository';
import { db } from '../../database/driver';
import { syncEngine } from '../../api/sync/syncEngine';
import {
  Building2, TrendingUp, CreditCard, AlertTriangle,
  CheckCircle, Clock, RefreshCw, Globe, Users2, Package
} from 'lucide-react-native';

interface PlatformStats {
  total: number;
  active: number;
  trial: number;
  expired: number;
  suspended: number;
}

export const PlatformDashboardScreen: React.FC = () => {
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [stats, setStats] = useState<PlatformStats>({ total: 0, active: 0, trial: 0, expired: 0, suspended: 0 });
  const [totalUsers, setTotalUsers] = useState(0);
  const [recentSupermarkets, setRecentSupermarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, usersRes, recentsRes, syncRes] = await Promise.all([
        supermarketRepository.getPlatformStats(),
        db.execute('SELECT COUNT(*) as count FROM users WHERE deleted = 0'),
        db.execute('SELECT * FROM supermarkets WHERE deleted = 0 ORDER BY created_at DESC LIMIT 5'),
        db.execute('SELECT COUNT(*) as count FROM sync_queue'),
      ]);
      setStats(s);
      setTotalUsers(usersRes.rows[0]?.count || 0);
      setRecentSupermarkets(recentsRes.rows);
      setPendingSync(syncRes.rows[0]?.count || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      await syncEngine.sync();
      await loadData();
      Alert.alert('Success', 'Synchronization completed successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const statCards = [
    {
      label: 'Total Supermarkets',
      value: stats.total,
      icon: Building2,
      color: colors.primary,
      bg: colors.primaryContainer,
    },
    {
      label: 'Active Subscriptions',
      value: stats.active,
      icon: CheckCircle,
      color: '#10B981',
      bg: '#D1FAE5',
    },
    {
      label: 'On Free Trial',
      value: stats.trial,
      icon: Clock,
      color: colors.tertiary,
      bg: colors.tertiaryContainer,
    },
    {
      label: 'Expired / Suspended',
      value: stats.expired + stats.suspended,
      icon: AlertTriangle,
      color: colors.error,
      bg: colors.errorContainer,
    },
    {
      label: 'Total Users',
      value: totalUsers,
      icon: Users2,
      color: '#6366F1',
      bg: '#EDE9FE',
    },
    {
      label: 'Pending Sync',
      value: pendingSync,
      icon: RefreshCw,
      color: pendingSync > 0 ? colors.tertiary : colors.outline,
      bg: pendingSync > 0 ? colors.tertiaryContainer : colors.background,
    },
  ];

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.container, isDesktop && styles.containerDesktop]}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.onSurface }]}>Platform Dashboard</Text>
            <Text style={{ color: colors.outline, fontSize: 13, marginTop: 2 }}>
              Global overview of all supermarkets
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleForceSync}
            disabled={syncing}
            style={[styles.syncBtn, { backgroundColor: colors.primaryContainer, borderRadius: borderRadius.md, opacity: syncing ? 0.6 : 1 }]}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <RefreshCw size={16} color={colors.primary} />
            )}
            <Text style={{ color: colors.primary, fontWeight: '600', marginLeft: 6, fontSize: 13 }}>
              {syncing ? 'Syncing...' : 'Sync'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stat Cards Grid */}
        <View style={[styles.grid, isDesktop && styles.gridDesktop]}>
          {statCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <View
                key={idx}
                style={[
                  styles.statCard,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: borderRadius.lg,
                    ...shadows.sm,
                    flex: isDesktop ? undefined : 1,
                    minWidth: isDesktop ? 200 : '45%',
                  }
                ]}
              >
                <View style={[styles.statIcon, { backgroundColor: card.bg, borderRadius: borderRadius.md }]}>
                  <Icon size={22} color={card.color} />
                </View>
                <Text style={[styles.statValue, { color: colors.onSurface }]}>{card.value}</Text>
                <Text style={{ color: colors.outline, fontSize: 12 }}>{card.label}</Text>
              </View>
            );
          })}
        </View>

        {/* Recent Supermarkets */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderRadius: borderRadius.lg, ...shadows.sm }]}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Recent Supermarkets</Text>
          {recentSupermarkets.length === 0 ? (
            <Text style={{ color: colors.outline, textAlign: 'center', paddingVertical: 20 }}>No supermarkets registered yet.</Text>
          ) : (
            recentSupermarkets.map((sm, idx) => (
              <View
                key={sm.id}
                style={[
                  styles.supermarketRow,
                  idx < recentSupermarkets.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.surfaceVariant }
                ]}
              >
                <View style={[styles.smAvatar, { backgroundColor: colors.primaryContainer }]}>
                  <Building2 size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', color: colors.onSurface }}>{sm.name}</Text>
                  <Text style={{ color: colors.outline, fontSize: 12 }}>{sm.email || 'No email'}</Text>
                </View>
                <View style={[
                  styles.statusChip,
                  {
                    backgroundColor:
                      sm.subscription_status === 'active' ? '#D1FAE5'
                      : sm.subscription_status === 'trial' ? colors.tertiaryContainer
                      : colors.errorContainer,
                    borderRadius: borderRadius.sm,
                  }
                ]}>
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color:
                      sm.subscription_status === 'active' ? '#10B981'
                      : sm.subscription_status === 'trial' ? colors.tertiary
                      : colors.error,
                  }}>
                    {sm.subscription_status.toUpperCase()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 20 },
  containerDesktop: { padding: 28 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold' },
  syncBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridDesktop: { gap: 16 },
  statCard: { padding: 20, gap: 8, alignItems: 'flex-start', minWidth: 150 },
  statIcon: { padding: 10, marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: 'bold' },
  section: { padding: 20, gap: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  supermarketRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  smAvatar: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 4 },
});
