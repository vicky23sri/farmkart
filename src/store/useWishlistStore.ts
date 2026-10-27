/**
 * Wishlist Store
 * Persistent Zustand store for buyer's saved farm produce.
 * Enables saving favorite crops, toggling hearts, and moving items directly to cart.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface WishlistItem {
  productId: string;
  name: string;
  nameTamil: string;
  category: string;
  price: number;
  unit: string;
  image: string;
  sellerId: string;
  sellerName: string;
  sellerFarm: string;
  village: string;
  lat: number;
  lng: number;
  rating: number;
  isOrganic: boolean;
  stock: number;
  minOrder: number;
  vehicleType?: string;
  addedAt?: string;
}

const INITIAL_WISHLIST: WishlistItem[] = [
  {
    productId: 'prod-1',
    name: 'A2 Cow Dung Manure (Mattu Eruvu)',
    nameTamil: 'நாட்டு மாட்டு எருவு (இயற்கை உரம்)',
    category: 'manure',
    price: 3500,
    unit: 'tractor load',
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600',
    sellerId: 'seller-1',
    sellerName: 'Ramasamy Gounder',
    sellerFarm: 'Vadipatti Iyarkai Pannai',
    village: 'Vadipatti',
    lat: 10.0558,
    lng: 77.9622,
    rating: 4.9,
    isOrganic: true,
    stock: 14,
    minOrder: 1,
    vehicleType: 'tractor',
    addedAt: '2026-10-25T10:30:00Z',
  },
  {
    productId: 'prod-10',
    name: 'Sevvalai (Red Banana Bunch)',
    nameTamil: 'நாட்டு செவ்வாழை தார்',
    category: 'fruits',
    price: 650,
    unit: 'bundle',
    image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600',
    sellerId: 'seller-1',
    sellerName: 'Ramasamy Gounder',
    sellerFarm: 'Vadipatti Iyarkai Pannai',
    village: 'Vadipatti',
    lat: 10.0558,
    lng: 77.9622,
    rating: 4.9,
    isOrganic: true,
    stock: 25,
    minOrder: 1,
    vehicleType: 'mini_truck',
    addedAt: '2026-10-26T08:15:00Z',
  },
];

export interface WishlistState {
  items: WishlistItem[];
  addToWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (productId: string) => void;
  toggleWishlist: (item: WishlistItem) => boolean;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
  getItemCount: () => number;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: INITIAL_WISHLIST,

      addToWishlist: (item: WishlistItem) => {
        const exists = get().items.some((i) => i.productId === item.productId);
        if (!exists) {
          set((state) => ({
            items: [{ ...item, addedAt: new Date().toISOString() }, ...state.items],
          }));
        }
      },

      removeFromWishlist: (productId: string) => {
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        }));
      },

      toggleWishlist: (item: WishlistItem) => {
        const exists = get().items.some((i) => i.productId === item.productId);
        if (exists) {
          get().removeFromWishlist(item.productId);
          return false;
        } else {
          get().addToWishlist(item);
          return true;
        }
      },

      isInWishlist: (productId: string) => {
        return get().items.some((i) => i.productId === productId);
      },

      clearWishlist: () => {
        set({ items: [] });
      },

      getItemCount: () => {
        return get().items.length;
      },
    }),
    {
      name: 'farmkart_wishlist_storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useWishlistStore;
