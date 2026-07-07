export interface MpesaResponse {
  success: boolean;
  checkoutRequestId?: string;
  transactionCode?: string;
  message: string;
}

export const mpesaService = {
  /**
   * Initiates Lipa Na M-Pesa STK Push.
   * Matches Safaricom Daraja API specifications.
   */
  async initiateStkPush(phone: string, amount: number): Promise<MpesaResponse> {
    // Sanitize phone number to format: 2547XXXXXXXX
    let formattedPhone = phone.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1);
    }

    if (formattedPhone.length !== 12) {
      return { success: false, message: 'Invalid phone format. Must be 2547XXXXXXXX.' };
    }

    console.log(`M-Pesa STK Push triggered. Phone: ${formattedPhone}, Amount: KES ${amount}`);

    // If offline, cache transaction for manual checkout request
    // Here we simulate the network response
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockCheckoutId = 'ws_CO_' + Math.random().toString(36).substring(2, 10).toUpperCase();
        resolve({
          success: true,
          checkoutRequestId: mockCheckoutId,
          message: 'STK Push sent successfully. Awaiting cashier/customer response pin.'
        });
      }, 1500);
    });
  },

  /**
   * Simulates checking transactions status.
   * Cashiers can type M-Pesa receipt codes (e.g. QWD45TRH90) to verify.
   */
  async verifyTransactionCode(code: string): Promise<{ success: boolean; amount: number; message: string }> {
    const uppercaseCode = code.toUpperCase().trim();
    
    // Regular M-Pesa code format is 10 alphanumeric characters starting with 'Q', 'R', etc.
    const isCodeValid = /^[A-Z0-9]{10}$/.test(uppercaseCode);
    if (!isCodeValid) {
      return { success: false, amount: 0, message: 'Invalid M-Pesa transaction code format.' };
    }

    // Mock validation database lookup
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          amount: 0, // In production, query Safaricom C2B callbacks database
          message: `Transaction ${uppercaseCode} reconciled successfully.`
        });
      }, 1000);
    });
  }
};
