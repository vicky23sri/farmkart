import re
from typing import Any, Dict, Optional
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

# Regex patterns for detecting sensitive PII
# Matches 10-digit Indian mobile numbers (optionally prefixed with +91, 91, or 0)
PHONE_REGEX = re.compile(r"(?:(?:\+|00)91[\s-]?)?[6-9]\d{9}\b")
# Matches standard JSON Web Tokens (header.payload.signature)
JWT_REGEX = re.compile(r"eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+")
# Matches Bearer token strings
BEARER_REGEX = re.compile(r"Bearer\s+[A-Za-z0-9\-_.=]+", re.IGNORECASE)

SENSITIVE_PHONE_KEYS = {"mobile", "phone", "phone_number", "contact_number"}
SENSITIVE_TOKEN_KEYS = {
    "token",
    "jwt",
    "access_token",
    "refresh_token",
    "authorization",
    "otp",
    "code",
    "password",
    "secret",
}


def sanitize_string(text: str) -> str:
    """Masks phone numbers and authentication tokens within a string."""
    if not isinstance(text, str):
        return text
    text = BEARER_REGEX.sub("Bearer [REDACTED_TOKEN]", text)
    text = JWT_REGEX.sub("[REDACTED_TOKEN]", text)
    text = PHONE_REGEX.sub("[REDACTED_PHONE]", text)
    return text


def sanitize_pii(data: Any) -> Any:
    """Recursively walks arbitrary data structures and sanitizes sensitive PII."""
    if isinstance(data, dict):
        sanitized = {}
        for key, value in data.items():
            key_lower = str(key).lower()
            if any(p_key in key_lower for p_key in SENSITIVE_PHONE_KEYS):
                sanitized[key] = "[REDACTED_PHONE]"
            elif any(t_key in key_lower for t_key in SENSITIVE_TOKEN_KEYS):
                sanitized[key] = "[REDACTED_TOKEN]"
            else:
                sanitized[key] = sanitize_pii(value)
        return sanitized
    elif isinstance(data, list):
        return [sanitize_pii(item) for item in data]
    elif isinstance(data, str):
        return sanitize_string(data)
    return data


def scrub_sentry_event(event: Dict[str, Any], hint: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """
    Sentry before_send hook that scrubs phone numbers, tokens,
    and sensitive authorization headers before transmission.
    """
    if not event:
        return event

    # Sanitize request headers and bodies
    request = event.get("request")
    if isinstance(request, dict):
        headers = request.get("headers")
        if isinstance(headers, dict):
            for header_name in list(headers.keys()):
                h_lower = header_name.lower()
                if h_lower in ("authorization", "cookie", "x-auth-token"):
                    headers[header_name] = "[REDACTED_TOKEN]"
                elif "phone" in h_lower or "mobile" in h_lower:
                    headers[header_name] = "[REDACTED_PHONE]"
        if "data" in request:
            request["data"] = sanitize_pii(request["data"])

    # Sanitize user details
    user = event.get("user")
    if isinstance(user, dict):
        event["user"] = sanitize_pii(user)

    # Sanitize breadcrumbs
    breadcrumbs = event.get("breadcrumbs")
    if isinstance(breadcrumbs, dict) and "values" in breadcrumbs:
        breadcrumbs["values"] = [sanitize_pii(b) for b in breadcrumbs["values"]]

    # Sanitize extra and contexts
    if "extra" in event:
        event["extra"] = sanitize_pii(event["extra"])
    if "contexts" in event:
        event["contexts"] = sanitize_pii(event["contexts"])

    # Sanitize exception values and messages
    exceptions = event.get("exception", {}).get("values", [])
    for exc in exceptions:
        if "value" in exc and isinstance(exc["value"], str):
            exc["value"] = sanitize_string(exc["value"])

    if "message" in event and isinstance(event["message"], str):
        event["message"] = sanitize_string(event["message"])

    return event


def init_sentry(dsn: str, env: str = "development", traces_sample_rate: float = 0.1) -> None:
    """Initializes Sentry SDK with FastAPI integration and PII scrubbing."""
    if not dsn:
        return

    sentry_sdk.init(
        dsn=dsn,
        environment=env,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
        ],
        before_send=scrub_sentry_event,
        send_default_pii=False,
        traces_sample_rate=traces_sample_rate,
    )
