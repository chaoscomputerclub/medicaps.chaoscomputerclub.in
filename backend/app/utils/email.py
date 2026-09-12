"""
Chaos Computer Club — Medi-Caps Chapter
utils/email.py — Async SMTP email dispatcher
Branded email template based on Chaos Computer Club India design system.
Production v4: Minimal, void-black only (immune to OS theme flips),
tag-cut dual chamfer acid container, 6-digit segmented hardware-authenticator UI,
RFC-compliant multipart/alternative (HTML + plaintext).
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
Enter the one-time authentication token below to complete verification.

==================================================
  ONE-TIME TOKEN:    {otp_code}
  VALIDITY:          EXPIRES IN 5 MINUTES
  POLICY:            SINGLE USE ONLY
==================================================

If you did not initiate this request, ignore this transmission. Never disclose this token.

--
EXPLORE · BUILD · COMPETE · FAIL · LEARN
https://medicaps.chaoscomputerclub.in
https://chaoscomputerclub.in

ESTABLISHED 2026 · OPEN BY DEFAULT · PEER DRIVEN
"""


def _otp_email_template(otp_code: str) -> str:
    """
    Chaos Computer Club India — Production Email Template
    - Void black only — immune to OS light mode inversions
    - tag-cut dual-chamfer acid-lime container matching root application geometry
    - 6 segmented tactile digit cells with black text on acid-lime
    - Ultra-minimal copy and hacker-grade typography hierarchy
    """
    digits = list(otp_code.strip()) if len(otp_code.strip()) == 6 else ["7", "3", "9", "1", "0", "4"]
    preview_padding = "&#847; &zwnj; &nbsp; &#8199; &shy; " * 30

    digit_cells_html = ""
    for d in digits:
        digit_cells_html += f"""<td align="center" valign="middle" width="44" style="width:44px;padding:0 3px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="44" style="width:44px;border-collapse:collapse;">
            <tr>
              <td align="center" valign="middle" height="54" bgcolor="#ccff00" style="height:54px;width:44px;background-color:#ccff00;border:2px solid #080808;text-align:center;font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:32px;font-weight:900;color:#080808;line-height:54px;mso-line-height-rule:exactly;">{d}</td>
            </tr>
          </table>
        </td>"""

    return f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!-- STRICT: Only dark mode, never adapt to light OS theme -->
  <meta name="color-scheme" content="only dark">
  <meta name="supported-color-schemes" content="only dark">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>CCC — Authenticate Session</title>

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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@700;800&family=JetBrains+Mono:wght@500;700;800;900&display=swap');

    :root {{
      color-scheme: only dark !important;
      supported-color-schemes: only dark !important;
    }}

    body, table, td, a, p, span, div {{
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

    /* Prevent any client in light mode from turning backgrounds white */
    @media (prefers-color-scheme: light) {{
      html, body, .body-canvas {{
        background-color: #080808 !important;
        background-image: linear-gradient(#080808, #080808) !important;
        color: #eaeaea !important;
      }}
      .card-box {{
        background-color: #0e0e10 !important;
        background-image: linear-gradient(#0e0e10, #0e0e10) !important;
      }}
      .card-footer {{
        background-color: #0a0a0c !important;
        background-image: linear-gradient(#0a0a0c, #0a0a0c) !important;
      }}
      .acid-hero {{
        background-color: #ccff00 !important;
        background-image: linear-gradient(#ccff00, #ccff00) !important;
        color: #080808 !important;
      }}
    }}

    /* Outlook.com Web dark overrides */
    [data-ogsc] html, [data-ogsc] body, [data-ogsc] .body-canvas {{
      background-color: #080808 !important;
      background-image: linear-gradient(#080808, #080808) !important;
    }}
    [data-ogsc] .card-box {{
      background-color: #0e0e10 !important;
      background-image: linear-gradient(#0e0e10, #0e0e10) !important;
    }}
    [data-ogsc] .card-footer {{
      background-color: #0a0a0c !important;
      background-image: linear-gradient(#0a0a0c, #0a0a0c) !important;
    }}
    [data-ogsc] .acid-hero {{
      background-color: #ccff00 !important;
      background-image: linear-gradient(#ccff00, #ccff00) !important;
    }}

    /* Modern client polygon: exact tag-cut geometry from root app */
    .tag-cut-container {{
      clip-path: polygon(
        0 0,
        calc(100% - 16px) 0,
        100% 16px,
        100% 100%,
        16px 100%,
        0 calc(100% - 16px)
      );
    }}
  </style>
</head>
<body bgcolor="#080808" class="body-canvas" style="margin:0;padding:0;background-color:#080808;background-image:linear-gradient(#080808,#080808);color:#eaeaea;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Preheader preview text -->
  <div style="display:none;font-size:1px;color:#080808;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    Your Chaos Computer Club authentication token is {otp_code}. Valid for 5 minutes.
    {preview_padding}
  </div>

  <!-- Canvas wrapper table: 100% width, void black -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080808" class="body-canvas" style="background-color:#080808;background-image:linear-gradient(#080808,#080808);width:100%;table-layout:fixed;">
    <tr>
      <td align="center" valign="top" bgcolor="#080808" class="body-canvas" style="padding:40px 16px 56px 16px;background-color:#080808;background-image:linear-gradient(#080808,#080808);">

        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="500" bgcolor="#0e0e10" style="background-color:#0e0e10;">
          <tr>
            <td align="center" valign="top" width="500" bgcolor="#0e0e10" style="background-color:#0e0e10;">
        <![endif]-->

        <!-- Main Card Container: 500px fixed width -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0e0e10" class="card-box" style="max-width:500px;width:100%;margin:0 auto;background-color:#0e0e10;background-image:linear-gradient(#0e0e10,#0e0e10);border:1px solid #1e1e26;">

          <!-- Acid Lime Top Bar -->
          <tr>
            <td height="2" bgcolor="#ccff00" style="background-color:#ccff00;font-size:2px;line-height:2px;height:2px;">&nbsp;</td>
          </tr>

          <!-- Header: Logo Mark Only + Context Label -->
          <tr>
            <td style="padding:20px 28px;border-bottom:1px solid #181820;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" valign="middle">
                    <a href="https://chaoscomputerclub.in" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;">
                      <img src="https://chaoscomputerclub.in/logo.png" width="32" height="32" alt="Chaos Computer Club" border="0" style="display:block;width:32px;height:32px;border:0;outline:none;" />
                    </a>
                  </td>
                  <td align="right" valign="middle">
                    <span style="font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:10px;font-weight:700;letter-spacing:1.8px;color:#5a5a64;text-transform:uppercase;">
                      AUTH // OTP
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Minimal Content Body -->
          <tr>
            <td style="padding:28px 28px 24px 28px;">

              <!-- Kicker badge -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                <tr>
                  <td bgcolor="#121808" style="background-color:rgba(204,255,0,0.08);border:1px solid rgba(204,255,0,0.28);padding:3px 8px;">
                    <span style="font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:9px;font-weight:700;letter-spacing:1.8px;color:#ccff00;text-transform:uppercase;display:block;">
                      IDENTITY CHALLENGE // MEDI-CAPS
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Headline -->
              <h1 style="margin:0 0 8px 0;padding:0;font-family:'Inter Tight','Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.4px;color:#ffffff;line-height:1.2;">
                Authenticate session
              </h1>

              <!-- Minimal instruction -->
              <p style="margin:0 0 24px 0;padding:0;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;color:#7e7e88;line-height:1.5;">
                Enter the one-time authentication token below to complete verification.
              </p>

              <!-- HERO: RECTANGLE ACID CONTAINER WITH TAG-CUT CUTOUTS & SEGMENTED CELLS -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
                <tr>
                  <td style="padding:0;">

                    <!--[if mso]>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ccff00" style="background-color:#ccff00;">
                      <tr>
                        <td align="center" valign="middle" style="padding:20px 16px 18px 16px;text-align:center;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                            <tr>
                              {digit_cells_html}
                            </tr>
                          </table>
                          <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:10px;font-weight:bold;letter-spacing:1.6px;color:#181800;text-transform:uppercase;margin-top:12px;">
                            EXPIRES IN 5 MIN &bull; SINGLE USE ONLY
                          </div>
                        </td>
                      </tr>
                    </table>
                    <![endif]-->

                    <!--[if !mso]><!-- -->
                    <div class="tag-cut-container acid-hero" style="position:relative;background-color:#ccff00;background-image:linear-gradient(#ccff00,#ccff00);padding:20px 16px 18px 16px;overflow:hidden;border:1px solid #ccff00;">

                      <!-- Top-Right Diagonal Cut Notch (Simulated via rotated div matching card background) -->
                      <div style="position:absolute;top:-13px;right:-13px;width:26px;height:26px;background-color:#0e0e10;background-image:linear-gradient(#0e0e10,#0e0e10);transform:rotate(45deg);border-bottom:1px solid #1e1e26;"></div>
                      <!-- Bottom-Left Diagonal Cut Notch (Matches root app tag-cut) -->
                      <div style="position:absolute;bottom:-13px;left:-13px;width:26px;height:26px;background-color:#0e0e10;background-image:linear-gradient(#0e0e10,#0e0e10);transform:rotate(45deg);border-top:1px solid #1e1e26;"></div>

                      <!-- Micro-Telemetry Top Row -->
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
                        <tr>
                          <td align="left" style="font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:9px;font-weight:800;letter-spacing:1.5px;color:#080808;text-transform:uppercase;">
                            [ TOKEN // 06-DIGIT ]
                          </td>
                          <td align="right" style="font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:9px;font-weight:800;letter-spacing:1.2px;color:#181800;text-transform:uppercase;">
                            TTL 300S &bull; ACTIVE
                          </td>
                        </tr>
                      </table>

                      <!-- 6 Segmented Digit Slots (Tactile Hardware Token Display) -->
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                        <tr>
                          {digit_cells_html}
                        </tr>
                      </table>

                      <!-- Subtext within container -->
                      <div style="text-align:center;margin-top:12px;">
                        <span style="font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:10px;font-weight:800;letter-spacing:1.8px;color:#141400;text-transform:uppercase;">
                          EXPIRES IN 5 MIN &bull; SINGLE USE ONLY
                        </span>
                      </div>

                    </div>
                    <!--<![endif]-->

                  </td>
                </tr>
              </table>

              <!-- 1-line security disclaimer -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-left:2px solid #22222a;padding:2px 0 2px 12px;">
                    <p style="margin:0;padding:0;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:11px;color:#5a5a64;line-height:1.5;">
                      If you did not initiate this request, ignore this transmission. Never disclose this token.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Minimal Footer -->
          <tr>
            <td bgcolor="#0a0a0c" class="card-footer" style="padding:16px 28px;border-top:1px solid #181820;background-color:#0a0a0c;background-image:linear-gradient(#0a0a0c,#0a0a0c);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:9px;font-weight:700;letter-spacing:1.8px;color:#ccff00;text-transform:uppercase;">
                    EXPLORE &middot; BUILD &middot; COMPETE &middot; FAIL &middot; LEARN
                  </td>
                </tr>
                <tr>
                  <td align="left" style="padding-top:6px;font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:9px;letter-spacing:1px;color:#3e3e48;text-transform:uppercase;">
                    medicaps.chaoscomputerclub.in
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Below-Card Tagline -->
        <div style="font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:9px;letter-spacing:1.2px;color:#2e2e36;text-transform:uppercase;margin-top:14px;text-align:center;">
          ESTABLISHED 2026 &bull; OPEN BY DEFAULT &bull; PEER DRIVEN
        </div>

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
