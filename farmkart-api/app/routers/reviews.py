from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_buyer, require_seller
from app.models.user import User
from app.models.order import Order
from app.models.product import Product
from app.models.review import Review
from app.schemas.review import (
    ReviewCreateRequest,
    ReviewReplyRequest,
    ReviewOut,
)

router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.post("", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def create_review(
    req: ReviewCreateRequest,
    current_buyer: User = Depends(require_buyer),
    db: Session = Depends(get_db),
):
    """
    Create a review (Buyer only).
    Rules:
    - Only allowed for delivered orders.
    - Only one review allowed per order item.
    """
    # 1. Check order
    order = db.query(Order).filter(Order.id == req.order_id, Order.buyer_id == current_buyer.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Delivered order not found under your account.")

    if order.status != "delivered":
        raise HTTPException(
            status_code=400,
            detail=f"Reviews can only be submitted for delivered orders (current status: '{order.status}').",
        )

    # 2. Check product in order items
    product_in_order = any(item.get("product_id") == req.product_id for item in order.items)
    if not product_in_order:
        raise HTTPException(
            status_code=400,
            detail=f"Product #{req.product_id} was not part of this order.",
        )

    # 3. Check for existing review (one review per order item)
    existing_review = (
        db.query(Review)
        .filter(Review.order_id == req.order_id, Review.product_id == req.product_id)
        .first()
    )
    if existing_review:
        raise HTTPException(
            status_code=400,
            detail="You have already submitted a review for this item in this order.",
        )

    review = Review(
        order_id=order.id,
        product_id=req.product_id,
        buyer_id=current_buyer.id,
        seller_id=order.seller_id,
        product_rating=req.product_rating,
        farmer_rating=req.farmer_rating,
        delivery_rating=req.delivery_rating,
        text=req.text,
        photos=req.photos,
        tags=req.tags,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    res = ReviewOut.model_validate(review)
    res.buyer_name = current_buyer.name or "Verified Buyer"
    return res


@router.post("/{review_id}/reply", response_model=ReviewOut)
def reply_to_review(
    review_id: int,
    req: ReviewReplyRequest,
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """Seller replies to a customer review (Seller only, own products/reviews only)."""
    review = (
        db.query(Review)
        .filter(Review.id == review_id, Review.seller_id == current_seller.id)
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found or not belonging to your farm.")

    review.seller_reply = req.reply
    db.commit()
    db.refresh(review)

    res = ReviewOut.model_validate(review)
    res.buyer_name = review.buyer.name if review.buyer else "Verified Buyer"
    return res


@router.get("/product/{product_id}", response_model=List[ReviewOut])
def get_product_reviews(product_id: int, db: Session = Depends(get_db)):
    """Public/buyer list of reviews for a specific product."""
    reviews = (
        db.query(Review)
        .filter(Review.product_id == product_id)
        .order_by(Review.id.desc())
        .all()
    )
    output = []
    for r in reviews:
        item = ReviewOut.model_validate(r)
        item.buyer_name = r.buyer.name if r.buyer else "Verified Buyer"
        output.append(item)
    return output


@router.get("/seller/{seller_id}", response_model=List[ReviewOut])
def get_seller_reviews(seller_id: int, db: Session = Depends(get_db)):
    """List of all customer reviews received by a seller."""
    reviews = (
        db.query(Review)
        .filter(Review.seller_id == seller_id)
        .order_by(Review.id.desc())
        .all()
    )
    output = []
    for r in reviews:
        item = ReviewOut.model_validate(r)
        item.buyer_name = r.buyer.name if r.buyer else "Verified Buyer"
        output.append(item)
    return output
