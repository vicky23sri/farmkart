/**
 * Review Service
 * Manages customer product reviews, multi-category ratings, and farmer responses.
 */

import { apiClient } from './api';

export interface CreateReviewPayload {
  order_id: number;
  product_id: number;
  product_rating: number;
  farmer_rating: number;
  delivery_rating: number;
  text?: string;
  photos?: string[];
  tags?: string[];
}

export interface ReviewItem {
  id: number;
  order_id: number;
  product_id: number;
  buyer_id: number;
  seller_id: number;
  product_rating: number;
  farmer_rating: number;
  delivery_rating: number;
  text?: string;
  photos: string[];
  tags: string[];
  seller_reply?: string;
  created_at?: string;
  buyer_name?: string;
}

export interface PaginatedReviews {
  items: ReviewItem[];
  total: number;
  limit: number;
  offset: number;
}

export const reviewService = {
  /**
   * Buyer creates a review for a delivered order item.
   */
  async createReview(payload: CreateReviewPayload): Promise<ReviewItem> {
    const res = (await apiClient.post('/reviews', payload)) as ReviewItem;
    return res;
  },

  /**
   * Seller replies to a customer review.
   */
  async replyToReview(reviewId: number, reply: string): Promise<ReviewItem> {
    const res = (await apiClient.post(`/reviews/${reviewId}/reply`, { reply })) as ReviewItem;
    return res;
  },

  /**
   * Get reviews for a product with limit/offset pagination.
   */
  async getProductReviews(
    productId: number,
    limit = 20,
    offset = 0
  ): Promise<PaginatedReviews> {
    const res = (await apiClient.get(`/reviews/product/${productId}`, {
      params: { limit, offset },
    })) as PaginatedReviews | ReviewItem[];

    if (res && 'items' in res && Array.isArray(res.items)) {
      return res;
    }
    if (Array.isArray(res)) {
      return { items: res, total: res.length, limit: res.length, offset: 0 };
    }
    return { items: [], total: 0, limit, offset };
  },

  /**
   * Get all reviews for a seller's farm with limit/offset pagination.
   */
  async getSellerReviews(
    sellerId: number,
    limit = 20,
    offset = 0
  ): Promise<PaginatedReviews> {
    const res = (await apiClient.get(`/reviews/seller/${sellerId}`, {
      params: { limit, offset },
    })) as PaginatedReviews | ReviewItem[];

    if (res && 'items' in res && Array.isArray(res.items)) {
      return res;
    }
    if (Array.isArray(res)) {
      return { items: res, total: res.length, limit: res.length, offset: 0 };
    }
    return { items: [], total: 0, limit, offset };
  },
};

export default reviewService;
