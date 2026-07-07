import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { generateUUID } from '../../utils/uuid';

export interface CartItem {
  id: string; // Cart line identifier
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string;
    buying_price: number;
    selling_price: number;
    tax_rate: number;
    discount_rate: number;
    current_stock: number;
    unit: string;
  };
  quantity: number;
  overridePrice?: number; // Authorized price changes
  discountRate: number; // Custom line-level discount percentage
}

export interface HeldSale {
  id: string;
  cart: CartItem[];
  customer: any | null;
  heldAt: string;
  notes?: string;
}

export interface POSState {
  cart: CartItem[];
  selectedCustomer: any | null; // Customer type
  heldSales: HeldSale[];
  globalDiscountPercent: number;
  paymentMethod: 'cash' | 'mpesa' | 'card' | 'credit' | 'split';
  splitPayments: {
    cash: number;
    mpesa: number;
    card: number;
    credit: number;
  };
  mpesaPhoneNumber: string;
  mpesaTransactionId: string;
  notes: string;
}

const initialState: POSState = {
  cart: [],
  selectedCustomer: null,
  heldSales: [],
  globalDiscountPercent: 0,
  paymentMethod: 'cash',
  splitPayments: {
    cash: 0,
    mpesa: 0,
    card: 0,
    credit: 0,
  },
  mpesaPhoneNumber: '',
  mpesaTransactionId: '',
  notes: '',
};

const posSlice = createSlice({
  name: 'pos',
  initialState,
  reducers: {
    addToCart(state, action: PayloadAction<POSState['cart'][0]['product']>) {
      const product = action.payload;
      const existingItem = state.cart.find(item => item.product.id === product.id);
      
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        state.cart.push({
          id: generateUUID(),
          product,
          quantity: 1,
          discountRate: product.discount_rate || 0,
        });
      }
    },
    updateCartQuantity(state, action: PayloadAction<{ id: string; quantity: number }>) {
      const { id, quantity } = action.payload;
      const item = state.cart.find(i => i.id === id);
      if (item && quantity > 0) {
        item.quantity = quantity;
      }
    },
    overrideCartItemPrice(state, action: PayloadAction<{ id: string; price: number }>) {
      const { id, price } = action.payload;
      const item = state.cart.find(i => i.id === id);
      if (item) {
        item.overridePrice = price;
      }
    },
    updateCartItemDiscount(state, action: PayloadAction<{ id: string; discountRate: number }>) {
      const { id, discountRate } = action.payload;
      const item = state.cart.find(i => i.id === id);
      if (item) {
        item.discountRate = Math.min(100, Math.max(0, discountRate));
      }
    },
    removeFromCart(state, action: PayloadAction<string>) {
      state.cart = state.cart.filter(item => item.id !== action.payload);
    },
    selectCustomer(state, action: PayloadAction<any | null>) {
      state.selectedCustomer = action.payload;
      // Default payment method changes to credit if account selected has credit options
      if (action.payload && action.payload.credit_limit > 0) {
        state.paymentMethod = 'credit';
      } else {
        state.paymentMethod = 'cash';
      }
    },
    setPaymentMethod(state, action: PayloadAction<POSState['paymentMethod']>) {
      state.paymentMethod = action.payload;
    },
    updateSplitPayments(state, action: PayloadAction<Partial<POSState['splitPayments']>>) {
      state.splitPayments = { ...state.splitPayments, ...action.payload };
    },
    setMpesaDetails(state, action: PayloadAction<{ phone: string; transactionId: string }>) {
      state.mpesaPhoneNumber = action.payload.phone;
      state.mpesaTransactionId = action.payload.transactionId;
    },
    setGlobalDiscount(state, action: PayloadAction<number>) {
      state.globalDiscountPercent = Math.min(100, Math.max(0, action.payload));
    },
    setSaleNotes(state, action: PayloadAction<string>) {
      state.notes = action.payload;
    },
    holdSale(state, action: PayloadAction<string | undefined>) {
      if (state.cart.length === 0) return;
      state.heldSales.push({
        id: generateUUID(),
        cart: [...state.cart],
        customer: state.selectedCustomer,
        heldAt: new Date().toISOString(),
        notes: action.payload,
      });
      // Clear current transaction
      state.cart = [];
      state.selectedCustomer = null;
      state.globalDiscountPercent = 0;
      state.notes = '';
      state.paymentMethod = 'cash';
    },
    resumeHeldSale(state, action: PayloadAction<string>) {
      const heldId = action.payload;
      const held = state.heldSales.find(h => h.id === heldId);
      if (held) {
        state.cart = held.cart;
        state.selectedCustomer = held.customer;
        state.notes = held.notes || '';
        state.heldSales = state.heldSales.filter(h => h.id !== heldId);
      }
    },
    voidHeldSale(state, action: PayloadAction<string>) {
      state.heldSales = state.heldSales.filter(h => h.id !== action.payload);
    },
    clearPOS(state) {
      state.cart = [];
      state.selectedCustomer = null;
      state.globalDiscountPercent = 0;
      state.notes = '';
      state.paymentMethod = 'cash';
      state.mpesaPhoneNumber = '';
      state.mpesaTransactionId = '';
      state.splitPayments = { cash: 0, mpesa: 0, card: 0, credit: 0 };
    }
  }
});

export const {
  addToCart,
  updateCartQuantity,
  overrideCartItemPrice,
  updateCartItemDiscount,
  removeFromCart,
  selectCustomer,
  setPaymentMethod,
  updateSplitPayments,
  setMpesaDetails,
  setGlobalDiscount,
  setSaleNotes,
  holdSale,
  resumeHeldSale,
  voidHeldSale,
  clearPOS
} = posSlice.actions;

export default posSlice.reducer;
