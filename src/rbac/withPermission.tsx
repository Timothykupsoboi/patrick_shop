/**
 * PermissionGuard — HOC / wrapper component for RBAC-based rendering.
 *
 * Usage:
 *   <PermissionGuard action="override_price">
 *     <PriceOverrideButton />
 *   </PermissionGuard>
 *
 *   // With custom fallback:
 *   <PermissionGuard action="view_reports" fallback={<Text>Access Denied</Text>}>
 *     <ReportingScreen />
 *   </PermissionGuard>
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePermission } from './usePermission';
import { PermissionAction } from './roles';
import { useTheme } from '../components/ThemeProvider';
import { Lock } from 'lucide-react-native';

interface PermissionGuardProps {
  /** The permission action required to see children. */
  action: PermissionAction;
  /** What to render when the user lacks permission. Defaults to null (hidden). */
  fallback?: React.ReactNode;
  /** If true, renders a styled "Access Denied" card instead of null when no fallback is provided. */
  showDenied?: boolean;
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  action,
  fallback,
  showDenied = false,
  children,
}) => {
  const allowed = usePermission(action);

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  if (showDenied) {
    return <AccessDeniedCard />;
  }

  return null;
};

// ---------------------------------------------------------------------------
// Access Denied Card (used when showDenied={true})
// ---------------------------------------------------------------------------

const AccessDeniedCard: React.FC = () => {
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.error,
          borderRadius: borderRadius.lg,
          padding: spacing.xl,
        }
      ]}>
        <Lock size={40} color={colors.error} style={{ marginBottom: spacing.md }} />
        <Text style={[styles.title, { color: colors.error }]}>Access Denied</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
          You do not have permission to access this feature.{'\n'}
          Contact your administrator if you believe this is an error.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    borderWidth: 1,
    maxWidth: 400,
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
