import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, useWindowDimensions,
  TouchableOpacity, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useTheme } from '../../components/ThemeProvider';
import { Card } from '../../components/Card';
import { db } from '../../database/driver';
import { syncEngine } from '../../api/sync/syncEngine';
import { useTenant } from '../../context/TenantContext';
import { useAppSelector } from '../../store';
import {
  TrendingUp, TrendingDown, Users, AlertTriangle, CloudCheck, CloudLightning,
  DollarSign, Package, ShoppingBag, RefreshCw, Bell, CheckCircle, Clock,
  BarChart2, ArrowUpRight, ArrowDownRight, ChevronRight, Boxes,
} from 'lucide-react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Notification {
  id: string;
  type: 'low_stock' | 'sale' | 'purchase' | 'info' | 'warning';
  title: string;
  body: string;
  time: string;
  read: boolean;
}

interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  current_stock: number;
  minimum_stock: number;
}

interface TopProduct {
  name: string;
  total_qty: number;
  total_revenue: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini bar chart component (no external deps)
// ─────────────────────────────────────────────────────────────────────────────
const MiniBarChart: React.FC<{
  data: number[];
  labels: string[];
  height?: number;
  color: string;
  labelColor: string;
}> = ({ data, labels, height = 140, color, labelColor }) => {
  const maxVal = Math.max(...data, 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: height + 28 }}>
      {data.map((val, i) => {
        const barH = Math.max(6, (val / maxVal) * height);
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: labelColor, marginBottom: 2 }}>
              {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val > 0 ? val : ''}
            </Text>
            <View style={{ width: '70%', height: barH, backgroundColor: color, borderRadius: 4 }} />
            <Text style={{ fontSize: 10, color: labelColor, marginTop: 4, fontWeight: '500' }}>
              {labels[i]}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Mini Sparkline (last 7 day trend line using View approximation)
// ─────────────────────────────────────────────────────────────────────────────
const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  const max = Math.max(...data, 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 28, gap: 2 }}>
      {data.map((v, i) => (
        <View
          key={i}
          style={{ flex: 1, height: Math.max(3, (v / max) * 28), backgroundColor: color, borderRadius: 2, opacity: 0.6 + (i / data.length) * 0.4 }}
        />
      ))}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────
export const DashboardScreen: React.FC = () => {
  const { colors, spacing, borderRadius, typography } = useTheme();
  const { width } = useWindowDimensions();
  const { supermarketId } = useTenant();
  const currentUser = useAppSelector((s) => s.auth.currentUser);
  const isDesktop = width >= 768;

  // ── State ──────────────────────────────────────────────────────────────────
  const [salesToday, setSalesToday] = useState(0);
  const [salesYesterday, setSalesYesterday] = useState(0);
  const [profitToday, setProfitToday] = useState(0);
  const [expensesToday, setExpensesToday] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [weeklyRevenue, setWeeklyRevenue] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [weeklyProfit, setWeeklyProfit] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [salesTodayCount, setSalesTodayCount] = useState(0);

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!supermarketId) return;
    setLoading(true);
    try {
      const now = new Date();
      const todayStr = now.toISOString().substring(0, 10);
      const todayStart = `${todayStr}T00:00:00.000Z`;
      const todayEnd = `${todayStr}T23:59:59.999Z`;

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yStr = yesterday.toISOString().substring(0, 10);
      const yStart = `${yStr}T00:00:00.000Z`;
      const yEnd = `${yStr}T23:59:59.999Z`;

      // ── Today Sales ──
      const salesRes = await db.execute(
        `SELECT total_amount, discount_amount, tax_amount FROM sales WHERE deleted = 0 AND supermarket_id = ? AND created_at >= ? AND created_at <= ?`,
        [supermarketId, todayStart, todayEnd]
      );
      let tSales = 0;
      salesRes.rows.forEach((r: any) => { tSales += Number(r.total_amount); });
      setSalesToday(tSales);
      setSalesTodayCount(salesRes.rows.length);

      // ── Yesterday Sales ──
      const yRes = await db.execute(
        `SELECT total_amount FROM sales WHERE deleted = 0 AND supermarket_id = ? AND created_at >= ? AND created_at <= ?`,
        [supermarketId, yStart, yEnd]
      );
      let ySales = 0;
      yRes.rows.forEach((r: any) => { ySales += Number(r.total_amount); });
      setSalesYesterday(ySales);

      // ── Today Expenses ──
      const expRes = await db.execute(
        `SELECT amount FROM expenses WHERE deleted = 0 AND supermarket_id = ? AND expense_date = ?`,
        [supermarketId, todayStr]
      );
      let tExp = 0;
      expRes.rows.forEach((r: any) => { tExp += Number(r.amount); });
      setExpensesToday(tExp);

      // ── Profit estimate (sales - expenses - cost of goods ~60%) ──
      const profitEst = (tSales * 0.3) - tExp;
      setProfitToday(profitEst);

      // ── Customer Count ──
      const custRes = await db.execute(
        `SELECT COUNT(*) as count FROM customers WHERE deleted = 0 AND supermarket_id = ?`,
        [supermarketId]
      );
      setCustomerCount(custRes.rows[0]?.count || 0);

      // ── Products count ──
      const prodRes = await db.execute(
        `SELECT COUNT(*) as count FROM products WHERE deleted = 0 AND supermarket_id = ?`,
        [supermarketId]
      );
      setTotalProducts(prodRes.rows[0]?.count || 0);

      // ── Low Stock Items ──
      const stockRes = await db.execute(
        `SELECT id, name, sku, current_stock, minimum_stock FROM products WHERE deleted = 0 AND supermarket_id = ? AND current_stock <= minimum_stock ORDER BY current_stock ASC LIMIT 8`,
        [supermarketId]
      );
      setLowStockItems(stockRes.rows as LowStockItem[]);

      // ── Recent Sales ──
      const recentRes = await db.execute(
        `SELECT s.id, s.total_amount, s.payment_method, s.created_at, c.name as customer_name
         FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
         WHERE s.deleted = 0 AND s.supermarket_id = ?
         ORDER BY s.created_at DESC LIMIT 7`,
        [supermarketId]
      );
      setRecentSales(recentRes.rows);

      // ── Weekly Revenue (last 7 days) ──
      const weekData: number[] = [];
      const weekProfit: number[] = [];
      for (let d = 6; d >= 0; d--) {
        const dayDate = new Date(now);
        dayDate.setDate(now.getDate() - d);
        const dayStr = dayDate.toISOString().substring(0, 10);
        const dStart = `${dayStr}T00:00:00.000Z`;
        const dEnd = `${dayStr}T23:59:59.999Z`;
        const dRes = await db.execute(
          `SELECT total_amount FROM sales WHERE deleted = 0 AND supermarket_id = ? AND created_at >= ? AND created_at <= ?`,
          [supermarketId, dStart, dEnd]
        );
        let dayTotal = 0;
        dRes.rows.forEach((r: any) => { dayTotal += Number(r.total_amount); });
        weekData.push(dayTotal);
        weekProfit.push(dayTotal * 0.3);
      }
      setWeeklyRevenue(weekData);
      setWeeklyProfit(weekProfit);

      // ── Sync queue status ──
      const qRes = await db.execute(`SELECT COUNT(*) as count FROM sync_queue`);
      setPendingSyncCount(qRes.rows[0]?.count || 0);

      // ── Build notifications ──
      const notifs: Notification[] = [];
      if (stockRes.rows.length > 0) {
        stockRes.rows.slice(0, 3).forEach((item: any) => {
          notifs.push({
            id: `low-${item.id}`,
            type: 'low_stock',
            title: '⚠️ Low Stock Alert',
            body: `${item.name} has only ${item.current_stock} units left (min: ${item.minimum_stock})`,
            time: 'Just now',
            read: false,
          });
        });
      }
      if (tSales > 0) {
        notifs.push({
          id: 'sales-today',
          type: 'sale',
          title: '✅ Sales Update',
          body: `Today's revenue: KES ${tSales.toLocaleString()} from ${salesRes.rows.length} transactions`,
          time: 'Today',
          read: true,
        });
      }
      if (tExp > 0) {
        notifs.push({
          id: 'exp-today',
          type: 'info',
          title: '💸 Expenses Recorded',
          body: `KES ${tExp.toLocaleString()} in expenses logged today`,
          time: 'Today',
          read: true,
        });
      }
      setNotifications(notifs);

    } catch (e) {
      console.error('Dashboard load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [supermarketId]);

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 30000); // refresh every 30s
    return () => clearInterval(timer);
  }, [loadAll]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncEngine.sync();
      await loadAll();
      Alert.alert('✅ Synced', 'All data synced with cloud successfully.');
    } catch (e: any) {
      Alert.alert('Sync Error', e.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const salesGrowth = salesYesterday > 0 ? ((salesToday - salesYesterday) / salesYesterday) * 100 : 0;
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return weekDays[d.getDay() === 0 ? 6 : d.getDay() - 1];
  });
  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.onSurfaceVariant, marginTop: 12 }}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[st.container, { backgroundColor: colors.background }]}
      contentContainerStyle={st.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={st.header}>
        <View>
          <Text style={{ fontSize: typography.sizes.h2, fontWeight: 'bold', color: colors.onSurface }}>
            Welcome back, {currentUser?.name?.split(' ')[0] || 'Admin'} 👋
          </Text>
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 13, marginTop: 2 }}>
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          {/* Notification Bell */}
          <TouchableOpacity
            onPress={() => setShowNotifications(!showNotifications)}
            style={[st.iconBtn, { backgroundColor: colors.surface, borderColor: colors.surfaceVariant }]}
          >
            <Bell size={18} color={unreadCount > 0 ? colors.error : colors.onSurfaceVariant} />
            {unreadCount > 0 && (
              <View style={[st.badge, { backgroundColor: colors.error }]}>
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Sync Button */}
          <TouchableOpacity
            onPress={handleSync}
            disabled={syncing}
            style={[
              st.syncBtn,
              {
                backgroundColor: pendingSyncCount > 0 ? colors.errorContainer : colors.primaryContainer,
                borderRadius: borderRadius.full,
                opacity: syncing ? 0.7 : 1,
              }
            ]}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 6 }} />
            ) : pendingSyncCount > 0 ? (
              <CloudLightning size={15} color={colors.error} style={{ marginRight: 6 }} />
            ) : (
              <CloudCheck size={15} color={colors.primary} style={{ marginRight: 6 }} />
            )}
            <Text style={{ fontSize: 12, fontWeight: '600', color: pendingSyncCount > 0 ? colors.error : colors.primary }}>
              {syncing ? 'Syncing...' : pendingSyncCount > 0 ? `${pendingSyncCount} pending` : 'Synced'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Notifications Panel ─────────────────────────────────────────────── */}
      {showNotifications && notifications.length > 0 && (
        <Card style={[st.notifPanel, { backgroundColor: colors.surface }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontWeight: '700', fontSize: 15, color: colors.onSurface }}>Notifications</Text>
            <TouchableOpacity onPress={() => setShowNotifications(false)}>
              <Text style={{ color: colors.primary, fontSize: 13 }}>Close</Text>
            </TouchableOpacity>
          </View>
          {notifications.map(n => (
            <View
              key={n.id}
              style={[
                st.notifRow,
                {
                  borderLeftWidth: 3,
                  borderLeftColor: n.type === 'low_stock' ? colors.error : n.type === 'sale' ? colors.success : colors.primary,
                  backgroundColor: n.read ? 'transparent' : colors.background,
                  borderRadius: borderRadius.sm,
                  marginBottom: 8,
                  paddingLeft: 10,
                  paddingVertical: 8,
                }
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', color: colors.onSurface, fontSize: 13 }}>{n.title}</Text>
                <Text style={{ color: colors.onSurfaceVariant, fontSize: 12, marginTop: 2 }}>{n.body}</Text>
              </View>
              <Text style={{ color: colors.outline, fontSize: 11 }}>{n.time}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* ── KPI Cards Row ──────────────────────────────────────────────────── */}
      <View style={[st.metricsGrid, isDesktop && st.metricsGridDesktop]}>

        {/* Revenue */}
        <Card style={[st.kpiCard, { borderLeftWidth: 4, borderLeftColor: colors.primary }]}>
          <View style={st.kpiHeader}>
            <View style={[st.kpiIcon, { backgroundColor: colors.primaryContainer }]}>
              <DollarSign size={18} color={colors.primary} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {salesGrowth >= 0 ? (
                <ArrowUpRight size={14} color={colors.success} />
              ) : (
                <ArrowDownRight size={14} color={colors.error} />
              )}
              <Text style={{ fontSize: 11, color: salesGrowth >= 0 ? colors.success : colors.error, fontWeight: '600' }}>
                {Math.abs(salesGrowth).toFixed(1)}%
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.onSurface, marginTop: 8 }}>
            KES {salesToday.toLocaleString()}
          </Text>
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 12, marginTop: 4 }}>Today's Revenue</Text>
          <Sparkline data={weeklyRevenue} color={colors.primary} />
        </Card>

        {/* Profit */}
        <Card style={[st.kpiCard, { borderLeftWidth: 4, borderLeftColor: colors.success }]}>
          <View style={st.kpiHeader}>
            <View style={[st.kpiIcon, { backgroundColor: colors.success + '20' }]}>
              <TrendingUp size={18} color={colors.success} />
            </View>
          </View>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: profitToday >= 0 ? colors.onSurface : colors.error, marginTop: 8 }}>
            KES {profitToday.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </Text>
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 12, marginTop: 4 }}>Est. Profit (30% margin)</Text>
          <Sparkline data={weeklyProfit} color={colors.success} />
        </Card>

        {/* Expenses */}
        <Card style={[st.kpiCard, { borderLeftWidth: 4, borderLeftColor: colors.error }]}>
          <View style={st.kpiHeader}>
            <View style={[st.kpiIcon, { backgroundColor: colors.errorContainer }]}>
              <TrendingDown size={18} color={colors.error} />
            </View>
          </View>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.onSurface, marginTop: 8 }}>
            KES {expensesToday.toLocaleString()}
          </Text>
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 12, marginTop: 4 }}>Today's Expenses</Text>
          <View style={{ height: 28 }} />
        </Card>

        {/* Sales Count */}
        <Card style={[st.kpiCard, { borderLeftWidth: 4, borderLeftColor: colors.secondary }]}>
          <View style={st.kpiHeader}>
            <View style={[st.kpiIcon, { backgroundColor: colors.secondaryContainer }]}>
              <ShoppingBag size={18} color={colors.secondary} />
            </View>
          </View>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.onSurface, marginTop: 8 }}>
            {salesTodayCount}
          </Text>
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 12, marginTop: 4 }}>Transactions Today</Text>
          <View style={{ height: 28 }} />
        </Card>

      </View>

      {/* ── Middle Grid: Chart + Alerts ────────────────────────────────────── */}
      <View style={[st.sectionGrid, isDesktop && st.sectionGridDesktop]}>

        {/* Weekly Revenue Chart */}
        <Card style={st.chartCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View>
              <Text style={{ fontWeight: '700', fontSize: 15, color: colors.onSurface }}>Weekly Revenue</Text>
              <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>Last 7 days performance</Text>
            </View>
            <BarChart2 size={18} color={colors.primary} />
          </View>
          <MiniBarChart
            data={weeklyRevenue}
            labels={last7Days}
            height={130}
            color={colors.primary}
            labelColor={colors.onSurfaceVariant}
          />
        </Card>

        {/* Quick Stats */}
        <View style={st.statsCol}>

          {/* Customers */}
          <Card style={[st.statCard, { backgroundColor: colors.secondaryContainer }]}>
            <Users size={20} color={colors.secondary} />
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.onSurface, marginTop: 6 }}>{customerCount}</Text>
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>Customers</Text>
          </Card>

          {/* Products */}
          <Card style={[st.statCard, { backgroundColor: colors.surfaceVariant }]}>
            <Boxes size={20} color={colors.primary} />
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.onSurface, marginTop: 6 }}>{totalProducts}</Text>
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>Products</Text>
          </Card>

          {/* Low Stock */}
          <Card style={[st.statCard, { backgroundColor: lowStockItems.length > 0 ? colors.errorContainer : colors.surfaceVariant }]}>
            <AlertTriangle size={20} color={lowStockItems.length > 0 ? colors.error : colors.outline} />
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: lowStockItems.length > 0 ? colors.error : colors.onSurface, marginTop: 6 }}>
              {lowStockItems.length}
            </Text>
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>Low Stock</Text>
          </Card>
        </View>
      </View>

      {/* ── Bottom Grid: Recent Sales + Low Stock Alerts ─────────────────── */}
      <View style={[st.sectionGrid, isDesktop && st.sectionGridDesktop]}>

        {/* Recent Transactions */}
        <Card style={st.listCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontWeight: '700', fontSize: 15, color: colors.onSurface }}>Recent Sales</Text>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={{ color: colors.primary, fontSize: 12 }}>See all</Text>
              <ChevronRight size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 260 }}>
            {recentSales.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <ShoppingBag size={36} color={colors.outline} />
                <Text style={{ color: colors.outline, marginTop: 8 }}>No sales today yet</Text>
              </View>
            ) : (
              recentSales.map((sale, i) => (
                <View
                  key={sale.id}
                  style={[
                    st.saleRow,
                    {
                      borderBottomColor: colors.surfaceVariant,
                      borderBottomWidth: i < recentSales.length - 1 ? 1 : 0,
                    }
                  ]}
                >
                  <View style={[st.saleAvatar, { backgroundColor: colors.primaryContainer }]}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.primary }}>
                      {(sale.customer_name || 'WI')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: colors.onSurface, fontSize: 13 }}>
                      {sale.customer_name || 'Walk-In Customer'}
                    </Text>
                    <Text style={{ color: colors.outline, fontSize: 11 }}>
                      #{sale.id?.substring(0, 8).toUpperCase()} • {sale.payment_method?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: 'bold', color: colors.primary, fontSize: 14 }}>
                      KES {Number(sale.total_amount).toLocaleString()}
                    </Text>
                    <Text style={{ color: colors.outline, fontSize: 10 }}>
                      {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </Card>

        {/* Low Stock Alerts */}
        <Card style={st.listCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontWeight: '700', fontSize: 15, color: colors.onSurface }}>🔴 Low Stock Alerts</Text>
            <TouchableOpacity onPress={loadAll}>
              <RefreshCw size={15} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 260 }}>
            {lowStockItems.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <CheckCircle size={36} color={colors.success} />
                <Text style={{ color: colors.success, marginTop: 8, fontWeight: '600' }}>All stock levels healthy!</Text>
              </View>
            ) : (
              lowStockItems.map((item, i) => (
                <View
                  key={item.id}
                  style={[
                    st.stockRow,
                    {
                      borderBottomColor: colors.surfaceVariant,
                      borderBottomWidth: i < lowStockItems.length - 1 ? 1 : 0,
                      backgroundColor: item.current_stock === 0 ? colors.errorContainer + '50' : 'transparent',
                    }
                  ]}
                >
                  <View style={[st.stockBadge, { backgroundColor: item.current_stock === 0 ? colors.error : colors.errorContainer }]}>
                    <Package size={14} color={item.current_stock === 0 ? '#fff' : colors.error} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: colors.onSurface, fontSize: 13 }} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={{ color: colors.outline, fontSize: 11 }}>SKU: {item.sku}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{
                      fontWeight: 'bold',
                      color: item.current_stock === 0 ? colors.error : colors.onSurface,
                      fontSize: 14,
                    }}>
                      {item.current_stock === 0 ? 'OUT' : item.current_stock}
                    </Text>
                    <Text style={{ color: colors.outline, fontSize: 10 }}>min: {item.minimum_stock}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </Card>
      </View>

      {/* ── Profit Summary Banner ─────────────────────────────────────────── */}
      <Card style={[st.profitBanner, { backgroundColor: colors.primary }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '500' }}>
            Net Position (Revenue - Expenses)
          </Text>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>
            KES {(salesToday - expensesToday).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4 }}>
            {salesTodayCount} transactions • est. {salesYesterday > 0 ? `${((salesToday / salesYesterday - 1) * 100).toFixed(1)}% vs yesterday` : 'first day data'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <TrendingUp size={40} color="rgba(255,255,255,0.3)" />
        </View>
      </Card>

    </ScrollView>
  );
};

