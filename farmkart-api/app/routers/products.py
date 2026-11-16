from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user_optional, require_seller
from app.models.review import Review
from app.models.user import User
from app.models.product import Product
from app.services.distance import calculate_haversine_distance
from app.services.s3 import delete_uploaded_image
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductStockUpdate,
    ProductToggleActive,
    ProductOut,
    ProductWithDistanceOut,
)
from app.schemas.common import MessageResponse, PaginatedResponse

router = APIRouter(prefix="/products", tags=["Products"])

# Upper bound on rows considered when sorting/filtering by distance in memory
MAX_DISTANCE_CANDIDATES = 2000


def _attach_ratings(db: Session, items: list) -> list:
    """Fill rating / review_count on product output models with one aggregate query."""
    ids = [item.id for item in items]
    if not ids:
        return items
    rows = (
        db.query(Review.product_id, func.avg(Review.product_rating), func.count(Review.id))
        .filter(Review.product_id.in_(ids))
        .group_by(Review.product_id)
        .all()
    )
    stats = {pid: (round(float(avg), 1), int(cnt)) for pid, avg, cnt in rows}
    for item in items:
        if item.id in stats:
            item.rating, item.review_count = stats[item.id]
    return items


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


@router.get("/mine", response_model=PaginatedResponse[ProductOut])
def get_my_products(
    limit: int = Query(20, ge=1, le=100, description="Items per page (1-100, default 20)"),
    offset: int = Query(0, ge=0, description="Page offset (default 0)"),
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """Get all products listed by the current seller with limit/offset pagination."""
    query = (
        db.query(Product)
        .filter(Product.seller_id == current_seller.id, Product.deleted_at.is_(None))
        .order_by(Product.id.desc())
    )
    total = query.count()
    products = query.offset(offset).limit(limit).all()
    result = []
    for p in products:
        item = ProductOut.model_validate(p)
        item.seller_name = str(current_seller.name) if current_seller.name else "Farmer"
        result.append(item)
    return {
        "items": _attach_ratings(db, result),
        "total": total,
        "limit": limit,
        "offset": offset,
    }


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
        .filter(
            Product.id == product_id,
            Product.seller_id == current_seller.id,
            Product.deleted_at.is_(None),
        )
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
        .filter(
            Product.id == product_id,
            Product.seller_id == current_seller.id,
            Product.deleted_at.is_(None),
        )
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
        .filter(
            Product.id == product_id,
            Product.seller_id == current_seller.id,
            Product.deleted_at.is_(None),
        )
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
        .filter(
            Product.id == product_id,
            Product.seller_id == current_seller.id,
            Product.deleted_at.is_(None),
        )
        .first()
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found or not owned by you.",
        )

    # Listings that were ever ordered or reviewed are archived: reviews reference the row and
    # order snapshots reference its images. Only never-used listings are removed outright.
    has_reviews = db.query(Review.id).filter(Review.product_id == product.id).first() is not None
    must_archive = has_reviews or db.execute(
        text(
            "SELECT 1 FROM orders o, json_array_elements(o.items) AS item "
            "WHERE o.seller_id = :seller_id AND (item->>'product_id')::int = :product_id LIMIT 1"
        ),
        {"seller_id": current_seller.id, "product_id": product.id},
    ).first() is not None

    if must_archive:
        product.is_active = False
        product.deleted_at = datetime.now(timezone.utc)
        db.commit()
    else:
        image_urls = list(product.images or [])
        db.delete(product)
        db.commit()
        for url in image_urls:
            delete_uploaded_image(url)
    return MessageResponse(message="Product deleted successfully.")


# ==========================================
# BUYER ENDPOINTS (Requires buyer role)
# ==========================================

