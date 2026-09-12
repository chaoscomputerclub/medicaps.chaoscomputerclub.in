"""
Chaos Computer Club — Medi-Caps Chapter
utils/email.py — Async SMTP email dispatcher
Branded email template based on Chaos Computer Club India design system.
Production v3: Table-based layout, MSO conditionals, forced dark mode,
club logo mark header, chamfered OTP hero, and RFC-compliant multipart/alternative (HTML + plaintext).
"""
import asyncio
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import settings

logger = logging.getLogger(__name__)


def _otp_email_plaintext(otp_code: str) -> str:
    """
    Plain-text fallback version of the OTP verification email.
    Required by spam filters and text-only email clients.
    """
    return f"""CHAOS COMPUTER CLUB // AUTH // OTP
IDENTITY CHALLENGE // MEDI-CAPS

AUTHENTICATE SESSION
An authentication challenge was requested for your account. Submit the one-time authorization token below to verify your identity.

==================================================
  ONE-TIME TOKEN:    {otp_code}
  VALIDITY:          EXPIRES IN 5 MINUTES
  POLICY:            SINGLE USE ONLY
==================================================

If you did not initiate this authentication request, disregard this transmission. Never disclose this token to anyone.

--
EXPLORE · BUILD · COMPETE · FAIL · LEARN
https://medicaps.chaoscomputerclub.in
https://chaoscomputerclub.in

ESTABLISHED 2026 · OPEN BY DEFAULT · PEER DRIVEN
"""


