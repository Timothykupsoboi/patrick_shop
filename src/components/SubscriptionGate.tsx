/**
 * SubscriptionGate — Blocks POS checkout when subscription is expired or suspended.
 *
 * Wrap the POS screen or any checkout-related component with this gate.
 * Platform Owner bypasses this gate entirely.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppSelector } from '../store';
import { useTheme } from './ThemeProvider';
import { AlertTriangle, CreditCard, Clock } from 'lucide-react-native';

interface SubscriptionGateProps {
  children: React.ReactNode;
  /** If true, only blocks checkout but still shows children in read-only mode */
  softBlock?: boolean;
}

export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ children, softBlock = false }) => {
  const { colors, spacing, borderRadius } = useTheme();
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const activeSupermarket = useAppSelector((state) => state.auth.activeSupermarket);

  // Platform owner bypasses all gates
  if (currentUser?.role === 'platform_owner') {
    return <>{children}</>;
  }

  const status = activeSupermarket?.subscription_status;

  const isBlocked = status === 'expired' || status === 'suspended';

  if (isBlocked && !softBlock) {
    return <SubscriptionExpiredScreen status={status!} supermarketName={activeSupermarket?.name} />;
  }

  return (
    <>
      {/* Trial Warning Banner */}
      {status === 'trial' && <TrialWarningBanner trialEndsAt={activeSupermarket?.trial_ends_at} />}

      {/* Soft block: show children but with expired banner on top */}
      {isBlocked && softBlock && (
        <View style={[styles.softBanner, { backgroundColor: colors.errorContainer }]}>
          <AlertTriangle size={16} color={colors.error} />
          <Text style={{ color: colors.error, marginLeft: 8, fontWeight: '600', fontSize: 13 }}>
            {status === 'suspended' ? 'Account Suspended' : 'Subscription Expired'} — Checkout Disabled
          </Text>
        </View>
      )}

      {children}
    </>
  );
};

// ---------------------------------------------------------------------------
// Full Block Screen
// ---------------------------------------------------------------------------

interface SubscriptionExpiredScreenProps {
  status: string;
  supermarketName?: string;
}

const SubscriptionExpiredScreen: React.FC<SubscriptionExpiredScreenProps> = ({ status, supermarketName }) => {
  const { colors, spacing, borderRadius } = useTheme();

  const isSuspended = status === 'suspended';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.xl,
          borderColor: isSuspended ? colors.error : colors.tertiary,
        }
      ]}>
        <View style={[
          styles.iconBg,
          { backgroundColor: isSuspended ? colors.errorContainer : colors.tertiaryContainer }
        ]}>
          {isSuspended
            ? <AlertTriangle size={40} color={colors.error} />
            : <CreditCard size={40} color={colors.tertiary} />
          }
        </View>

        <Text style={[styles.title, { color: isSuspended ? colors.error : colors.tertiary }]}>
          {isSuspended ? 'Account Suspended' : 'Subscription Expired'}
        </Text>

        {supermarketName && (
          <Text style={[styles.storeName, { color: colors.onSurface }]}>{supermarketName}</Text>
        )}

        <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>
          {isSuspended
            ? 'This supermarket account has been suspended by the platform administrator. Please contact support to reinstate your account.'
            : 'Your POS subscription has expired. Checkout and sales are disabled until your subscription is renewed. Reports and inventory can still be viewed.'}
        </Text>

        <View style={[styles.infoBox, { backgroundColor: colors.background, borderRadius: borderRadius.md }]}>
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 13, lineHeight: 20 }}>
            📞 Contact your Antigravity POS representative to renew:{'\n'}
            <Text style={{ color: colors.primary, fontWeight: '600' }}>admin@antigravitypos.com</Text>
          </Text>
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Trial Warning Banner
// ---------------------------------------------------------------------------

interface TrialWarningBannerProps {
  trialEndsAt?: string | null;
}

const TrialWarningBanner: React.FC<TrialWarningBannerProps> = ({ trialEndsAt }) => {
  const { colors, spacing } = useTheme();

  if (!trialEndsAt) return null;

  const daysLeft = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // Only show banner when 7 or fewer days remain
  if (daysLeft > 7) return null;

  const isUrgent = daysLeft <= 3;

  return (
    <View style={[
      styles.trialBanner,
      { backgroundColor: isUrgent ? colors.errorContainer : colors.tertiaryContainer }
    ]}>
      <Clock size={14} color={isUrgent ? colors.error : colors.tertiary} />
      <Text style={[
        styles.trialText,
        { color: isUrgent ? colors.error : colors.tertiary }
      ]}>
        {daysLeft <= 0
          ? 'Trial has ended — please renew your subscription.'
          : `Free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Contact admin to upgrade.`
        }
      </Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    padding: 32,
    borderWidth: 1,
    maxWidth: 480,
    width: '100%',
    gap: 16,
  },
  iconBg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  storeName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 360,
  },
  infoBox: {
    padding: 16,
    width: '100%',
    marginTop: 8,
  },
  softBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingHorizontal: 16,
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  trialText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
