"""Public web pages the app stores require (no authentication)."""

from html import escape

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.core.config import settings

router = APIRouter(tags=["Legal"])


def _contact_html() -> str:
    if not settings.SUPPORT_EMAIL:
        return ""
    email = escape(settings.SUPPORT_EMAIL)
    return f"""
  <h2>Can't open the app?</h2>
  <p>Email <a href="mailto:{email}?subject=FarmKart%20account%20deletion">{email}</a> from the address
  on your account, or include the mobile number you registered with. We will confirm by OTP or email
  before deleting, and finish within 30 days.</p>"""


@router.get("/account/delete", response_class=HTMLResponse, include_in_schema=False)
def account_deletion_page() -> HTMLResponse:
    """Account-deletion instructions. Use this URL for Google Play's "Delete account URL"."""
    body = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Delete your FarmKart account</title>
<style>
  body {{ font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem;
         line-height: 1.6; color: #1f2933; background: #ffffff; }}
  h1 {{ color: #2e7d32; }}
  li {{ margin-bottom: .4rem; }}
</style>
</head>
<body>
  <h1>Delete your FarmKart account</h1>

  <h2>From the app</h2>
  <ol>
    <li>Open FarmKart and sign in.</li>
    <li>Go to the <strong>Profile</strong> tab.</li>
    <li>Tap <strong>Delete My Account</strong> (farmers: <strong>Delete Farmer Account</strong>) and confirm.</li>
  </ol>
  <p>If an order is confirmed, packed or out for delivery, or a UPI payment is still being verified,
  finish or settle it first. Orders the farmer has not accepted yet are cancelled automatically.</p>
{_contact_html()}
  <h2>What is deleted</h2>
  <ul>
    <li>Your name, mobile number, email, password, profile photo, address and location</li>
    <li>Your farmer UPI ID and product listings (listings are taken off the marketplace)</li>
    <li>Push notification tokens, notifications and sign-in codes</li>
    <li>The delivery address and notes on your past orders</li>
  </ul>

  <h2>What is kept</h2>
  <p>Order amounts, items and dates are kept without your name or contact details, because we need
  them for accounting and tax records. Reviews you wrote stay visible as "Deleted User".</p>
</body>
</html>"""
    return HTMLResponse(body)
