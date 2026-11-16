/**
 * Order domain types shared by buyer and seller screens.
 * Orders always come from the API (see services/orderService.ts); nothing is stored locally.
 */

export type OrderStatus =
  | 'pending_seller_approval'
  | 'awaiting_buyer_confirmation'
  | 'rejected'
  | 'placed'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type OrderTab = 'ongoing' | 'delivered' | 'cancelled';

export type PaymentStatus = 'pending' | 'submitted' | 'paid' | 'rejected' | 'expired' | 'collected';

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  image?: string;
}

export interface TimelineStep {
  status: OrderStatus;
  title: string;
  titleTamil: string;
  time?: string;
  description: string;
  done: boolean;
  current: boolean;
}

export interface Order {
  id: string;
  orderDate: string;
  createdAt?: string;
  tab: OrderTab;
  status: OrderStatus;
  statusLabel: string;
  buyerName: string;
  buyerPhone?: string;
  sellerId: string;
  sellerName: string;
  sellerPhone?: string;
  sellerAddress?: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  extraDeliveryFee: number;
  grandTotal: number;
  paymentMode: 'upi' | 'cod';
  paymentStatus: PaymentStatus;
  upiUtr?: string;
  paymentSubmittedAt?: string;
  paymentConfirmedAt?: string;
  paymentRejectedReason?: string;
  paymentResubmitCount?: number;
  /** Only present for the buyer; the seller must ask for it at handover. */
  deliveryOtp?: string;
  timeline: TimelineStep[];
  isExtendedDelivery: boolean;
  distanceKm?: number;
  sellerNote?: string;
  rejectReason?: string;
}
