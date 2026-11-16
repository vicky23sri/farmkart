import os
from typing import Annotated, Any
from urllib.parse import quote_plus
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict



def _split_csv(v: Any) -> list[str]:
    if isinstance(v, str):
        return [item.strip() for item in v.split(",") if item.strip()]
    if isinstance(v, (list, tuple, set)):
        return [str(item).strip() for item in v if str(item).strip()]
    return []


class Settings(BaseSettings):
    """Application settings loaded from environment or .env file."""

    # Environment: "development" | "test" | "production".
    # Defaults to production so that a missing ENV never silently enables dev behaviour.
    ENV: str = "production"

    # Database (no default credentials: they must come from the environment)
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str
    DB_PASSWORD: str
    DB_NAME: str = "farmkart"
    DB_SSLMODE: str = "prefer"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10

    # Security & JWT
    JWT_SECRET: str
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days

    # Google Sign-In: OAuth client IDs whose tokens we accept (comma-separated)
    GOOGLE_CLIENT_IDS: Annotated[list[str], NoDecode] = []

    # Public contact for privacy, support and account-deletion requests (shown on /account/delete)
    SUPPORT_EMAIL: str = ""

    # Delivery Configuration
    FREE_DELIVERY_RADIUS_KM: float = 50.0
    MAX_EXTENDED_DELIVERY_KM: float = 0.0  # 0 means no hard limit

    # CORS Configuration (only relevant for the web build; native apps do not use CORS)
    CORS_ORIGINS: Annotated[list[str], NoDecode] = []

    # Expose /docs and /redoc. Defaults to on outside production.
    ENABLE_DOCS: bool | None = None

    # Rate limiting (requests per window, per client IP)
    RATE_LIMIT_ENABLED: bool = True

    # Sentry Configuration
    SENTRY_DSN: str = ""
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1

    # MSG91 SMS Provider Configuration
    MSG91_AUTH_KEY: str = ""
    MSG91_TEMPLATE_ID: str = ""
    MSG91_SENDER_ID: str = ""

    # AWS S3 (optional in development; required in production)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-south-1"
    S3_BUCKET: str = ""
    # Public base URL for uploaded objects (e.g. a CloudFront domain). Defaults to the S3 bucket URL.
    S3_PUBLIC_BASE_URL: str = ""

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("ENV")
    @classmethod
    def normalize_env(cls, v: str) -> str:
        v = (v or "production").strip().lower()
        if v not in ("development", "test", "production"):
            raise ValueError("ENV must be one of: development, test, production")
        return v

    @field_validator("JWT_SECRET")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 32:
            raise ValueError(
                f"JWT_SECRET must be at least 32 characters long (received {len(v)}). "
                "Run `openssl rand -hex 32` to generate one."
            )
        return v

    @field_validator("CORS_ORIGINS", "GOOGLE_CLIENT_IDS", mode="before")
    @classmethod
    def parse_csv(cls, v: Any) -> list[str]:
        return _split_csv(v)

    @model_validator(mode="after")
    def validate_production(self) -> "Settings":
        if self.ENV != "production":
            return self
        missing = []
        if not self.MSG91_AUTH_KEY or not self.MSG91_TEMPLATE_ID:
            missing.append("MSG91_AUTH_KEY / MSG91_TEMPLATE_ID")
        if not self.S3_BUCKET:
            missing.append("S3_BUCKET")
        if not self.SUPPORT_EMAIL:
            missing.append("SUPPORT_EMAIL")
        if "*" in self.CORS_ORIGINS:
            raise ValueError("CORS_ORIGINS must not contain '*' in production.")
        if self.DB_SSLMODE == "disable" and self.DB_HOST not in ("localhost", "127.0.0.1", "postgres", "db"):
            missing.append("DB_SSLMODE (must not be 'disable' for a remote database)")
        if missing:
            raise ValueError("Production configuration incomplete: " + ", ".join(missing))
        return self

    @property
    def is_production(self) -> bool:
        return self.ENV == "production"

    @property
    def docs_enabled(self) -> bool:
        if self.ENABLE_DOCS is not None:
            return self.ENABLE_DOCS
        return not self.is_production

    @property
    def DATABASE_URL(self) -> str:
        """Builds standard SQLAlchemy connection string."""
        return (
            f"postgresql+psycopg2://{quote_plus(self.DB_USER)}:{quote_plus(self.DB_PASSWORD)}@"
            f"{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?sslmode={self.DB_SSLMODE}"
        )


settings = Settings()
