/**
 * Order Store
 * Persistent Zustand store shared by Buyer and Seller.
 * Manages orders across categories: Ongoing, Delivered, Cancelled, Returns.
 * Controls vertical tracking timeline stages, delivery partner status, COD collection, and OTP.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
  | 'cancelled'
  | 'returned';

export type OrderTab = 'ongoing' | 'delivered' | 'cancelled' | 'returns';

export interface OrderItem {
  id: string;
  name: string;
  nameTamil?: string;
  price: number;
  quantity: number;
  unit: string;
  image?: string;
  farmerName?: string;
}

export interface DeliveryPartner {
  name: string;
  phone: string;
  vehicleNumber: string;
  vehicleType: string;
  lat: number;
  lng: number;
  eta: string;
  distanceRemainingKm: number;
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
  tab: OrderTab;
  status: OrderStatus;
  statusLabel: string;
  buyerName: string;
  buyerPhone: string;
  sellerId: string;
  sellerName: string;
  sellerFarm: string;
  sellerPhone: string;
  sellerVillage: string;
  sellerLat: number;
  sellerLng: number;
  deliveryAddress: string;
  deliverySlot: string;
  deliveryNotes?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  couponDiscount: number;
  grandTotal: number;
  paymentMode: 'upi' | 'card' | 'netbanking' | 'wallet' | 'cod';
  paymentStatus: 'paid' | 'pending';
  deliveryPartner?: DeliveryPartner;
  deliveryOtp: string;
  timeline: TimelineStep[];
  isReviewed?: boolean;
  review?: OrderReview;
  isExtendedDelivery?: boolean;
  distanceKm?: number;
  extraDeliveryFee?: number;
  sellerNote?: string;
  rejectionReason?: string;
}

export interface OrderReview {
  productRating: number;
  farmerRating: number;
  deliveryRating: number;
  comment: string;
  photos: string[];
  tags: string[];
  date: string;
}

const DEFAULT_TIMELINE_TEMPLATE: Omit<TimelineStep, 'done' | 'current' | 'time'>[] = [
  {
    status: 'placed',
    title: 'Order Placed',
    titleTamil: 'ஆர்டர் பதிவு செய்யப்பட்டது',
    description: 'Received by FarmKart marketplace system',
  },
  {
    status: 'confirmed',
    title: 'Confirmed',
    titleTamil: 'விவசாயி உறுதி செய்தார்',
    description: 'Farmer accepted order and scheduled harvest',
  },
  {
    status: 'packed',
    title: 'Packed',
    titleTamil: 'அறுவடை செய்து பேக் செய்யப்பட்டது',
    description: 'Fresh crop cut and packed in eco-friendly sacks',
  },
  {
    status: 'shipped',
    title: 'Shipped',
    titleTamil: 'பண்ணையிலிருந்து அனுப்பப்பட்டது',
    description: 'Dispatched via local farm delivery vehicle',
  },
  {
    status: 'out_for_delivery',
    title: 'Out for Delivery',
    titleTamil: 'விநியோகத்திற்கு புறப்பட்டது',
    description: 'Delivery partner is en route to your doorstep',
  },
  {
    status: 'delivered',
    title: 'Delivered',
    titleTamil: 'வீட்டு வாசலில் ஒப்படைக்கப்பட்டது',
    description: 'Produce delivered and verified at doorstep',
  },
];

export function buildTimeline(
  currentStatus: OrderStatus,
  placedTime = 'Today, 2:15 PM',
  existingTimeline?: TimelineStep[]
): TimelineStep[] {
  const statusOrder: OrderStatus[] = [
    'placed',
    'confirmed',
    'packed',
    'shipped',
    'out_for_delivery',
    'delivered',
  ];

  const currentIndex = statusOrder.indexOf(currentStatus);

  const defaultTimes = [
    placedTime,
    'Today, 2:25 PM',
    'Today, 2:45 PM',
    'Today, 3:10 PM',
    'Today, 3:30 PM',
    'Today, 4:05 PM',
  ];

  return DEFAULT_TIMELINE_TEMPLATE.map((tmpl, idx) => {
    const isDone = currentIndex > idx || (currentIndex === idx && currentStatus === 'delivered');
    const isCurrent = currentIndex === idx && currentStatus !== 'delivered';

    let timeString: string | undefined = undefined;
    const existingStep = existingTimeline?.find((s) => s.status === tmpl.status);

    if (existingStep?.time) {
      timeString = existingStep.time;
    } else if (idx <= currentIndex) {
      if (idx === currentIndex && currentIndex > 0) {
        const now = new Date();
        const hours = now.getHours();
        const mins = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
        timeString = `Today, ${formattedHours}:${mins} ${ampm}`;
      } else {
        timeString = defaultTimes[idx];
      }
    }

    return {
      ...tmpl,
      done: isDone,
      current: isCurrent,
      time: timeString,
    };
  });
}

// Initial realistic Tamil Nadu agricultural orders
export const INITIAL_ORDERS: Order[] = [
  // 1. Ongoing order (Out for delivery, COD)
  {
    id: 'ORD-7821',
    orderDate: 'Today, 2:15 PM',
    tab: 'ongoing',
    status: 'out_for_delivery',
    statusLabel: 'Out for Delivery',
    buyerName: 'Karthik V.',
    buyerPhone: '+91 98765 43210',
    sellerId: 'seller-1',
    sellerName: 'Ramasamy Gounder',
    sellerFarm: 'Vadipatti Iyarkai Pannai',
    sellerPhone: '+91 98421 56780',
    sellerVillage: 'Vadipatti, Madurai',
    sellerLat: 10.0558,
    sellerLng: 77.9622,
    deliveryAddress: 'Flat 4B, Kaveri Green Apts, Bypass Road, Madurai - 625002',
    deliverySlot: 'Today Evening (4:30 PM - 7:30 PM)',
    deliveryNotes: 'Near Meenakshi Temple west tower, gate 2',
    items: [
      {
        id: 'prod-07',
        name: 'Country Tomatoes (நாட்டு தக்காளி)',
        nameTamil: 'நாட்டு தக்காளி',
        price: 35,
        quantity: 3,
        unit: 'kg',
        image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400',
        farmerName: 'Ramasamy Gounder',
      },
      {
        id: 'prod-04',
        name: 'Kezhvaragu / Finger Millet (Ragi)',
        nameTamil: 'நாட்டு கேழ்வரகு',
        price: 42,
        quantity: 2,
        unit: 'kg',
        image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400',
        farmerName: 'Ramasamy Gounder',
      },
    ],
    subtotal: 189,
    deliveryFee: 30,
    couponDiscount: 0,
    grandTotal: 219,
    paymentMode: 'cod',
    paymentStatus: 'pending',
    deliveryOtp: '4829',
    deliveryPartner: {
      name: 'Senthil Kumar',
      phone: '+91 98421 99881',
      vehicleNumber: 'TN-59-BZ-4102',
      vehicleType: 'Two-Wheeler Express',
      lat: 9.9950,
      lng: 78.0400,
      eta: '25 mins (4:45 PM)',
      distanceRemainingKm: 3.8,
    },
    timeline: buildTimeline('out_for_delivery', 'Today, 2:15 PM'),
  },

  // 2. Delivered order (Paid UPI)
  {
    id: 'ORD-6402',
    orderDate: 'Oct 24, 2026, 10:30 AM',
    tab: 'delivered',
    status: 'delivered',
    statusLabel: 'Delivered Successfully',
    buyerName: 'Karthik V.',
    buyerPhone: '+91 98765 43210',
    sellerId: 'seller-2',
    sellerName: 'Murugesan Chettiar',
    sellerFarm: 'Cauvery Delta Paddy Farms',
    sellerPhone: '+91 94431 89012',
    sellerVillage: 'Thiruvaiyaru, Thanjavur',
    sellerLat: 10.8803,
    sellerLng: 79.1039,
    deliveryAddress: 'Flat 4B, Kaveri Green Apts, Bypass Road, Madurai - 625002',
    deliverySlot: 'Morning (6:00 AM - 9:00 AM)',
    items: [
      {
        id: 'prod-02',
        name: 'Traditional Seeraga Samba Nellu',
        nameTamil: 'சீரக சம்பா நெல்',
        price: 420,
        quantity: 1,
        unit: 'bag',
        image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400',
        farmerName: 'Murugesan Chettiar',
      },
      {
        id: 'prod-12',
        name: 'Small Shallot Sambar Onions',
        nameTamil: 'சின்ன வெங்காயம்',
        price: 65,
        quantity: 4,
        unit: 'kg',
        image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400',
        farmerName: 'Murugesan Chettiar',
      },
    ],
    subtotal: 680,
    deliveryFee: 60,
    couponDiscount: 50,
    grandTotal: 690,
    paymentMode: 'upi',
    paymentStatus: 'paid',
    deliveryOtp: '7104',
    timeline: buildTimeline('delivered', 'Oct 24, 2026, 10:30 AM'),
  },

  // 3. Cancelled order
  {
    id: 'ORD-5190',
    orderDate: 'Oct 20, 2026, 4:00 PM',
    tab: 'cancelled',
    status: 'cancelled',
    statusLabel: 'Order Cancelled',
    buyerName: 'Karthik V.',
    buyerPhone: '+91 98765 43210',
    sellerId: 'seller-3',
    sellerName: 'Selvam Muthuvel',
    sellerFarm: 'Oddanchatram Vegetable Collective',
    sellerPhone: '+91 97880 23451',
    sellerVillage: 'Oddanchatram, Dindigul',
    sellerLat: 10.4851,
    sellerLng: 77.7472,
    deliveryAddress: 'Bypass Road, Madurai - 625002',
    deliverySlot: 'Evening',
    items: [
      {
        id: 'prod-18',
        name: 'Co-4 High Protein Fodder Grass',
        nameTamil: 'கோ-4 தீவனப்புல் கட்டு',
        price: 180,
        quantity: 2,
        unit: 'bundle',
        image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400',
        farmerName: 'Selvam Muthuvel',
      },
    ],
    subtotal: 360,
    deliveryFee: 60,
    couponDiscount: 0,
    grandTotal: 420,
    paymentMode: 'upi',
    paymentStatus: 'paid',
    deliveryOtp: '3921',
    timeline: [
      {
        status: 'placed',
        title: 'Order Placed',
        titleTamil: 'ஆர்டர் பதிவு செய்யப்பட்டது',
        time: 'Oct 20, 4:00 PM',
        description: 'Order placed by buyer',
        done: true,
        current: false,
      },
      {
        status: 'cancelled',
        title: 'Cancelled by Buyer',
        titleTamil: 'வாங்குபவரால் ரத்து செய்யப்பட்டது',
        time: 'Oct 20, 4:35 PM',
        description: 'Cancelled: Changed delivery date preference',
        done: true,
        current: true,
      },
    ],
  },

  // 4. Returns order
  {
    id: 'ORD-4109',
    orderDate: 'Oct 18, 2026, 11:20 AM',
    tab: 'returns',
    status: 'returned',
    statusLabel: 'Return Approved & Refunded',
    buyerName: 'Karthik V.',
    buyerPhone: '+91 98765 43210',
    sellerId: 'seller-4',
    sellerName: 'Sundarrajan Palanisamy',
    sellerFarm: 'Kongu Organic Cattle & Dairy',
    sellerPhone: '+91 98942 67890',
    sellerVillage: 'Pollachi, Coimbatore',
    sellerLat: 10.6609,
    sellerLng: 77.0048,
    deliveryAddress: 'Bypass Road, Madurai - 625002',
    deliverySlot: 'Morning',
    items: [
      {
        id: 'prod-20',
        name: 'Pure Desi Cow A2 Bilona Ghee',
        nameTamil: 'நாட்டுப்பசு பிலோனா நெய்',
        price: 750,
        quantity: 1,
        unit: 'kg',
        image: 'https://images.unsplash.com/photo-1589923188900-85dae523342b?w=400',
        farmerName: 'Sundarrajan Palanisamy',
      },
    ],
    subtotal: 750,
    deliveryFee: 40,
    couponDiscount: 50,
    grandTotal: 740,
    paymentMode: 'upi',
    paymentStatus: 'paid',
    deliveryOtp: '1849',
    timeline: [
      {
        status: 'delivered',
        title: 'Delivered',
        titleTamil: 'ஒப்படைக்கப்பட்டது',
        time: 'Oct 18, 5:30 PM',
        description: 'Delivered to buyer',
        done: true,
        current: false,
      },
      {
        status: 'returned',
        title: 'Return Picked Up',
        titleTamil: 'திரும்பப் பெறப்பட்டது',
        time: 'Oct 19, 11:00 AM',
        description: 'Jar lid damaged during transport • Full refund ₹740 credited',
        done: true,
        current: true,
      },
    ],
  },
];

interface OrderStoreState {
  orders: Order[];
  getOrderById: (orderId: string) => Order | undefined;
  getOrdersByTab: (tab: OrderTab) => Order[];
  getOrdersForSeller: (sellerId?: string) => Order[];

  // Order lifecycle updates (shared by Seller & Buyer)
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  createOrder: (order: Order) => void;
  cancelOrder: (orderId: string, reason?: string) => void;
  requestReturn: (orderId: string, reason: string) => void;
  submitReview: (orderId: string, review: OrderReview) => void;
}

export const useOrderStore = create<OrderStoreState>()(
  persist(
    (set, get) => ({
      orders: INITIAL_ORDERS,

      getOrderById: (orderId: string) => {
        return get().orders.find((o) => o.id.toLowerCase() === orderId.toLowerCase());
      },

      getOrdersByTab: (tab: OrderTab) => {
        return get().orders.filter((o) => o.tab === tab);
      },

      getOrdersForSeller: (sellerId?: string) => {
        if (!sellerId) return get().orders;
        return get().orders.filter((o) => o.sellerId === sellerId);
      },

      /**
       * Crucial Real-Time Update:
       * When seller updates status (e.g. from 'packed' to 'shipped' or 'out_for_delivery'),
       * updates the order's status, tab, and regenerates the timeline.
       * Buyer's tracking screen instantly reflects this update!
       */
      updateOrderStatus: (orderId: string, newStatus: OrderStatus) => {
        set((state) => {
          const updated = state.orders.map((ord) => {
            if (ord.id.toLowerCase() === orderId.toLowerCase()) {
              let newTab: OrderTab = ord.tab;
              if (newStatus === 'delivered') newTab = 'delivered';
              else if (newStatus === 'cancelled') newTab = 'cancelled';
              else if (newStatus === 'returned') newTab = 'returns';
              else newTab = 'ongoing';

              const statusLabels: Record<OrderStatus, string> = {
                pending_seller_approval: 'Waiting for seller approval',
                awaiting_buyer_confirmation: 'Awaiting your confirmation',
                rejected: 'Rejected by seller',
                placed: 'Order Placed',
                confirmed: 'Order Confirmed',
                packed: 'Harvest Packed',
                shipped: 'Shipped from Farm',
                out_for_delivery: 'Out for Delivery',
                delivered: 'Delivered Successfully',
                cancelled: 'Order Cancelled',
                returned: 'Returned & Refunded',
              };

              const newPaymentStatus =
                newStatus === 'delivered' ? 'paid' : ord.paymentStatus;

              const updatedPartner = ord.deliveryPartner
                ? {
                    ...ord.deliveryPartner,
                    eta:
                      newStatus === 'delivered'
                        ? 'Delivered at Doorstep'
                        : newStatus === 'out_for_delivery'
                        ? '15 mins (Arriving Soon)'
                        : ord.deliveryPartner.eta,
                  }
                : undefined;

              return {
                ...ord,
                status: newStatus,
                statusLabel: statusLabels[newStatus],
                tab: newTab,
                paymentStatus: newPaymentStatus,
                deliveryPartner: updatedPartner,
                timeline: buildTimeline(newStatus, ord.orderDate, ord.timeline),
              };
            }
            return ord;
          });

          return { orders: updated };
        });
      },

      createOrder: (order: Order) => {
        set((state) => ({
          orders: [order, ...state.orders],
        }));
      },

      cancelOrder: (orderId: string, reason = 'Cancelled by buyer') => {
        get().updateOrderStatus(orderId, 'cancelled');
      },

      requestReturn: (orderId: string, reason: string) => {
        get().updateOrderStatus(orderId, 'returned');
      },

      submitReview: (orderId: string, review: OrderReview) => {
        set((state) => ({
          orders: state.orders.map((ord) =>
            ord.id.toLowerCase() === orderId.toLowerCase()
              ? { ...ord, isReviewed: true, review }
              : ord
          ),
        }));
      },
    }),
    {
      name: 'farmkart_order_storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        orders: state.orders,
      }),
    }
  )
);

export default useOrderStore;