@router.get("", response_model=PaginatedResponse[ProductWithDistanceOut])
def get_products_for_buyer(
    category: Optional[str] = Query(None, description="Filter by category"),
    is_organic: Optional[bool] = Query(None, description="Filter by organic only"),
    in_stock: Optional[bool] = Query(None, description="Show only items in stock"),
    min_price: Optional[float] = Query(None, ge=0, description="Minimum price"),
    max_price: Optional[float] = Query(None, ge=0, description="Maximum price"),
    search: Optional[str] = Query(None, max_length=100, description="Keyword search in name, tamil name, category"),
    sort: Optional[str] = Query(None, description="Sort order: price_asc, price_desc, newest, distance"),
    buyer_lat: Optional[float] = Query(None, ge=-90, le=90, description="Buyer latitude"),
    buyer_lng: Optional[float] = Query(None, ge=-180, le=180, description="Buyer longitude"),
    max_distance_km: Optional[float] = Query(None, description="Optional custom max distance limit"),
    limit: int = Query(20, ge=1, le=100, description="Items per page (1-100, default 20)"),
    offset: int = Query(0, ge=0, description="Page offset (default 0)"),
    current_buyer: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    List products for buyers with limit/offset pagination.
    Important rule: Do NOT hide products beyond 50 km.
    Computes distance_km and sets within_free_radius (distance <= 50 km).
    """
    query = (
        db.query(Product)
        .join(User, Product.seller_id == User.id)
        .filter(
            Product.is_active.is_(True),
            Product.deleted_at.is_(None),
            User.deleted_at.is_(None),
        )
        .options(joinedload(Product.seller))
    )

    if category and category.lower() != "all":
        cat_lower = category.lower().strip()
        if cat_lower in ("grains", "millets", "grains_millets", "paddy", "rice"):
            query = query.filter(
                (Product.category.ilike("%grain%"))
                | (Product.category.ilike("%millet%"))
                | (Product.category.ilike("%paddy%"))
                | (Product.category.ilike("%rice%"))
                | (Product.category.ilike("%nellu%"))
                | (Product.category.ilike("%ragi%"))
                | (Product.name.ilike("%rice%"))
                | (Product.name.ilike("%nellu%"))
                | (Product.name.ilike("%ragi%"))
                | (Product.name.ilike("%millet%"))
            )
        elif cat_lower in ("manure", "organic_manure", "fertilizer"):
            query = query.filter(
                (Product.category.ilike("%manure%"))
                | (Product.category.ilike("%eruvu%"))
                | (Product.category.ilike("%compost%"))
                | (Product.name.ilike("%manure%"))
                | (Product.name.ilike("%eruvu%"))
                | (Product.name.ilike("%vermicompost%"))
                | (Product.name.ilike("%coir pith%"))
            )
        elif cat_lower in ("fodder", "straw", "hay", "grass"):
            query = query.filter(
                (Product.category.ilike("%fodder%"))
                | (Product.category.ilike("%straw%"))
                | (Product.category.ilike("%hay%"))
                | (Product.category.ilike("%grass%"))
                | (Product.name.ilike("%straw%"))
                | (Product.name.ilike("%hay%"))
                | (Product.name.ilike("%maize%"))
                | (Product.name.ilike("%fodder%"))
            )
        elif cat_lower in ("vegetables", "vegetable"):
            query = query.filter(
                (Product.category.ilike("%vegetable%"))
                | (Product.category.ilike("%produce%"))
                | (Product.name.ilike("%tomato%"))
                | (Product.name.ilike("%onion%"))
                | (Product.name.ilike("%brinjal%"))
                | (Product.name.ilike("%vegetable%"))
            )
        elif cat_lower in ("fruits", "fruit"):
            query = query.filter(
                (Product.category.ilike("%fruit%"))
                | (Product.name.ilike("%coconut%"))
                | (Product.name.ilike("%banana%"))
                | (Product.name.ilike("%fruit%"))
                | (Product.name.ilike("%mango%"))
                | (Product.name.ilike("%guava%"))
            )
        elif cat_lower in ("spices", "spice"):
            query = query.filter(
                (Product.category.ilike("%spice%"))
                | (Product.name.ilike("%turmeric%"))
                | (Product.name.ilike("%chili%"))
                | (Product.name.ilike("%pepper%"))
            )
        elif cat_lower in ("pulses", "pulse", "dal"):
            query = query.filter(
                (Product.category.ilike("%pulse%"))
                | (Product.category.ilike("%dal%"))
                | (Product.name.ilike("%moong%"))
                | (Product.name.ilike("%urad%"))
                | (Product.name.ilike("%chana%"))
                | (Product.name.ilike("%payaru%"))
            )
        elif cat_lower in ("dairy", "milk", "ghee"):
            query = query.filter(
                (Product.category.ilike("%dairy%"))
                | (Product.category.ilike("%milk%"))
                | (Product.category.ilike("%ghee%"))
                | (Product.name.ilike("%ghee%"))
                | (Product.name.ilike("%milk%"))
                | (Product.name.ilike("%butter%"))
            )
        elif cat_lower in ("seeds", "seed"):
            query = query.filter(
                (Product.category.ilike("%seed%"))
                | (Product.name.ilike("%seed%"))
                | (Product.name.ilike("%vithai%"))
            )
        elif cat_lower in ("tools", "tool"):
            query = query.filter(
                (Product.category.ilike("%tool%"))
                | (Product.name.ilike("%tool%"))
                | (Product.name.ilike("%mannvetti%"))
                | (Product.name.ilike("%aruval%"))
            )
        else:
            clean_cat = cat_lower.replace("_", " ")
            query = query.filter(
                (Product.category.ilike(f"%{clean_cat}%"))
                | (Product.category.ilike(f"%{cat_lower}%"))
                | (Product.name.ilike(f"%{clean_cat}%"))
            )
    if is_organic is not None:
        query = query.filter(Product.is_organic == is_organic)
    if in_stock:
        query = query.filter(Product.stock > 0)
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
    if max_price is not None:
        query = query.filter(Product.price <= max_price)
    if search and search.strip():
        escaped = search.strip()[:100].replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        search_pattern = f"%{escaped}%"
        query = query.filter(
            (Product.name.ilike(search_pattern, escape="\\"))
            | (Product.name_tamil.ilike(search_pattern, escape="\\"))
            | (Product.category.ilike(search_pattern, escape="\\"))
        )

    # Base ordering
    if sort == "price_asc":
        query = query.order_by(Product.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Product.price.desc())
    else:
        query = query.order_by(Product.id.desc())
    if sort in ("price_asc", "price_desc"):
        query = query.order_by(Product.id.desc())  # stable tiebreaker for pagination

    # Distance sorting/filtering needs every candidate in memory; otherwise paginate in SQL.
    needs_in_memory = sort == "distance" or max_distance_km is not None
    if needs_in_memory:
        products = query.limit(MAX_DISTANCE_CANDIDATES).all()
        sql_total = None
    else:
        sql_total = query.count()
        products = query.offset(offset).limit(limit).all()

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

    if sql_total is not None:
        total = sql_total
        paginated_items = output
    else:
        if sort == "distance":
            output.sort(key=lambda x: (x.distance_km is None, x.distance_km))
        total = len(output)
        paginated_items = output[offset : offset + limit]

    return {
        "items": _attach_ratings(db, paginated_items),
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{product_id}", response_model=ProductWithDistanceOut)
def get_product_detail_for_buyer(
    product_id: int,
    buyer_lat: Optional[float] = Query(None, description="Buyer latitude"),
    buyer_lng: Optional[float] = Query(None, description="Buyer longitude"),
    current_buyer: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Get single product details with distance_km and within_free_radius."""
    prod = (
        db.query(Product)
        .options(joinedload(Product.seller))
        .filter(Product.id == product_id, Product.deleted_at.is_(None))
        .first()
    )
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
    _attach_ratings(db, [item])
    return item
