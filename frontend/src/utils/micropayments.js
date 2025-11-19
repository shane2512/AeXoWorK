/**
 * Micropayment Utilities for HBAR
 * Handles small HBAR payments for data marketplace
 */

import { ethers } from 'ethers';

/**
 * Convert HBAR to tinybar (smallest unit)
 * 1 HBAR = 100,000,000 tinybars
 */
export const hbarToTinybar = (hbar) => {
  return Math.floor(hbar * 100000000);
};

/**
 * Convert tinybar to HBAR
 */
export const tinybarToHbar = (tinybar) => {
  return tinybar / 100000000;
};

/**
 * Format HBAR amount for display
 */
export const formatHbar = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0 HBAR';
  
  if (num < 0.01) {
    return `${(num * 1000).toFixed(2)} mHBAR`;
  }
  return `${num.toFixed(2)} HBAR`;
};

/**
 * Validate HBAR amount
 */
export const isValidHbarAmount = (amount) => {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num < 50000000000; // Max supply
};

/**
 * Create micropayment transaction
 */
export const createMicropaymentTx = async (provider, from, to, amount) => {
  try {
    const signer = provider.getSigner();
    const amountWei = ethers.utils.parseEther(amount.toString());
    
    const tx = await signer.sendTransaction({
      to,
      value: amountWei,
      gasLimit: 21000 // Standard transfer
    });
    
    return tx;
  } catch (error) {
    console.error('Micropayment transaction error:', error);
    throw error;
  }
};

/**
 * Wait for micropayment confirmation
 */
export const waitForMicropayment = async (tx, confirmations = 1) => {
  try {
    const receipt = await tx.wait(confirmations);
    return receipt;
  } catch (error) {
    console.error('Micropayment confirmation error:', error);
    throw error;
  }
};

/**
 * Get gas price estimation
 */
export const estimateGasCost = async (provider) => {
  try {
    const gasPrice = await provider.getGasPrice();
    const gasCost = gasPrice.mul(21000); // Standard transfer gas
    return ethers.utils.formatEther(gasCost);
  } catch (error) {
    console.error('Gas estimation error:', error);
    return '0.000021'; // Default estimate
  }
};

/**
 * Batch micropayments (for multiple purchases)
 */
export const batchMicropayments = async (provider, payments) => {
  const results = [];
  
  for (const payment of payments) {
    try {
      const tx = await createMicropaymentTx(
        provider,
        payment.from,
        payment.to,
        payment.amount
      );
      const receipt = await waitForMicropayment(tx);
      results.push({
        success: true,
        tx: tx.hash,
        receipt
      });
    } catch (error) {
      results.push({
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
};

/**
 * Calculate total cost with gas
 */
export const calculateTotalCost = (amount, gasPrice) => {
  const dataPrice = parseFloat(amount);
  const gas = parseFloat(gasPrice);
  return (dataPrice + gas).toFixed(6);
};

/**
 * Micropayment status tracker
 */
export class MicropaymentTracker {
  constructor() {
    this.payments = new Map();
  }

  addPayment(id, tx) {
    this.payments.set(id, {
      tx,
      status: 'pending',
      timestamp: Date.now()
    });
  }

  updateStatus(id, status, receipt = null) {
    const payment = this.payments.get(id);
    if (payment) {
      payment.status = status;
      payment.receipt = receipt;
      payment.confirmedAt = Date.now();
      this.payments.set(id, payment);
    }
  }

  getPayment(id) {
    return this.payments.get(id);
  }

  getAllPayments() {
    return Array.from(this.payments.entries());
  }

  getPendingCount() {
    return Array.from(this.payments.values()).filter(
      p => p.status === 'pending'
    ).length;
  }

  clearCompleted() {
    for (const [id, payment] of this.payments.entries()) {
      if (payment.status === 'confirmed' || payment.status === 'failed') {
        this.payments.delete(id);
      }
    }
  }
}

/**
 * Pricing tiers for common data sizes
 */
export const PRICING_TIERS = {
  tiny: { size: '< 1 MB', price: 0.1 },
  small: { size: '1-10 MB', price: 0.5 },
  medium: { size: '10-100 MB', price: 2 },
  large: { size: '100 MB - 1 GB', price: 10 },
  xlarge: { size: '> 1 GB', price: 50 }
};

/**
 * Calculate recommended price based on data size
 */
export const recommendPrice = (sizeInMB) => {
  if (sizeInMB < 1) return PRICING_TIERS.tiny.price;
  if (sizeInMB < 10) return PRICING_TIERS.small.price;
  if (sizeInMB < 100) return PRICING_TIERS.medium.price;
  if (sizeInMB < 1000) return PRICING_TIERS.large.price;
  return PRICING_TIERS.xlarge.price;
};

export default {
  hbarToTinybar,
  tinybarToHbar,
  formatHbar,
  isValidHbarAmount,
  createMicropaymentTx,
  waitForMicropayment,
  estimateGasCost,
  batchMicropayments,
  calculateTotalCost,
  MicropaymentTracker,
  PRICING_TIERS,
  recommendPrice
};

