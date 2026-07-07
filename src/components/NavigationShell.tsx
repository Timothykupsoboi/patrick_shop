import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  useWindowDimensions, SafeAreaView, ScrollView
} from 'react-native';
import { useTheme } from './ThemeProvider';
import { useAppDispatch, useAppSelector } from '../store';
import { lockTerminal, logoutUser } from '../features/auth/authSlice';
import { UserRole, getRoleLabel } from '../rbac/roles';

// ── Screen imports ──────────────────────────────────────────────────────────
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { POSScreen } from '../features/pos/POSScreen';
import { InventoryScreen } from '../features/inventory/InventoryScreen';
import { CustomerScreen } from '../features/customers/CustomerScreen';
import { ReportingScreen } from '../features/reports/ReportingScreen';
import { EmployeesScreen } from '../features/employees/EmployeesScreen';
import { ExpensesScreen } from '../features/expenses/ExpensesScreen';
import { SuppliersScreen } from '../features/suppliers/SuppliersScreen';
import { PlatformDashboardScreen } from '../features/platform/PlatformDashboardScreen';
import { SupermarketsScreen } from '../features/platform/SupermarketsScreen';
import { SubscriptionsScreen } from '../features/platform/SubscriptionsScreen';
import { LicensesScreen } from '../features/platform/LicensesScreen';

// ── Icons ───────────────────────────────────────────────────────────────────
import {
  LayoutDashboard, ShoppingCart, Package, Users2, LineChart,
  Lock, LogOut, UserCog, DollarSign, Truck, Globe, Building2,
  CreditCard, Key, BarChart3, ChevronRight, Menu, X
} from 'lucide-react-native';

// ---------------------------------------------------------------------------
// Screen type & menu item definition
// ---------------------------------------------------------------------------

type ScreenKey =
  // Store screens
  | 'dashboard' | 'pos' | 'inventory' | 'customers' | 'reports'
  | 'employees' | 'expenses' | 'suppliers'
  // Platform screens
  | 'platform_dashboard' | 'supermarkets' | 'subscriptions' | 'licenses';

interface MenuItem {
  key: ScreenKey;
  label: string;
  icon: React.ComponentType<any>;
  badge?: number;
}

// ---------------------------------------------------------------------------
// Role → menu items mapping
// ---------------------------------------------------------------------------