def _otp_email_template(otp_code: str) -> str:
    """
    Chaos Computer Club India — Production v3 Email Template
    - Table-based nested layout with inlined styles
    - Outlook desktop Word-engine fallbacks (MSO conditionals & DPI settings)
    - Dark mode forced: HTML bgcolor attributes + CSS color-scheme + Apple/Outlook media overrides
    - Retina-ready club logo mark (no wordmark text) with alt accessibility text
    - Visual hierarchy: Eyebrow pill -> Display headline -> Body copy -> Chamfered OTP Hero -> Security disclaimer
    - Hidden preheader text for inbox list preview
    """
    # 30 non-breaking zero-width separator tokens to prevent body text bleed into inbox preview
    preview_padding = "&#847; &zwnj; &nbsp; &#8199; &shy; " * 30

    return f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark light">
  <meta name="supported-color-schemes" content="dark light">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>Chaos Computer Club — Authenticate Session</title>

  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->

  <!-- Progressive enhancement: Google Fonts with robust system fallbacks -->
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@700;800&family=JetBrains+Mono:wght@500;700;800;900&display=swap');

    :root {{
      color-scheme: dark light;
      supported-color-schemes: dark light;
    }}

    /* Global reset for consistent client rendering */
    body, table, td, a, p, span {{
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      margin: 0;
      padding: 0;
    }}

    table, td {{
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
      border-collapse: collapse;
    }}

    img {{
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      display: block;
    }}

    /* Forced dark mode preservation across light/dark OS modes */
    @media (prefers-color-scheme: light) {{
      body, .bg-body {{
        background-color: #080808 !important;
        color: #eaeaea !important;
      }}
      .bg-card {{
        background-color: #0e0e10 !important;
      }}
      .bg-footer {{
        background-color: #0a0a0c !important;
      }}
      .text-title {{
        color: #ffffff !important;
      }}
      .text-body {{
        color: #8e8e93 !important;
      }}
      .text-subtle {{
        color: #6c6c72 !important;
      }}
    }}

    /* Outlook.com (Web) dark mode overrides */
    [data-ogsc] .bg-body {{ background-color: #080808 !important; }}
    [data-ogsc] .bg-card {{ background-color: #0e0e10 !important; }}
    [data-ogsc] .bg-footer {{ background-color: #0a0a0c !important; }}
    [data-ogsc] .text-title {{ color: #ffffff !important; }}
    [data-ogsc] .text-body {{ color: #8e8e93 !important; }}
    [data-ogsc] .text-subtle {{ color: #6c6c72 !important; }}
  </style>
</head>
<body bgcolor="#080808" class="bg-body" style="margin:0;padding:0;background-color:#080808;color:#eaeaea;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Preheader: Hidden preview text that shows in inbox message snippet -->
  <div style="display:none;font-size:1px;color:#080808;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    Your Chaos Computer Club authentication token is {otp_code}. Valid for 5 minutes. Single-use only.
    {preview_padding}
  </div>

  <!-- Full-width body wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080808" class="bg-body" style="background-color:#080808;width:100%;table-layout:fixed;">
    <tr>
      <td align="center" valign="top" bgcolor="#080808" class="bg-body" style="padding:40px 16px 56px 16px;background-color:#080808;">

        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="520" bgcolor="#0e0e10" style="background-color:#0e0e10;">
          <tr>
            <td align="center" valign="top" width="520" bgcolor="#0e0e10" style="background-color:#0e0e10;">
        <![endif]-->

        <!-- Main Card Container: 520px max width -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0e0e10" class="bg-card" style="max-width:520px;width:100%;margin:0 auto;background-color:#0e0e10;border:1px solid #222228;border-collapse:separate;">

          <!-- Top Accent Bar: Refined Acid Lime strip -->
          <tr>
            <td height="3" bgcolor="#ccff00" style="background-color:#ccff00;font-size:3px;line-height:3px;height:3px;">&nbsp;</td>
          </tr>

          <!-- Header Section: Logo Mark Only + Context Label -->
          <tr>
            <td style="padding:22px 32px 22px 32px;border-bottom:1px solid #1a1a20;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Brand Identity: Club logo mark only (no accompanying text), retina-ready PNG with alt text -->
                  <td align="left" valign="middle" style="vertical-align:middle;">
                    <a href="https://chaoscomputerclub.in" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;">
                      <img src="https://chaoscomputerclub.in/logo.png" width="34" height="34" alt="Chaos Computer Club" border="0" style="display:block;width:34px;height:34px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />
                    </a>
                  </td>
                  <!-- Technical Context Label -->
                  <td align="right" valign="middle" style="vertical-align:middle;">
                    <span style="font-family:'JetBrains Mono',ui-monospace,'Cascadia Code','Source Code Pro',Menlo,Consolas,monospace;font-size:11px;font-weight:700;letter-spacing:1.8px;color:#5a5a64;text-transform:uppercase;">
                      AUTH // OTP
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Section -->
          <tr>
            <td style="padding:34px 32px 30px 32px;">

              <!-- Eyebrow Tag Pill -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td bgcolor="#121808" style="background-color:rgba(204,255,0,0.08);border:1px solid rgba(204,255,0,0.28);padding:4px 10px;">
                    <span style="font-family:'JetBrains Mono',ui-monospace,'Cascadia Code','Source Code Pro',Menlo,Consolas,monospace;font-size:10px;font-weight:700;letter-spacing:2px;color:#ccff00;text-transform:uppercase;display:block;">
                      IDENTITY CHALLENGE // MEDI-CAPS
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Headline: Authoritative, deliberate display typography -->
              <h1 class="text-title" style="margin:0 0 10px 0;padding:0;font-family:'Inter Tight','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:24px;font-weight:800;letter-spacing:-0.4px;color:#ffffff;line-height:1.25;">
                Authenticate session
              </h1>

              <!-- Body Copy: Terser, confident CCC brand voice -->
              <p class="text-body" style="margin:0 0 28px 0;padding:0;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:400;color:#8e8e93;line-height:1.65;">
                An authentication challenge was requested for your account. Submit the one-time authorization token below to verify your identity.
              </p>

              <!-- HERO: The OTP Code Block (Email-safe with Outlook fallback) -->
              <!--[if mso]>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ccff00" style="margin:0 0 26px 0;background-color:#ccff00;">
                <tr>
                  <td align="center" valign="middle" style="padding:28px 20px 24px 20px;text-align:center;">
                    <div style="font-family:'JetBrains Mono',Consolas,'Courier New',monospace;font-size:46px;font-weight:bold;letter-spacing:14px;color:#080808;mso-line-height-rule:exactly;line-height:48px;padding-left:14px;">
                      {otp_code}
                    </div>
                    <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;font-weight:bold;letter-spacing:2px;color:#181800;text-transform:uppercase;margin-top:12px;">
                      EXPIRES IN 5 MIN &bull; SINGLE USE
                    </div>
                  </td>
                </tr>
              </table>
              <![endif]-->

              <!--[if !mso]><!-- -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px 0;">
                <tr>
                  <td style="padding:0;">
                    <!-- Chamfered container: relative positioning with cut-corner simulator -->
                    <div style="position:relative;background-color:#ccff00;overflow:hidden;border:1px solid #ccff00;">
                      <!-- Chamfer cut notch (top-right corner) -->
                      <div style="position:absolute;top:-13px;right:-13px;width:26px;height:26px;background-color:#0e0e10;transform:rotate(45deg);border-bottom:1px solid #222228;"></div>
                      <!-- Block Content -->
                      <div style="padding:28px 24px 24px 24px;text-align:center;">
                        <!-- OTP Digits: Tabular monospace numerals, generous letter-spacing, black on acid-lime -->
                        <div style="font-family:'JetBrains Mono',ui-monospace,'Cascadia Code','Source Code Pro',Menlo,Consolas,monospace;font-size:46px;font-weight:900;letter-spacing:16px;color:#080808;line-height:1;padding-left:16px;margin:0 auto;text-align:center;">
                          {otp_code}
                        </div>
                        <!-- Expiry & Single-Use Notice -->
                        <div style="font-family:'JetBrains Mono',ui-monospace,'Cascadia Code','Source Code Pro',Menlo,Consolas,monospace;font-size:10px;font-weight:800;letter-spacing:2px;color:#181800;text-transform:uppercase;margin-top:12px;">
                          EXPIRES IN 5 MIN &bull; SINGLE USE
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
              <!--<![endif]-->

              <!-- Security Disclaimer: Restrained fine-print note with distinct visual border -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-left:2px solid #26262e;padding:2px 0 2px 14px;">
                    <p class="text-subtle" style="margin:0;padding:0;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-weight:400;color:#6c6c72;line-height:1.6;">
                      If you did not initiate this authentication request, disregard this transmission. Never disclose this token to anyone.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td bgcolor="#0a0a0c" class="bg-footer" style="padding:20px 32px 20px 32px;border-top:1px solid #1a1a20;background-color:#0a0a0c;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <!-- Tagline Row -->
                <tr>
                  <td style="padding-bottom:8px;">
                    <span style="font-family:'JetBrains Mono',ui-monospace,'Cascadia Code','Source Code Pro',Menlo,Consolas,monospace;font-size:10px;font-weight:700;letter-spacing:2px;color:#ccff00;text-transform:uppercase;display:block;">
                      EXPLORE &middot; BUILD &middot; COMPETE &middot; FAIL &middot; LEARN
                    </span>
                  </td>
                </tr>
                <!-- Domain Links -->
                <tr>
                  <td>
                    <span style="font-family:'JetBrains Mono',ui-monospace,'Cascadia Code','Source Code Pro',Menlo,Consolas,monospace;font-size:10px;letter-spacing:1.2px;color:#4a4a54;text-transform:uppercase;">
                      <a href="https://medicaps.chaoscomputerclub.in" target="_blank" style="color:#4a4a54;text-decoration:none;">medicaps.chaoscomputerclub.in</a>
                      &nbsp;&bull;&nbsp;
                      <a href="https://chaoscomputerclub.in" target="_blank" style="color:#4a4a54;text-decoration:none;">chaoscomputerclub.in</a>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Below-Card Monospace Tagline -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;margin:16px auto 0 auto;">
          <tr>
            <td align="center" style="text-align:center;">
              <span style="font-family:'JetBrains Mono',ui-monospace,'Cascadia Code','Source Code Pro',Menlo,Consolas,monospace;font-size:10px;letter-spacing:1.4px;color:#34343c;text-transform:uppercase;">
                ESTABLISHED 2026 &bull; OPEN BY DEFAULT &bull; PEER DRIVEN
              </span>
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
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.info("[DEV] OTP for %s: %s (no SMTP configured)", to_email, otp)
        return True

    try:
        subject = f"Your Chaos Computer Club Code: {otp}"
        html = _otp_email_template(otp)
        plaintext = _otp_email_plaintext(otp)
        await asyncio.to_thread(_smtp_send_sync, to_email, subject, html, plaintext)
        logger.info("OTP email sent to %s", to_email)
        return True
    except Exception as e:
        logger.error("SMTP error sending to %s: %s", to_email, e)
        return False
