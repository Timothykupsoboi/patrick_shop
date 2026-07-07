import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, useWindowDimensions, Modal, Alert } from 'react-native';
import { useTheme } from '../../components/ThemeProvider';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { db } from '../../database/driver';
import { customerRepository, Customer, CreditLedgerEntry } from '../../database/repositories/customerRepository';
import { Search, UserPlus, CreditCard, Award, Phone, User, Landmark, Plus, ArrowUpRight, X, Receipt } from 'lucide-react-native';
import { useTenant } from '../../context/TenantContext';

export const CustomerScreen: React.FC = () => {
  const { colors, spacing, borderRadius, typography } = useTheme();
  const { width } = useWindowDimensions();
  const { supermarketId, branchId } = useTenant();

  const isDesktop = width >= 768;

  // Customers states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [creditLedger, setCreditLedger] = useState<CreditLedgerEntry[]>([]);

  // Modals states
  const [isCreateModalVisible, setIsCreateModalVisible] = useState<boolean>(false);
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState<boolean>(false);

  // Form states
  const [newName, setNewName] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newNationalId, setNewNationalId] = useState<string>('');
  const [newCreditLimit, setNewCreditLimit] = useState<string>('5000');
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState<boolean>(false);

  // Credit Payment Form states
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      if (!supermarketId) return;
      const all = await customerRepository.getAll(supermarketId);
      setCustomers(all);
      if (selectedCustomer) {
        // Refresh selected customer state
        const updated = all.find(c => c.id === selectedCustomer.id);
        if (updated) {
          setSelectedCustomer(updated);
          loadCreditHistory(updated.id!);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadCreditHistory = async (customerId: string) => {
    try {
      if (!supermarketId) return;
      const history = await customerRepository.getCreditHistory(customerId, supermarketId);
      setCreditLedger(history);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCustomer = async () => {
    if (!newName) {
      Alert.alert('Error', 'Customer name is required.');
      return;
    }

    setIsSubmittingCustomer(true);
    try {
      const limit = parseFloat(newCreditLimit) || 0;
      if (!supermarketId) return;
      await customerRepository.create({
        name: newName,
        phone: newPhone || undefined,
        national_id: newNationalId || undefined,
        credit_limit: limit,
        balance: 0,
        loyalty_points: 0
      }, supermarketId, branchId);

      Alert.alert('Success', 'Customer registered successfully.');
      setIsCreateModalVisible(false);
      setNewName('');
      setNewPhone('');
      setNewNationalId('');
      setNewCreditLimit('5000');
      loadCustomers();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save customer.');
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedCustomer) return;
    const amount = parseFloat(paymentAmount);
    
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount.');
      return;
    }

    if (amount > selectedCustomer.balance) {
      Alert.alert('Warning', `Payment exceeds outstanding debt of KES ${selectedCustomer.balance.toFixed(2)}.`);
      return;
    }

    setIsSubmittingPayment(true);
    try {
      if (!supermarketId) return;
      await customerRepository.recordCreditTransaction({
        customer_id: selectedCustomer.id!,
        type: 'payment',
        amount,
        description: paymentNotes || 'Cash debt repayment'
      }, supermarketId, branchId);

      Alert.alert('Success', 'Repayment written to ledger successfully.');
      setIsPaymentModalVisible(false);
      setPaymentAmount('');
      setPaymentNotes('');
      // Reload states
      await loadCustomers();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Payment write failed.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const filtered = customers.filter(
    c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.phone && c.phone.includes(searchQuery))
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.contentContainer}>
      
      <View style={styles.header}>
        <View>
          <Text style={{ fontSize: typography.sizes.h2, fontWeight: 'bold', color: colors.onSurface }}>
            Credit Accounts & Loyalty
          </Text>
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 14 }}>
            Manage supermarket customer credit limits, outstanding balances, and purchase statements.
          </Text>
        </View>

        <Button
          title="Register Customer"
          icon={<UserPlus size={16} color={colors.onPrimary} style={{ marginRight: 6 }} />}
          onPress={() => setIsCreateModalVisible(true)}
        />
      </View>

      {/* Grid split */}
      <View style={[styles.mainLayout, isDesktop && styles.mainLayoutDesktop]}>
        
        {/* Left Side: Search & customers list */}
        <View style={styles.leftCol}>
          <Card style={styles.card}>
            <View style={[styles.searchBox, { borderColor: colors.outline, backgroundColor: colors.background, borderRadius: borderRadius.md, marginBottom: 16 }]}>
              <Search size={18} color={colors.outline} style={{ marginRight: 8 }} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search customers by name or phone..."
                placeholderTextColor={colors.outline}
                style={[styles.searchInput, { color: colors.onSurface }]}
              />
            </View>

            {/* List */}
            <ScrollView style={styles.customerList}>
              {filtered.length === 0 ? (
                <Text style={{ padding: 24, textAlign: 'center', color: colors.outline }}>No customers found.</Text>
              ) : (
                filtered.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => {
                      setSelectedCustomer(item);
                      loadCreditHistory(item.id!);
                    }}
                    style={[
                      styles.customerRow, 
                      { 
                        backgroundColor: selectedCustomer?.id === item.id ? colors.primaryContainer : 'transparent',
                        borderBottomColor: colors.surfaceVariant,
                        borderRadius: borderRadius.md 
                      }
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold', color: colors.onSurface }}>{item.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 }}>
                        {item.phone || 'No phone'} • Loyalty Points: {item.loyalty_points}
                      </Text>
                    </View>
                    
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: item.balance > 0 ? colors.error : colors.outline, fontWeight: 'bold' }}>
                        KES {Number(item.balance).toFixed(0)}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.outline, marginTop: 2 }}>
                        Limit: KES {Number(item.credit_limit).toFixed(0)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </Card>
        </View>

        {/* Right Side: Selected customer detail profile drawer */}
        <View style={styles.rightCol}>
          {selectedCustomer ? (
            <Card style={styles.card}>
              <View style={styles.profileHeader}>
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: colors.onPrimary, fontWeight: 'bold', fontSize: 18 }}>
                    {selectedCustomer.name.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.onSurface }}>{selectedCustomer.name}</Text>
                  <Text style={{ color: colors.outline, fontSize: 13 }}>ID Card: {selectedCustomer.national_id || 'N/A'}</Text>
                </View>
              </View>

              {/* Account summary cards */}
              <View style={styles.creditStats}>
                <View style={[styles.statBox, { backgroundColor: colors.background, borderRadius: borderRadius.md }]}>
                  <Landmark size={18} color={colors.primary} />
                  <Text style={{ fontSize: 11, color: colors.onSurfaceVariant, marginTop: 4 }}>Outstanding Debt</Text>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.error, marginTop: 2 }}>
                    KES {selectedCustomer.balance.toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: colors.background, borderRadius: borderRadius.md }]}>
                  <Award size={18} color={colors.secondary} />
                  <Text style={{ fontSize: 11, color: colors.onSurfaceVariant, marginTop: 4 }}>Loyalty Points</Text>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.success, marginTop: 2 }}>
                    {selectedCustomer.loyalty_points} pts
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <Button
                title="Record Debt Repayment"
                size="md"
                style={{ width: '100%', marginBottom: 20 }}
                icon={<Plus size={16} color={colors.onPrimary} style={{ marginRight: 6 }} />}
                onPress={() => setIsPaymentModalVisible(true)}
                disabled={selectedCustomer.balance <= 0}
              />

              {/* Credit Ledger Timeline logs */}
              <Text style={{ fontWeight: 'bold', color: colors.onSurface, marginBottom: 12 }}>Credit Account Statement</Text>
              <ScrollView style={styles.ledgerList}>
                {creditLedger.length === 0 ? (
                  <Text style={{ color: colors.outline, fontSize: 13, textAlign: 'center', marginTop: 20 }}>
                    No statement ledger history found.
                  </Text>
                ) : (
                  creditLedger.map((log) => (
                    <View key={log.id} style={[styles.ledgerRow, { borderBottomColor: colors.surfaceVariant }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '500', color: colors.onSurface }}>
                          {log.description}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.outline, marginTop: 2 }}>
                          {new Date(log.created_at!).toLocaleString()}
                        </Text>
                      </View>
                      <Text style={{ 
                        color: log.type === 'charge' ? colors.error : colors.success,
                        fontWeight: 'bold' 
                      }}>
                        {log.type === 'charge' ? '+' : '-'} KES {log.amount.toFixed(0)}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </Card>
          ) : (
            <Card style={[styles.card, styles.emptyDetailsCard]}>
              <Landmark size={48} color={colors.outline} style={{ marginBottom: 12 }} />
              <Text style={{ color: colors.outline, textAlign: 'center' }}>
                Select a customer from the catalog list to manage their credit ledger and statement history.
              </Text>
            </Card>
          )}
        </View>

      </View>

      {/* CREATE CUSTOMER MODAL */}
      <Modal visible={isCreateModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <Card elevation="lg" style={[styles.modalCard, { width: isDesktop ? 480 : '95%' }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: typography.sizes.h3, fontWeight: 'bold', color: colors.onSurface }}>
                Register New Customer
              </Text>
              <TouchableOpacity onPress={() => setIsCreateModalVisible(false)}>
                <X size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <Input
              label="Full Name"
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. John Doe"
              style={{ marginBottom: 12 }}
            />

            <Input
              label="Phone Number"
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
              placeholder="e.g. 0712345678"
              style={{ marginBottom: 12 }}
            />

            <Input
              label="National ID / ID Number"
              value={newNationalId}
              onChangeText={setNewNationalId}
              placeholder="e.g. 33445566"
              style={{ marginBottom: 12 }}
            />

            <Input
              label="Account Credit Limit (KES)"
              value={newCreditLimit}
              onChangeText={setNewCreditLimit}
              keyboardType="numeric"
              placeholder="e.g. 5000"
              style={{ marginBottom: 20 }}
            />

            <Button
              title={isSubmittingCustomer ? "Registering..." : "Register Member"}
              onPress={handleCreateCustomer}
              loading={isSubmittingCustomer}
              style={{ width: '100%', height: 48 }}
            />
          </Card>
        </View>
      </Modal>

      {/* DEBT REPAYMENT MODAL */}
      <Modal visible={isPaymentModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <Card elevation="lg" style={[styles.modalCard, { width: isDesktop ? 480 : '95%' }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: typography.sizes.h3, fontWeight: 'bold', color: colors.onSurface }}>
                Record Debt Repayment
              </Text>
              <TouchableOpacity onPress={() => setIsPaymentModalVisible(false)}>
                <X size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {selectedCustomer && (
              <View style={[styles.prodAlert, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md, marginBottom: 16 }]}>
                <Text style={{ fontWeight: 'bold', color: colors.onSurface }}>Debtor: {selectedCustomer.name}</Text>
                <Text style={{ fontSize: 13, color: colors.onSurfaceVariant, marginTop: 4 }}>
                  Outstanding Balance Owed: KES {selectedCustomer.balance.toFixed(2)}
                </Text>
              </View>
            )}

            <Input
              label="Payment Amount (KES)"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="decimal-pad"
              placeholder="e.g. 1000"
              style={{ marginBottom: 12 }}
            />

            <Input
              label="Reference Notes"
              value={paymentNotes}
              onChangeText={setPaymentNotes}
              placeholder="M-Pesa reference or cash desk receipt number"
              style={{ marginBottom: 20 }}
            />

            <Button
              title={isSubmittingPayment ? "Confirming..." : "Confirm Repayment"}
              onPress={handleRecordPayment}
              loading={isSubmittingPayment}
              style={{ width: '100%', height: 48 }}
            />
          </Card>
        </View>
      </Modal>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  mainLayout: {
    flexDirection: 'column',
    rowGap: 24,
  },
  mainLayoutDesktop: {
    flexDirection: 'row',
    columnGap: 24,
    rowGap: 0,
  },
  leftCol: {
    flex: 1,
  },
  rightCol: {
    flex: 1.2,
  },
  card: {
    padding: 20,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 400,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    padding: 0,
  },
  customerList: {
    maxHeight: 480,
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditStats: {
    flexDirection: 'row',
    columnGap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  ledgerList: {
    maxHeight: 250,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  emptyDetailsCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    padding: 24,
    borderWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  prodAlert: {
    padding: 12,
  },
});