const st = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 20, flexWrap: 'wrap', rowGap: 12,
  },
  iconBtn: {
    padding: 8, borderRadius: 10, borderWidth: 1,
    position: 'relative',
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  syncBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14 },
  notifPanel: { padding: 16, marginBottom: 16, borderWidth: 0 },
  notifRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  metricsGrid: { flexDirection: 'column', gap: 12, marginBottom: 16 },
  metricsGridDesktop: { flexDirection: 'row' },
  kpiCard: { flex: 1, padding: 16, borderWidth: 0, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kpiIcon: { padding: 8, borderRadius: 8 },
  sectionGrid: { flexDirection: 'column', gap: 16, marginBottom: 16 },
  sectionGridDesktop: { flexDirection: 'row' },
  chartCard: { flex: 2, padding: 20, borderWidth: 0, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  statsCol: { flex: 1, flexDirection: 'column', gap: 12 },
  statCard: { flex: 1, padding: 16, alignItems: 'flex-start', borderWidth: 0, elevation: 1 },
  listCard: { flex: 1, padding: 16, borderWidth: 0, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  saleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  saleAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  stockRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10, paddingHorizontal: 4, borderRadius: 6 },
  stockBadge: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  profitBanner: {
    flexDirection: 'row', alignItems: 'center', padding: 20,
    borderRadius: 16, marginBottom: 8, borderWidth: 0,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12,
  },
});
