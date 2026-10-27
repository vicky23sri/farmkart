from pydantic import BaseModel
from typing import Optional, Any


class MessageResponse(BaseModel):
    """Standard message response for simple actions."""
    message: str
    success: bool = True
    data: Optional[Any] = None
