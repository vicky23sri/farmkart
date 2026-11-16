import io
import logging
import os
import re
import uuid
from typing import Optional
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps

from app.core.config import settings

logger = logging.getLogger(__name__)

# Directory for local fallback uploads in development
LOCAL_UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads"
)

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
# Reject decompression bombs: 40 megapixels is far above any phone camera output we resize.
Image.MAX_IMAGE_PIXELS = 40_000_000
MAX_DIMENSION = 2048
STREAM_CHUNK_SIZE = 64 * 1024  # 64 KB chunks


def detect_magic_bytes(data: bytes) -> Optional[str]:
    """
    Inspects leading magic bytes to verify true image format.
    Prevents file extension spoofing attacks.
    """
    if len(data) < 12:
        return None
    if data.startswith(b"\xff\xd8\xff"):
        return "JPEG"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "PNG"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "WEBP"
    return None


def get_s3_client():
    """Initializes Boto3 S3 client using explicit credentials or IAM instance/task role."""
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        return boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
    return boto3.client("s3", region_name=settings.AWS_REGION)


def public_object_url(key: str) -> str:
    """Public URL for an uploaded object (CloudFront/custom domain if configured)."""
    if settings.S3_PUBLIC_BASE_URL:
        return f"{settings.S3_PUBLIC_BASE_URL.rstrip('/')}/{key}"
    return f"https://{settings.S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"


def upload_image_file(file: UploadFile, base_url: str = "") -> str:
    """
    Streams and validates image upload:
    1. Enforces size limit while streaming (max 5 MB) to avoid memory exhaustion.
    2. Validates real file type via magic bytes (JPEG, PNG, WebP).
    3. Re-encodes with Pillow to strip EXIF/GPS metadata and sanitize raw pixel data.
    4. Generates a cryptographically random UUID filename.
    5. In production: strictly uploads to S3, returning the S3 URL with no local fallback.
       In development: uploads to S3 if configured, or falls back to local disk.
    """
    # 1. Stream file while enforcing size limit
    total_bytes = 0
    chunks = []

    while True:
        chunk = file.file.read(STREAM_CHUNK_SIZE)
        if not chunk:
            break
        total_bytes += len(chunk)
        if total_bytes > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds the 5 MB limit.",
            )
        chunks.append(chunk)

    if total_bytes == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file upload.",
        )

    raw_data = b"".join(chunks)

    # 2. Verify file type with magic bytes
    detected_format = detect_magic_bytes(raw_data)
    if not detected_format:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image file format. Only JPEG, PNG, and WebP are allowed.",
        )

    # 3. Re-encode image with Pillow to strip EXIF and GPS metadata
    try:
        with Image.open(io.BytesIO(raw_data)) as img:
            # Verify image integrity
            if img.format not in ("JPEG", "PNG", "WEBP"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported image format: {img.format}.",
                )

            # Auto-orient based on EXIF tag before stripping
            try:
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass

            # Downscale very large photos to save bandwidth for buyers on mobile data
            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))

            output_buffer = io.BytesIO()
            if detected_format == "JPEG":
                if img.mode in ("RGBA", "P", "LA"):
                    img = img.convert("RGB")
                img.save(output_buffer, format="JPEG", quality=85, optimize=True)
                content_type = "image/jpeg"
                target_ext = ".jpg"
            elif detected_format == "PNG":
                img.save(output_buffer, format="PNG", optimize=True)
                content_type = "image/png"
                target_ext = ".png"
            elif detected_format == "WEBP":
                img.save(output_buffer, format="WEBP", quality=85)
                content_type = "image/webp"
                target_ext = ".webp"
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Unsupported image format.",
                )

            clean_bytes = output_buffer.getvalue()
    except HTTPException:
        raise
    except Image.DecompressionBombError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image dimensions are too large.",
        )
    except Exception as exc:
        logger.error("Failed to process and re-encode image: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Corrupted or invalid image file.",
        )

    # 4. Generate random UUID filename
    unique_filename = f"{uuid.uuid4().hex}{target_ext}"

    # 5. Production: Upload to S3 only (NO local disk fallback)
    is_production = settings.ENV.lower() == "production"

    if is_production:
        if not (settings.S3_BUCKET and settings.AWS_REGION):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Image upload is not configured.",
            )
        try:
            s3_client = get_s3_client()
            s3_client.put_object(
                Bucket=settings.S3_BUCKET,
                Key=unique_filename,
                Body=clean_bytes,
                ContentType=content_type,
                CacheControl="public, max-age=31536000, immutable",
            )
            return public_object_url(unique_filename)
        except (BotoCoreError, ClientError) as err:
            logger.error("S3 upload failed in production: %s", err)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Image upload is temporarily unavailable. Please try again.",
            )

    # In development / testing: try S3 if credentials exist, otherwise save locally
    has_aws_keys = bool(
        settings.AWS_ACCESS_KEY_ID
        and settings.AWS_SECRET_ACCESS_KEY
        and settings.S3_BUCKET
    )
    if has_aws_keys:
        try:
            s3_client = get_s3_client()
            s3_client.put_object(
                Bucket=settings.S3_BUCKET,
                Key=unique_filename,
                Body=clean_bytes,
                ContentType=content_type,
                CacheControl="public, max-age=31536000, immutable",
            )
            return public_object_url(unique_filename)
        except (BotoCoreError, ClientError) as err:
            logger.warning("S3 upload failed in development (%s). Falling back to local disk storage.", err)

    # Local fallback for non-production environments
    os.makedirs(LOCAL_UPLOAD_DIR, exist_ok=True)
    destination_path = os.path.join(LOCAL_UPLOAD_DIR, unique_filename)
    with open(destination_path, "wb") as f:
        f.write(clean_bytes)

    if base_url:
        return f"{base_url.rstrip('/')}/static/uploads/{unique_filename}"
    return f"/static/uploads/{unique_filename}"


# Filenames we generate: 32 hex chars + a known extension. Anything else is not ours to delete.
_OWN_FILENAME = re.compile(r"^[0-9a-f]{32}\.(jpg|png|webp)$")


def delete_uploaded_image(url: Optional[str]) -> bool:
    """
    Best-effort removal of an image this API uploaded (S3 object or local dev file).
    URLs we did not issue (e.g. a Google profile picture) are ignored. Never raises.
    Returns True when a file was deleted.
    """
    if not url:
        return False
    filename = url.split("?", 1)[0].rstrip("/").rsplit("/", 1)[-1]
    if not _OWN_FILENAME.match(filename):
        return False

    try:
        if settings.S3_BUCKET and url.startswith(public_object_url("")):
            get_s3_client().delete_object(Bucket=settings.S3_BUCKET, Key=filename)
            return True
        if "/static/uploads/" in url and not settings.is_production:
            path = os.path.join(LOCAL_UPLOAD_DIR, filename)
            if os.path.isfile(path):
                os.remove(path)
                return True
    except (BotoCoreError, ClientError, OSError) as err:
        logger.warning("Could not delete uploaded image %s: %s", filename, err)
    return False
