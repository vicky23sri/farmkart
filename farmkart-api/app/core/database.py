from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from typing import Generator
from app.core.config import settings

# Create engine for PostgreSQL
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Check connection health before using
)

# Session factory for database sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base class for models
Base = declarative_base()


def get_db() -> Generator:
    """Dependency that provides a database session and closes it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
