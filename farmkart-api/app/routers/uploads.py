from fastapi import APIRouter, Depends, File, UploadFile, Request
from pydantic import BaseModel
from app.core.deps import get_current_user
from app.models.user import User
from app.services.s3 import upload_image_file

router = APIRouter(prefix="/uploads", tags=["Uploads"])


class UploadImageResponse(BaseModel):
    url: str
    message: str = "Image uploaded successfully."


@router.post("/image", response_model=UploadImageResponse)
def upload_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload an image (jpg, png, webp, max 5MB).
    Uploads to AWS S3 if credentials configured in .env, otherwise saves to local disk.
    Requires JWT authentication.
    """
    base_url = str(request.base_url)
    image_url = upload_image_file(file, base_url=base_url)
    return UploadImageResponse(url=image_url)
