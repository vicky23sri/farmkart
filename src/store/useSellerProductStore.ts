/**
 * Seller product types.
 * Listings always come from the API (productService.getMyProducts); nothing is cached locally.
 */

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
}
