import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, useWindowDimensions, FlatList, Modal, Alert } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  addToCart,
  removeFromCart,
  updateCartQuantity,
  overrideCartItemPrice,
  updateCartItemDiscount,
  selectCustomer,
  setPaymentMethod,
  setGlobalDiscount,
  clearPOS,
  holdSale,
  resumeHeldSale
} from './posSlice';
import { useTheme } from '../../components/ThemeProvider';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { productRepository, Product } from '../../database/repositories/productRepository';
import { customerRepository, Customer } from '../../database/repositories/customerRepository';
import { salesRepository } from '../../database/repositories/salesRepository';
import { useHardwareScanner } from '../../hooks/useHardwareScanner';
import { printService } from '../../services/printService';
import { useTenant } from '../../context/TenantContext';
import { mpesaService } from '../../services/mpesaService';
import { Plus, Minus, Trash2, Search, User, CreditCard, DollarSign, Smartphone, Layers, ListFilter, Pause, RefreshCw, X, Camera, Printer, CheckCircle } from 'lucide-react-native';
import { ReceiptData } from '../../services/printService';

export const POSScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { cart, selectedCustomer, heldSales, globalDiscountPercent, paymentMethod } = useAppSelector((state) => state.pos);
  const currentUser = useAppSelector((state) => state.auth.currentUser);

  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const { width } = useWindowDimensions();
  const { supermarketId, branchId } = useTenant();

  const isDesktop = width >= 1024;

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  // Modals States
  const [isCheckoutVisible, setIsCheckoutVisible] = useState<boolean>(false);
  const [isCustomerModalVisible, setIsCustomerModalVisible] = useState<boolean>(false);
  const [isHoldListVisible, setIsHoldListVisible] = useState<boolean>(false);
  const [isCameraScannerVisible, setIsCameraScannerVisible] = useState<boolean>(false);
  const [isReceiptVisible, setIsReceiptVisible] = useState<boolean>(false);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);

  // Checkout Payment States
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [mpesaPhone, setMpesaPhone] = useState<string>('');
  const [mpesaCode, setMpesaCode] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);

  // Customer List
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState<string>('');

  // Load products on mount
  useEffect(() => {
    loadProducts();
    loadCustomers();
  }, []);

  // Filter products when search query or category changes
  useEffect(() => {
    let result = products;
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.location === selectedCategory); // We use location/tag as temporary category fields
    }
    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term) || (p.barcode && p.barcode.includes(term)));
    }
    setFilteredProducts(result);
  }, [searchQuery, selectedCategory, products]);

  const loadProducts = async () => {
    try {
      if (!supermarketId) return;
      const all = await productRepository.getAll(supermarketId);
      setProducts(all);
      // Generate categories based on shelf locations
      const locs = all.map(p => p.location || 'General').filter((v, i, a) => a.indexOf(v) === i);
      setCategories(['All', ...locs]);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCustomers = async () => {
    try {
      if (!supermarketId) return;
      const all = await customerRepository.getAll(supermarketId);
      setCustomers(all);
    } catch (e) {
      console.error(e);
    }
  };

  // ----------------------------------------------------
  // Barcode Scanning Handlers
  // ----------------------------------------------------
  // Hardware scanner hook
  useHardwareScanner({
    onScan: async (barcode) => {
      console.log('Hardware scan captured barcode:', barcode);
      if (!supermarketId) return;
      const prod = await productRepository.getByBarcode(barcode, supermarketId);
      if (prod) {
        dispatch(addToCart(prod as any));
        Alert.alert('Scanned', `${prod.name} added to cart.`);
      } else {
        Alert.alert('Not Found', `Product with code ${barcode} not found in inventory.`);
      }
    }
  });

  // ----------------------------------------------------
  // Cart Logic Calculations
  // ----------------------------------------------------
  const calculateCartSubtotal = () => {
    return cart.reduce((sum, item) => {
      const price = item.overridePrice ?? item.product.selling_price;
      return sum + (price * item.quantity);
    }, 0);
  };

  const calculateCartDiscount = () => {
    const sub = calculateCartSubtotal();
    const itemDiscounts = cart.reduce((sum, item) => {
      const price = item.overridePrice ?? item.product.selling_price;
      return sum + ((price * item.quantity * item.discountRate) / 100);
    }, 0);
    const globalDisc = (sub * globalDiscountPercent) / 100;
    return itemDiscounts + globalDisc;
  };

  const calculateCartTax = () => {
    // 16% VAT on taxable subtotal
    return cart.reduce((sum, item) => {
      const price = item.overridePrice ?? item.product.selling_price;
      const netVal = (price * item.quantity) - ((price * item.quantity * item.discountRate) / 100);
      return sum + ((netVal * item.product.tax_rate) / 100);
    }, 0);
  };

  const calculateCartTotal = () => {
    const sub = calculateCartSubtotal();
    const disc = calculateCartDiscount();
    const tax = calculateCartTax();
    return sub - disc + tax;
  };

  // ----------------------------------------------------
  // Payment Checkouts
  // ----------------------------------------------------
  const handleCheckoutSubmit = async () => {
    const total = calculateCartTotal();
    const paid = parseFloat(amountPaid) || 0;

    if (paymentMethod === 'cash' && paid < total) {
      Alert.alert('Error', 'Paid amount is less than total amount.');
      return;
    }

    if (paymentMethod === 'credit' && !selectedCustomer) {
      Alert.alert('Error', 'Please select a credit account customer first.');
      return;
    }

    if (paymentMethod === 'credit' && selectedCustomer) {
      const remainingLimit = selectedCustomer.credit_limit - selectedCustomer.balance;
      if (total > remainingLimit) {
        Alert.alert('Warning', `Sale exceeds customer's remaining credit limit of KES ${remainingLimit.toFixed(2)}.`);
        return;
      }
    }

    setIsProcessingPayment(true);

    try {
      // 1. Prepare Sale model
      const saleRecord = {
        cashier_id: currentUser?.id || '00000000-0000-0000-0000-000000000000',
        customer_id: selectedCustomer?.id || null,
        total_amount: total,
        discount_amount: calculateCartDiscount(),
        tax_amount: calculateCartTax(),
        payment_status: paymentMethod === 'credit' ? 'unpaid' : 'paid' as any,
        payment_method: paymentMethod,
        branch_id: currentUser?.branch_id || undefined,
        notes: `POS Checkout completed via ${paymentMethod}`
      };

      // 2. Perform Transaction Checkout
      if (!supermarketId) return;
      const savedSale = await salesRepository.checkout(saleRecord, cart, supermarketId, branchId);

      // 3. Print receipt
      const receiptPayload = {
        id: savedSale.id!,
        cashierName: currentUser?.name || 'Cashier',
        customerName: selectedCustomer?.name,
        items: cart.map(i => ({
          name: i.product.name,
          quantity: i.quantity,
          price: i.overridePrice ?? i.product.selling_price,
          discount: (i.overridePrice ?? i.product.selling_price) * i.quantity * (i.discountRate / 100),
          subtotal: (i.overridePrice ?? i.product.selling_price) * i.quantity - ((i.overridePrice ?? i.product.selling_price) * i.quantity * (i.discountRate / 100))
        })),
        total,
        discount: calculateCartDiscount(),
        tax: calculateCartTax(),
        paymentMethod,
        amountPaid: paymentMethod === 'cash' ? paid : total,
        changeDue: paymentMethod === 'cash' ? paid - total : 0,
        date: savedSale.created_at!,
        branchName: 'Nairobi Mini Super'
      };

      // 4. Show professional receipt modal then cleanup
      setLastReceipt(receiptPayload);
      dispatch(clearPOS());
      setIsCheckoutVisible(false);
      setAmountPaid('');
      setMpesaPhone('');
      setMpesaCode('');
      loadProducts();
      loadCustomers();
      setIsReceiptVisible(true);
    } catch (e: any) {
      Alert.alert('Checkout Failed', e.message || 'Unknown database write error.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleMpesaStkPush = async () => {
    if (!mpesaPhone) {
      Alert.alert('Phone Required', 'Please enter customer M-Pesa phone number.');
      return;
    }
    setIsProcessingPayment(true);
    const total = calculateCartTotal();
    const res = await mpesaService.initiateStkPush(mpesaPhone, total);
    setIsProcessingPayment(false);
    if (res.success) {
      Alert.alert('STK Push Sent', res.message);
      setAmountPaid(total.toString()); // Mark paid once push acknowledged
    } else {
      Alert.alert('STK Push Failed', res.message);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* Main Grid split */}
      <View style={[styles.mainLayout, isDesktop && styles.mainLayoutDesktop]}>
        
        {/* Left Side: Product Browser */}
        <View style={styles.leftPane}>
          {/* Header search bar */}
          <View style={styles.searchHeader}>
            <View style={[styles.searchBox, { borderColor: colors.outline, backgroundColor: colors.surface, borderRadius: borderRadius.md }]}>
              <Search size={20} color={colors.outline} style={{ marginRight: 8 }} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Scan barcode or type name..."
                placeholderTextColor={colors.outline}
                style={[styles.searchInput, { color: colors.onSurface }]}
              />
            </View>
            <TouchableOpacity
              onPress={() => setIsCameraScannerVisible(true)}
              style={[styles.cameraScanBtn, { backgroundColor: colors.primaryContainer, borderRadius: borderRadius.md }]}
            >
              <Camera size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Categories Tab Row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[
                  styles.categoryTab,
                  { 
                    backgroundColor: selectedCategory === cat ? colors.primary : colors.surface,
                    borderRadius: borderRadius.full,
                    borderColor: colors.surfaceVariant
                  }
                ]}
              >
                <Text style={{ color: selectedCategory === cat ? colors.onPrimary : colors.onSurface, fontWeight: '500' }}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Product Items List Grid */}
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id!}
            numColumns={isDesktop ? 3 : 2}
            key={isDesktop ? 'desktop-grid' : 'mobile-grid'}
            renderItem={({ item }) => (
              <Card
                onPress={() => dispatch(addToCart(item as any))}
                style={[styles.productCard, { margin: spacing.xs }]}
              >
                <Text style={[styles.productName, { color: colors.onSurface, fontSize: typography.sizes.bodyMedium, fontWeight: '600' }]} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={{ color: colors.outline, fontSize: 11, marginTop: 2 }}>
                  SKU: {item.sku}
                </Text>
                <View style={styles.productFooter}>
                  <Text style={{ color: colors.primary, fontWeight: 'bold' }}>
                    KES {Number(item.selling_price).toFixed(0)}
                  </Text>
                  <Text style={{ 
                    color: item.current_stock <= item.minimum_stock ? colors.error : colors.success, 
                    fontSize: 11,
                    fontWeight: '500'
                  }}>
                    Stock: {Number(item.current_stock).toFixed(0)}
                  </Text>
                </View>
              </Card>
            )}
            contentContainerStyle={styles.productList}
          />
        </View>

        {/* Right Side: Cart / Checkout billing */}
        <View style={[styles.rightPane, { backgroundColor: colors.surface, borderLeftColor: colors.surfaceVariant }]}>
          
          {/* Customer Lookup Panel */}
          <View style={[styles.customerPanel, { borderBottomColor: colors.surfaceVariant }]}>
            <View style={styles.customerSummary}>
              <User size={20} color={colors.primary} style={{ marginRight: 8 }} />
              {selectedCustomer ? (
                <View>
                  <Text style={{ fontWeight: 'bold', color: colors.onSurface }}>{selectedCustomer.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.outline }}>
                    Limit: KES {selectedCustomer.credit_limit} • Bal: KES {selectedCustomer.balance}
                  </Text>
                </View>
              ) : (
                <Text style={{ color: colors.outline }}>Walk-In / Guest Customer</Text>
              )}
            </View>
            
            <View style={{ flexDirection: 'row', columnGap: 8 }}>
              {selectedCustomer && (
                <TouchableOpacity onPress={() => dispatch(selectCustomer(null))} style={styles.clearCustBtn}>
                  <X size={16} color={colors.error} />
                </TouchableOpacity>
              )}
              <Button
                title="Select"
                size="sm"
                variant="outlined"
                onPress={() => setIsCustomerModalVisible(true)}
              />
            </View>
          </View>

          {/* Cart Items List */}
          <ScrollView style={styles.cartItemsScroll}>
            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <Layers size={36} color={colors.outline} style={{ marginBottom: 8 }} />
                <Text style={{ color: colors.outline }}>Cart is empty</Text>
              </View>
            ) : (
              cart.map((item) => (
                <View key={item.id} style={[styles.cartRow, { borderBottomColor: colors.surfaceVariant }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontWeight: '500' }} numberOfLines={1}>
                      {item.product.name}
                    </Text>
                    <Text style={{ color: colors.primary, fontSize: 13, marginTop: 2 }}>
                      KES {item.overridePrice ?? item.product.selling_price}
                    </Text>
                  </View>

                  {/* Quantity Adjusters */}
                  <View style={styles.cartQtyBox}>
                    <TouchableOpacity
                      onPress={() => dispatch(updateCartQuantity({ id: item.id, quantity: item.quantity - 1 }))}
                      style={[styles.qtyBtn, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.sm }]}
                    >
                      <Minus size={14} color={colors.onSurface} />
                    </TouchableOpacity>
                    <Text style={[styles.qtyText, { color: colors.onSurface }]}>{item.quantity}</Text>
                    <TouchableOpacity
                      onPress={() => dispatch(updateCartQuantity({ id: item.id, quantity: item.quantity + 1 }))}
                      style={[styles.qtyBtn, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.sm }]}
                    >
                      <Plus size={14} color={colors.onSurface} />
                    </TouchableOpacity>
                  </View>

                  {/* Delete Item */}
                  <TouchableOpacity
                    onPress={() => dispatch(removeFromCart(item.id))}
                    style={styles.cartDeleteBtn}
                  >
                    <Trash2 size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          {/* Cart Totals Summary */}
          <View style={[styles.cartSummary, { borderTopColor: colors.surfaceVariant }]}>
            <View style={styles.summaryRow}>
              <Text style={{ color: colors.onSurfaceVariant }}>Subtotal</Text>
              <Text style={{ color: colors.onSurface, fontWeight: '500' }}>
                KES {calculateCartSubtotal().toFixed(2)}
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={{ color: colors.onSurfaceVariant }}>Discounts</Text>
              <Text style={{ color: colors.error, fontWeight: '500' }}>
                -KES {calculateCartDiscount().toFixed(2)}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={{ color: colors.onSurfaceVariant }}>VAT (16%)</Text>
              <Text style={{ color: colors.onSurface, fontWeight: '500' }}>
                KES {calculateCartTax().toFixed(2)}
              </Text>
            </View>

            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={{ color: colors.onSurface, fontWeight: 'bold', fontSize: 18 }}>TOTAL</Text>
              <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 20 }}>
                KES {calculateCartTotal().toFixed(2)}
              </Text>
            </View>

            {/* Quick action triggers */}
            <View style={styles.quickActionsRow}>
              <Button
                title="Hold"
                variant="outlined"
                size="sm"
                icon={<Pause size={14} color={colors.primary} style={{ marginRight: 4 }} />}
                onPress={() => {
                  dispatch(holdSale('POS Held sale'));
                  Alert.alert('Sale Held', 'Transaction held successfully.');
                }}
                disabled={cart.length === 0}
                style={{ flex: 1 }}
              />
              <Button
                title={`Held (${heldSales.length})`}
                variant="outlined"
                size="sm"
                onPress={() => setIsHoldListVisible(true)}
                style={{ flex: 1 }}
              />
              <Button
                title="Clear"
                variant="text"
                size="sm"
                onPress={() => dispatch(clearPOS())}
                disabled={cart.length === 0}
                style={{ flex: 0.8 }}
              />
            </View>

            {/* Checkout Action Button */}
            <Button
              title="Pay & Checkout"
              onPress={() => setIsCheckoutVisible(true)}
              disabled={cart.length === 0}
              style={styles.payBtn}
            />
          </View>

        </View>

      </View>

      {/* CHECKOUT BILLING MODAL */}
      <Modal visible={isCheckoutVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <Card elevation="lg" style={[styles.checkoutModalCard, { width: isDesktop ? 480 : '95%' }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: typography.sizes.h3, fontWeight: 'bold', color: colors.onSurface }}>
                Payment Checkout
              </Text>
              <TouchableOpacity onPress={() => setIsCheckoutVisible(false)}>
                <X size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 15, color: colors.onSurfaceVariant, marginBottom: 16 }}>
              Total Payable: <Text style={{ color: colors.primary, fontWeight: 'bold' }}>KES {calculateCartTotal().toFixed(2)}</Text>
            </Text>

            {/* Payment Method Selector Grid */}
            <View style={styles.paymentMethodSelector}>
              {(['cash', 'mpesa', 'card', 'credit'] as const).map((method) => (
                <TouchableOpacity
                  key={method}
                  onPress={() => dispatch(setPaymentMethod(method))}
                  style={[
                    styles.methodTab,
                    {
                      borderColor: paymentMethod === method ? colors.primary : colors.outline,
                      backgroundColor: paymentMethod === method ? colors.primaryContainer : 'transparent',
                      borderRadius: borderRadius.md
                    }
                  ]}
                >
                  {method === 'cash' && <DollarSign size={20} color={colors.primary} />}
                  {method === 'mpesa' && <Smartphone size={20} color={colors.primary} />}
                  {method === 'card' && <CreditCard size={20} color={colors.primary} />}
                  {method === 'credit' && <User size={20} color={colors.primary} />}
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.onSurface, marginTop: 4 }}>
                    {method.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Payment inputs based on selection */}
            {paymentMethod === 'cash' && (
              <Input
                label="Cash Amount Received"
                value={amountPaid}
                onChangeText={setAmountPaid}
                keyboardType="decimal-pad"
                placeholder="Enter cash paid..."
                style={{ marginVertical: 16 }}
              />
            )}

            {paymentMethod === 'mpesa' && (
              <View style={{ marginVertical: 16 }}>
                <Input
                  label="Customer Phone (STK Push)"
                  value={mpesaPhone}
                  onChangeText={setMpesaPhone}
                  keyboardType="number-pad"
                  placeholder="2547XXXXXXXX"
                  style={{ marginBottom: 12 }}
                />
                <Button 
                  title={isProcessingPayment ? "Triggering STK Push..." : "Trigger M-Pesa STK Push"} 
                  onPress={handleMpesaStkPush} 
                  loading={isProcessingPayment}
                  disabled={isProcessingPayment}
                  style={{ width: '100%', marginBottom: 12 }} 
                />
                <Input
                  label="Manual M-Pesa Receipt Code (Reconciliation)"
                  value={mpesaCode}
                  onChangeText={setMpesaCode}
                  placeholder="QWE123RTY8"
                />
              </View>
            )}

            {paymentMethod === 'credit' && (
              <View style={[styles.creditDetailBox, { backgroundColor: colors.background, borderRadius: borderRadius.md, marginVertical: 16 }]}>
                {selectedCustomer ? (
                  <>
                    <Text style={{ fontWeight: 'bold', color: colors.onSurface }}>Debtor: {selectedCustomer.name}</Text>
                    <Text style={{ fontSize: 13, color: colors.onSurfaceVariant, marginTop: 4 }}>
                      Outstanding Owed: KES {selectedCustomer.balance.toFixed(2)}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.onSurfaceVariant }}>
                      Credit Limit Owed: KES {selectedCustomer.credit_limit.toFixed(2)}
                    </Text>
                  </>
                ) : (
                  <Text style={{ color: colors.error, fontWeight: '500' }}>
                    Error: Select a customer profile to charge credit debt.
                  </Text>
                )}
              </View>
            )}

            {/* Cash change calculator */}
            {paymentMethod === 'cash' && amountPaid && (
              <View style={[styles.changeBox, { backgroundColor: colors.primaryContainer, borderRadius: borderRadius.md, marginBottom: 16 }]}>
                <Text style={{ color: colors.onPrimaryContainer, fontWeight: '500' }}>
                  Change Due: KES {Math.max(0, parseFloat(amountPaid) - calculateCartTotal()).toFixed(2)}
                </Text>
              </View>
            )}

            <Button
              title={isProcessingPayment ? "Processing..." : "Confirm Payment & Print"}
              onPress={handleCheckoutSubmit}
              loading={isProcessingPayment}
              style={{ width: '100%', height: 48 }}
            />
          </Card>
        </View>
      </Modal>

      {/* CUSTOMER SEARCH MODAL */}
      <Modal visible={isCustomerModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <Card elevation="lg" style={[styles.customerModalCard, { width: isDesktop ? 480 : '95%', height: 450 }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: typography.sizes.h3, fontWeight: 'bold', color: colors.onSurface }}>
                Select Customer Account
              </Text>
              <TouchableOpacity onPress={() => setIsCustomerModalVisible(false)}>
                <X size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <Input
              value={customerSearch}
              onChangeText={setCustomerSearch}
              placeholder="Search by name or phone..."
              style={{ marginBottom: 16 }}
            />

            <ScrollView style={{ flex: 1 }}>
              {customers
                .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone && c.phone.includes(customerSearch)))
                .map((cust) => (
                  <TouchableOpacity
                    key={cust.id}
                    onPress={() => {
                      dispatch(selectCustomer(cust));
                      setIsCustomerModalVisible(false);
                      setCustomerSearch('');
                    }}
                    style={[styles.customerSelectItem, { borderBottomColor: colors.surfaceVariant }]}
                  >
                    <View>
                      <Text style={{ fontWeight: '600', color: colors.onSurface }}>{cust.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.outline }}>
                        Phone: {cust.phone || 'N/A'} • Points: {cust.loyalty_points}
                      </Text>
                    </View>
                    <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 12 }}>
                      Bal: KES {cust.balance}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </Card>
        </View>
      </Modal>

      {/* HELD SALES MODAL */}
      <Modal visible={isHoldListVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <Card elevation="lg" style={[styles.customerModalCard, { width: isDesktop ? 480 : '95%' }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: typography.sizes.h3, fontWeight: 'bold', color: colors.onSurface }}>
                Held Transactions
              </Text>
              <TouchableOpacity onPress={() => setIsHoldListVisible(false)}>
                <X size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, minHeight: 250 }}>
              {heldSales.length === 0 ? (
                <Text style={{ color: colors.outline, textAlign: 'center', marginTop: 40 }}>
                  No transactions currently held.
                </Text>
              ) : (
                heldSales.map((h) => (
                  <View key={h.id} style={[styles.heldRow, { borderBottomColor: colors.surfaceVariant }]}>
                    <View>
                      <Text style={{ fontWeight: '600', color: colors.onSurface }}>
                        ID: #{h.id.substring(0, 8).toUpperCase()}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.outline }}>
                        Held: {new Date(h.heldAt).toLocaleTimeString()} • Items: {h.cart.length}
                      </Text>
                    </View>
                    <Button
                      title="Resume"
                      size="sm"
                      onPress={() => {
                        dispatch(resumeHeldSale(h.id));
                        setIsHoldListVisible(false);
                      }}
                    />
                  </View>
                ))
              )}
            </ScrollView>
          </Card>
        </View>
      </Modal>

      {/* CAMERA SCANNER SIMULATOR MODAL */}
      <Modal visible={isCameraScannerVisible} animationType="slide">
        <View style={styles.cameraContainer}>
          <Text style={{ color: '#fff', fontSize: 18, marginBottom: 20 }}>Camera Barcode Scanner</Text>
          <View style={styles.cameraViewportSimulator}>
            <Text style={{ color: '#aaa', fontSize: 14 }}>[ Camera Stream Simulated ]</Text>
          </View>
          <View style={{ width: '80%', rowGap: 12 }}>
            <Button
              title="Simulate Scan Milk (Barcode: 600123)"
              onPress={async () => {
                try {
                  if (!supermarketId) return;
                  const prod = await productRepository.getByBarcode('600123', supermarketId);
                  if (prod) {
                    dispatch(addToCart(prod as any));
                    setIsCameraScannerVisible(false);
                  } else {
                    Alert.alert('Error', 'Simulated barcode 600123 not in database.');
                  }
                } catch (e: any) {
                  Alert.alert('Error', e.message || 'Failed to simulate barcode scan.');
                }
              }}
            />
            <Button
              title="Cancel"
              variant="danger"
              onPress={() => setIsCameraScannerVisible(false)}
            />
          </View>
        </View>
      </Modal>

      {/* ── PROFESSIONAL RECEIPT MODAL ──────────────────────────────── */}
      <Modal visible={isReceiptVisible} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.receiptModal, { width: isDesktop ? 400 : '95%', backgroundColor: colors.surface }]}>
            {/* Scrollable receipt */}
            <ScrollView
              contentContainerStyle={{ paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {/* ── Receipt Header ── */}
              <View style={[styles.receiptHeader, { backgroundColor: colors.primary }]}>
                <CheckCircle size={28} color="#fff" style={{ marginBottom: 6 }} />
                <Text style={styles.receiptStoreName}>NAIROBI MINI SUPER</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                  Nairobi, Kenya • Tel: +254 700 000000
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>
                  PIN: P051530432Z • VAT Reg: V001234567
                </Text>
              </View>

              <View style={{ padding: 16 }}>
                {/* ── Receipt Meta ── */}
                <View style={styles.receiptMeta}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.receiptMetaLabel, { color: colors.onSurfaceVariant }]}>Receipt No.</Text>
                    <Text style={[styles.receiptMetaValue, { color: colors.onSurface }]}>
                      #{lastReceipt?.id.substring(0, 8).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={[styles.receiptMetaLabel, { color: colors.onSurfaceVariant }]}>Date & Time</Text>
                    <Text style={[styles.receiptMetaValue, { color: colors.onSurface }]}>
                      {lastReceipt ? new Date(lastReceipt.date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>
                      {lastReceipt ? new Date(lastReceipt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                  </View>
                </View>

                {/* Cashier / Customer info */}
                <View style={[styles.receiptInfoRow, { backgroundColor: colors.background, borderRadius: 8 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>Served By</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.onSurface }}>{lastReceipt?.cashierName}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>Customer</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.onSurface }}>
                      {lastReceipt?.customerName || 'Walk-In'}
                    </Text>
                  </View>
                </View>

                {/* ── Items List ── */}
                <View style={[styles.receiptDivider, { borderColor: colors.surfaceVariant }]} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant, marginBottom: 8, letterSpacing: 0.5 }}>
                  ITEMS PURCHASED
                </Text>

                {/* Column headers */}
                <View style={styles.receiptItemHeader}>
                  <Text style={[styles.receiptItemHeaderTxt, { flex: 2, color: colors.onSurfaceVariant }]}>Item</Text>
                  <Text style={[styles.receiptItemHeaderTxt, { width: 40, textAlign: 'center', color: colors.onSurfaceVariant }]}>Qty</Text>
                  <Text style={[styles.receiptItemHeaderTxt, { width: 70, textAlign: 'right', color: colors.onSurfaceVariant }]}>Price</Text>
                  <Text style={[styles.receiptItemHeaderTxt, { width: 70, textAlign: 'right', color: colors.onSurfaceVariant }]}>Total</Text>
                </View>
                <View style={[styles.receiptDivider, { borderColor: colors.surfaceVariant, marginVertical: 4 }]} />

                {lastReceipt?.items.map((item, i) => (
                  <View key={i} style={styles.receiptItemRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={{ fontSize: 13, color: colors.onSurface, fontWeight: '500' }} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.discount && item.discount > 0 ? (
                        <Text style={{ fontSize: 10, color: colors.error }}>
                          Disc: -KES {item.discount.toFixed(0)}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={{ width: 40, textAlign: 'center', fontSize: 13, color: colors.onSurface }}>{item.quantity}</Text>
                    <Text style={{ width: 70, textAlign: 'right', fontSize: 13, color: colors.onSurface }}>
                      {Number(item.price).toFixed(0)}
                    </Text>
                    <Text style={{ width: 70, textAlign: 'right', fontSize: 13, fontWeight: '600', color: colors.onSurface }}>
                      {Number(item.subtotal).toFixed(0)}
                    </Text>
                  </View>
                ))}

                {/* ── Totals ── */}
                <View style={[styles.receiptDivider, { borderColor: colors.surfaceVariant, marginTop: 8 }]} />

                <View style={styles.receiptTotalsBox}>
                  <View style={styles.receiptTotRow}>
                    <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }}>Subtotal</Text>
                    <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: '500' }}>
                      KES {((lastReceipt?.total ?? 0) + (lastReceipt?.discount ?? 0) - (lastReceipt?.tax ?? 0)).toFixed(2)}
                    </Text>
                  </View>
                  {(lastReceipt?.discount ?? 0) > 0 && (
                    <View style={styles.receiptTotRow}>
                      <Text style={{ color: colors.error, fontSize: 13 }}>Discount</Text>
                      <Text style={{ color: colors.error, fontSize: 13, fontWeight: '500' }}>
                        -KES {(lastReceipt?.discount ?? 0).toFixed(2)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.receiptTotRow}>
                    <Text style={{ color: colors.onSurfaceVariant, fontSize: 13 }}>VAT (16%)</Text>
                    <Text style={{ color: colors.onSurface, fontSize: 13 }}>
                      KES {(lastReceipt?.tax ?? 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.receiptDivider, { borderColor: colors.surfaceVariant }]} />
                  <View style={styles.receiptTotRow}>
                    <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: 'bold' }}>TOTAL</Text>
                    <Text style={{ color: colors.primary, fontSize: 18, fontWeight: 'bold' }}>
                      KES {(lastReceipt?.total ?? 0).toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* ── Payment Info ── */}
                <View style={[styles.receiptPayBox, { backgroundColor: colors.primaryContainer, borderRadius: 10 }]}>
                  <View style={styles.receiptTotRow}>
                    <Text style={{ color: colors.onSurface, fontWeight: '600' }}>Payment Method</Text>
                    <Text style={{ color: colors.primary, fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {lastReceipt?.paymentMethod}
                    </Text>
                  </View>
                  <View style={styles.receiptTotRow}>
                    <Text style={{ color: colors.onSurface }}>Amount Paid</Text>
                    <Text style={{ color: colors.onSurface, fontWeight: '600' }}>
                      KES {(lastReceipt?.amountPaid ?? 0).toFixed(2)}
                    </Text>
                  </View>
                  {(lastReceipt?.changeDue ?? 0) > 0 && (
                    <View style={styles.receiptTotRow}>
                      <Text style={{ color: colors.onSurface }}>Change</Text>
                      <Text style={{ color: colors.success, fontWeight: 'bold' }}>
                        KES {(lastReceipt?.changeDue ?? 0).toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* ── Footer ── */}
                <View style={{ alignItems: 'center', marginTop: 16 }}>
                  <Text style={{ color: colors.onSurfaceVariant, fontSize: 12, textAlign: 'center' }}>
                    Thank you for shopping with us!
                  </Text>
                  <Text style={{ color: colors.outline, fontSize: 11, marginTop: 2 }}>
                    This is your official receipt. Please keep it.
                  </Text>
                  <Text style={{ color: colors.outline, fontSize: 10, marginTop: 8, fontFamily: 'monospace' }}>
                    *** {lastReceipt?.id.toUpperCase()} ***
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* ── Action Buttons ── */}
            <View style={[styles.receiptActions, { borderTopColor: colors.surfaceVariant }]}>
              <TouchableOpacity
                onPress={async () => {
                  if (lastReceipt) await printService.print(lastReceipt);
                }}
                style={[styles.receiptPrintBtn, { backgroundColor: colors.primary }]}
              >
                <Printer size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Print Receipt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setIsReceiptVisible(false); setLastReceipt(null); }}
                style={[styles.receiptCloseBtn, { borderColor: colors.surfaceVariant }]}
              >
                <Text style={{ color: colors.onSurfaceVariant, fontWeight: '600', fontSize: 14 }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'column',
  },
  mainLayoutDesktop: {
    flexDirection: 'row',
  },
  leftPane: {
    flex: 1.5,
    padding: 16,
  },
  rightPane: {
    flex: 1,
    borderLeftWidth: 1,
    flexDirection: 'column',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    columnGap: 8,
  },
  searchBox: {
    flex: 1,
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
  cameraScanBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryRow: {
    flexDirection: 'row',
    maxHeight: 40,
    marginBottom: 16,
  },
  categoryTab: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderWidth: 1.2,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productList: {
    paddingBottom: 24,
  },
  productCard: {
    flex: 1,
    padding: 12,
    alignItems: 'flex-start',
    borderWidth: 0,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  productName: {
    marginBottom: 4,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
    alignItems: 'center',
  },
  customerPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  customerSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clearCustBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  cartItemsScroll: {
    flex: 1,
    padding: 16,
  },
  emptyCart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  cartQtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 16,
    textAlign: 'center',
  },
  cartDeleteBtn: {
    padding: 8,
    marginLeft: 8,
  },
  cartSummary: {
    borderTopWidth: 1,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    marginTop: 4,
  },
  quickActionsRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  payBtn: {
    width: '100%',
    height: 48,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkoutModalCard: {
    padding: 24,
    borderWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  paymentMethodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  methodTab: {
    flex: 1,
    padding: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditDetailBox: {
    padding: 12,
    width: '100%',
  },
  changeBox: {
    padding: 12,
    width: '100%',
    alignItems: 'center',
  },
  customerModalCard: {
    padding: 24,
    borderWidth: 0,
  },
  customerSelectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  heldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraViewportSimulator: {
    width: 300,
    height: 300,
    borderWidth: 2,
    borderColor: '#fff',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  // ── Receipt Modal Styles ────────────────────────────────────────────────
  receiptModal: {
    maxHeight: '90%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  receiptHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  receiptStoreName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  receiptMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  receiptMetaLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  receiptMetaValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  receiptInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 12,
  },
  receiptDivider: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 8,
  },
  receiptItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptItemHeaderTxt: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  receiptItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  receiptTotalsBox: {
    marginTop: 4,
    marginBottom: 12,
  },
  receiptTotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  receiptPayBox: {
    padding: 14,
    marginBottom: 8,
  },
  receiptActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    padding: 12,
    gap: 10,
  },
  receiptPrintBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
  },
  receiptCloseBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
  },
});
