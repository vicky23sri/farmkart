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
   * Get all reviews for a product.
   */
  async getProductReviews(productId: number): Promise<ReviewItem[]> {
    const res = (await apiClient.get(`/reviews/product/${productId}`)) as ReviewItem[];
    return res;
  },

  /**
   * Get all reviews for a seller's farm.
   */
  async getSellerReviews(sellerId: number): Promise<ReviewItem[]> {
    const res = (await apiClient.get(`/reviews/seller/${sellerId}`)) as ReviewItem[];
    return res;
  },
};

export default reviewService;
