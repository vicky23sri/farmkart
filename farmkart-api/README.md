# 🌾 FarmKart API (FastAPI Backend)

A lightweight, beginner-friendly REST API backend for the **FarmKart** agricultural marketplace. Built with **Python 3.11+**, **FastAPI**, **PostgreSQL**, **SQLAlchemy 2.0**, **Alembic**, and **JWT**.

---

## 🚀 Quick Start Guide

Follow these exact steps in your terminal to set up and start the server:

### 1. Navigate to the project directory
```bash
cd /home/vignesh/farmkart/farmkart-api
```

### 2. Create and activate a Python virtual environment
```bash
python3 -m venv venv
source venv/bin/activate
```
*(On Windows: `venv\Scripts\activate`)*

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure your `.env` file
The `.env` file is already pre-configured for your local PostgreSQL database:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=virat
DB_PASSWORD=virat
DB_NAME=farmkart
DB_SSLMODE=disable

JWT_SECRET=farmkart_super_secret_jwt_key_2026_xyz123
JWT_EXPIRE_MINUTES=10080

FREE_DELIVERY_RADIUS_KM=50
MAX_EXTENDED_DELIVERY_KM=0

# AWS S3 (Leave empty for automatic local disk fallback in uploads/)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
S3_BUCKET=farmkart-uploads
```

### 5. Run database migrations
```bash
alembic upgrade head
```

### 6. Seed sample data (1 Seller, 1 Buyer, 10 Tamil Nadu Products)
```bash
python scripts/seed.py
```

### 7. Start the FastAPI development server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 📖 Interactive Swagger Documentation

Open your browser and navigate to:
👉 **[http://localhost:8000/docs](http://localhost:8000/docs)**

Click the green **Authorize** button on the top right to paste your JWT Bearer token when testing role-protected endpoints.

---

## 🧪 How to Test Every Endpoint (cURL & Swagger)

### 1. Authentication Flow
The system uses mobile OTP verification. In development mode, the 6-digit OTP code prints directly to your terminal console!

#### A. Send OTP
```bash
curl -X POST "http://localhost:8000/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9842156780"}'
```
*Look at the terminal console running uvicorn to see the 6-digit code (e.g. `482910`).*

#### B. Verify OTP & Obtain JWT
```bash
curl -X POST "http://localhost:8000/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9842156780", "otp": "482910"}'
```
*Returns:*
```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "user_id": 1,
  "role": "seller",
  "is_new_user": false
}
```

#### C. Set Role (Buyer or Seller)
```bash
curl -X POST "http://localhost:8000/auth/set-role" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"role": "seller"}'
```

---

### 2. Products

#### A. Browse Products with Distance & Free Delivery (Buyer only)
Does NOT hide products beyond 50 km. Computes `distance_km` and `within_free_radius`:
```bash
curl -X GET "http://localhost:8000/products?category=Grains%20and%20Millets&buyer_lat=9.9252&buyer_lng=78.1198" \
  -H "Authorization: Bearer <BUYER_TOKEN>"
```

#### B. Get Product Detail (Buyer only)
```bash
curl -X GET "http://localhost:8000/products/1?buyer_lat=9.9252&buyer_lng=78.1198" \
  -H "Authorization: Bearer <BUYER_TOKEN>"
```

#### C. Create New Product (Seller only)
```bash
curl -X POST "http://localhost:8000/products" \
  -H "Authorization: Bearer <SELLER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Coimbatore Fresh Curry Leaves",
    "name_tamil": "கோயம்புத்தூர் கறிவேப்பிலை",
    "category": "Fresh Produce",
    "price": 40.0,
    "unit": "bundle",
    "stock": 100.0,
    "min_order": 5.0,
    "is_organic": true,
    "delivery_radius_km": 50.0,
    "images": ["https://images.unsplash.com/photo-1615485290382-441e4d049cb5"]
  }'
```

#### D. View My Products (Seller only)
```bash
curl -X GET "http://localhost:8000/products/mine" \
  -H "Authorization: Bearer <SELLER_TOKEN>"
```

#### E. Update Stock or Toggle Active (Seller only)
```bash
# Update Stock
curl -X PATCH "http://localhost:8000/products/1/stock" \
  -H "Authorization: Bearer <SELLER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"stock": 120.0}'

# Toggle Active/Inactive
curl -X PATCH "http://localhost:8000/products/1/toggle-active" \
  -H "Authorization: Bearer <SELLER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'
```

---

### 3. Orders (Extended Delivery & Lifecycle)

#### A. Place Order (Buyer only)
- If delivery distance <= 50 km: status is `"placed"`.
- If delivery distance > 50 km: not rejected! Status becomes `"pending_seller_approval"` with `is_extended_delivery = true`.
```bash
curl -X POST "http://localhost:8000/orders" \
  -H "Authorization: Bearer <BUYER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"product_id": 1, "quantity": 2.0}],
    "address": "45 Anna Nagar Main Road, Madurai",
    "lat": 9.9252,
    "lng": 78.1198,
    "payment_method": "cod"
  }'
```

#### B. Approve Order (Seller only)
- If `extra_delivery_fee == 0`: status becomes `"confirmed"` (stock reduced).
- If `extra_delivery_fee > 0`: status becomes `"awaiting_buyer_confirmation"`.
```bash
curl -X PATCH "http://localhost:8000/orders/1/approve" \
  -H "Authorization: Bearer <SELLER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "extra_delivery_fee": 150.0,
    "seller_note": "Mini truck arranged for distant delivery."
  }'
