# Contributing to FarmKart 🌾

Thank you for your interest in contributing to FarmKart! We are committed to building an equitable, transparent direct farm-to-door agricultural marketplace for Tamil Nadu farmers and consumers.

---

## 🛠️ Development Workflow

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (`npm` or `bun`)
- **Python**: v3.11 or higher
- **PostgreSQL**: v14 or higher (or Docker)
- **Expo CLI**: `npx expo`

### 2. Fork & Branch
- Fork the repository and create your feature branch:
  ```bash
  git checkout -b feature/your-feature-name
  ```

### 3. Code Standards & Guidelines
- **Mobile (`src/`)**:
  - Always use Expo Router (`src/app/` for routes, `src/services/`, `src/store/`, `src/components/` for non-route code).
  - Use `npx expo install <package>` to resolve SDK 58 compatible versions.
  - Run type checks and linter before submitting PRs:
    ```bash
    npx tsc --noEmit
    npx expo lint
    ```
- **Backend (`farmkart-api/`)**:
  - Use SQLAlchemy 2.0 `Mapped` and `mapped_column` type annotations on all models.
  - Keep stock mutations atomic and protected by row-level locking (`with_for_update()`).
  - Run the test suite before submitting PRs:
    ```bash
    cd farmkart-api
    .venv/bin/pytest -v
    ```

### 4. Commit Conventions
We follow conventional commit format:
- `feat: add push notifications for order delivery status`
- `fix: prevent overselling under high concurrency`
- `docs: update deployment architecture and environment table`
- `test: add rate limiting tests for mobile OTP verification`

---

## ⚖️ Code of Conduct
Please be respectful and constructive in all issue discussions, code reviews, and community channels. Let us work together to uplift local farmers and rural communities.
