/**
 * Cart Store
 * Persistent Zustand basket state backed by AsyncStorage.
 * Calculates:
 * - Real-time distances to each product's farmer
 * - Load-based delivery fees (Bike under 10 km, Mini Truck, Tractor for bulk items)
 * - Coupon discounts
 * - 50 km doorstep delivery feasibility guard
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { Product } from '@/data/products';
import { getDistanceKm } from '@/utils/distance';

export interface CartItem {
  id: string; // product id
  product: Product;
  quantity: number;
  selectedUnit: string;
}

export type DeliveryVehicleTier = 'two_wheeler' | 'mini_truck' | 'tractor';

export interface DeliveryBreakdown {
  fee: number;
  vehicleTier: DeliveryVehicleTier;
  vehicleName: string;
  vehicleNameTamil: string;
  maxDistanceKm: number;
  isBulk: boolean;
  description: string;
}

export interface Coupon {
  code: string;
  discountType: 'fixed' | 'percent';
  value: number;
  minOrder: number;
  description: string;
}

export const AVAILABLE_COUPONS: Coupon[] = [
  {
    code: 'FARM50',
    discountType: 'fixed',
    value: 50,
    minOrder: 200,
    description: '₹50 flat discount on farm orders above ₹200',
  },
  {
    code: 'UZHAVAN10',
    discountType: 'percent',
    value: 10,
    minOrder: 100,
    description: '10% off directly on your harvest order',
  },
  {
    code: 'FIRSTCROP',
    discountType: 'fixed',
    value: 100,
    minOrder: 500,
    description: '₹100 welcome discount on orders above ₹500',
  },
];

interface CartState {
  items: CartItem[];
  couponCode: string | null;
  couponDiscount: number;
  couponError: string | null;

  // Actions
  addItem: (product: Product, quantity?: number, selectedUnit?: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;

  // Coupon actions
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;

  // Getters & Calculations
  getItemQuantity: (productId: string) => number;
  getTotalCount: () => number;
  getSubtotal: () => number;
  getTotalPrice: () => number; // Alias for getSubtotal

  // Dynamic Distance & Delivery Fee Calculation
  getDeliveryBreakdown: (buyerLat: number, buyerLng: number) => DeliveryBreakdown;
  getGrandTotal: (buyerLat: number, buyerLng: number) => number;

  // 50 km Guard Checks
  getItemsWithDistance: (
    buyerLat: number,
    buyerLng: number
  ) => (CartItem & { distanceKm: number; isDeliverable: boolean })[];
  hasOutOfRangeItems: (buyerLat: number, buyerLng: number, maxKm?: number) => boolean;
  getOutOfRangeItems: (
    buyerLat: number,
    buyerLng: number,
    maxKm?: number
  ) => (CartItem & { distanceKm: number })[];
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: null,
      couponDiscount: 0,
      couponError: null,

      addItem: (product: Product, quantity = 1, selectedUnit?: string) => {
        const unit = selectedUnit || product.unit;
        const currentItems = get().items;
        const existingIndex = currentItems.findIndex(
          (i) => i.product.id === product.id
        );

        if (existingIndex > -1) {
          const updated = [...currentItems];
          updated[existingIndex].quantity += quantity;
          set({ items: updated });
        } else {
          set({
            items: [
              ...currentItems,
              {
                id: product.id,
                product,
                quantity: Math.max(quantity, product.minOrder || 1),
                selectedUnit: unit,
              },
            ],
          });
        }
      },

      updateQuantity: (productId: string, quantity: number) => {
        const currentItems = get().items;
        if (quantity <= 0) {
          set({ items: currentItems.filter((i) => i.id !== productId) });
        } else {
          set({
            items: currentItems.map((i) =>
              i.id === productId ? { ...i, quantity } : i
            ),
          });
        }
      },

      removeItem: (productId: string) => {
        set({ items: get().items.filter((i) => i.id !== productId) });
      },

      clearCart: () =>
        set({
          items: [],
          couponCode: null,
          couponDiscount: 0,
          couponError: null,
        }),

      applyCoupon: (rawCode: string) => {
        const code = rawCode.trim().toUpperCase();
        const subtotal = get().getSubtotal();

        const coupon = AVAILABLE_COUPONS.find((c) => c.code === code);
        if (!coupon) {
          set({ couponError: 'Invalid coupon code. Try FARM50 or UZHAVAN10' });
          return { success: false, message: 'Invalid coupon code' };
        }

        if (subtotal < coupon.minOrder) {
          const msg = `Minimum order amount of ₹${coupon.minOrder} required for ${code}`;
          set({ couponError: msg });
          return { success: false, message: msg };
        }

        let discount = 0;
        if (coupon.discountType === 'fixed') {
          discount = Math.min(coupon.value, subtotal);
        } else if (coupon.discountType === 'percent') {
          discount = Math.round((subtotal * coupon.value) / 100);
          if (discount > 150) discount = 150; // Cap at 150
        }

        set({
          couponCode: code,
          couponDiscount: discount,
          couponError: null,
        });

        return {
          success: true,
          message: `Coupon ${code} applied successfully! Saved ₹${discount}`,
        };
      },

      removeCoupon: () =>
        set({ couponCode: null, couponDiscount: 0, couponError: null }),

      getItemQuantity: (productId: string) => {
        const found = get().items.find((i) => i.id === productId);
        return found ? found.quantity : 0;
      },

      getTotalCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce(
          (sum, item) => sum + item.product.price * item.quantity,
          0
        );
      },

      getTotalPrice: () => {
        return get().getSubtotal();
      },

      /**
       * Delivery Fee Calculation based on distance and load:
       * - Bike under 10 km (₹30 flat for light produce)
       * - Mini truck for 10-25 km or medium weight (₹60 base)
       * - Tractor for bulk items (manure tractor load, paddy quintals, fodder bales, 25-50 km: ₹150 base)
       */
      getDeliveryBreakdown: (buyerLat: number, buyerLng: number): DeliveryBreakdown => {
        const items = get().items;
        if (items.length === 0) {
          return {
            fee: 0,
            vehicleTier: 'two_wheeler',
            vehicleName: 'Free',
            vehicleNameTamil: 'இலவசம்',
            maxDistanceKm: 0,
            isBulk: false,
            description: 'No items in cart',
          };
        }

        // Calculate max distance among all farmer sources
        let maxDistance = 0;
        let hasBulkItem = false;
        let totalEstimatedWeightKg = 0;

        for (const item of items) {
          const dist = getDistanceKm(
            buyerLat,
            buyerLng,
            item.product.lat,
            item.product.lng
          );
          if (dist > maxDistance) {
            maxDistance = dist;
          }

          // Check if item qualifies as bulk load
          const unit = item.selectedUnit || item.product.unit;
          if (
            unit === 'tractor load' ||
            unit === 'truck load' ||
            unit === 'quintal' ||
            item.product.category === 'manure' ||
            item.product.category === 'fodder' ||
            item.quantity >= 30
          ) {
            hasBulkItem = true;
          }

          // Rough weight estimation
          if (unit === 'tractor load') totalEstimatedWeightKg += 2500;
          else if (unit === 'quintal') totalEstimatedWeightKg += 100 * item.quantity;
          else if (unit === 'bag') totalEstimatedWeightKg += 40 * item.quantity;
          else totalEstimatedWeightKg += item.quantity;
        }

        // Determine vehicle tier & fee
        if (hasBulkItem || totalEstimatedWeightKg >= 150) {
          // Tractor / Heavy Agro Vehicle
          const baseFee = 150;
          const distanceAddon = Math.round(maxDistance * 2.5);
          const fee = baseFee + distanceAddon;
          return {
            fee,
            vehicleTier: 'tractor',
            vehicleName: 'Tractor Tipper / Heavy Load',
            vehicleNameTamil: 'டிராக்டர் / கனரக லோடு',
            maxDistanceKm: maxDistance,
            isBulk: true,
            description: `Tractor transport for ${totalEstimatedWeightKg >= 1000 ? 'bulk harvest/manure' : 'heavy load'} (${maxDistance.toFixed(1)} km)`,
          };
        } else if (maxDistance > 10 || totalEstimatedWeightKg >= 25) {
          // Mini Truck / Auto
          const baseFee = 60;
          const distanceAddon = maxDistance > 10 ? Math.round((maxDistance - 10) * 2) : 0;
          const fee = baseFee + distanceAddon;
          return {
            fee,
            vehicleTier: 'mini_truck',
            vehicleName: 'Mini Truck / Auto Cargo',
            vehicleNameTamil: 'மினி லாரி / ஆட்டோ கார்கோ',
            maxDistanceKm: maxDistance,
            isBulk: false,
            description: `Farm-to-door delivery for ${maxDistance.toFixed(1)} km`,
          };
        } else {
          // Bike Courier (under 10 km, light harvest)
          return {
            fee: 30,
            vehicleTier: 'two_wheeler',
            vehicleName: 'Two-Wheeler Direct Express',
            vehicleNameTamil: 'இருசக்கர விரைவு விநியோகம்',
            maxDistanceKm: maxDistance,
            isBulk: false,
            description: `Local doorstep express delivery under 10 km (${maxDistance.toFixed(1)} km)`,
          };
        }
      },

      getGrandTotal: (buyerLat: number, buyerLng: number) => {
        const subtotal = get().getSubtotal();
        const discount = get().couponDiscount;
        const deliveryFee = get().getDeliveryBreakdown(buyerLat, buyerLng).fee;
        return Math.max(0, subtotal - discount + deliveryFee);
      },

      getItemsWithDistance: (buyerLat: number, buyerLng: number) => {
        return get().items.map((item) => {
          const dist = getDistanceKm(
            buyerLat,
            buyerLng,
            item.product.lat,
            item.product.lng
          );
          return {
            ...item,
            distanceKm: dist,
            isDeliverable: dist <= 50,
          };
        });
      },

      hasOutOfRangeItems: (buyerLat: number, buyerLng: number, maxKm = 50) => {
        return get().items.some((item) => {
          const dist = getDistanceKm(
            buyerLat,
            buyerLng,
            item.product.lat,
            item.product.lng
          );
          return dist > maxKm;
        });
      },

      getOutOfRangeItems: (buyerLat: number, buyerLng: number, maxKm = 50) => {
        const outList: (CartItem & { distanceKm: number })[] = [];
        for (const item of get().items) {
          const dist = getDistanceKm(
            buyerLat,
            buyerLng,
            item.product.lat,
            item.product.lng
          );
          if (dist > maxKm) {
            outList.push({ ...item, distanceKm: dist });
          }
        }
        return outList;
      },
    }),
    {
      name: 'farmkart_cart_storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        items: state.items,
        couponCode: state.couponCode,
        couponDiscount: state.couponDiscount,
      }),
    }
  )
);

export default useCartStore;
