from fastapi import APIRouter, Depends, File, Request, UploadFile
from pydantic import BaseModel
from app.core.deps import get_current_user
from app.core.rate_limit import rate_limit
from app.models.user import User
from app.services.s3 import upload_image_file

router = APIRouter(prefix="/uploads", tags=["Uploads"])


class UploadImageResponse(BaseModel):
    url: str
    message: str = "Image uploaded successfully."


@router.post(
    "/image",
    response_model=UploadImageResponse,
    dependencies=[Depends(rate_limit("upload", 30, 600))],
)
def upload_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload an image (jpg, png, webp, max 5MB).
    Verifies magic bytes, strips EXIF/GPS metadata via Pillow, and generates random UUID filename.
    In production: strictly uploads to S3 and returns S3 URL with no local disk fallback.
    In development: saves to S3 if configured, or local disk fallback.
    Requires JWT authentication.
    """
    base_url = str(request.base_url)
    image_url = upload_image_file(file, base_url=base_url)
    return UploadImageResponse(url=image_url)
