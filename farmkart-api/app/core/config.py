import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from urllib.parse import quote_plus


class Settings(BaseSettings):
    """Application settings loaded from environment or .env file."""

    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "virat"
    DB_PASSWORD: str = ""
    DB_NAME: str = "farmkart"
    DB_SSLMODE: str = "disable"

    # Security & JWT
    JWT_SECRET: str = "farmkart_super_secret_jwt_key_2026_xyz123"
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days

    # Delivery Configuration
    FREE_DELIVERY_RADIUS_KM: float = 50.0
    MAX_EXTENDED_DELIVERY_KM: float = 0.0  # 0 means no hard limit

    # AWS S3 (optional)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-south-1"
    S3_BUCKET: str = "farmkart-uploads"

    # Load from .env file
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def DATABASE_URL(self) -> str:
        """Builds standard SQLAlchemy connection string."""
        encoded_password = quote_plus(self.DB_PASSWORD)
        return (
            f"postgresql+psycopg2://{self.DB_USER}:{encoded_password}@"
            f"{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?sslmode={self.DB_SSLMODE}"
        )


settings = Settings()
