/**
 * Order Service
 * Connects to the FastAPI backend /orders/* endpoints.
 * Includes TanStack Query hooks (polling + cache invalidation after mutations).
 */

import { QueryClient, useQuery } from '@tanstack/react-query';

import { Order, OrderItem, OrderStatus, OrderTab, TimelineStep } from '@/types/order';

import { apiClient } from './api';

export interface CreateOrderPayload {
  items: { product_id: number; quantity: number }[];
  address: string;
  lat?: number;
  lng?: number;
  payment_method: 'cod' | 'upi' | 'online';
  delivery_notes?: string;
}

export interface UpiLinkResponse {
  upi_url: string;
  qr_payload: string;
  payee_vpa: string;
  payee_name: string;
  amount: number;
  txn_ref: string;
}

export interface BackendOrder {
  id: number;
  buyer_id: number;
  seller_id: number;
  items: {
    product_id: number;
    name: string;
    price: number;
    quantity: number;
    unit: string;
    subtotal: number;
    image?: string;
  }[];
  distance_km: number;
  is_extended_delivery: boolean;
  extra_delivery_fee: number;
  delivery_fee: number;
  subtotal: number;
  total: number;
  payment_method: 'cod' | 'upi' | 'online';
  payment_status: 'pending' | 'submitted' | 'paid' | 'rejected' | 'expired' | 'collected';
  upi_utr?: string;
  payment_submitted_at?: string;
  payment_confirmed_at?: string;
  payment_rejected_reason?: string;
  payment_resubmit_count?: number;
  status:
    | 'placed'
    | 'pending_seller_approval'
    | 'awaiting_buyer_confirmation'
    | 'confirmed'
    | 'packed'
    | 'shipped'
    | 'out_for_delivery'
    | 'delivered'
    | 'rejected'
    | 'cancelled';
  seller_note?: string;
  reject_reason?: string;
  address: string;
  lat?: number;
  lng?: number;
  delivery_notes?: string | null;
  delivery_otp?: string | null;
  created_at?: string;
  buyer_name?: string | null;
  buyer_mobile?: string | null;
  seller_name?: string | null;
  seller_mobile?: string | null;
  seller_address?: string | null;
  status_history: {
    id: number;
    status: string;
    note?: string;
    timestamp: string;
  }[];
  message?: string;
}

export interface TrackOrderResponse {
  order_id: number;
  current_status: string;
  status_history: {
    id: number;
    status: string;
    note?: string;
    timestamp: string;
  }[];
  eta: string;
  payment_method: string;
  payment_status: string;
  total: number;
  cod_amount_to_pay?: number;
  delivery_otp?: string;
}

/**
 * Maps status string to human-readable English and Tamil label.
 */
export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    placed: 'Order Placed',
    pending_seller_approval: 'Waiting for seller approval',
    awaiting_buyer_confirmation: 'Awaiting your confirmation',
    confirmed: 'Order Confirmed',
    packed: 'Packed at Farm',
    shipped: 'Shipped from Farm',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered Successfully',
    rejected: 'Rejected by seller',
    cancelled: 'Order Cancelled',
  };
  return map[status] || status;
}

const PROGRESSION: { status: OrderStatus; title: string; titleTamil: string; description: string }[] = [
  { status: 'placed', title: 'Order Placed', titleTamil: 'ஆர்டர் பதிவு செய்யப்பட்டது', description: 'Order received by the farmer' },
  { status: 'confirmed', title: 'Confirmed', titleTamil: 'விவசாயி உறுதி செய்தார்', description: 'Farmer accepted your order' },
  { status: 'packed', title: 'Packed', titleTamil: 'பேக் செய்யப்பட்டது', description: 'Produce harvested and packed' },
  { status: 'shipped', title: 'Shipped', titleTamil: 'அனுப்பப்பட்டது', description: 'Dispatched from the farm' },
  { status: 'out_for_delivery', title: 'Out for Delivery', titleTamil: 'விநியோகத்திற்கு புறப்பட்டது', description: 'On the way to your address' },
  { status: 'delivered', title: 'Delivered', titleTamil: 'ஒப்படைக்கப்பட்டது', description: 'Delivered and verified with OTP' },
];

