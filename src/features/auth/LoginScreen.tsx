import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  useWindowDimensions, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { loginWithEmail, loginWithPIN, clearAuthError } from './authSlice';
import { useTheme } from '../../components/ThemeProvider';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Lock, Eye, EyeOff, Building2, ShieldCheck, Delete } from 'lucide-react-native';

export const LoginScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.auth);
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const { width } = useWindowDimensions();

  const [isPinMode, setIsPinMode] = useState<boolean>(true);

  // PIN state
  const [pin, setPin] = useState<string>('');

  // Email state
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const isDesktop = width >= 768;

  // ── PIN handlers ──────────────────────────────────────────────────────────

  const handlePinPress = (num: string) => {
    dispatch(clearAuthError());
    if (pin.length < 6) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        dispatch(loginWithPIN({ pin: nextPin }));
      }
    }
  };

  const handlePinDelete = () => setPin(pin.slice(0, -1));
  const handlePinClear = () => setPin('');

  // ── Email handlers ────────────────────────────────────────────────────────

  const handleEmailSubmit = () => {
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    dispatch(loginWithEmail({ email, password }));
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const pinDots = Array.from({ length: Math.max(4, pin.length) }, (_, i) => i < pin.length);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { backgroundColor: colors.background }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.outerContainer, isDesktop && styles.outerContainerDesktop]}>

        {/* ── Left Brand Panel (Desktop) ─────────────────────────────────── */}
        {isDesktop && (
          <View style={[styles.brandPanel, { backgroundColor: colors.primary }]}>
            <View style={styles.brandContent}>
              <View style={styles.brandLogo}>
                <ShieldCheck size={52} color={colors.onPrimary} />
              </View>
              <Text style={[styles.brandTitle, { color: colors.onPrimary }]}>
                Antigravity POS
              </Text>
              <Text style={[styles.brandTagline, { color: colors.primaryContainer }]}>
                Multi-Tenant Supermarket Platform
              </Text>

              <View style={[styles.brandBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={{ color: colors.onPrimary, fontWeight: '600', fontSize: 12 }}>
                  🔒 Offline-First · Cloud-Synced
                </Text>
              </View>

              <View style={styles.brandStats}>
                {[
                  { label: 'Platforms', value: '1' },
                  { label: 'Supermarkets', value: '∞' },
                  { label: 'Branches', value: '∞' },
                ].map((stat) => (
                  <View key={stat.label} style={styles.brandStat}>
                    <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.onPrimary }}>{stat.value}</Text>
                    <Text style={{ fontSize: 11, color: colors.primaryContainer }}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ── Right Login Panel ──────────────────────────────────────────── */}
        <View style={[styles.loginPanel, { backgroundColor: colors.surface }]}>

          {/* Mobile brand */}
          {!isDesktop && (
            <View style={styles.mobileBrand}>
              <ShieldCheck size={36} color={colors.primary} />
              <Text style={[styles.brandTitle, { color: colors.primary, fontSize: 22, marginTop: 8 }]}>
                Antigravity POS
              </Text>
            </View>
          )}

          {/* Error Banner */}
          {error && (
            <View style={[styles.errorBanner, { backgroundColor: colors.errorContainer, borderRadius: borderRadius.md }]}>
              <Text style={{ color: colors.error, fontSize: 13, fontWeight: '500' }}>⚠ {error}</Text>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* STORE LOGIN                                                     */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <View style={styles.formContainer}>

            {/* Sub-mode toggle */}
            <View style={[styles.subTabs, { borderColor: colors.surfaceVariant }]}>
              <TouchableOpacity
                style={[styles.subTab, isPinMode && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => { setIsPinMode(true); dispatch(clearAuthError()); }}
              >
                <Text style={{ color: isPinMode ? colors.primary : colors.onSurfaceVariant, fontWeight: isPinMode ? '700' : '400' }}>
                  Quick PIN
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subTab, !isPinMode && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => { setIsPinMode(false); dispatch(clearAuthError()); }}
              >
                <Text style={{ color: !isPinMode ? colors.primary : colors.onSurfaceVariant, fontWeight: !isPinMode ? '700' : '400' }}>
                  Email Login
                </Text>
              </TouchableOpacity>
            </View>

            {isPinMode ? (
              /* ── PIN Pad ────────────────────────────────────────────── */
              <View style={styles.pinContainer}>
                <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>
                  Enter your 4-digit PIN
                </Text>

                {/* PIN Dots */}
                <View style={styles.pinDots}>
                  {pinDots.map((filled, i) => (
                    <View
                      key={i}
                      style={[
                        styles.pinDot,
                        {
                          backgroundColor: filled ? colors.primary : 'transparent',
                          borderColor: filled ? colors.primary : colors.outline,
                        }
                      ]}
                    />
                  ))}
                </View>

                {/* Numpad */}
                <View style={styles.numpad}>
                  {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, idx) => (
                    <TouchableOpacity
                      key={idx}
                      disabled={key === '' || loading}
                      onPress={() => {
                        if (key === '⌫') handlePinDelete();
                        else handlePinPress(key);
                      }}
                      style={[
                        styles.numpadKey,
                        {
                          backgroundColor: key === '' ? 'transparent' : colors.background,
                          borderColor: colors.surfaceVariant,
                          borderRadius: borderRadius.md,
                          opacity: (key !== '' && loading) ? 0.5 : 1,
                        }
                      ]}
                    >
                      {key === '⌫' ? (
                        <Delete size={20} color={colors.onSurface} />
                      ) : (
                        <Text style={[styles.numpadKeyText, { color: colors.onSurface }]}>{key}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                {loading && (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ color: colors.onSurfaceVariant, marginLeft: 8 }}>Verifying...</Text>
                  </View>
                )}

                <TouchableOpacity onPress={handlePinClear} disabled={loading}>
                  <Text style={{ color: loading ? colors.outline : colors.outline, textAlign: 'center', marginTop: 8, opacity: loading ? 0.5 : 1 }}>Clear</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Email Form ─────────────────────────────────────────── */
              <View style={styles.emailForm}>
                <Input
                  label="Email Address"
                  value={email}
                  onChangeText={(t) => { setEmail(t); dispatch(clearAuthError()); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="cashier@supermarket.co.ke"
                />
                <View style={{ position: 'relative' }}>
                  <Input
                    label="Password"
                    value={password}
                    onChangeText={(t) => { setPassword(t); dispatch(clearAuthError()); }}
                    secureTextEntry={!showPassword}
                    placeholder="••••••••"
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    {showPassword
                      ? <EyeOff size={18} color={colors.outline} />
                      : <Eye size={18} color={colors.outline} />
                    }
                  </TouchableOpacity>
                </View>
                <Button
                  title={loading ? 'Signing in...' : 'Sign In'}
                  onPress={handleEmailSubmit}
                  disabled={loading}
                  loading={loading}
                />
              </View>
            )}
          </View>

          {/* Footer */}
          <Text style={[styles.footer, { color: colors.outline }]}>
            Antigravity POS v2.0 · Offline-First Multi-Tenant Platform
          </Text>
        </View>

      </View>
    </ScrollView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
  },
  outerContainer: {
    flex: 1,
    minHeight: '100%',
  },
  outerContainerDesktop: {
    flexDirection: 'row',
  },
  brandPanel: {
    width: '42%',
    minHeight: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  brandContent: {
    alignItems: 'center',
    maxWidth: 320,
  },
  brandLogo: {
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  brandTagline: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
    opacity: 0.85,
  },
  brandBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 32,
  },
  brandStats: {
    flexDirection: 'row',
    gap: 32,
  },
  brandStat: {
    alignItems: 'center',
  },
  mobileBrand: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 16,
  },
  loginPanel: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
    minHeight: '100%',
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  subTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: 20,
  },
  subTab: {
    flex: 1,
    paddingBottom: 12,
    alignItems: 'center',
  },
  errorBanner: {
    padding: 12,
    marginBottom: 16,
  },
  formContainer: {
    gap: 12,
  },
  pinContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  sectionLabel: {
    fontSize: 14,
    marginBottom: 16,
  },
  pinDots: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 240,
    gap: 10,
    justifyContent: 'center',
  },
  numpadKey: {
    width: 70,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  numpadKeyText: {
    fontSize: 22,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  emailForm: {
    gap: 12,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 38,
    zIndex: 10,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 4,
  },
  platformHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    marginTop: 32,
  },
});
