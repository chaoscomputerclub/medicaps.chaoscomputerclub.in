# DOMAIN AND DNS RUNBOOK — MULTI-DOMAIN ROUTING SPECIFICATION

**Protocol Standard:** Production Host Ingress & Reverse Proxy Topology  
**Architecture:** Parent Site (`domainname.com`) + Core App (`app.domainname.com`) + API (`api.domainname.com`)

---

## 1. Domain Topology Overview

| Hostname | Target Purpose | Primary Content / Service | Ingress / Origin |
|---|---|---|---|
| `domainname.com` | Parent Marketing Site | Hero, product breakdown, arena overview, pricing, about, legal documentation, blog | Nginx / Cloudflare CDN $\rightarrow$ Web Public Bundle |
| `app.domainname.com` | Core Application | Inner competitive programming arena, AI interview workspace, dashboard, profile, settings | Nginx $\rightarrow$ Single Page Application Bundle |
| `api.domainname.com` | Backend REST/WebSocket API | Distributed judge, LangGraph orchestrator, HCVE neural audio stream, auth endpoints | Nginx $\rightarrow$ Uvicorn FastAPI Backend (:8002) |
| `admin.domainname.com` | Protected Admin Console | Contest proctoring, node infrastructure, telemetry dashboard, user administration | Nginx $\rightarrow$ Admin Web Bundle (Role Gated) |

---

## 2. DNS Record Matrix

| Type | Name | Content / Target | TTL | Proxy Status (Cloudflare) |
|---|---|---|---|---|
| `A` | `@` (apex) | `143.198.38.205` | Auto | Proxied (Orange Cloud) |
| `CNAME` | `www` | `domainname.com` | Auto | Proxied (Redirect to apex) |
| `A` | `app` | `143.198.38.205` | Auto | Proxied (Orange Cloud) |
| `A` | `api` | `143.198.38.205` | Auto | Proxied (Orange Cloud) |
| `A` | `admin` | `143.198.38.205` | Auto | Proxied (Orange Cloud) |

---

## 3. Environment Configuration Contract

The following environment variables centrally govern all domain generation, cookie scopes, and CORS policies:

```bash
# ── Global Platform Identity & Domains ──────────────────────────────────────
PLATFORM_NAME="Chaos Computer Club Arena"
PLATFORM_BASE_DOMAIN="chaoscomputerclub.in"
MARKETING_BASE_URL="https://chaoscomputerclub.in"
APP_BASE_URL="https://app.chaoscomputerclub.in"
API_BASE_URL="https://api.chaoscomputerclub.in"
ADMIN_BASE_URL="https://admin.chaoscomputerclub.in"

# ── Dynamic Ingress & Security ──────────────────────────────────────────────
PUBLIC_WEB_ORIGIN="https://app.chaoscomputerclub.in"
CORS_ALLOWED_ORIGINS="https://chaoscomputerclub.in,https://app.chaoscomputerclub.in,https://admin.chaoscomputerclub.in,https://medicaps.chaoscomputerclub.in"
COOKIE_DOMAIN=".chaoscomputerclub.in"
COOKIE_SECURE=true
COOKIE_SAME_SITE="lax"

# ── Email & Communications ──────────────────────────────────────────────────
EMAIL_FROM_NAME="CCC Arena"
EMAIL_FROM_ADDRESS="noreply@chaoscomputerclub.in"
SUPPORT_EMAIL="support@chaoscomputerclub.in"

# ── University & Workspace Discovery ────────────────────────────────────────
ENFORCE_STRICT_EMAIL_DOMAIN=false
ALLOWED_EMAIL_DOMAIN=""
```

---

## 4. Nginx Reverse Proxy Architecture

### 4.1 Apex Marketing Site (`domainname.com`)
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name chaoscomputerclub.in www.chaoscomputerclub.in;
    return 301 https://chaoscomputerclub.in$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.chaoscomputerclub.in;
    return 301 https://chaoscomputerclub.in$request_uri;
}

server {
    listen 443 ssl http2;
    server_name chaoscomputerclub.in;

    root /var/www/ccc-marketing/.output/public;
    index index.html;

    # Cloudflare SSL certs
    ssl_certificate /etc/ssl/certs/ccc_live.crt;
    ssl_certificate_key /etc/ssl/private/ccc_live.key;

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "public, max-age=3600, must-revalidate";
    }

    location = /robots.txt {
        add_header Content-Type text/plain;
        return 200 "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nSitemap: https://chaoscomputerclub.in/sitemap.xml\n";
    }
}
```

### 4.2 Application Subdomain (`app.domainname.com`)
```nginx
server {
    listen 443 ssl http2;
    server_name app.chaoscomputerclub.in;

    root /var/www/ccc-medicaps/.output/public;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8002/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        
        # WebSockets
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 5. Security & Verification Directives

1. **Host-Header Injection Protection:** In FastAPI, `AllowedHostsMiddleware` or `origins.py` strictly matches incoming `Host` headers against `ALLOWED_HOSTS = [PLATFORM_BASE_DOMAIN, "*.PLATFORM_BASE_DOMAIN", "localhost"]`.
2. **CORS Isolation:** CORS strictly verifies against configured origins; wildcard `*` is strictly forbidden when credentials (`allow_credentials=True`) are enabled.
3. **Cookie Scope:**
   - When users log in on `app.domainname.com`, cookies with `Domain=.domainname.com` allow seamless SSO across `app`, `admin`, and `api`.
   - In local development, `Domain` is omitted (host-only) to prevent localhost cookie collisions.
