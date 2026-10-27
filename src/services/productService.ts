/**
 * Product Service
 * Connects to the FastAPI backend /products/* endpoints and S3/local image upload.
 * Maps backend responses cleanly to the mobile app's Product interfaces.
 */

import { apiClient, BASE_URL } from './api';
import {
  Product,
  ProductCategory,
  ProductUnit,
  Review,
  REVIEWS,
  Seller,
  SELLERS,
} from '@/data/products';

export interface ProductFilterParams {
  category?: ProductCategory | 'all' | string;
  searchQuery?: string;
  organicOnly?: boolean;
  userLat?: number;
  userLng?: number;
  maxDistanceKm?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'distance' | 'newest';
  limit?: number;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export interface CategorySummary {
  id: ProductCategory;
  name: string;
  nameTamil: string;
  icon: string;
  count: number;
}

export interface BackendProduct {
  id: number;
  seller_id: number;
  name: string;
  name_tamil?: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  min_order: number;
  is_organic: boolean;
  harvest_date?: string;
  images: string[];
  lat?: number;
  lng?: number;
  delivery_radius_km: number;
  vehicle_type?: string;
  composting_age?: string;
  moisture_content?: string;
  variety?: string;
  is_active: boolean;
  created_at?: string;
  seller_name?: string;
  distance_km?: number;
  within_free_radius?: boolean;
}

/**
 * Transforms FastAPI backend product structure into the mobile app's Product type.
 */
export function mapBackendProductToApp(item: BackendProduct): Product & {
  distanceKm?: number;
  withinFreeRadius?: boolean;
} {
  // Normalize full image URLs if returned as relative static paths
  const resolvedImages = (item.images || []).map((img) => {
    if (img.startsWith('/static/')) {
      return `${BASE_URL.replace(/\/$/, '')}${img}`;
    }
    return img;
  });

  if (resolvedImages.length === 0) {
    resolvedImages.push('https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800');
  }

  return {
    id: String(item.id),
    name: item.name,
    nameTamil: item.name_tamil || item.name,
    category: (item.category.toLowerCase().replace(/\s+/g, '_') as ProductCategory) || 'grains',
    price: item.price,
    unit: (item.unit as ProductUnit) || 'kg',
    stock: item.stock,
    minOrder: item.min_order || 1,
    isOrganic: Boolean(item.is_organic),
    harvestDate: item.harvest_date || 'Fresh Harvest',
    sellerId: String(item.seller_id),
    sellerName: item.seller_name || 'Tamil Nadu Farmer',
    village: 'Madurai Region',
    lat: item.lat ?? 10.0528,
    lng: item.lng ?? 77.9625,
    images: resolvedImages,
    rating: 4.8,
    reviewCount: 16,
    description:
      item.variety ||
      item.composting_age ||
      item.moisture_content ||
      'Direct farm harvest packed fresh for delivery.',
    vehicleType: item.vehicle_type || 'mini_truck',
    distanceKm: item.distance_km,
    withinFreeRadius: item.within_free_radius ?? (item.distance_km ? item.distance_km <= 50 : true),
  };
}

export const productService = {
  /**
   * Retrieves products with filters and buyer lat/lng.
   * Calls GET /products on FastAPI backend.
   */
  async getProducts(params?: ProductFilterParams): Promise<Product[]> {
    try {
      const queryParams: Record<string, any> = {};

      if (params?.category && params.category !== 'all') {
        queryParams.category = params.category;
      }
      if (params?.searchQuery) {
        queryParams.search = params.searchQuery;
      }
      if (params?.organicOnly) {
        queryParams.is_organic = true;
      }
      if (params?.userLat !== undefined) {
        queryParams.buyer_lat = params.userLat;
      }
      if (params?.userLng !== undefined) {
        queryParams.buyer_lng = params.userLng;
      }
      if (params?.maxDistanceKm) {
        queryParams.max_distance_km = params.maxDistanceKm;
      }
      if (params?.sortBy) {
        queryParams.sort = params.sortBy;
      }
      if (params?.inStock) {
        queryParams.in_stock = true;
      }
      if (params?.minPrice !== undefined) {
        queryParams.min_price = params.minPrice;
      }
      if (params?.maxPrice !== undefined) {
        queryParams.max_price = params.maxPrice;
      }

      const res = (await apiClient.get('/products', {
        params: queryParams,
      })) as BackendProduct[];

      if (Array.isArray(res) && res.length > 0) {
        return res.map(mapBackendProductToApp);
      }
      return [];
    } catch (err) {
      console.warn('[productService.getProducts] Failed to fetch from backend, returning empty list:', err);
      return [];
    }
  },

  /**
   * Retrieves single product by ID with live distance calculation.
   */
  async getProductById(
    id: string | number,
    buyerLat?: number,
    buyerLng?: number
  ): Promise<Product | null> {
    try {
      const res = (await apiClient.get(`/products/${id}`, {
        params: {
          buyer_lat: buyerLat,
          buyer_lng: buyerLng,
        },
      })) as BackendProduct;

      return mapBackendProductToApp(res);
    } catch (err) {
      console.warn(`[productService.getProductById] Failed to fetch product #${id}:`, err);
      return null;
    }
  },

  /**
   * Retrieves all products listed by the current seller (Seller only).
   */
  async getMyProducts(): Promise<Product[]> {
    const res = (await apiClient.get('/products/mine')) as BackendProduct[];
    return res.map(mapBackendProductToApp);
  },

  /**
   * Seller creates a new product.
   */
  async createProduct(data: {
    name: string;
    name_tamil?: string;
    category: string;
    price: number;
    unit: string;
    stock: number;
    min_order?: number;
    is_organic?: boolean;
    harvest_date?: string;
    images?: string[];
    lat?: number;
    lng?: number;
    delivery_radius_km?: number;
    vehicle_type?: string;
    composting_age?: string;
    moisture_content?: string;
    variety?: string;
  }): Promise<Product> {
    const res = (await apiClient.post('/products', data)) as BackendProduct;
    return mapBackendProductToApp(res);
  },

  /**
   * Seller updates product details.
   */
  async updateProduct(id: string | number, data: Partial<BackendProduct>): Promise<Product> {
    const res = (await apiClient.put(`/products/${id}`, data)) as BackendProduct;
    return mapBackendProductToApp(res);
  },

  /**
   * Seller quick updates stock level.
   */
  async updateStock(id: string | number, stock: number): Promise<Product> {
    const res = (await apiClient.patch(`/products/${id}/stock`, { stock })) as BackendProduct;
    return mapBackendProductToApp(res);
  },

  /**
   * Seller toggles active / inactive listing.
   */
  async toggleActive(id: string | number, isActive: boolean): Promise<Product> {
    const res = (await apiClient.patch(`/products/${id}/toggle-active`, {
      is_active: isActive,
    })) as BackendProduct;
    return mapBackendProductToApp(res);
  },

  /**
   * Seller deletes product listing.
   */
  async deleteProduct(id: string | number): Promise<void> {
    await apiClient.delete(`/products/${id}`);
  },

  /**
   * Uploads an image to S3 (or local fallback disk) and returns the public URL.
   */
  async uploadImage(file: { uri: string; name?: string; type?: string }): Promise<string> {
    const formData = new FormData();
    const filename = file.name || file.uri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const mimeType = file.type || (match ? `image/${match[1]}` : 'image/jpeg');

    formData.append('file', {
      uri: file.uri,
      name: filename,
      type: mimeType,
    } as any);

    const res = (await apiClient.post('/uploads/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })) as { url: string; message: string };

    let finalUrl = res.url;
    if (finalUrl.startsWith('/static/')) {
      finalUrl = `${BASE_URL.replace(/\/$/, '')}${finalUrl}`;
    }
    return finalUrl;
  },

  /**
   * Retrieves all verified sellers.
   */
  async getSellers(): Promise<Seller[]> {
    return [...SELLERS];
  },

  /**
   * Retrieves seller profile by ID.
   */
  async getSellerById(id: string): Promise<Seller | null> {
    const seller = SELLERS.find((s) => s.id === id);
    return seller ?? null;
  },

  /**
   * Retrieves reviews for a product.
   */
  async getReviews(productId?: string): Promise<Review[]> {
    if (!productId) return [...REVIEWS];
    return REVIEWS.filter((r) => r.productId === productId);
  },

  /**
   * Categories list for browse screen.
   */
  async getCategories(): Promise<CategorySummary[]> {
    const categoryMeta: Record<
      ProductCategory,
      { name: string; nameTamil: string; icon: string }
    > = {
      vegetables: { name: 'Vegetables', nameTamil: 'காய்கறிகள்', icon: 'carrot' },
      fruits: { name: 'Fruits', nameTamil: 'பழங்கள்', icon: 'food-apple-outline' },
      grains: { name: 'Paddy & Rice', nameTamil: 'நெல் & அரிசி', icon: 'rice' },
      millets: { name: 'Millets', nameTamil: 'சிறு தானியங்கள்', icon: 'barley' },
      pulses: { name: 'Pulses', nameTamil: 'பருப்பு வகைகள்', icon: 'seed-outline' },
      spices: { name: 'Spices', nameTamil: 'மசாலா பொருட்கள்', icon: 'chili-mild' },
      dairy: { name: 'Desi Dairy', nameTamil: 'நாட்டு பால் & நெய்', icon: 'cup-water' },
      manure: { name: 'Organic Manure', nameTamil: 'இயற்கை உரம்', icon: 'flower-tulip-outline' },
      fodder: { name: 'Fodder & Straw', nameTamil: 'வைக்கோல் & தீவனம்', icon: 'grass' },
      seeds: { name: 'Native Seeds', nameTamil: 'நாட்டு விதைகள்', icon: 'seed' },
      tools: { name: 'Hand Tools', nameTamil: 'விவசாய கருவிகள்', icon: 'tools' },
    };

    const categories = Object.keys(categoryMeta) as ProductCategory[];
    return categories.map((catKey) => ({
      id: catKey,
      name: categoryMeta[catKey].name,
      nameTamil: categoryMeta[catKey].nameTamil,
      icon: categoryMeta[catKey].icon,
      count: 4,
    }));
  },
};

export default productService;
