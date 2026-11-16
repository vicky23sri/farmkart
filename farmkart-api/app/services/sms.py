from abc import ABC, abstractmethod
import json
import logging
import urllib.request
import urllib.error
from app.core.config import settings

logger = logging.getLogger(__name__)


class BaseSMSProvider(ABC):
    """Abstract Base Class for SMS delivery providers."""

    @abstractmethod
    def send_otp(self, mobile: str, otp_code: str) -> bool:
        """Dispatch OTP code to recipient mobile number."""
        pass


class MSG91SMSProvider(BaseSMSProvider):
    """
    MSG91 SMS Gateway implementation using their Send OTP API.
    Docs: https://docs.msg91.com/p/tf9mwn/e/7XqW2E/MSG91
    """

    def send_otp(self, mobile: str, otp_code: str) -> bool:
        if not settings.MSG91_AUTH_KEY:
            logger.error("MSG91 SMS failed: MSG91_AUTH_KEY is not set.")
            return False

        # MSG91 expects mobile formatted with country code (91 for India)
        clean_mobile = mobile.strip()
        if not clean_mobile.startswith("91") and len(clean_mobile) == 10:
            formatted_mobile = f"91{clean_mobile}"
        else:
            formatted_mobile = clean_mobile

        url = "https://control.msg91.com/api/v5/otp"
        payload = {
            "template_id": settings.MSG91_TEMPLATE_ID,
            "mobile": formatted_mobile,
            "otp": otp_code,
        }
        if settings.MSG91_SENDER_ID:
            payload["sender"] = settings.MSG91_SENDER_ID

        headers = {
            "Content-Type": "application/json",
            "authkey": settings.MSG91_AUTH_KEY,
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                status_code = response.getcode()
                body = response.read().decode("utf-8")
                logger.info("MSG91 SMS API dispatched. HTTP %s", status_code)
                logger.debug("MSG91 response body: %s", body)
                return 200 <= status_code < 300
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8") if e.fp else str(e)
            logger.error("MSG91 SMS HTTP error %s: %s", e.code, error_body)
            return False
        except Exception as e:
            logger.error("MSG91 SMS unexpected error: %s", str(e))
            return False


class ConsoleSMSProvider(BaseSMSProvider):
    """
    Development fallback SMS provider that logs and outputs OTP to console.
    Strictly forbidden in non-development environments.
    """

    def send_otp(self, mobile: str, otp_code: str) -> bool:
        if settings.ENV not in ("development", "test"):
            logger.warning(
                "ConsoleSMSProvider invoked in %s environment! Refusing to print OTP.",
                settings.ENV,
            )
            return False

        print("\n" + "=" * 50)
        print(f"🌾 [DEV CONSOLE SMS] AUTH OTP FOR MOBILE: {mobile}")
        print(f"👉 YOUR OTP CODE IS: {otp_code}")
        print("⏰ Valid for 5 minutes")
        print("=" * 50 + "\n")
        logger.info("[DEV] OTP printed to console for mobile: %s", mobile)
        return True


def get_sms_provider() -> BaseSMSProvider:
    """
    Factory function returning the appropriate SMS provider based on environment:
    - If in development and MSG91_AUTH_KEY is not configured, fallback to ConsoleSMSProvider.
    - Otherwise (production or when MSG91 is configured), use MSG91SMSProvider.
    """
    if settings.ENV in ("development", "test") and not settings.MSG91_AUTH_KEY:
        return ConsoleSMSProvider()
    return MSG91SMSProvider()
