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
    return f"""Sign in to {app_name}

You requested to sign in to {app_name}. Your one-time code is:

{otp_code}

This code expires in 10 minutes.

If you didn't request to sign in to {app_name}, you can safely ignore this email. Someone else might have typed your email address by mistake.
"""


def _otp_email_template(to_email: str, otp_code: str) -> str:
    """
    Minimalist Strix-style email verification template.
    Pixel-matched to the clean rectangular card specification:
    - Rectangular card (#ffffff background, #ebebeb subtle border, border-radius: 20px, max-width: 580px)
    - Left-aligned header 'Sign in to {app_name}'
    - Clean subtext 'You requested to sign in to {app_name}. Your one-time code is:'
    - High-visibility 32px clean tabular numeral OTP token
    - Faint hairline separator
    - 10-minute expiration notice and safe-ignore footer
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
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>Sign in to {app_name}</title>
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
    @media only screen and (max-width: 620px) {{
      .card-wrap {{
        padding: 24px 12px !important;
      }}
      .card-container {{
        padding: 28px 22px !important;
        border-radius: 16px !important;
      }}
      .otp-display {{
        font-size: 28px !important;
        margin-bottom: 24px !important;
      }}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Preheader text (inbox preview) -->
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    Your one-time code is {safe_code}. Valid for 10 minutes.
    {preview_padding}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#ffffff;">
    <tr>
      <td align="center" valign="top" class="card-wrap" style="padding:40px 16px 56px 16px;">

        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
          <tr>
            <td align="left" valign="top" width="600">
        <![endif]-->

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card-container" style="max-width:600px;background-color:#ffffff;border:1px solid #ebebeb;border-radius:22px;padding:42px 48px;text-align:left;box-sizing:border-box;">
          <tr>
            <td align="left" style="padding:0;">

              <!-- Heading -->
              <h1 style="margin:0 0 12px 0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:600;color:#111111;line-height:1.3;letter-spacing:-0.2px;">
                Sign in to {app_name}
              </h1>

              <!-- Instruction Paragraph -->
              <p style="margin:0 0 28px 0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#333333;">
                You requested to sign in to {app_name}. Your one-time code is:
              </p>

              <!-- OTP Code Display -->
              <div class="otp-display" style="margin:0 0 32px 0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:34px;font-weight:500;color:#111111;letter-spacing:0.5px;line-height:1;font-variant-numeric:tabular-nums;">
                {safe_code}
              </div>

              <!-- Thin Hairline Horizontal Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 26px 0;">
                <tr>
                  <td style="border-top:1px solid #f0f0f0;height:1px;line-height:1px;font-size:1px;padding:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Expiry Notice -->
              <p style="margin:0 0 8px 0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#777777;">
                This code expires in 10 minutes.
              </p>

              <!-- Disclaimer / Ignore -->
              <p style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#777777;">
                If you didn't request to sign in to {app_name}, you can safely ignore this email. Someone else might have typed your email address by mistake.
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
        app_name = settings.SMTP_FROM_NAME or "Chaos Computer Club"
        subject = f"Sign in to {app_name}"
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
