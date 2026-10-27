import os
import uuid
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings

# Directory for local fallback uploads
LOCAL_UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads"
)


def upload_image_file(file: UploadFile, base_url: str = "") -> str:
    """
    Upload an image to AWS S3 if credentials exist.
    Otherwise, fallback smoothly to saving locally in the uploads/ directory.
    Returns the public image URL.
    """
    # 1. Validate extension
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp"}
    if file_ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file extension. Only jpg, png, and webp are allowed.",
        )

    # 2. Read contents and check 5 MB size limit
    contents = file.file.read()
    max_bytes = 5 * 1024 * 1024  # 5 MB
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the 5 MB limit.",
        )

    # Reset pointer if needed
    file.file.seek(0)

    unique_filename = f"{uuid.uuid4().hex}{file_ext}"

    # 3. Check if AWS S3 credentials are configured
    has_aws_keys = bool(
        settings.AWS_ACCESS_KEY_ID
        and settings.AWS_SECRET_ACCESS_KEY
        and settings.S3_BUCKET
    )

    if has_aws_keys:
        try:
            s3_client = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION,
            )
            content_type = file.content_type or "image/jpeg"
            s3_client.put_object(
                Bucket=settings.S3_BUCKET,
                Key=unique_filename,
                Body=contents,
                ContentType=content_type,
            )
            # Standard public S3 URL
            return f"https://{settings.S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{unique_filename}"
        except (BotoCoreError, ClientError) as err:
            print(f"[Warning] S3 upload failed ({err}). Falling back to local disk storage.")

    # 4. Fallback to local disk storage
    os.makedirs(LOCAL_UPLOAD_DIR, exist_ok=True)
    destination_path = os.path.join(LOCAL_UPLOAD_DIR, unique_filename)
    with open(destination_path, "wb") as f:
        f.write(contents)

    # Return accessible static path
    if base_url:
        return f"{base_url.rstrip('/')}/static/uploads/{unique_filename}"
    return f"/static/uploads/{unique_filename}"
