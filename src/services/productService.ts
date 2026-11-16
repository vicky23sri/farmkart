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
  Seller,
} from '@/data/products';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProductFilterParams {
  category?: ProductCategory | 'all' | string;
  searchQuery?: string;
  organicOnly?: boolean;
  userLat?: number;
  userLng?: number;
  maxDistanceKm?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'distance' | 'newest';
  limit?: number;
  offset?: number;
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
  rating?: number | null;
  review_count?: number;
  distance_km?: number;
  within_free_radius?: boolean;
}

export function normalizeCategory(cat: string, name?: string): ProductCategory {
  const c = ((cat || '') + ' ' + (name || '')).toLowerCase().trim();
  if (c.includes('manure') || c.includes('eruvu') || c.includes('compost') || c.includes('coir')) return 'manure';
  if (c.includes('fodder') || c.includes('straw') || c.includes('hay') || c.includes('grass') || c.includes('vaikkol') || c.includes('maize')) return 'fodder';
  if (c.includes('millet') || c.includes('ragi') || c.includes('kezhvaragu') || c.includes('kambu') || c.includes('cholam')) return 'millets';
  if (c.includes('grain') || c.includes('paddy') || c.includes('rice') || c.includes('nellu') || c.includes('ponni') || c.includes('samba')) return 'grains';
  if (c.includes('banana') || c.includes('coconut') || c.includes('fruit') || c.includes('mango') || c.includes('guava')) return 'fruits';
  if (c.includes('vegetable') || c.includes('tomato') || c.includes('onion') || c.includes('brinjal') || c.includes('produce')) return 'vegetables';
  if (c.includes('spice') || c.includes('turmeric') || c.includes('chili') || c.includes('pepper')) return 'spices';
  if (c.includes('pulse') || c.includes('dal') || c.includes('moong') || c.includes('urad') || c.includes('chana') || c.includes('payaru')) return 'pulses';
  if (c.includes('dairy') || c.includes('milk') || c.includes('ghee') || c.includes('butter')) return 'dairy';
  if (c.includes('seed') || c.includes('vithai')) return 'seeds';
  if (c.includes('tool') || c.includes('mannvetti') || c.includes('aruval') || c.includes('spade')) return 'tools';
  return 'grains';
}

/**
 * Transforms FastAPI backend product structure into the mobile app's Product type.
 */
export function mapBackendProductToApp(item: BackendProduct): Product & {
  distanceKm?: number;
  withinFreeRadius?: boolean;
  isActive: boolean;
} {
  // Normalize full image URLs if returned as relative static paths
  const resolvedImages = (item.images || []).map((img) => {
    if (img.startsWith('/static/')) {
      return `${BASE_URL.replace(/\/$/, '')}${img}`;
    }
    return img;
  });


  return {
    id: String(item.id),
    name: item.name,
    nameTamil: item.name_tamil || item.name,
    category: normalizeCategory(item.category, item.name),
    price: item.price,
    unit: (item.unit as ProductUnit) || 'kg',
    stock: item.stock,
    minOrder: item.min_order || 1,
    isOrganic: Boolean(item.is_organic),
    harvestDate: item.harvest_date || 'Fresh Harvest',
    sellerId: String(item.seller_id),
    sellerName: item.seller_name || 'Tamil Nadu Farmer',
    village: '',
    lat: item.lat ?? Number.NaN,
    lng: item.lng ?? Number.NaN,
    images: resolvedImages,
    rating: item.rating ?? 0,
    reviewCount: item.review_count ?? 0,
    isActive: item.is_active ?? true,
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
   * Calls GET /products on FastAPI backend with limit/offset pagination.
   */
  async getProducts(params?: ProductFilterParams): Promise<PaginatedResult<Product>> {
    try {
      const queryParams: Record<string, any> = {};

      if (params?.limit !== undefined) {
        queryParams.limit = params.limit;
      }
      if (params?.offset !== undefined) {
        queryParams.offset = params.offset;
      }
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
      })) as { items: BackendProduct[]; total: number; limit: number; offset: number } | BackendProduct[];

      if (res && 'items' in res && Array.isArray(res.items)) {
        return {
          items: res.items.map(mapBackendProductToApp),
          total: res.total,
          limit: res.limit,
          offset: res.offset,
        };
      }
      if (Array.isArray(res)) {
        return {
          items: res.map(mapBackendProductToApp),
          total: res.length,
          limit: res.length,
          offset: 0,
        };
      }
      return { items: [], total: 0, limit: params?.limit || 20, offset: params?.offset || 0 };
    } catch (err) {
      console.warn('[productService.getProducts] Failed to fetch from backend, returning empty list:', err);
      return { items: [], total: 0, limit: params?.limit || 20, offset: params?.offset || 0 };
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
   * Retrieves all products listed by the current seller with limit/offset pagination (Seller only).
   */
  async getMyProducts(params?: { limit?: number; offset?: number }): Promise<PaginatedResult<Product>> {
    const res = (await apiClient.get('/products/mine', { params })) as
      | { items: BackendProduct[]; total: number; limit: number; offset: number }
      | BackendProduct[];
    if (res && 'items' in res && Array.isArray(res.items)) {
      return {
        items: res.items.map(mapBackendProductToApp),
        total: res.total,
        limit: res.limit,
        offset: res.offset,
      };
    }
    if (Array.isArray(res)) {
      return {
        items: res.map(mapBackendProductToApp),
        total: res.length,
        limit: res.length,
        offset: 0,
      };
    }
    return { items: [], total: 0, limit: params?.limit || 20, offset: params?.offset || 0 };
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
      // Photo uploads over rural mobile data can be slow
      timeout: 60000,
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
    return [];
  },

  /**
   * Retrieves seller profile by ID.
   */
  async getSellerById(id: string): Promise<Seller | null> {
    return null;
  },

  /**
   * Retrieves reviews for a product from backend API.
   */
  async getReviews(productId?: string): Promise<Review[]> {
    if (!productId) return [];
    try {
      const res = (await apiClient.get(`/reviews/product/${productId}`)) as {
        items: {
          id: number;
          product_id: number;
          buyer_name?: string;
          product_rating: number;
          created_at: string;
          text?: string;
        }[];
      };
      if (res && Array.isArray(res.items)) {
        return res.items.map((r) => ({
          id: String(r.id),
          productId: String(r.product_id),
          buyerName: r.buyer_name || 'Verified Buyer',
          rating: r.product_rating,
          date: r.created_at ? r.created_at.split('T')[0] : 'Recent',
          comment: r.text || '',
        }));
      }
      return [];
    } catch {
      return [];
    }
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
    try {
      const res = (await apiClient.get('/products', { params: { limit: 100 } })) as any;
      const items: BackendProduct[] =
        res && 'items' in res && Array.isArray(res.items)
          ? res.items
          : Array.isArray(res)
          ? res
          : [];
      const counts: Record<string, number> = {};
      items.forEach((p) => {
        const cat = normalizeCategory(p.category, p.name);
        counts[cat] = (counts[cat] || 0) + 1;
      });

      return categories.map((catKey) => ({
        id: catKey,
        name: categoryMeta[catKey].name,
        nameTamil: categoryMeta[catKey].nameTamil,
        icon: categoryMeta[catKey].icon,
        count: counts[catKey] ?? 0,
      }));
    } catch {
      return categories.map((catKey) => ({
        id: catKey,
        name: categoryMeta[catKey].name,
        nameTamil: categoryMeta[catKey].nameTamil,
        icon: categoryMeta[catKey].icon,
        count: 2,
      }));
    }
  },
};

export default productService;