function formatTimestamp(ts?: string): string | undefined {
  if (!ts) return undefined;
  // Backend timestamps are UTC without an offset; mark them as UTC before formatting locally.
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts : `${ts}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Builds the six-stage delivery timeline from the server's status history.
 */
export function buildTimeline(o: Pick<BackendOrder, 'status' | 'status_history'>): TimelineStep[] {
  const history = o.status_history || [];
  const currentIdx = PROGRESSION.findIndex((p) => p.status === o.status);
  // 'pending_seller_approval' / 'awaiting_buyer_confirmation' sit between placed and confirmed
  const effectiveIdx = currentIdx >= 0 ? currentIdx : ['cancelled', 'rejected'].includes(o.status) ? -1 : 0;

  return PROGRESSION.map((step, idx) => {
    const entry = [...history].reverse().find((h) => h.status === step.status);
    const done = effectiveIdx > idx || (o.status === 'delivered' && idx === effectiveIdx);
    return {
      status: step.status,
      title: step.title,
      titleTamil: step.titleTamil,
      description: entry?.note || step.description,
      time: formatTimestamp(entry?.timestamp) ?? (idx === 0 ? formatTimestamp(history[0]?.timestamp) : undefined),
      done: done || (idx === 0 && history.length > 0),
      current: idx === effectiveIdx && o.status !== 'delivered',
    };
  });
}

/**
 * Transforms backend order model into the mobile app's Order interface.
 */
export function mapBackendOrderToApp(o: BackendOrder): Order {
  let tab: OrderTab = 'ongoing';
  if (o.status === 'delivered') tab = 'delivered';
  else if (o.status === 'cancelled' || o.status === 'rejected') tab = 'cancelled';

  const appItems: OrderItem[] = (o.items || []).map((it, idx) => ({
    id: String(it.product_id ?? idx),
    name: it.name,
    price: it.price,
    quantity: it.quantity,
    unit: it.unit,
    image: it.image || undefined,
  }));

  return {
    id: String(o.id),
    orderDate: formatTimestamp(o.created_at) ?? '',
    createdAt: o.created_at,
    tab,
    status: o.status as OrderStatus,
    statusLabel: getStatusLabel(o.status),
    buyerName: o.buyer_name || 'Buyer',
    buyerPhone: o.buyer_mobile || undefined,
    sellerId: String(o.seller_id),
    sellerName: o.seller_name || 'Farmer',
    sellerPhone: o.seller_mobile || undefined,
    sellerAddress: o.seller_address || undefined,
    deliveryAddress: o.address,
    deliveryNotes: o.delivery_notes || undefined,
    items: appItems,
    subtotal: o.subtotal,
    deliveryFee: o.delivery_fee,
    extraDeliveryFee: o.extra_delivery_fee || 0,
    grandTotal: o.total,
    paymentMode: o.payment_method === 'cod' ? 'cod' : 'upi',
    paymentStatus: o.payment_status || 'pending',
    upiUtr: o.upi_utr,
    paymentSubmittedAt: o.payment_submitted_at,
    paymentConfirmedAt: o.payment_confirmed_at,
    paymentRejectedReason: o.payment_rejected_reason,
    paymentResubmitCount: o.payment_resubmit_count,
    deliveryOtp: o.delivery_otp || undefined,
    timeline: buildTimeline(o),
    isExtendedDelivery: o.is_extended_delivery,
    rejectReason: o.reject_reason,
    sellerNote: o.seller_note,
    distanceKm: o.distance_km,
  };
}

export const orderService = {
  /**
   * Buyer creates an order.
   */
  async createOrder(payload: CreateOrderPayload): Promise<BackendOrder> {
    const res = (await apiClient.post('/orders', payload)) as BackendOrder;
    return res;
  },

  /**
   * Get orders for the current user (filtered by tab) with limit/offset pagination.
   */
  async getMyOrders(
    tab = 'all',
    limit = 20,
    offset = 0
  ): Promise<{ items: Order[]; total: number; limit: number; offset: number }> {
    const res = (await apiClient.get('/orders/mine', {
      params: { tab, limit, offset },
    })) as
      | { items: BackendOrder[]; total: number; limit: number; offset: number }
      | BackendOrder[];

    if (res && 'items' in res && Array.isArray(res.items)) {
      return {
        items: res.items.map(mapBackendOrderToApp),
        total: res.total,
        limit: res.limit,
        offset: res.offset,
      };
    }
    if (Array.isArray(res)) {
      return {
        items: res.map(mapBackendOrderToApp),
        total: res.length,
        limit: res.length,
        offset: 0,
      };
    }
    return { items: [], total: 0, limit, offset };
  },

  /**
   * Get single order by ID.
   */
  async getOrderById(orderId: number | string): Promise<Order> {
    const res = (await apiClient.get(`/orders/${orderId}`)) as BackendOrder;
    return mapBackendOrderToApp(res);
  },

  /**
   * Track order timeline, ETA, and delivery OTP.
   */
  async trackOrder(orderId: number | string): Promise<TrackOrderResponse> {
    const res = (await apiClient.get(`/orders/${orderId}/track`)) as TrackOrderResponse;
    return res;
  },

  /**
   * Buyer fetches server-computed UPI payment URL, QR code payload, and seller VPA.
   */
  async getUpiLink(orderId: number | string): Promise<UpiLinkResponse> {
    const res = (await apiClient.get(`/orders/${orderId}/upi-link`)) as UpiLinkResponse;
    return res;
  },

  /**
   * Buyer submits 12-digit UPI UTR transaction reference number.
   */
  async submitUtr(orderId: number | string, utr: string): Promise<BackendOrder> {
    const res = (await apiClient.post(`/orders/${orderId}/payment/submit-utr`, { utr })) as BackendOrder;
    return res;
  },

  /**
   * Seller confirms receipt of UPI payment.
   */
  async confirmPayment(orderId: number | string): Promise<BackendOrder> {
    const res = (await apiClient.patch(`/orders/${orderId}/payment/confirm`)) as BackendOrder;
    return res;
  },

  /**
   * Seller rejects submitted payment with a reason.
   */
  async rejectPayment(orderId: number | string, reason: string): Promise<BackendOrder> {
    const res = (await apiClient.patch(`/orders/${orderId}/payment/reject`, { reason })) as BackendOrder;
    return res;
  },

  /**
   * Buyer cancels placed order.
   */
  async cancelOrder(orderId: number | string): Promise<BackendOrder> {
    const res = (await apiClient.patch(`/orders/${orderId}/cancel`)) as BackendOrder;
    return res;
  },

  /**
   * Buyer confirms extra delivery fee for extended delivery.
   */
  async buyerConfirm(orderId: number | string): Promise<BackendOrder> {
    const res = (await apiClient.patch(`/orders/${orderId}/buyer-confirm`)) as BackendOrder;
    return res;
  },

  /**
   * Seller approves order (with optional extra delivery fee & note).
   */
  async approveOrder(
    orderId: number | string,
    extraDeliveryFee = 0,
    sellerNote?: string
  ): Promise<BackendOrder> {
    const res = (await apiClient.patch(`/orders/${orderId}/approve`, {
      extra_delivery_fee: extraDeliveryFee,
      seller_note: sellerNote,
    })) as BackendOrder;
    return res;
  },

  /**
   * Seller rejects order with reason.
   */
  async rejectOrder(orderId: number | string, reason: string): Promise<BackendOrder> {
    const res = (await apiClient.patch(`/orders/${orderId}/reject`, {
      reason,
    })) as BackendOrder;
    return res;
  },

  /**
   * Seller advances order status (packed -> shipped -> out_for_delivery -> delivered).
   */
  async updateStatus(
    orderId: number | string,
    status: 'packed' | 'shipped' | 'out_for_delivery' | 'delivered',
    options: { note?: string; deliveryOtp?: string } = {}
  ): Promise<BackendOrder> {
    const res = (await apiClient.patch(`/orders/${orderId}/status`, {
      status,
      note: options.note,
      delivery_otp: options.deliveryOtp,
    })) as BackendOrder;
    return res;
  },
};

/**
 * Refresh every cached order view after a mutation so all screens show server state.
 */
export function invalidateOrderQueries(queryClient: QueryClient, orderId?: number | string) {
  queryClient.invalidateQueries({ queryKey: ['orders-mine'] });
  queryClient.invalidateQueries({ queryKey: ['buyer-my-orders-infinite'] });
  queryClient.invalidateQueries({ queryKey: ['seller-my-orders-infinite'] });
  queryClient.invalidateQueries({ queryKey: ['payout-summary'] });
  if (orderId !== undefined) {
    queryClient.invalidateQueries({ queryKey: ['order', String(orderId)] });
    queryClient.invalidateQueries({ queryKey: ['order-track', String(orderId)] });
  }
}

/**
 * TanStack Query Hook: polls order tracking every 15 seconds.
 */
export function useOrderTracking(orderId: number | string | undefined) {
  return useQuery({
    queryKey: ['order-track', String(orderId)],
    queryFn: () => orderService.trackOrder(orderId!),
    enabled: Boolean(orderId),
    refetchInterval: 15000, // 15 seconds real-time polling
  });
}

/**
 * TanStack Query Hook: polls single order with configurable interval (for payment status polling).
 */
export function useOrder(orderId: number | string | undefined, refetchInterval: number | false = 15000) {
  return useQuery({
    queryKey: ['order', String(orderId)],
    queryFn: () => orderService.getOrderById(orderId!),
    enabled: Boolean(orderId),
    refetchInterval,
  });
}

/**
 * TanStack Query Hook: fetches my orders with 15-second refresh.
 */
export function useMyOrders(tab = 'all', limit = 20, offset = 0) {
  return useQuery({
    queryKey: ['orders-mine', tab, limit, offset],
    queryFn: () => orderService.getMyOrders(tab, limit, offset),
    refetchInterval: 15000,
  });
}

export default orderService;
