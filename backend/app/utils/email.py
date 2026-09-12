"""
Chaos Computer Club — Medi-Caps Chapter
utils/email.py — Async SMTP email dispatcher
Branded email template based on Chaos Computer Club India design system.
"""
import asyncio
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import settings

logger = logging.getLogger(__name__)


def _otp_email_template(otp_code: str) -> str:
    """
    Chaos Computer Club India — Minimal OTP Verification Email Template
    - Void black only — never adapts to OS light mode
    - tag-cut (chamfered polygon) acid-lime OTP block
    - Black OTP digits on acid-lime background
    """
    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Chaos Computer Club — Verify</title>
  <style>
    :root {{ color-scheme: dark; }}
    @media (prefers-color-scheme: light) {{
      body, table, td {{ background-color: #080808 !important; color: #eaeaea !important; }}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#080808;color:#eaeaea;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;" bgcolor="#080808">

  <!-- Outer wrapper: forces #080808 everywhere -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080808" style="background-color:#080808;">
    <tr>
      <td align="center" style="padding:48px 16px 64px;">

        <!-- Card: 520px max -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#0e0e10;border:1px solid #222228;">

          <!-- Acid-lime top bar -->
          <tr>
            <td height="3" bgcolor="#ccff00" style="background-color:#ccff00;font-size:3px;line-height:3px;">&nbsp;</td>
          </tr>

          <!-- Header row -->
          <tr>
            <td style="padding:20px 28px 20px;border-bottom:1px solid #1c1c22;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:'JetBrains Mono','SF Mono',Consolas,monospace;font-size:11px;font-weight:700;letter-spacing:1.6px;color:#ccff00;text-transform:uppercase;vertical-align:middle;">
                    CHAOS COMPUTER CLUB
                  </td>
                  <td align="right" style="font-family:'JetBrains Mono','SF Mono',Consolas,monospace;font-size:10px;letter-spacing:1.2px;color:#44444c;text-transform:uppercase;vertical-align:middle;">
                    AUTH // OTP
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 28px 28px;">

              <!-- Kicker pill — tag-cut simulated via thick border-left -->
              <div style="display:inline-block;background-color:#ccff001a;border:1px solid #ccff0040;padding:3px 10px;margin-bottom:20px;">
                <span style="font-family:'JetBrains Mono','SF Mono',Consolas,monospace;font-size:10px;font-weight:700;letter-spacing:2px;color:#ccff00;text-transform:uppercase;">
                  IDENTITY CHALLENGE // MEDI-CAPS
                </span>
              </div>

              <!-- Title -->
              <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.3px;color:#ffffff;line-height:1.2;margin:0 0 10px;">
                Verify your identity
              </div>

              <!-- Subtitle -->
              <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;color:#6c6c72;line-height:1.6;margin:0 0 28px;">
                Use the passcode below to complete authentication.
              </div>

              <!-- OTP Block: acid-lime fill + chamfered top-right corner (inline SVG trick via border) -->
              <!--
                clip-path polygon not supported in email clients, so we simulate
                the tag-cut chamfer by nesting a rotated border element in the top-right corner.
                The block itself is solid #ccff00 with #080808 text (black on lime).
              -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td>
                    <!-- Outer shell: relative container with overflow hidden for chamfer effect -->
                    <div style="position:relative;background-color:#ccff00;overflow:hidden;">
                      <!-- Chamfer notch: a rotated dark square in top-right simulates the polygon cut -->
                      <div style="position:absolute;top:-14px;right:-14px;width:28px;height:28px;background-color:#0e0e10;transform:rotate(45deg);"></div>
                      <!-- Inner content -->
                      <div style="padding:28px 28px 28px 28px;text-align:center;">
                        <!-- OTP code: black text on acid-lime -->
                        <div style="font-family:'JetBrains Mono','SF Mono',Consolas,'Courier New',monospace;font-size:48px;font-weight:900;letter-spacing:16px;color:#080808;line-height:1;padding-left:16px;">
                          {otp_code}
                        </div>
                        <!-- Meta line -->
                        <div style="font-family:'JetBrains Mono','SF Mono',Consolas,monospace;font-size:10px;font-weight:700;letter-spacing:2px;color:#1c1c00;text-transform:uppercase;margin-top:12px;">
                          EXPIRES IN 5 MIN &bull; SINGLE USE
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Disclaimer -->
              <div style="border-left:2px solid #222228;padding-left:12px;">
                <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:12px;color:#44444c;line-height:1.6;">
                  If you didn&rsquo;t request this, ignore it. Never share this code.
                </div>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 28px;border-top:1px solid #1c1c22;background-color:#0a0a0c;">
              <div style="font-family:'JetBrains Mono','SF Mono',Consolas,monospace;font-size:10px;font-weight:700;letter-spacing:2px;color:#ccff00;text-transform:uppercase;margin-bottom:8px;">
                EXPLORE &middot; BUILD &middot; COMPETE &middot; FAIL &middot; LEARN
              </div>
              <div style="font-family:'JetBrains Mono','SF Mono',Consolas,monospace;font-size:10px;letter-spacing:1px;color:#3a3a44;text-transform:uppercase;">
                chaoscomputerclub.in &bull; medicaps.chaoscomputerclub.in
              </div>
            </td>
          </tr>

        </table>

        <!-- Below-card muted tag -->
        <div style="font-family:'JetBrains Mono','SF Mono',Consolas,monospace;font-size:10px;letter-spacing:1.2px;color:#2e2e36;text-transform:uppercase;margin-top:14px;text-align:center;">
          ESTABLISHED 2026 &bull; OPEN BY DEFAULT &bull; PEER DRIVEN
        </div>

      </td>
    </tr>
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
