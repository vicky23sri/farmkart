/**
 * Order Service
 * Connects to the FastAPI backend /orders/* endpoints.
 * Includes TanStack Query hooks for live 15-second tracking refetching.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from './api';
import { Order, OrderItem, OrderStatus, OrderTab, TimelineStep } from '@/store/useOrderStore';

export interface CreateOrderPayload {
  items: { product_id: number; quantity: number }[];
  address: string;
  lat?: number;
  lng?: number;
  payment_method: 'cod' | 'online';
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
  payment_method: 'cod' | 'online';
  payment_status: 'pending' | 'paid' | 'collected' | 'failed';
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
  delivery_otp?: string;
  created_at?: string;
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

/**
 * Transforms backend order model into the mobile app's Order interface.
 */
export function mapBackendOrderToApp(o: BackendOrder): Order & {
  isExtendedDelivery?: boolean;
  extraDeliveryFee?: number;
  rejectReason?: string;
  sellerNote?: string;
  distanceKm?: number;
} {
  let tab: OrderTab = 'ongoing';
  if (o.status === 'delivered') tab = 'delivered';
  else if (o.status === 'cancelled' || o.status === 'rejected') tab = 'cancelled';

  const appItems: OrderItem[] = (o.items || []).map((it, idx) => ({
    id: String(it.product_id || idx),
    name: it.name,
    price: it.price,
    quantity: it.quantity,
    unit: it.unit,
    image: it.image || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400',
  }));

  // Build timeline steps
  const timeline: TimelineStep[] = (o.status_history || []).map((h) => ({
    status: h.status as OrderStatus,
    title: getStatusLabel(h.status),
    titleTamil: getStatusLabel(h.status),
    description: h.note || `Order status updated to ${h.status}`,
    time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    done: true,
    current: h.status === o.status,
  }));

  return {
    id: String(o.id),
    orderDate: o.created_at ? new Date(o.created_at).toLocaleDateString() : 'Today',
    tab,
    status: o.status as OrderStatus,
    statusLabel: getStatusLabel(o.status),
    buyerName: 'Karthik V.',
    buyerPhone: '+91 98765 43210',
    sellerId: String(o.seller_id),
    sellerName: 'Vadipatti Organic Farm',
    sellerFarm: 'Vadipatti Organic Farm',
    sellerPhone: '+91 98421 56780',
    sellerVillage: 'Vadipatti, Madurai',
    sellerLat: 10.0528,
    sellerLng: 77.9625,
    deliveryAddress: o.address,
    deliverySlot: 'Standard Delivery (24-48 hrs)',
    items: appItems,
    subtotal: o.subtotal,
    deliveryFee: o.delivery_fee,
    couponDiscount: 0,
    grandTotal: o.total,
    paymentMode: o.payment_method === 'cod' ? 'cod' : 'upi',
    paymentStatus: o.payment_status === 'paid' || o.payment_status === 'collected' ? 'paid' : 'pending',
    deliveryOtp: o.delivery_otp || '1234',
    timeline,
    isExtendedDelivery: o.is_extended_delivery,
    extraDeliveryFee: o.extra_delivery_fee,
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
   * Get orders for the current user (filtered by tab).
   */
  async getMyOrders(tab = 'all'): Promise<Order[]> {
    const res = (await apiClient.get('/orders/mine', {
      params: { tab },
    })) as BackendOrder[];
    return res.map(mapBackendOrderToApp);
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
    status: OrderStatus | string,
    note?: string
  ): Promise<BackendOrder> {
    const res = (await apiClient.patch(`/orders/${orderId}/status`, {
      status,
      note,
    })) as BackendOrder;
    return res;
  },
};

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
 * TanStack Query Hook: fetches my orders with 15-second refresh.
 */
export function useMyOrders(tab = 'all') {
  return useQuery({
    queryKey: ['orders-mine', tab],
    queryFn: () => orderService.getMyOrders(tab),
    refetchInterval: 15000,
  });
}

export default orderService;
