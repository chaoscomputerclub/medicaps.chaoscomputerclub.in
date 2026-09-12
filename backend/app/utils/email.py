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
    Chaos Computer Club India — Branded OTP Verification Email Template
    Editorial / industrial architectural dark aesthetic:
    - Void black (#080808) base canvas
    - Charcoal surface (#101012), surface-raised (#151518)
    - Signature acid-lime accent (#ccff00)
    - Zero border-radius (pure flat architectural geometry)
    - Monospace terminal kickers & cryptographic token display card
    """
    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Chaos Computer Club — Verification Code</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a, span {{ font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif !important; }}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #080808; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #eaeaea; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #080808; table-layout: fixed; margin: 0; padding: 0;">
    <tr>
      <td align="center" style="padding: 44px 16px 60px 16px;">
        
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="560">
        <tr>
        <td align="center" valign="top" width="560">
        <![endif]-->
        
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #101012; border: 1px solid #1f1f24; border-top: 3px solid #ccff00; border-collapse: separate; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);">
          
          <!-- System Status Bar -->
          <tr>
            <td style="background-color: #151518; border-bottom: 1px solid #1f1f24; padding: 12px 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 10px;">
                          <img src="https://chaoscomputerclub.in/logo.png" width="22" height="22" alt="CCC" style="display: block; border: 0; width: 22px; height: 22px; object-fit: contain;" />
                        </td>
                        <td style="vertical-align: middle; font-family: 'JetBrains Mono', 'SF Mono', Consolas, 'Courier New', monospace; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #ffffff; text-transform: uppercase;">
                          CHAOS COMPUTER CLUB
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle; font-family: 'JetBrains Mono', 'SF Mono', Consolas, 'Courier New', monospace; font-size: 10px; font-weight: 600; letter-spacing: 1.5px; color: #ccff00; text-transform: uppercase;">
                    [ AUTH // 2026 ]
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 38px 36px 32px 36px;">
              
              <!-- Section Kicker -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                <tr>
                  <td style="background-color: rgba(204, 255, 0, 0.08); border: 1px solid rgba(204, 255, 0, 0.25); padding: 4px 10px;">
                    <span style="font-family: 'JetBrains Mono', 'SF Mono', Monaco, Consolas, monospace; font-size: 10px; font-weight: 700; letter-spacing: 1.8px; color: #ccff00; text-transform: uppercase;">
                      (01 // IDENTITY_CHALLENGE) &middot; MEDI-CAPS
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Main Title -->
              <h1 style="margin: 0 0 12px 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 25px; font-weight: 700; letter-spacing: -0.4px; color: #ffffff; line-height: 1.25;">
                Verify Your Identity
              </h1>

              <!-- Description -->
              <p style="margin: 0 0 28px 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #94949a;">
                A terminal session access request was initiated for your account. Provide the cryptographic verification code below to authorize your session in the arena.
              </p>

              <!-- Industrial OTP Passcode Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 26px 0;">
                <tr>
                  <td style="background-color: #08080a; border: 1px solid #28282e; border-left: 4px solid #ccff00; padding: 24px 20px; text-align: center;">
                    <div style="font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace; font-size: 10px; font-weight: 700; letter-spacing: 2.5px; color: #6e6e76; text-transform: uppercase; margin-bottom: 10px;">
                      // ONE-TIME VERIFICATION PASSCODE //
                    </div>
                    <div style="font-family: 'JetBrains Mono', 'SF Mono', Consolas, 'Courier New', monospace; font-size: 42px; font-weight: 800; letter-spacing: 14px; color: #ccff00; line-height: 1.15; padding: 6px 0 8px 14px; text-shadow: 0 0 24px rgba(204, 255, 0, 0.2);">
                      {otp_code}
                    </div>
                    <div style="font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace; font-size: 11px; color: #8e8e96; letter-spacing: 1.2px; margin-top: 10px;">
                      EXPIRES IN <strong style="color: #ffffff;">5 MINUTES</strong> &bull; SINGLE-USE ONLY
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Session Telemetry Grid -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #141417; border: 1px solid #1f1f24; margin-bottom: 26px;">
                <tr>
                  <td style="padding: 14px 18px; font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace; font-size: 11px; line-height: 1.7; color: #6a6a72;">
                    <span style="color: #9a9aa2; font-weight: 600;">REALM:</span> Medi-Caps University Chapter<br>
                    <span style="color: #9a9aa2; font-weight: 600;">GATEWAY:</span> Redis HMAC-SHA256
                  </td>
                  <td align="right" style="padding: 14px 18px; font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace; font-size: 11px; line-height: 1.7; color: #6a6a72; vertical-align: top;">
                    <span style="color: #9a9aa2; font-weight: 600;">TTL:</span> 300s Remaining<br>
                    <span style="color: #9a9aa2; font-weight: 600;">MAX ATTEMPTS:</span> 5
                  </td>
                </tr>
              </table>

              <!-- Security Disclaimer -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="border-left: 2px solid #28282e; padding-left: 12px;">
                    <p style="margin: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.6; color: #6e6e76;">
                      Never share this code. Chaos Computer Club administrators will never solicit your verification token. If you did not trigger this authentication request, no action is necessary.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer Divider -->
          <tr>
            <td style="border-top: 1px solid #1b1b1f; padding: 0; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Industrial CCC Footer -->
          <tr>
            <td style="background-color: #0c0c0e; padding: 26px 36px; text-align: center;">
              
              <!-- Orbital Tagline -->
              <div style="font-family: 'JetBrains Mono', 'SF Mono', Consolas, 'Courier New', monospace; font-size: 10px; font-weight: 700; letter-spacing: 2px; color: #ccff00; text-transform: uppercase; margin-bottom: 12px;">
                EXPLORE &middot; BUILD &middot; COMPETE &middot; FAIL &middot; LEARN &middot; SHARE
              </div>

              <!-- Community Subtitle -->
              <p style="margin: 0 0 12px 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; line-height: 1.6; color: #52525a;">
                Chaos Computer Club India &middot; Medi-Caps University Chapter<br>
                India's offline competitive tech community for college students.
              </p>

              <!-- Navigation Links -->
              <p style="margin: 0; font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace; font-size: 11px; color: #6a6a72;">
                <a href="https://chaoscomputerclub.in" style="color: #94949a; text-decoration: none; border-bottom: 1px dotted #404048;">chaoscomputerclub.in</a>
                &nbsp;&bull;&nbsp;
                <a href="https://medicaps.chaoscomputerclub.in" style="color: #94949a; text-decoration: none; border-bottom: 1px dotted #404048;">medicaps.chaoscomputerclub.in</a>
              </p>

            </td>
          </tr>

        </table>
        
        <!-- Outer Micro Tag -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin-top: 16px;">
          <tr>
            <td align="center" style="font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace; font-size: 10px; letter-spacing: 1px; color: #3a3a42; text-transform: uppercase;">
              ESTABLISHED 2026 &bull; OPEN BY DEFAULT &bull; PEER DRIVEN
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