```

#### C. Confirm Extra Fee (Buyer only)
```bash
curl -X PATCH "http://localhost:8000/orders/1/buyer-confirm" \
  -H "Authorization: Bearer <BUYER_TOKEN>"
```

#### D. Advance Status Sequence (Seller only)
Sequence enforced: `confirmed` ➔ `packed` ➔ `shipped` ➔ `out_for_delivery` ➔ `delivered`.
```bash
curl -X PATCH "http://localhost:8000/orders/1/status" \
  -H "Authorization: Bearer <SELLER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status": "packed", "note": "Loaded onto transport."}'
```
*(On `delivered` with COD, `payment_status` automatically updates to `"collected"`)*.

#### E. Reject Order (Seller only)
```bash
curl -X PATCH "http://localhost:8000/orders/1/reject" \
  -H "Authorization: Bearer <SELLER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Heavy rain caused road blockage to delivery area."}'
```

#### F. Cancel Order (Buyer only)
```bash
curl -X PATCH "http://localhost:8000/orders/1/cancel" \
  -H "Authorization: Bearer <BUYER_TOKEN>"
```

#### G. Live Order Tracking & OTP
```bash
curl -X GET "http://localhost:8000/orders/1/track" \
  -H "Authorization: Bearer <BUYER_TOKEN>"
```
*Returns timeline history, ETA, COD balance to collect, and handoff delivery OTP.*

#### H. View Orders by Tab (`ongoing`, `delivered`, `cancelled`, `returns`)
```bash
curl -X GET "http://localhost:8000/orders/mine?tab=ongoing" \
  -H "Authorization: Bearer <BUYER_OR_SELLER_TOKEN>"
```

---

### 4. Reviews & Ratings

#### A. Submit Review (Buyer only - delivered orders only, 1 review per item)
```bash
curl -X POST "http://localhost:8000/reviews" \
  -H "Authorization: Bearer <BUYER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": 1,
    "product_id": 1,
    "product_rating": 5.0,
    "farmer_rating": 5.0,
    "delivery_rating": 4.5,
    "text": "Excellent natural Ponni rice, very well packed!",
    "tags": ["Fresh", "Good packaging", "On time"]
  }'
```

#### B. Reply to Review (Seller only)
```bash
curl -X POST "http://localhost:8000/reviews/1/reply" \
  -H "Authorization: Bearer <SELLER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"reply": "Thank you for supporting our organic farm!"}'
```

#### C. Get Product or Seller Reviews (Public)
```bash
curl -X GET "http://localhost:8000/reviews/product/1"
curl -X GET "http://localhost:8000/reviews/seller/1"
```

---

### 5. Seller Payouts & Earnings Summary

#### A. View Earnings Summary (Seller only)
```bash
curl -X GET "http://localhost:8000/payouts/summary" \
  -H "Authorization: Bearer <SELLER_TOKEN>"
```
*Calculates total earnings, COD collected vs pending, online earnings, and list of delivered orders.*

---

### 6. Image Uploads (S3 & Local Fallback)

Upload product photos or review images (max 5 MB, jpg/png/webp):
```bash
curl -X POST "http://localhost:8000/uploads/image" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "file=@/path/to/sample_crop.jpg"
```
*If AWS S3 keys are configured in `.env`, uploads directly to S3. If keys are omitted or blank, smoothly saves to local `uploads/` folder and serves via `/static/uploads/{filename}`.*

---

## 📁 Project Architecture

```
farmkart-api/
├── alembic/                      # Database migrations
│   ├── versions/
│   │   └── 001_initial_schema.py # Initial database schema
│   ├── env.py
│   └── script.py.mako
├── app/
│   ├── core/
│   │   ├── config.py             # pydantic-settings config
│   │   ├── database.py           # SQLAlchemy engine & sessionmaker
│   │   ├── deps.py               # get_current_user, require_buyer, require_seller
│   │   └── security.py           # JWT generation & password hashing
│   ├── models/
│   │   ├── user.py               # User table
│   │   ├── otp.py                # OTP temporary storage
│   │   ├── product.py            # Product & farm crop listings
│   │   ├── order.py              # Order & OrderStatusHistory
│   │   ├── review.py             # Ratings & reviews
│   │   └── payout.py             # Payout records
│   ├── schemas/                  # Pydantic request/response models
│   │   ├── auth.py
│   │   ├── product.py
│   │   ├── order.py
│   │   ├── review.py
│   │   ├── payout.py
│   │   └── common.py
│   ├── services/
│   │   ├── distance.py           # Haversine distance calculation
│   │   ├── otp.py                # OTP generation & console print
│   │   └── s3.py                 # S3 upload with local disk fallback
│   ├── routers/
│   │   ├── auth.py               # /auth/*
│   │   ├── products.py           # /products/*
│   │   ├── orders.py             # /orders/*
│   │   ├── reviews.py            # /reviews/*
│   │   ├── payouts.py            # /payouts/*
│   │   └── uploads.py            # /uploads/*
│   └── main.py                   # FastAPI app instance, CORS & error handler
├── scripts/
│   └── seed.py                   # Seed sample buyer, seller & 10 TN products
├── uploads/                      # Local uploads directory (static fallback)
├── .env                          # Local environment settings
├── .env.example                  # Template configuration
├── .gitignore                    # Git ignores (.env, venv, uploads)
├── alembic.ini                   # Alembic configuration
├── requirements.txt              # Project Python packages
└── README.md                     # Documentation & testing guide
```
