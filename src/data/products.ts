/**
 * FarmKart Product & Seller Interfaces
 * Core domain types for agricultural products, verified farmers, and reviews.
 */

export type ProductUnit =
  | 'kg'
  | 'quintal'
  | 'ton'
  | 'bundle'
  | 'bag'
  | 'tractor load'
  | 'truck load';

export type ProductCategory =
  | 'vegetables'
  | 'fruits'
  | 'grains'
  | 'millets'
  | 'pulses'
  | 'spices'
  | 'dairy'
  | 'manure'
  | 'fodder'
  | 'seeds'
  | 'tools';

export type DeliveryVehicleType =
  | 'two_wheeler'
  | 'auto_rickshaw'
  | 'mini_truck'
  | 'tractor'
  | 'heavy_truck';

export interface Product {
  id: string;
  name: string;
  nameTamil: string;
  category: ProductCategory;
  price: number;
  unit: ProductUnit;
  stock: number;
  minOrder: number;
  isOrganic: boolean;
  harvestDate: string;
  sellerId: string;
  sellerName: string;
  village: string;
  lat: number;
  lng: number;
  images: string[];
  rating: number;
  reviewCount: number;
  description: string;
  vehicleType: DeliveryVehicleType | string;
  /** False when the farmer has paused the listing (seller views only). */
  isActive?: boolean;
}

export interface Seller {
  id: string;
  name: string;
  farmName: string;
  phone: string;
  village: string;
  district: string;
  lat: number;
  lng: number;
  isVerified: boolean;
  rating: number;
  totalOrders: number;
  mandiLicenseNo?: string;
}

export interface Review {
  id: string;
  productId: string;
  buyerName: string;
  rating: number;
  date: string;
  comment: string;
}
