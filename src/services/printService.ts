import { Platform } from 'react-native';

export interface ReceiptData {
  id: string;
  cashierName: string;
  customerName?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    discount?: number;
    subtotal: number;
  }>;
  total: number;
  discount: number;
  tax: number;
  paymentMethod: string;
  amountPaid: number;
  changeDue: number;
  date: string;
  branchName: string;
}

export const printService = {
  /**
   * Generates a text-based ESC/POS formatted receipt layout.
   */
  generateEscPosText(data: ReceiptData): string {
    const divider = '--------------------------------\n';
    let output = '';

    // ESC/POS Align Center
    output += '\x1b\x61\x01';
    output += `** ${data.branchName.toUpperCase()} **\n`;
    output += 'SELF-SERVICE MINI SUPERMARKET\n';
    output += 'Tel: +254 700 000000\n';
    output += divider;

    // ESC/POS Align Left
    output += '\x1b\x61\x00';
    output += `Receipt: #${data.id.substring(0, 8).toUpperCase()}\n`;
    output += `Date: ${new Date(data.date).toLocaleString()}\n`;
    output += `Cashier: ${data.cashierName}\n`;
    if (data.customerName) {
      output += `Customer: ${data.customerName}\n`;
    }
    output += divider;

    // Cart Headers
    output += 'Item         Qty   Price   Total\n';
    output += divider;

    // Cart Items
    for (const item of data.items) {
      const itemLine = `${item.name.substring(0, 12).padEnd(12)} ${item.quantity.toString().padStart(3)}   ${item.price.toFixed(0).padStart(5)}   ${item.subtotal.toFixed(0).padStart(6)}\n`;
      output += itemLine;
      if (item.discount && item.discount > 0) {
        output += `   (Disc: -KES ${item.discount.toFixed(0)})\n`;
      }
    }
    output += divider;

    // Totals
    output += `Subtotal:           KES ${ (data.total + data.discount - data.tax).toFixed(2).padStart(10) }\n`;
    output += `Discount:           KES -${data.discount.toFixed(2).padStart(10) }\n`;
    output += `Tax (VAT 16%):      KES ${data.tax.toFixed(2).padStart(10) }\n`;
    output += `TOTAL:              KES ${data.total.toFixed(2).padStart(10) }\n`;
    output += divider;

    // Payment details
    output += `Payment:            ${data.paymentMethod.toUpperCase()}\n`;
    output += `Paid:               KES ${data.amountPaid.toFixed(2).padStart(10) }\n`;
    output += `Change:             KES ${data.changeDue.toFixed(2).padStart(10) }\n`;

    output += divider;
    // ESC/POS Align Center
    output += '\x1b\x61\x01';
    output += 'Thank you for shopping with us!\n';
    output += 'Please visit again.\n';
    output += '\n\n\n\n'; // Feed cut lines

    return output;
  },

  /**
   * Triggers the printer action on the device.
   */
  async print(data: ReceiptData): Promise<boolean> {
    console.log('Sending print command to terminal printer...', data);
    
    if (Platform.OS === 'web') {
      // Check if Electron is available
      if ((window as any).electronAPI) {
        try {
          const success = await (window as any).electronAPI.printReceipt(data);
          return !!success;
        } catch (e) {
          console.error('Electron hardware print failed, falling back to Web window.print()', e);
        }
      }
      
      // Standard browser print fallback
      window.print();
      return true;
    }

    // Native implementation (Android/iOS)
    // Here we can hook into native Bluetooth serial printers or Expo Print module.
    // Since we want this buildable immediately without external native printer drivers:
    try {
      const receiptText = this.generateEscPosText(data);
      console.log('--- NATIVE THERMAL PRINT OUTPUT ---\n', receiptText);
      return true;
    } catch (e) {
      console.error('Native printing failed', e);
      return false;
    }
  }
};
