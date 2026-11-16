# 🌾 FarmKart (பாம்கார்ட்)

> **Direct Farm-to-Door Agri-Marketplace connecting Tamil Nadu farmers and buyers.**  
> Eliminating middlemen markups, ensuring fair farm-gate pricing, and delivering fresh harvests directly within a 50 km local delivery radius.

---

## 📋 Table of Contents
1. [About FarmKart](#-about-farmkart)
2. [Key Features](#-key-features)
3. [System Architecture](#-system-architecture)
4. [Tech Stack](#-tech-stack)
5. [Getting Started & Setup](#-getting-started--setup)
   - [Backend API Setup](#1-backend-api-setup-farmkart-api)
   - [Mobile App Setup](#2-mobile-app-setup-react-native--expo)
6. [Environment Variables Reference](#-environment-variables-reference)
7. [Running Tests & Quality Checks](#-running-tests--quality-checks)
8. [License & Contributing](#-license--contributing)

---

## 🌿 About FarmKart

**FarmKart** is a mobile-first direct marketplace designed for agricultural ecosystems in Tamil Nadu (spanning farming hubs such as Madurai, Coimbatore, Thanjavur, Dindigul, and Erode). 

Traditional mandi supply chains pass produce through multiple brokers and wholesalers, resulting in up to 40% value loss for farmers and delayed, wilted produce for consumers. FarmKart resolves this by:
- Enforcing a strict **50 km hyperlocal radius rule** to ensure same-day field freshness and feasible local transit via mini-trucks, tractors, and three-wheelers.
- Providing dual persona views: **Buyer Mode** (browsing, distance-based delivery, live tracking, reviews) and **Farmer/Seller Mode** (inventory, harvest drops, order approvals, earnings payouts).
- Protecting farmers from payment delays with Cash-on-Delivery (COD) reconciliation and online UPI settlement.

---

## ✨ Key Features

- **Mobile OTP Authentication**: Passwordless phone verification with cryptographic rate limiting, SHA-256 hashed OTPs, and brute-force lockouts.
- **50 km Geo-Delivery Engine**: Haversine distance calculations determine delivery feasibility, vehicle assignment, and transparent transport fees.
- **Concurrency & Anti-Overselling Guard**: PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) sorted by product ID guarantee atomic inventory decrements and safe stock restores.
- **Real-Time Push Notifications**: Integrated with the **Expo Push API** to deliver live alerts for all order status milestones (`placed`, `confirmed`, `packed`, `shipped`, `out_for_delivery`, `delivered`).
- **Live Handoff Delivery Verification**: 6-digit delivery OTP handoff verification to prevent delivery disputes.
- **Ratings & Verified Reviews**: Review submission restricted to completed orders, with photo uploads and farmer replies.
- **Secure Image Uploads**: Multi-stage validation using file magic bytes, EXIF/GPS metadata stripping via Pillow, and direct S3 cloud storage.
- **Bilingual Interface**: Full live bilingual switching between English and Tamil (தமிழ்).
- **Compliance & Privacy**: In-app "Delete My Account" flow with personal data anonymization (`DELETE /auth/me`), paired with Privacy Policy and Terms of Service screens.

---

## 🏛️ System Architecture

```text
+-----------------------------------------------------------------------------------+
|                               FARMKART CLIENT APP                                 |
|         React Native (Expo SDK 58, Expo Router, TypeScript, Zustand, TanStack)    |
|                                                                                   |
|    +-----------------------------+          +--------------------------------+    |
|    |      Buyer Mobile UI        |          |      Farmer / Seller UI        |    |
|    |  Marketplace, Cart, Tracking|          |  Add Crops, Approvals, Payouts |    |
|    +-----------------------------+          +--------------------------------+    |
|                   |                                        |                      |
|                   +-------------------+--------------------+                      |
|                                       |                                           |
|                            [Axios HTTP / Sentry SDK]                              |
+---------------------------------------|-------------------------------------------+
                                        |  REST Requests (JWT Bearer)
                                        v
+-----------------------------------------------------------------------------------+
|                              FASTAPI BACKEND SERVICE                              |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   |                        Request Middlewares & Core                         |   |
|   |    Request-ID Logging  •  CORS Origin Guard  •  Sentry PII Sanitizer      |   |
|   +---------------------------------------------------------------------------+   |
|                                       |                                           |
|   +---------------------------------------------------------------------------+   |
|   |                             API Routers                                   |   |
|   |   /auth   •   /products   •   /orders   •   /notifications   •  /reviews  |   |
|   +---------------------------------------------------------------------------+   |
|         |                     |                     |                   |         |
|         v                     v                     v                   v         |
|   [SMS Service]         [Pillow / S3]        [Push Service]      [SQLAlchemy 2.0] |
+---------|---------------------|---------------------|-------------------|---------+
          |                     |                     |                   |
          v                     v                     v                   v
    +-----------+        +-------------+       +--------------+     +------------+
    | MSG91 SMS |        | AWS S3 /    |       |  Expo Push   |     | PostgreSQL |
    |  Gateway  |        | Local Disk  |       | Notification |     | Database   |
    +-----------+        +-------------+       +--------------+     +------------+
```

---

## 💻 Tech Stack

### Mobile Application
- **Framework**: React Native 0.88.0, Expo SDK ~58.0.19
- **Navigation**: Expo Router (file-based routing in `src/app/`)
- **State Management**: Zustand with persistent storage
- **Data Fetching**: TanStack React Query v5 & Axios
- **Notifications**: `expo-notifications` & `expo-device`
- **Error Monitoring**: `@sentry/react-native` with PII scrubber
- **Languages**: TypeScript, i18next (English & Tamil)

### Backend API
- **Framework**: FastAPI (Python 3.11+)
- **ORM & Migrations**: SQLAlchemy 2.0 (typed with `Mapped`), Alembic
- **Database**: PostgreSQL 15+
- **Authentication**: JWT (JSON Web Tokens) with python-jose, Passlib, bcrypt
- **Image Processing**: Pillow (EXIF stripping, format normalization), python-magic
- **Cloud Storage**: AWS S3 via boto3 (with local-disk fallback for dev)
- **Monitoring & Logging**: Structured JSON logging, `sentry-sdk[fastapi]`
- **Containerization**: Docker multi-stage build, Docker Compose, Gunicorn/Uvicorn

---

## 🚀 Getting Started & Setup

### Prerequisites
- Node.js v18+ and `npm`
- Python 3.11+
- PostgreSQL 14+ (or Docker)

---

### 1. Backend API Setup (`farmkart-api`)

1. **Navigate to the API folder:**
   ```bash
   cd farmkart-api
   ```

2. **Create and activate a virtual environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   # Windows: .venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   pip install -r requirements-dev.txt
   ```

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` with your PostgreSQL database credentials and JWT secret.*

5. **Run database migrations:**
   ```bash
   alembic upgrade head
   ```

6. **Seed sample data (optional):**
   ```bash
   python scripts/seed.py
   ```

7. **Start the API server:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   *Interactive API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)*

---

### 2. Mobile App Setup (`React Native / Expo`)

1. **Install dependencies at repository root:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   *Set `EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:8000` (use your computer's local Wi-Fi IP for physical devices or `http://localhost:8000` for emulator).*

3. **Start the Expo development server:**
   ```bash
   npx expo start
   ```

4. **Run on your device or emulator:**
   - Press `a` for Android emulator
   - Press `w` for Web preview
   - Scan the QR code using the **Expo Go** app on your physical mobile phone

---

## 🔐 Environment Variables Reference

### Mobile App (`.env`)
| Variable | Description | Example |
| :--- | :--- | :--- |
| `EXPO_PUBLIC_API_URL` | Base URL of the FastAPI backend | `http://192.168.1.10:8000` |
| `EXPO_PUBLIC_SENTRY_DSN` | (Optional) Sentry project DSN for mobile crash logging | `https://xxxx@sentry.io/123456` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | (Optional) Google **Web** OAuth client ID; shows the Google button | `xxxx.apps.googleusercontent.com` |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | (Optional) Google iOS OAuth client ID, iOS builds only | `yyyy.apps.googleusercontent.com` |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | (Optional) Contact shown in the privacy policy | `support@example.com` |
| `APP_ENV` | Application environment (`development` / `production`) | `development` |

### Backend API (`farmkart-api/.env`)
| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `ENV` | Server environment (`development` / `production`) | `development` |
| `DB_HOST` | PostgreSQL hostname | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `secretpassword` |
| `DB_NAME` | PostgreSQL database name | `farmkart` |
| `JWT_SECRET` | Secret key for signing auth tokens | `openssl rand -hex 32` |
| `JWT_EXPIRE_MINUTES` | JWT expiration duration in minutes | `10080` (7 days) |
| `ENV` | `development`, `test` or `production` (defaults to `production`) | `development` |
| `CORS_ORIGINS` | Comma-separated allowed origins (web build only; ignored in development, `*` rejected in production) | `http://localhost:8081` |
| `GOOGLE_CLIENT_IDS` | Google OAuth client IDs accepted for sign-in (the Web client ID, plus the iOS one if used) | `xxxx.apps.googleusercontent.com` |
| `SUPPORT_EMAIL` | Contact for privacy / account-deletion requests, shown on `/account/delete` (required in production) | `support@example.com` |
| `FREE_DELIVERY_RADIUS_KM`| Maximum direct farm delivery radius | `50.0` |
| `MSG91_AUTH_KEY` / `MSG91_TEMPLATE_ID` | MSG91 OTP credentials (in development, OTPs print to the console when unset) | — |
| `SENTRY_DSN` | Sentry DSN for backend monitoring | `https://xxxx@sentry.io/123` |
| `AWS_ACCESS_KEY_ID` | AWS S3 access key (production uploads) | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS S3 secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `S3_BUCKET` | AWS S3 bucket name | `farmkart-uploads` |

---

## 🧪 Running Tests & Quality Checks

### Backend Test Suite
The backend contains comprehensive automated tests for concurrency locking, rate limiting, order status progression, and account deletion:
```bash
cd farmkart-api
.venv/bin/pytest -v
```

### Mobile App Verification
```bash
# Typecheck TypeScript codebase
npx tsc --noEmit

# Lint code according to Expo rules
npx expo lint
```

---

## 📄 License & Contributing

- **License**: This project is licensed under the [MIT License](LICENSE).
- **Contributing**: Please review [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines, commit standards, and coding conventions.
