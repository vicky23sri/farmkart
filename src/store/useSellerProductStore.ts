/**
 * Seller Product Store
 * Persistent Zustand store managing the farmer's live harvest listings, stock levels,
 * category specifications, and active/inactive marketplace availability.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type SellerCropCategory =
  | 'vegetables'
  | 'fruits'
  | 'grains_millets'
  | 'organic_manure'
  | 'fodder'
  | 'pulses'
  | 'dairy';

export type SellerCropUnit =
  | 'kg'
  | 'quintal'
  | 'ton'
  | 'bundle'
  | 'bag'
  | 'tractor load'
  | 'truck load';

export interface SellerProduct {
  id: string;
  name: string;
  nameTamil: string;
  category: SellerCropCategory;
  categoryLabel: string;
  price: number;
  unit: SellerCropUnit;
  stock: number;
  minOrder: number;
  harvestDate: string;
  isOrganic: boolean;
  isActive: boolean;
  photos: string[];
  vehicleType: string;
  deliveryRadiusKm: number;
  // Category-specific properties
  compostingAge?: string; // For Organic Manure
  moisture?: string; // For Fodder / Grains
  variety?: string; // For Grains & Millets (Paddy, Ragi)
  rating: number;
  reviewCount: number;
  ordersCount: number;
}

const INITIAL_SELLER_PRODUCTS: SellerProduct[] = [
  {
    id: 'sprod-1',
    name: 'Organic Country Tomatoes (நாட்டு தக்காளி)',
    nameTamil: 'நாட்டு தக்காளி',
    category: 'vegetables',
    categoryLabel: 'Vegetables',
    price: 35,
    unit: 'kg',
    stock: 12, // Low stock for alert testing
    minOrder: 2,
    harvestDate: 'Today, 6:00 AM',
    isOrganic: true,
    isActive: true,
    photos: ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600'],
    vehicleType: 'two_wheeler',
    deliveryRadiusKm: 25,
    rating: 4.9,
    reviewCount: 68,
    ordersCount: 142,
  },
  {
    id: 'sprod-2',
    name: 'Traditional Seeraga Samba Nellu (Paddy)',
    nameTamil: 'சீரக சம்பா நெல்',
    category: 'grains_millets',
    categoryLabel: 'Grains and Millets',
    variety: 'Seeraga Samba (Traditional)',
    moisture: '10.5% (Sun-cured Mandi Grade)',
    price: 4200,
    unit: 'quintal',
    stock: 2, // Low stock alert
    minOrder: 1,
    harvestDate: 'Oct 20, 2026',
    isOrganic: true,
    isActive: true,
    photos: ['https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600'],
    vehicleType: 'mini_truck',
    deliveryRadiusKm: 50,
    rating: 4.9,
    reviewCount: 44,
    ordersCount: 88,
  },
  {
    id: 'sprod-3',
    name: 'Pure Desi Cow Dung Vermicompost (Mattu Eruvu)',
    nameTamil: 'நாட்டு மாட்டு எருவு (மண்புழு உரம்)',
    category: 'organic_manure',
    categoryLabel: 'Organic Manure',
    compostingAge: '9 Months Well-Cured & Aerated',
    moisture: '22% Ideal Soil Moisture',
    price: 3500,
    unit: 'tractor load',
    stock: 18,
    minOrder: 1,
    harvestDate: 'Ready for loading',
    isOrganic: true,
    isActive: true,
    photos: ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600'],
    vehicleType: 'tractor',
    deliveryRadiusKm: 35,
    rating: 4.8,
    reviewCount: 31,
    ordersCount: 62,
  },
  {
    id: 'sprod-4',
    name: 'Co-4 High Protein Green Fodder Grass',
    nameTamil: 'கோ-4 பசுந்தீவனப்புல் கட்டு',
    category: 'fodder',
    categoryLabel: 'Fodder',
    moisture: 'Fresh Cut (Hydrated 65%)',
    price: 180,
    unit: 'bundle',
    stock: 85,
    minOrder: 5,
    harvestDate: 'Daily Morning Cut',
    isOrganic: true,
    isActive: true,
    photos: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600'],
    vehicleType: 'mini_truck',
    deliveryRadiusKm: 30,
    rating: 4.7,
    reviewCount: 19,
    ordersCount: 45,
  },
  {
    id: 'sprod-5',
    name: 'Kezhvaragu / Finger Millet (Ragi)',
    nameTamil: 'நாட்டு கேழ்வரகு (தானியம்)',
    category: 'grains_millets',
    categoryLabel: 'Grains and Millets',
    variety: 'Country Native Ragi',
    moisture: '11% Moisture Grade',
    price: 42,
    unit: 'kg',
    stock: 650,
    minOrder: 5,
    harvestDate: 'Oct 22, 2026',
    isOrganic: true,
    isActive: false, // Paused by seller
    photos: ['https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600'],
    vehicleType: 'auto_rickshaw',
    deliveryRadiusKm: 40,
    rating: 4.9,
    reviewCount: 27,
    ordersCount: 56,
  },
];

interface SellerProductStoreState {
  products: SellerProduct[];
  addProduct: (product: Omit<SellerProduct, 'id' | 'rating' | 'reviewCount' | 'ordersCount'>) => void;
  updateProduct: (id: string, updates: Partial<SellerProduct>) => void;
  updateStock: (id: string, newStock: number) => void;
  toggleActive: (id: string) => void;
  deleteProduct: (id: string) => void;
  getLowStockProducts: (threshold?: number) => SellerProduct[];
}

export const useSellerProductStore = create<SellerProductStoreState>()(
  persist(
    (set, get) => ({
      products: INITIAL_SELLER_PRODUCTS,

      addProduct: (cropData) => {
        const newProduct: SellerProduct = {
          ...cropData,
          id: `sprod-${Date.now()}`,
          rating: 5.0,
          reviewCount: 0,
          ordersCount: 0,
        };

        set((state) => ({
          products: [newProduct, ...state.products],
        }));
      },

      updateProduct: (id, updates) => {
        set((state) => ({
          products: state.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }));
      },

      updateStock: (id, newStock) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, stock: Math.max(0, newStock) } : p
          ),
        }));
      },

      toggleActive: (id) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, isActive: !p.isActive } : p
          ),
        }));
      },

      deleteProduct: (id) => {
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        }));
      },

      getLowStockProducts: (threshold = 15) => {
        return get().products.filter((p) => p.isActive && p.stock <= threshold);
      },
    }),
    {
      name: 'farmkart_seller_products_storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useSellerProductStore;
