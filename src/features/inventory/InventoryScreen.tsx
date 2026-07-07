import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, useWindowDimensions, Modal, Alert } from 'react-native';
import { useTheme } from '../../components/ThemeProvider';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { db } from '../../database/driver';
import { productRepository, Product } from '../../database/repositories/productRepository';
import { generateUUID } from '../../utils/uuid';
import { syncQueue } from '../../api/sync/syncQueue';
import { syncEngine } from '../../api/sync/syncEngine';
import { Search, Plus, Minus, History, ShieldAlert, ArrowDownUp, RefreshCw, X, AlertCircle, Edit3, Trash2 } from 'lucide-react-native';
import { useTenant } from '../../context/TenantContext';
import { usePermission } from '../../rbac/usePermission';

export const InventoryScreen: React.FC = () => {
  const { colors, spacing, borderRadius, typography } = useTheme();
  const { width } = useWindowDimensions();
  const { supermarketId } = useTenant();

  const isDesktop = width >= 768;

  // Inventory states
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stockHistory, setStockHistory] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Adjustment Modal state
  const [isAdjustModalVisible, setIsAdjustModalVisible] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'adjustment_add' | 'adjustment_sub' | 'damaged' | 'expired'>('adjustment_add');
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState<boolean>(false);

  // Product management modal states
  const canManageProducts = usePermission('create_product') || usePermission('edit_product');
  const canCreateProduct = usePermission('create_product');
  const canEditProduct = usePermission('edit_product');
  const canDeleteProduct = usePermission('delete_product');

  const [isProductModalVisible, setIsProductModalVisible] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Product Form states
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodBarcode, setProdBarcode] = useState('');
  const [prodUnit, setProdUnit] = useState('pcs');
  const [prodBuyingPrice, setProdBuyingPrice] = useState('');
  const [prodSellingPrice, setProdSellingPrice] = useState('');
  const [prodMinStock, setProdMinStock] = useState('5');
  const [prodMaxStock, setProdMaxStock] = useState('100');
  const [prodLocation, setProdLocation] = useState('');
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  useEffect(() => {
    loadProducts();
    loadStockHistory();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadProducts(), loadStockHistory()]);
      Alert.alert('Success', 'Inventory data refreshed successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to refresh inventory.');
    } finally {
      setRefreshing(false);
    }
  };

  const loadProducts = async () => {
    try {
      if (!supermarketId) return;
      const all = await productRepository.getAll(supermarketId);
      setProducts(all);
    } catch (e) {
      console.error(e);
    }
  };

  const loadStockHistory = async () => {
    try {
      if (!supermarketId) return;
      const res = await db.execute(
        `SELECT st.*, p.name as product_name, p.sku 
         FROM stock_transactions st 
         JOIN products p ON st.product_id = p.id
         WHERE st.deleted = 0 AND st.supermarket_id = ?
         ORDER BY st.created_at DESC 
         LIMIT 20`,
        [supermarketId]
      );
      setStockHistory(res.rows);
    } catch (e) {
      console.error(e);
    }
  };

  const openAddProductModal = () => {
    setEditingProduct(null);
    setProdName('');
    setProdSku('');
    setProdBarcode('');
    setProdUnit('pcs');
    setProdBuyingPrice('');
    setProdSellingPrice('');
    setProdMinStock('5');
    setProdMaxStock('100');
    setProdLocation('');
    setIsProductModalVisible(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setProdName(product.name);
    setProdSku(product.sku);
    setProdBarcode(product.barcode || '');
    setProdUnit(product.unit);
    setProdBuyingPrice(String(product.buying_price));
    setProdSellingPrice(String(product.selling_price));
    setProdMinStock(String(product.minimum_stock));
    setProdMaxStock(String(product.maximum_stock));
    setProdLocation(product.location || '');
    setIsProductModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!prodName.trim()) { Alert.alert('Validation', 'Product name is required.'); return; }
    if (!prodSku.trim()) { Alert.alert('Validation', 'SKU is required.'); return; }
    const buyPrice = parseFloat(prodBuyingPrice);
    const sellPrice = parseFloat(prodSellingPrice);
    if (isNaN(buyPrice) || buyPrice < 0) { Alert.alert('Validation', 'Please enter a valid buying price.'); return; }
    if (isNaN(sellPrice) || sellPrice < 0) { Alert.alert('Validation', 'Please enter a valid selling price.'); return; }

    setIsSavingProduct(true);
    try {
      const data: Partial<Product> = {
        name: prodName.trim(),
        sku: prodSku.trim(),
        barcode: prodBarcode.trim() || undefined,
        unit: prodUnit.trim(),
        buying_price: buyPrice,
        selling_price: sellPrice,
        minimum_stock: parseFloat(prodMinStock) || 0,
        maximum_stock: parseFloat(prodMaxStock) || 0,
        location: prodLocation.trim() || undefined,
      };

      if (editingProduct?.id) {
        await productRepository.update(editingProduct.id, data);
        Alert.alert('Success', 'Product updated successfully.');
      } else {
        await productRepository.create(data as Product, supermarketId!);
        Alert.alert('Success', 'Product added successfully.');
      }
      setIsProductModalVisible(false);
      loadProducts();
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'Database write error.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!product.id) return;
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete ${product.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await productRepository.delete(product.id!);
              Alert.alert('Success', 'Product deleted.');
              loadProducts();
            } catch (e: any) {
              Alert.alert('Failed', e.message || 'Could not delete product.');
            }
          }
        }
      ]
    );
  };

  const handleApplyAdjustment = async () => {
    if (!selectedProduct) return;
    const qty = parseFloat(adjustQty);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Error', 'Please enter a valid positive quantity.');
      return;
    }

    setIsSubmittingAdjustment(true);
    const now = new Date().toISOString();
    const transactionId = generateUUID();

    try {
      // Calculate next stock level
      const currentStock = Number(selectedProduct.current_stock || 0);
      const isAddition = adjustType === 'adjustment_add';
      const newStock = isAddition ? (currentStock + qty) : (currentStock - qty);
      const nextVersion = (selectedProduct.version || 1) + 1;

      // Wrap local updates inside db transaction
      await db.transaction(async (tx) => {
        // 1. Update stock levels on products table
        await tx.execute(
          'UPDATE products SET current_stock = ?, version = ?, updated_at = ? WHERE id = ?',
          [newStock, nextVersion, now, selectedProduct.id]
        );

        // 2. Insert stock transactions ledger entry
        const stockTx = {
          id: transactionId,
          product_id: selectedProduct.id,
          type: adjustType,
          quantity: qty,
          unit_cost: selectedProduct.buying_price,
          reference_id: 'adjustment',
          notes: adjustNotes || `Manual ${adjustType} stock audit`,
          created_at: now,
          updated_at: now,
          deleted: 0,
          version: 1
        };

        const keys = Object.keys(stockTx);
        const values = keys.map(k => (stockTx as any)[k]);
        const placeholders = keys.map(() => '?').join(', ');
        
        await tx.execute(
          `INSERT INTO stock_transactions (${keys.join(', ')}) VALUES (${placeholders})`,
          values
        );
      });

      // Fetch completed updated row to queue sync
      const completeProdRes = await db.execute('SELECT * FROM products WHERE id = ? LIMIT 1', [selectedProduct.id]);
      const completeProduct = productRepository.mapFromSqlite(completeProdRes.rows[0]);

      // Push both product update and stock transaction to sync queue
      await syncQueue.addToQueue('products', selectedProduct.id!, 'UPDATE', completeProduct);
      
      const loggedTxRes = await db.execute('SELECT * FROM stock_transactions WHERE id = ? LIMIT 1', [transactionId]);
      await syncQueue.addToQueue('stock_transactions', transactionId, 'INSERT', loggedTxRes.rows[0]);

      syncEngine.sync();

      Alert.alert('Success', 'Inventory adjustment written successfully.');
      setIsAdjustModalVisible(false);
      setAdjustQty('');
      setAdjustNotes('');
      loadProducts();
      loadStockHistory();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Unknown database write error.');
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  const filtered = products.filter(
    p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.contentContainer}>
      
      <View style={styles.header}>
        <View>
          <Text style={{ fontSize: typography.sizes.h2, fontWeight: 'bold', color: colors.onSurface }}>
            Inventory Management
          </Text>
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 14 }}>
            Monitor self-service mini-supermarket stock counts and run audit adjustments.
          </Text>
        </View>
        
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {canCreateProduct && (
            <Button
              title="Add Item"
              variant="filled"
              icon={<Plus size={16} color="#fff" style={{ marginRight: 6 }} />}
              onPress={openAddProductModal}
            />
          )}
          <Button
            title={refreshing ? "Refreshing..." : "Refresh Data"}
            variant="outlined"
            loading={refreshing}
            disabled={refreshing}
            icon={<RefreshCw size={16} color={refreshing ? colors.outline : colors.primary} style={{ marginRight: 6 }} />}
            onPress={handleRefresh}
          />
        </View>
      </View>

      {/* Grid splits */}
      <View style={[styles.mainLayout, isDesktop && styles.mainLayoutDesktop]}>
        
        {/* Left Side: Products stock lookup */}
        <View style={styles.leftCol}>
          <Card style={styles.card}>
            <View style={styles.searchHeader}>
              <View style={[styles.searchBox, { borderColor: colors.outline, backgroundColor: colors.background, borderRadius: borderRadius.md }]}>
                <Search size={18} color={colors.outline} style={{ marginRight: 8 }} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Filter stock by SKU or name..."
                  placeholderTextColor={colors.outline}
                  style={[styles.searchInput, { color: colors.onSurface }]}
                />
              </View>
            </View>

            {/* Desktop Stock Table */}
            <ScrollView horizontal style={{ width: '100%' }}>
              <View style={styles.table}>
                <View style={[styles.tableHeader, { backgroundColor: colors.surfaceVariant }]}>
                  <Text style={[styles.headerCell, { width: 140, color: colors.onSurfaceVariant }]}>SKU</Text>
                  <Text style={[styles.headerCell, { width: 180, color: colors.onSurfaceVariant }]}>Product Name</Text>
                  <Text style={[styles.headerCell, { width: 100, color: colors.onSurfaceVariant, textAlign: 'right' }]}>Stock Level</Text>
                  <Text style={[styles.headerCell, { width: 90, color: colors.onSurfaceVariant, textAlign: 'right' }]}>Min stock</Text>
                  <Text style={[styles.headerCell, { width: 120, color: colors.onSurfaceVariant, textAlign: 'center' }]}>Audit Actions</Text>
                </View>

                {filtered.length === 0 ? (
                  <Text style={{ padding: 24, color: colors.outline, textAlign: 'center' }}>No products match filters.</Text>
                ) : (
                  filtered.map((item) => (
                    <View key={item.id} style={[styles.tableRow, { borderBottomColor: colors.surfaceVariant }]}>
                      <Text style={[styles.cell, { width: 140, color: colors.onSurface }]}>{item.sku}</Text>
                      <Text style={[styles.cell, { width: 180, color: colors.onSurface }]} numberOfLines={1}>{item.name}</Text>
                      <Text style={[
                        styles.cell, 
                        { 
                          width: 100, 
                          textAlign: 'right', 
                          fontWeight: 'bold',
                          color: item.current_stock <= item.minimum_stock ? colors.error : colors.onSurface
                        }
                      ]}>
                        {Number(item.current_stock).toFixed(0)} {item.unit}
                      </Text>
                      <Text style={[styles.cell, { width: 90, textAlign: 'right', color: colors.outline }]}>
                        {Number(item.minimum_stock).toFixed(0)}
                      </Text>
                      
                      <View style={{ width: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Button
                          title="Adjust"
                          size="sm"
                          onPress={() => {
                            setSelectedProduct(item);
                            setIsAdjustModalVisible(true);
                          }}
                        />
                        {canEditProduct && (
                          <TouchableOpacity
                            onPress={() => openEditProductModal(item)}
                            style={{ padding: 6, borderWidth: 1, borderColor: colors.surfaceVariant, borderRadius: borderRadius.sm }}
                          >
                            <Edit3 size={14} color={colors.primary} />
                          </TouchableOpacity>
                        )}
                        {canDeleteProduct && (
                          <TouchableOpacity
                            onPress={() => handleDeleteProduct(item)}
                            style={{ padding: 6, borderWidth: 1, borderColor: colors.surfaceVariant, borderRadius: borderRadius.sm }}
                          >
                            <Trash2 size={14} color={colors.error} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </Card>
        </View>

        {/* Right Side: Stock Transaction history ledger logs */}
        <View style={styles.rightCol}>
          <Card style={styles.card}>
            <View style={styles.historyHeader}>
              <History size={20} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={{ fontSize: typography.sizes.bodyLarge, fontWeight: 'bold', color: colors.onSurface }}>
                Stock In/Out History
              </Text>
            </View>

            <ScrollView style={styles.historyList}>
              {stockHistory.length === 0 ? (
                <Text style={{ padding: 24, textAlign: 'center', color: colors.outline }}>No transactions logged.</Text>
              ) : (
                stockHistory.map((item) => {
                  const isAddition = ['in', 'adjustment_add', 'transfer_in'].includes(item.type);
                  return (
                    <View key={item.id} style={[styles.historyRow, { borderBottomColor: colors.surfaceVariant }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '500', color: colors.onSurface }} numberOfLines={1}>
                          {item.product_name}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.outline, marginTop: 2 }}>
                          {item.type.toUpperCase()} • {item.notes}
                        </Text>
                      </View>
                      
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ 
                          color: isAddition ? colors.success : colors.error, 
                          fontWeight: 'bold',
                          fontSize: 14 
                        }}>
                          {isAddition ? '+' : '-'}{Number(item.quantity).toFixed(0)}
                        </Text>
                        <Text style={{ fontSize: 10, color: colors.outline }}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </Card>
        </View>

      </View>

      {/* INVENTORY ADJUSTMENT MODAL */}
      <Modal visible={isAdjustModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <Card elevation="lg" style={[styles.adjustModalCard, { width: isDesktop ? 480 : '95%' }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: typography.sizes.h3, fontWeight: 'bold', color: colors.onSurface }}>
                Audit Stock Level
              </Text>
              <TouchableOpacity onPress={() => setIsAdjustModalVisible(false)}>
                <X size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {selectedProduct && (
              <View style={[styles.prodAlert, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md }]}>
                <Text style={{ fontWeight: 'bold', color: colors.onSurface }}>{selectedProduct.name}</Text>
                <Text style={{ fontSize: 13, color: colors.onSurfaceVariant, marginTop: 4 }}>
                  Current Stock: {Number(selectedProduct.current_stock).toFixed(0)} {selectedProduct.unit}
                </Text>
              </View>
            )}

            {/* Type selector */}
            <View style={styles.typeSelectorRow}>
              {(['adjustment_add', 'adjustment_sub', 'damaged', 'expired'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setAdjustType(type)}
                  style={[
                    styles.typeBtn,
                    {
                      borderColor: adjustType === type ? colors.primary : colors.outline,
                      backgroundColor: adjustType === type ? colors.primaryContainer : 'transparent',
                      borderRadius: borderRadius.sm
                    }
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.onSurface }}>
                    {type.toUpperCase().replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Quantity to Adjust"
              value={adjustQty}
              onChangeText={setAdjustQty}
              keyboardType="decimal-pad"
              placeholder="e.g. 10"
              style={{ marginBottom: 12 }}
            />

            <Input
              label="Audit Comments / Reason"
              value={adjustNotes}
              onChangeText={setAdjustNotes}
              placeholder="Damaged in transit / counts discrepancy"
              style={{ marginBottom: 20 }}
            />

            <Button
              title="Apply Adjustment"
              onPress={handleApplyAdjustment}
              loading={isSubmittingAdjustment}
              style={{ width: '100%', height: 48 }}
            />
          </Card>
        </View>
      </Modal>

      {/* PRODUCT FORM MODAL */}
      <Modal visible={isProductModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <Card elevation="lg" style={[styles.adjustModalCard, { width: isDesktop ? 500 : '95%' }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: typography.sizes.h3, fontWeight: 'bold', color: colors.onSurface }}>
                {editingProduct ? 'Edit Product Item' : 'Create New Product'}
              </Text>
              <TouchableOpacity onPress={() => setIsProductModalVisible(false)}>
                <X size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              <Input
                label="Product Name *"
                value={prodName}
                onChangeText={setProdName}
                placeholder="e.g. Fresh Milk 1L"
              />
              <Input
                label="SKU *"
                value={prodSku}
                onChangeText={setProdSku}
                placeholder="e.g. MILK-1L"
              />
              <Input
                label="Barcode / Barcode String"
                value={prodBarcode}
                onChangeText={setProdBarcode}
                placeholder="e.g. 6192837482"
              />
              <Input
                label="Unit *"
                value={prodUnit}
                onChangeText={setProdUnit}
                placeholder="e.g. pcs, bags, packets"
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Buying Price *"
                    value={prodBuyingPrice}
                    onChangeText={setProdBuyingPrice}
                    keyboardType="decimal-pad"
                    placeholder="KES Buying"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Selling Price *"
                    value={prodSellingPrice}
                    onChangeText={setProdSellingPrice}
                    keyboardType="decimal-pad"
                    placeholder="KES Selling"
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Minimum Stock Alert"
                    value={prodMinStock}
                    onChangeText={setProdMinStock}
                    keyboardType="numeric"
                    placeholder="Min stock"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Maximum Stock"
                    value={prodMaxStock}
                    onChangeText={setProdMaxStock}
                    keyboardType="numeric"
                    placeholder="Max stock"
                  />
                </View>
              </View>
              <Input
                label="Shelf / Stock Room Location"
                value={prodLocation}
                onChangeText={setProdLocation}
                placeholder="e.g. Aisle 3"
              />
            </ScrollView>

            <Button
              title={isSavingProduct ? "Saving..." : "Save Product"}
              onPress={handleSaveProduct}
              loading={isSavingProduct}
              style={{ width: '100%', height: 48, marginTop: 16 }}
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
    flex: 1.6,
  },
  rightCol: {
    flex: 1,
  },
  card: {
    padding: 20,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchHeader: {
    marginBottom: 16,
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
  table: {
    minWidth: 630,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  headerCell: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  cell: {
    fontSize: 13,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  historyList: {
    maxHeight: 450,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustModalCard: {
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
    marginBottom: 16,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 4,
    marginBottom: 16,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
