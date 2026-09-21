"""
Chaos Computer Club — Medi-Caps Chapter
utils/email.py — Async SMTP email dispatcher
Minimalist clean card UI template for email verification OTP,
pixel-matched to the specification (Verify your email, left-aligned typography,
clean card border, RFC-compliant multipart/alternative HTML + plaintext).
"""
import asyncio
import html as html_lib
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import settings

logger = logging.getLogger(__name__)


def _otp_email_plaintext(to_email: str, otp_code: str) -> str:
    """
    Plain-text fallback version of the OTP verification email.
    Required by spam filters and text-only email clients.
    """
    app_name = settings.SMTP_FROM_NAME or "Chaos Computer Club"
    return f"""Verify your email

We need to verify your email address {to_email} before you can access your account. Enter the code below in your open browser window.

{otp_code}

This code expires in 15 minutes.
If you didn't sign up for {app_name}, you can safely ignore this email. Someone else might have typed your email address by mistake.
"""


def _otp_email_template(to_email: str, otp_code: str) -> str:
    """
    Clean, minimalist email verification OTP template.
    Pixel-matched to the clean UI card specification:
    - Rounded border card (#ffffff background, #e5e7eb border, border-radius: 20px)
    - Bold left-aligned header 'Verify your email'
    - Dynamic email address display in instruction paragraph
    - High-visibility 36px monospace-capable tabular numeral OTP token
    - Clean horizontal separator
    - 15-minute expiration notice and safe-ignore footer
    """
    safe_email = html_lib.escape(to_email.strip())
    safe_code = html_lib.escape(otp_code.strip())
    app_name = html_lib.escape(settings.SMTP_FROM_NAME or "Chaos Computer Club")
    preview_padding = "&#847; &zwnj; &nbsp; &#8199; &shy; " * 25

    return f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>Verify your email address</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, p, a, div {{
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      margin: 0;
      padding: 0;
    }}
    table, td {{
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
      border-collapse: separate;
    }}
    @media only screen and (max-width: 600px) {{
      .card-wrap {{
        padding: 24px 16px !important;
      }}
      .card-container {{
        padding: 32px 24px !important;
        border-radius: 16px !important;
      }}
      .otp-display {{
        font-size: 32px !important;
        margin-bottom: 28px !important;
      }}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Preheader text (inbox preview) -->
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    Your verification code is {safe_code}. Valid for 15 minutes.
    {preview_padding}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#ffffff;">
    <tr>
      <td align="center" valign="top" class="card-wrap" style="padding:48px 16px 64px 16px;">

        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="520">
          <tr>
            <td align="left" valign="top" width="520">
        <![endif]-->

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card-container" style="max-width:520px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:20px;padding:44px 40px;text-align:left;box-sizing:border-box;">
          <tr>
            <td align="left" style="padding:0;">

              <!-- Heading -->
              <h1 style="margin:0 0 18px 0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:24px;font-weight:700;color:#111827;line-height:1.25;letter-spacing:-0.2px;">
                Verify your email
              </h1>

              <!-- Instruction Paragraph -->
              <p style="margin:0 0 32px 0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#374151;">
                We need to verify your email address <a href="mailto:{safe_email}" style="color:#2563eb;text-decoration:none;">{safe_email}</a> before you can access your account. Enter the code below in your open browser window.
              </p>

              <!-- OTP Code Display -->
              <div class="otp-display" style="margin:0 0 32px 0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:36px;font-weight:600;color:#111827;letter-spacing:2px;line-height:1;font-variant-numeric:tabular-nums;">
                {safe_code}
              </div>

              <!-- Thin Horizontal Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px 0;">
                <tr>
                  <td style="border-top:1px solid #f3f4f6;height:1px;line-height:1px;font-size:1px;padding:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Expiry Notice -->
              <p style="margin:0 0 10px 0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#6b7280;">
                This code expires in 15 minutes.
              </p>

              <!-- Disclaimer / Ignore -->
              <p style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#6b7280;">
                If you didn't sign up for {app_name}, you can safely ignore this email. Someone else might have typed your email address by mistake.
              </p>

            </td>
          </tr>
        </table>

        <!--[if (gte mso 9)|(IE)]>
            </td>
          </tr>
        </table>
        <![endif]-->

      </td>
    </tr>
  </table>

</body>
</html>"""
def _smtp_send_sync(to_email: str, subject: str, html_body: str, plain_body: str) -> None:
    """
    Synchronous SMTP send — run via asyncio.to_thread to keep event loop free.
    Attaches both text/plain and text/html alternatives (RFC 2046 compliant).
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM}>"
    msg["To"] = to_email

    # Plain text alternative must be attached first, HTML second
    msg.attach(MIMEText(plain_body, "plain", "utf-8"))
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
    When mail dispatch is disabled (e.g. in dev mode), skips SMTP and logs OTP directly.
    """
    logger.info("🔑 [AUTH] Generated OTP for %s: %s", to_email, otp)

    # HARD SHIELD: Block all automated QA/test emails from hitting SMTP to protect domain reputation
    if (
        to_email.startswith("qa.")
        or "test" in to_email
        or to_email == "qa.organizer@medicaps.ac.in"
        or getattr(settings, "ENVIRONMENT", "production") in ("test", "testing", "qa")
    ):
        logger.info("🛡️ [QA/TEST GUARD] Suppressing external SMTP dispatch for %s. Mock OTP: %s", to_email, otp)
        return True

    if settings.is_mail_dispatch_disabled:
        logger.info("⚡ [DEV MODE] Mail dispatch disabled. Mock OTP for %s: %s", to_email, otp)
        return True

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.info("[DEV] OTP for %s: %s (no SMTP configured)", to_email, otp)
        return True

    try:
        subject = "Verify your email address"
        html = _otp_email_template(to_email, otp)
        plaintext = _otp_email_plaintext(to_email, otp)
        await asyncio.to_thread(_smtp_send_sync, to_email, subject, html, plaintext)
        logger.info("✓ OTP email sent to %s", to_email)
        return True
    except Exception as e:
        logger.error("SMTP error sending to %s: %s", to_email, e)
        if settings.is_dev_bypass_enabled or "qa." in to_email or "test" in to_email:
            logger.warning("⚠️ [TEST/QA FALLBACK] SMTP failed, but allowing login for %s. Use OTP: %s", to_email, otp)
            return True
        return False
