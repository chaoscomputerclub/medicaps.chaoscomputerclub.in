"""
Chaos Computer Club — Medi-Caps Chapter
utils/email.py — Async SMTP email dispatcher
Architecture mirrors: Interleet/backend/app/utils/email.py
"""
import asyncio
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import settings

logger = logging.getLogger(__name__)


def _otp_email_template(otp_code: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CCC Verification Code</title>
</head>
<body style="margin:0;padding:0;background:#050505;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;background:#0f0f0f;border:1px solid #1f1f1f;border-radius:12px;overflow:hidden;">
        <tr><td height="4" style="background:linear-gradient(90deg,#ff6500,#ff8c00);font-size:4px;line-height:4px;">&nbsp;</td></tr>
        <tr><td style="padding:36px 32px;text-align:center;">
          <div style="display:inline-block;padding:6px 14px;background:#141414;border:1px solid #262626;border-radius:6px;margin-bottom:28px;">
            <span style="font-size:12px;font-weight:700;letter-spacing:2px;color:#fff;">CHAOS COMPUTER CLUB · MEDI-CAPS</span>
          </div>
          <h1 style="font-size:18px;font-weight:600;color:#fff;margin:0 0 8px;">Verify your identity</h1>
          <p style="font-size:14px;color:#888;margin:0 0 32px;">Enter the code below to access your Medi-Caps arena account.</p>
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:24px;margin:0 0 28px;">
            <div style="font-size:40px;font-weight:700;letter-spacing:10px;color:#ff6500;font-family:Courier New,monospace;">{otp_code}</div>
          </div>
          <p style="font-size:13px;color:#555;margin:0 0 4px;">This code expires in <strong style="color:#888;">5 minutes</strong>.</p>
          <p style="font-size:13px;color:#555;margin:0;">If you did not request this, ignore this email.</p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #1f1f1f;text-align:center;">
          <p style="font-size:11px;color:#444;margin:0;">Chaos Computer Club · Medi-Caps University Chapter · chaoscomputerclub.in</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _smtp_send_sync(to_email: str, subject: str, html_body: str) -> None:
    """Synchronous SMTP send — run via asyncio.to_thread to keep event loop free."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    if settings.SMTP_PORT == 465:
        server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)
    else:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)
        server.ehlo()
        if server.has_extn("STARTTLS"):
            server.starttls()
            server.ehlo()
    try:
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, [to_email], msg.as_string())
    finally:
        server.quit()


async def send_otp_email(to_email: str, otp: str) -> bool:
    """
    Dispatch OTP verification email asynchronously.
    Uses asyncio.to_thread so the event loop is never blocked.
    Returns True on success, False on SMTP failure.
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.info("[DEV] OTP for %s: %s (no SMTP configured)", to_email, otp)
        return True

    try:
        subject = f"Your Chaos Computer Club Code: {otp}"
        html = _otp_email_template(otp)
        await asyncio.to_thread(_smtp_send_sync, to_email, subject, html)
        logger.info("OTP email sent to %s", to_email)
        return True
    except Exception as e:
        logger.error("SMTP error sending to %s: %s", to_email, e)
        return False
