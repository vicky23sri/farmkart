from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import require_seller, require_buyer
from app.core.security import decode_access_token
from app.models.user import User
from app.models.product import Product
from app.services.distance import calculate_haversine_distance
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductStockUpdate,
    ProductToggleActive,
    ProductOut,
    ProductWithDistanceOut,
)
from app.schemas.common import MessageResponse

_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Extract user if valid token provided; returns None if guest or missing token."""
    if not credentials:
        return None
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("user_id")
    if not user_id:
        return None
    return db.query(User).filter(User.id == int(user_id)).first()


router = APIRouter(prefix="/products", tags=["Products"])


# ==========================================
# SELLER ENDPOINTS (Requires seller role)
# ==========================================

@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    req: ProductCreate,
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """Create a new product listing (Seller only)."""
    # Use seller coordinates as fallback if not provided on the product
    lat = req.lat if req.lat is not None else current_seller.lat
    lng = req.lng if req.lng is not None else current_seller.lng

    product = Product(
        seller_id=current_seller.id,
        name=req.name,
        name_tamil=req.name_tamil,
        category=req.category,
        price=req.price,
        unit=req.unit,
        stock=req.stock,
        min_order=req.min_order,
        is_organic=req.is_organic,
        harvest_date=req.harvest_date,
        images=req.images,
        lat=lat,
        lng=lng,
        delivery_radius_km=req.delivery_radius_km,
        vehicle_type=req.vehicle_type,
        composting_age=req.composting_age,
        moisture_content=req.moisture_content,
        variety=req.variety,
        is_active=True,
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    res = ProductOut.model_validate(product)
    res.seller_name = str(current_seller.name) if current_seller.name else "Farmer"
    return res


@router.get("/mine", response_model=List[ProductOut])
def get_my_products(
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """Get all products listed by the current seller."""
    products = (
        db.query(Product)
        .filter(Product.seller_id == current_seller.id)
        .order_by(Product.id.desc())
        .all()
    )
    result = []
    for p in products:
        item = ProductOut.model_validate(p)
        item.seller_name = str(current_seller.name) if current_seller.name else "Farmer"
        result.append(item)
    return result


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    req: ProductUpdate,
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """Update a product listing (Seller only, own products only)."""
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.seller_id == current_seller.id)
        .first()
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found or not owned by you.",
        )

    # Update only fields provided
    update_data = req.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)

    res = ProductOut.model_validate(product)
    res.seller_name = str(current_seller.name) if current_seller.name else "Farmer"
    return res


@router.patch("/{product_id}/stock", response_model=ProductOut)
def update_product_stock(
    product_id: int,
    req: ProductStockUpdate,
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """Quick update for product stock level (Seller only)."""
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.seller_id == current_seller.id)
        .first()
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found or not owned by you.",
        )

    setattr(product, "stock", req.stock)
    db.commit()
    db.refresh(product)

    res = ProductOut.model_validate(product)
    res.seller_name = str(current_seller.name) if current_seller.name else "Farmer"
    return res


@router.patch("/{product_id}/toggle-active", response_model=ProductOut)
def toggle_product_active(
    product_id: int,
    req: ProductToggleActive,
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """Enable or disable a product listing (Seller only)."""
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.seller_id == current_seller.id)
        .first()
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found or not owned by you.",
        )

    setattr(product, "is_active", req.is_active)
    db.commit()
    db.refresh(product)

    res = ProductOut.model_validate(product)
    res.seller_name = str(current_seller.name) if current_seller.name else "Farmer"
    return res


@router.delete("/{product_id}", response_model=MessageResponse)
def delete_product(
    product_id: int,
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """Delete a product listing (Seller only)."""
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.seller_id == current_seller.id)
        .first()
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found or not owned by you.",
        )

    db.delete(product)
    db.commit()
    return MessageResponse(message="Product deleted successfully.")


# ==========================================
# BUYER ENDPOINTS (Requires buyer role)
# ==========================================

@router.get("", response_model=List[ProductWithDistanceOut])
def get_products_for_buyer(
    category: Optional[str] = Query(None, description="Filter by category"),
    is_organic: Optional[bool] = Query(None, description="Filter by organic only"),
    in_stock: Optional[bool] = Query(None, description="Show only items in stock"),
    min_price: Optional[float] = Query(None, description="Minimum price"),
    max_price: Optional[float] = Query(None, description="Maximum price"),
    search: Optional[str] = Query(None, description="Keyword search in name, tamil name, category"),
    sort: Optional[str] = Query(None, description="Sort order: price_asc, price_desc, newest, distance"),
    buyer_lat: Optional[float] = Query(None, description="Buyer latitude"),
    buyer_lng: Optional[float] = Query(None, description="Buyer longitude"),
    max_distance_km: Optional[float] = Query(None, description="Optional custom max distance limit"),
    current_buyer: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    List products for buyers.
    Important rule: Do NOT hide products beyond 50 km.
    Computes distance_km and sets within_free_radius (distance <= 50 km).
    """
    query = db.query(Product).filter(Product.is_active == True)

    if category:
        query = query.filter(Product.category == category)
    if is_organic is not None:
        query = query.filter(Product.is_organic == is_organic)
    if in_stock:
        query = query.filter(Product.stock > 0)
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
    if max_price is not None:
        query = query.filter(Product.price <= max_price)
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            (Product.name.ilike(search_pattern))
            | (Product.name_tamil.ilike(search_pattern))
            | (Product.category.ilike(search_pattern))
        )

    # Base ordering
    if sort == "price_asc":
        query = query.order_by(Product.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Product.price.desc())
    elif sort == "newest":
        query = query.order_by(Product.id.desc())

    products = query.all()

    # Determine buyer coordinate (query params override profile coordinates)
    ref_lat_val: Optional[float] = None
    if buyer_lat is not None:
        ref_lat_val = float(buyer_lat)
    elif current_buyer and current_buyer.lat is not None:
        ref_lat_val = float(getattr(current_buyer, "lat"))

    ref_lng_val: Optional[float] = None
    if buyer_lng is not None:
        ref_lng_val = float(buyer_lng)
    elif current_buyer and current_buyer.lng is not None:
        ref_lng_val = float(getattr(current_buyer, "lng"))

    output: List[ProductWithDistanceOut] = []
    for prod in products:
        dist: Optional[float] = None
        within_free = True

        p_lat = getattr(prod, "lat", None)
        p_lng = getattr(prod, "lng", None)

        if ref_lat_val is not None and ref_lng_val is not None and p_lat is not None and p_lng is not None:
            dist = calculate_haversine_distance(
                ref_lat_val, ref_lng_val, float(p_lat), float(p_lng)
            )
            within_free = dist <= settings.FREE_DELIVERY_RADIUS_KM
        else:
            # If coordinates are missing, default to free radius
            within_free = True

        # If user explicitly passed max_distance_km filter, apply it
        if max_distance_km is not None and dist is not None:
            if dist > max_distance_km:
                continue

        item = ProductWithDistanceOut.model_validate(prod)
        item.seller_name = str(prod.seller.name) if (prod.seller and prod.seller.name) else "Farmer"
        item.distance_km = dist
        item.within_free_radius = within_free
        output.append(item)

    # Sort by distance if requested
    if sort == "distance":
        output.sort(key=lambda x: (x.distance_km is None, x.distance_km))

    return output


