/**
 * Payout Service
 * Provides seller earnings summaries, COD collection balances, and payout history.
 */

import { apiClient } from './api';

export interface PayoutSummary {
  seller_id: number;
  total_earnings: number;
  cod_collected: number;
  cod_pending: number;
  online_earnings: number;
  delivered_orders_count: number;
  delivered_orders: any[];
}

export interface PayoutRecord {
  id: number;
  seller_id: number;
  amount: number;
  status: string;
  reference_id?: string;
  notes?: string;
  created_at?: string;
}

export const payoutService = {
  /**
   * Get earnings and COD collection summary for seller.
   */
  async getPayoutSummary(): Promise<PayoutSummary> {
    const res = (await apiClient.get('/payouts/summary')) as PayoutSummary;
    return res;
  },

  /**
   * Get history of payout transfers.
   */
  async getPayoutHistory(): Promise<PayoutRecord[]> {
    const res = (await apiClient.get('/payouts/history')) as PayoutRecord[];
    return res;
  },
};

export default payoutService;
