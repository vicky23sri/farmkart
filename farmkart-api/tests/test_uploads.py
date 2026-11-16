import io
import re
from unittest.mock import MagicMock, patch
from botocore.exceptions import ClientError
from fastapi.testclient import TestClient
from PIL import Image

from app.core.config import settings


def _create_test_image(format: str = "JPEG", add_exif: bool = False) -> bytes:
    """Helper to generate in-memory test image with optional EXIF metadata."""
    img = Image.new("RGB", (64, 64), color=(100, 200, 50))
    buffer = io.BytesIO()

    if add_exif and format == "JPEG":
        exif = img.getexif()
        # 0x010E is ImageDescription, 0x010F is Make, 0x0110 is Model
        exif[0x010E] = "Sensitive GPS location metadata"
        exif[0x0110] = "iPhone 15 Pro"
        img.save(buffer, format=format, exif=exif)
    else:
        img.save(buffer, format=format)

    return buffer.getvalue()


def test_upload_magic_bytes_invalid_file(buyer_client: TestClient):
    """Ensure non-image files with spoofed image extension are rejected via magic bytes."""
    fake_image_content = b"This is a malicious shell script pretending to be an image."
    files = {"file": ("malicious.jpg", io.BytesIO(fake_image_content), "image/jpeg")}

    resp = buyer_client.post("/uploads/image", files=files)
    assert resp.status_code == 400
    assert "Invalid image file format" in resp.json()["detail"]


def test_upload_valid_image_and_uuid_filename(buyer_client: TestClient):
    """Test valid PNG image upload produces random UUID filename."""
    png_bytes = _create_test_image("PNG")
    files = {"file": ("avatar.png", io.BytesIO(png_bytes), "image/png")}

    resp = buyer_client.post("/uploads/image", files=files)
    assert resp.status_code == 200
    data = resp.json()
    url = data["url"]

    # Verify filename is a 32-char hex UUID with .png
    filename = url.split("/")[-1]
    assert re.match(r"^[0-9a-f]{32}\.png$", filename)


def test_upload_strips_exif_data(buyer_client: TestClient):
    """Verify that Pillow re-encoding completely strips EXIF and GPS metadata."""
    jpeg_with_exif = _create_test_image("JPEG", add_exif=True)

    # Double check that source image has EXIF
    src_img = Image.open(io.BytesIO(jpeg_with_exif))
    assert len(src_img.getexif()) > 0

    files = {"file": ("photo.jpg", io.BytesIO(jpeg_with_exif), "image/jpeg")}
    resp = buyer_client.post("/uploads/image", files=files)
    assert resp.status_code == 200

    url = resp.json()["url"]
    filename = url.split("/")[-1]

    # Read uploaded file from local static directory in dev
    import os
    from app.services.s3 import LOCAL_UPLOAD_DIR

    saved_path = os.path.join(LOCAL_UPLOAD_DIR, filename)
    assert os.path.exists(saved_path)

    with Image.open(saved_path) as saved_img:
        saved_exif = saved_img.getexif()
        # EXIF tags must be completely stripped
        assert len(saved_exif) == 0


def test_upload_streaming_size_limit_exceeded(buyer_client: TestClient):
    """Test that file exceeding 5MB is rejected immediately while streaming."""
    # 5.1 MB of dummy data starting with JPEG magic bytes
    large_content = b"\xff\xd8\xff\xe0" + (b"A" * (5 * 1024 * 1024 + 100 * 1024))
    files = {"file": ("huge.jpg", io.BytesIO(large_content), "image/jpeg")}

    resp = buyer_client.post("/uploads/image", files=files)
    assert resp.status_code == 400
    assert "File size exceeds the 5 MB limit" in resp.json()["detail"]


def test_upload_production_s3_only_success(buyer_client: TestClient, monkeypatch):
    """In production, uploads must go to S3 and return the S3 URL."""
    monkeypatch.setattr(settings, "ENV", "production")
    monkeypatch.setattr(settings, "S3_BUCKET", "farmkart-prod-bucket")
    monkeypatch.setattr(settings, "AWS_REGION", "ap-south-1")

    png_bytes = _create_test_image("PNG")
    files = {"file": ("product.png", io.BytesIO(png_bytes), "image/png")}

    mock_s3 = MagicMock()
    with patch("app.services.s3.get_s3_client", return_value=mock_s3):
        resp = buyer_client.post("/uploads/image", files=files)
        assert resp.status_code == 200
        url = resp.json()["url"]

        assert url.startswith("https://farmkart-prod-bucket.s3.ap-south-1.amazonaws.com/")
        mock_s3.put_object.assert_called_once()


def test_upload_production_s3_failure_no_local_fallback(buyer_client: TestClient, monkeypatch):
    """In production, if S3 fails, it must fail with 503 and NEVER fallback to local disk."""
    monkeypatch.setattr(settings, "ENV", "production")
    monkeypatch.setattr(settings, "S3_BUCKET", "farmkart-prod-bucket")
    monkeypatch.setattr(settings, "AWS_REGION", "ap-south-1")

    png_bytes = _create_test_image("PNG")
    files = {"file": ("product.png", io.BytesIO(png_bytes), "image/png")}

    mock_s3 = MagicMock()
    mock_s3.put_object.side_effect = ClientError({"Error": {"Message": "Access Denied"}}, "PutObject")

    with patch("app.services.s3.get_s3_client", return_value=mock_s3):
        resp = buyer_client.post("/uploads/image", files=files)
        assert resp.status_code == 503
        assert "temporarily unavailable" in resp.json()["detail"]