@router.get("/{product_id}", response_model=ProductWithDistanceOut)
def get_product_detail_for_buyer(
    product_id: int,
    buyer_lat: Optional[float] = Query(None, description="Buyer latitude"),
    buyer_lng: Optional[float] = Query(None, description="Buyer longitude"),
    current_buyer: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Get single product details with distance_km and within_free_radius."""
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    ref_lat_val: Optional[float] = None
    if buyer_lat is not None:
        ref_lat_val = float(buyer_lat)
    elif current_buyer and current_buyer.lat is not None:
        ref_lat_val = float(getattr(current_buyer, "lat"))

    ref_lng_val: Optional[float] = None
    if buyer_lng is not None:
        ref_lng_val = float(buyer_lng)
    elif current_buyer and current_buyer.lng is not None:
        ref_lng_val = float(getattr(current_buyer, "lng"))

    dist: Optional[float] = None
    within_free = True
    p_lat = getattr(prod, "lat", None)
    p_lng = getattr(prod, "lng", None)
    if ref_lat_val is not None and ref_lng_val is not None and p_lat is not None and p_lng is not None:
        dist = calculate_haversine_distance(
            ref_lat_val, ref_lng_val, float(p_lat), float(p_lng)
        )
        within_free = dist <= settings.FREE_DELIVERY_RADIUS_KM

    item = ProductWithDistanceOut.model_validate(prod)
    item.seller_name = str(prod.seller.name) if (prod.seller and prod.seller.name) else "Farmer"
    item.distance_km = dist
    item.within_free_radius = within_free
    return item
