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
      items: [],

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
      name: 'farmkart_wishlist_storage_v2',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useWishlistStore;