function buildMenuForRole(role: UserRole): MenuItem[] {
  switch (role) {
    case 'platform_owner':
      return [
        { key: 'platform_dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { key: 'supermarkets',       label: 'Supermarkets', icon: Building2 },
        { key: 'subscriptions',      label: 'Subscriptions', icon: CreditCard },
        { key: 'licenses',           label: 'Licenses', icon: Key },
        { key: 'employees',          label: 'Global Users', icon: Users2 },
      ];

    case 'super_admin':
      return [
        { key: 'dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
        { key: 'pos',         label: 'Checkout',   icon: ShoppingCart },
        { key: 'inventory',   label: 'Inventory',  icon: Package },
        { key: 'customers',   label: 'Customers',  icon: Users2 },
        { key: 'suppliers',   label: 'Suppliers',  icon: Truck },
        { key: 'employees',   label: 'Employees',  icon: UserCog },
        { key: 'reports',     label: 'Reports',    icon: LineChart },
        { key: 'expenses',    label: 'Expenses',   icon: DollarSign },
      ];

    case 'admin':
      return [
        { key: 'dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
        { key: 'inventory',   label: 'Inventory',  icon: Package },
        { key: 'suppliers',   label: 'Suppliers',  icon: Truck },
        { key: 'customers',   label: 'Customers',  icon: Users2 },
        { key: 'reports',     label: 'Reports',    icon: LineChart },
        { key: 'expenses',    label: 'Expenses',   icon: DollarSign },
      ];

    case 'manager':
      return [
        { key: 'dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
        { key: 'pos',         label: 'Checkout',   icon: ShoppingCart },
        { key: 'inventory',   label: 'Inventory',  icon: Package },
        { key: 'reports',     label: 'Reports',    icon: LineChart },
      ];

    case 'cashier':
      return [
        { key: 'pos',         label: 'Checkout',   icon: ShoppingCart },
        { key: 'customers',   label: 'Customers',  icon: Users2 },
      ];

    case 'store_keeper':
      return [
        { key: 'inventory',   label: 'Inventory',  icon: Package },
      ];

    case 'accountant':
      return [
        { key: 'reports',     label: 'Reports',    icon: LineChart },
        { key: 'expenses',    label: 'Expenses',   icon: DollarSign },
        { key: 'customers',   label: 'Customers',  icon: Users2 },
      ];

    default:
      return [{ key: 'pos', label: 'Checkout', icon: ShoppingCart }];
  }
}

/** Returns the default landing screen for each role. */
function getDefaultScreen(role: UserRole): ScreenKey {
  switch (role) {
    case 'platform_owner':  return 'platform_dashboard';
    case 'super_admin':     return 'dashboard';
    case 'admin':           return 'dashboard';
    case 'manager':         return 'dashboard';
    case 'cashier':         return 'pos';
    case 'store_keeper':    return 'inventory';
    case 'accountant':      return 'reports';
    default:                return 'pos';
  }
}

// ---------------------------------------------------------------------------
// Screen renderer
// ---------------------------------------------------------------------------

function renderScreen(key: ScreenKey): React.ReactElement {
  switch (key) {
    case 'dashboard':           return <DashboardScreen />;
    case 'pos':                 return <POSScreen />;
    case 'inventory':           return <InventoryScreen />;
    case 'customers':           return <CustomerScreen />;
    case 'reports':             return <ReportingScreen />;
    case 'employees':           return <EmployeesScreen />;
    case 'expenses':            return <ExpensesScreen />;
    case 'suppliers':           return <SuppliersScreen />;
    case 'platform_dashboard':  return <PlatformDashboardScreen />;
    case 'supermarkets':        return <SupermarketsScreen />;
    case 'subscriptions':       return <SubscriptionsScreen />;
    case 'licenses':            return <LicensesScreen />;
    default:                    return <POSScreen />;
  }
}

// ---------------------------------------------------------------------------
// Main Navigation Shell
// ---------------------------------------------------------------------------

export const NavigationShell: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const activeSupermarket = useAppSelector((state) => state.auth.activeSupermarket);

  const { colors, spacing, borderRadius } = useTheme();
  const { width } = useWindowDimensions();

  const role = (currentUser?.role || 'cashier') as UserRole;
  const menuItems = buildMenuForRole(role);

  const [activeScreen, setActiveScreen] = useState<ScreenKey>(getDefaultScreen(role));
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isDesktop = width >= 768;
  const isPlatformOwner = role === 'platform_owner';

  // Sidebar content (shared between desktop and mobile drawer)
  const SidebarContent = () => (
    <View style={{ flex: 1, flexDirection: 'column' }}>
      {/* Brand Header */}
      <View style={[styles.sidebarHeader, { borderBottomColor: colors.surfaceVariant }]}>
        <Text style={[styles.brandTitle, { color: colors.primary }]}>
          {isPlatformOwner ? 'Antigravity POS' : (activeSupermarket?.name || 'POS System')}
        </Text>
        <Text style={{ color: colors.outline, fontSize: 11, marginTop: 2 }}>
          {isPlatformOwner ? 'Platform Administration' : 'v2.0 · Offline-First'}
        </Text>
        {isPlatformOwner && (
          <View style={[styles.platformBadge, { backgroundColor: colors.primaryContainer }]}>
            <Globe size={10} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700', marginLeft: 4 }}>
              PLATFORM OWNER
            </Text>
          </View>
        )}
      </View>

      {/* User Info */}
      {currentUser && (
        <View style={[styles.userBox, { backgroundColor: colors.background, borderRadius: borderRadius.md }]}>
          <View style={[styles.userAvatar, { backgroundColor: colors.primaryContainer }]}>
            <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 16 }}>
              {currentUser.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontWeight: 'bold', color: colors.onSurface, fontSize: 13 }} numberOfLines={1}>
              {currentUser.name}
            </Text>
            <Text style={{ fontSize: 11, color: colors.outline, marginTop: 1 }}>
              {getRoleLabel(role)}
            </Text>
          </View>
        </View>
      )}

      {/* Subscription status indicator (store users only) */}
      {!isPlatformOwner && activeSupermarket && (
        <View style={[
          styles.subscriptionBadge,
          {
            backgroundColor:
              activeSupermarket.subscription_status === 'active' ? colors.primaryContainer
              : activeSupermarket.subscription_status === 'trial' ? colors.tertiaryContainer
              : colors.errorContainer,
            borderRadius: borderRadius.sm,
          }
        ]}>
          <Text style={{
            fontSize: 10,
            fontWeight: '700',
            color:
              activeSupermarket.subscription_status === 'active' ? colors.primary
              : activeSupermarket.subscription_status === 'trial' ? colors.tertiary
              : colors.error,
          }}>
            {activeSupermarket.subscription_status === 'active' ? '● ACTIVE'
              : activeSupermarket.subscription_status === 'trial' ? '◐ TRIAL'
              : activeSupermarket.subscription_status === 'expired' ? '✕ EXPIRED'
              : '⊘ SUSPENDED'}
          </Text>
        </View>
      )}

      {/* Menu Items */}
      <ScrollView style={styles.sidebarMenu} showsVerticalScrollIndicator={false}>
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeScreen === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => {
                setActiveScreen(item.key);
                setMobileSidebarOpen(false);
              }}
              style={[
                styles.sidebarItem,
                {
                  backgroundColor: isActive ? colors.primaryContainer : 'transparent',
                  borderRadius: borderRadius.md,
                }
              ]}
            >
              <IconComponent
                size={18}
                color={isActive ? colors.primary : colors.onSurfaceVariant}
                style={{ marginRight: 12 }}
              />
              <Text style={{
                color: isActive ? colors.primary : colors.onSurface,
                fontWeight: isActive ? '700' : '500',
                flex: 1,
                fontSize: 14,
              }}>
                {item.label}
              </Text>
              {isActive && <ChevronRight size={14} color={colors.primary} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.sidebarFooter, { borderTopColor: colors.surfaceVariant }]}>
        {!isPlatformOwner && (
          <TouchableOpacity
            onPress={() => dispatch(lockTerminal())}
            style={styles.sidebarFooterBtn}
          >
            <Lock size={16} color={colors.outline} style={{ marginRight: 10 }} />
            <Text style={{ color: colors.onSurfaceVariant, fontWeight: '500', fontSize: 13 }}>
              Lock Terminal
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => dispatch(logoutUser())}
          style={styles.sidebarFooterBtn}
        >
          <LogOut size={16} color={colors.error} style={{ marginRight: 10 }} />
          <Text style={{ color: colors.error, fontWeight: '500', fontSize: 13 }}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.desktopLayout}>

          {/* Sidebar */}
          <View style={[styles.sidebar, { backgroundColor: colors.surface, borderRightColor: colors.surfaceVariant }]}>
            <SidebarContent />
          </View>

          {/* Main content area */}
          <View style={styles.desktopContent}>
            {renderScreen(activeScreen)}
          </View>

        </View>
      </SafeAreaView>
    );
  }

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Mobile Header */}
      <View style={[styles.mobileHeader, { backgroundColor: colors.surface, borderBottomColor: colors.surfaceVariant }]}>
        <TouchableOpacity onPress={() => setMobileSidebarOpen(true)} style={{ padding: 4 }}>
          <Menu size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.primary, flex: 1, textAlign: 'center' }}>
          {isPlatformOwner ? 'Platform Admin' : (activeSupermarket?.name || 'POS')}
        </Text>
        {!isPlatformOwner && (
          <TouchableOpacity onPress={() => dispatch(lockTerminal())} style={{ padding: 4 }}>
            <Lock size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}
      </View>

      {/* Screen Content */}
      <View style={{ flex: 1 }}>
        {renderScreen(activeScreen)}
      </View>

      {/* Mobile Bottom Tabs (show max 5 items) */}
      <View style={[styles.mobileTabs, { backgroundColor: colors.surface, borderTopColor: colors.surfaceVariant }]}>
        {menuItems.slice(0, 5).map((item) => {
          const IconComponent = item.icon;
          const isActive = activeScreen === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => setActiveScreen(item.key)}
              style={styles.mobileTabItem}
            >
              <IconComponent size={20} color={isActive ? colors.primary : colors.onSurfaceVariant} />
              <Text style={{
                color: isActive ? colors.primary : colors.onSurfaceVariant,
                fontSize: 9,
                marginTop: 3,
                fontWeight: isActive ? 'bold' : '400',
              }}>
                {item.label.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Mobile Drawer Overlay */}
      {mobileSidebarOpen && (
        <View style={styles.drawerOverlay}>
          <TouchableOpacity
            style={styles.drawerBackdrop}
            onPress={() => setMobileSidebarOpen(false)}
          />
          <View style={[styles.drawer, { backgroundColor: colors.surface }]}>
            <View style={styles.drawerClose}>
              <TouchableOpacity onPress={() => setMobileSidebarOpen(false)}>
                <X size={22} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
            <SidebarContent />
          </View>
        </View>
      )}

    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 250,
    borderRightWidth: 1,
    flexDirection: 'column',
  },
  sidebarHeader: {
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  userBox: {
    margin: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionBadge: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  sidebarMenu: {
    flex: 1,
    paddingHorizontal: 8,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 2,
  },
  sidebarFooter: {
    borderTopWidth: 1,
    padding: 8,
    gap: 2,
  },
  sidebarFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  desktopContent: {
    flex: 1,
  },
  mobileHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  mobileTabs: {
    height: 60,
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  mobileTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 1000,
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    width: 280,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    elevation: 10,
  },
  drawerClose: {
    padding: 16,
    alignItems: 'flex-end',
  },
});
