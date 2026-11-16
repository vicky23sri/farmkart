"""Server-side verification of Google Sign-In tokens."""

import logging
import time
from dataclasses import dataclass
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
VALID_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


@dataclass
class GoogleIdentity:
    email: str
    name: Optional[str]
    picture: Optional[str]
    subject: str


class GoogleAuthError(Exception):
    pass


def _truthy(value) -> bool:
    return value is True or str(value).lower() == "true"


def verify_google_token(id_token: Optional[str], access_token: Optional[str]) -> GoogleIdentity:
    """
    Verify a Google ID token or OAuth access token with Google and return the verified identity.

    The token must have been issued to one of our own OAuth client IDs (GOOGLE_CLIENT_IDS) and
    carry a verified email. Client-supplied emails are never trusted.
    """
    if not settings.GOOGLE_CLIENT_IDS:
        raise GoogleAuthError("Google sign-in is not configured on this server.")
    if not id_token and not access_token:
        raise GoogleAuthError("A Google id_token or access_token is required.")

    params = {"id_token": id_token} if id_token else {"access_token": access_token}
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(TOKENINFO_URL, params=params)
    except httpx.HTTPError as exc:
        logger.warning("Google tokeninfo request failed: %s", exc)
        raise GoogleAuthError("Could not reach Google to verify sign-in. Please try again.")

    if resp.status_code != 200:
        raise GoogleAuthError("Google sign-in token is invalid or expired.")

    info = resp.json()
    audience = info.get("aud") or info.get("azp")
    if audience not in settings.GOOGLE_CLIENT_IDS and info.get("azp") not in settings.GOOGLE_CLIENT_IDS:
        raise GoogleAuthError("Google token was not issued for this application.")

    if id_token and info.get("iss") not in VALID_ISSUERS:
        raise GoogleAuthError("Google token issuer is invalid.")

    try:
        if int(info.get("exp", 0)) < int(time.time()):
            raise GoogleAuthError("Google sign-in token has expired.")
    except ValueError:
        raise GoogleAuthError("Google sign-in token is invalid.")

    email = (info.get("email") or "").strip().lower()
    if not email or not _truthy(info.get("email_verified")):
        raise GoogleAuthError("Your Google account email is not verified.")

    subject = str(info.get("sub") or "")
    if not subject:
        raise GoogleAuthError("Google sign-in token is invalid.")

    return GoogleIdentity(
        email=email,
        name=info.get("name"),
        picture=info.get("picture"),
        subject=subject,
    )
