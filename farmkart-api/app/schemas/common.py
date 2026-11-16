from typing import Generic, List, Optional, TypeVar, Any
from pydantic import BaseModel

T = TypeVar("T")


class MessageResponse(BaseModel):
    """Standard message response for simple actions."""
    message: str
    success: bool = True
    data: Optional[Any] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated wrapper for list endpoints."""
    items: List[T]
    total: int
    limit: int
    offset: int
