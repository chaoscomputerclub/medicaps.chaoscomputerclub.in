#!/usr/bin/env python3
"""
Cloudflare DNS Manager for Chaos Computer Club (chaoscomputerclub.in)
Configures DNS records for Vercel hosting using Cloudflare Global API Key or API Token.
"""

import sys
import os
import json
import urllib.request
import urllib.error

CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"
ZONE_NAME = "chaoscomputerclub.in"
ZONE_ID = "a3196336f1ca85fd084accffc269a81f"

# Vercel DNS Targets
VERCEL_A_IP = "76.76.21.21"
VERCEL_CNAME_TARGET = "6b22536f0c3f65cd.vercel-dns-017.com"
VERCEL_NAMESERVERS = ["ns1.vercel-dns.com", "ns2.vercel-dns.com"]


def cf_request(endpoint: str, method: str = "GET", data: dict = None, headers: dict = None):
    url = f"{CLOUDFLARE_API_BASE}{endpoint}"
    req_data = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=req_data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        try:
            return json.loads(error_body)
        except Exception:
            return {"success": False, "errors": [{"message": f"HTTP {e.code}: {e.reason}"}]}
    except Exception as exc:
        return {"success": False, "errors": [{"message": str(exc)}]}


def get_headers(email: str, key_or_token: str):
    if email and ("@" in email):
        return {
            "X-Auth-Email": email.strip(),
            "X-Auth-Key": key_or_token.strip(),
            "Content-Type": "application/json",
        }
    else:
        return {
            "Authorization": f"Bearer {key_or_token.strip()}",
            "Content-Type": "application/json",
        }


def list_records(headers: dict):
    res = cf_request(f"/zones/{ZONE_ID}/dns_records?per_page=100", headers=headers)
    if not res.get("success"):
        print("❌ Error listing DNS records:", res.get("errors"))
        return []
    return res.get("result", [])


def upsert_record(headers: dict, rtype: str, name: str, content: str, proxied: bool = False, comment: str = ""):
    existing = list_records(headers)
    target_name = f"{name}.{ZONE_NAME}" if name not in ("@", ZONE_NAME) else ZONE_NAME

    matched = [r for r in existing if r["name"] == target_name and r["type"] == rtype]

    payload = {
        "type": rtype,
        "name": name,
        "content": content,
        "ttl": 1,  # Auto
        "proxied": proxied,
        "comment": comment or f"Vercel routing for {target_name}",
    }

    if matched:
        rec_id = matched[0]["id"]
        print(f"🔄 Updating existing {rtype} record '{target_name}' (ID: {rec_id}) -> {content} (proxied: {proxied})...")
        res = cf_request(f"/zones/{ZONE_ID}/dns_records/{rec_id}", method="PUT", data=payload, headers=headers)
    else:
        print(f"➕ Creating new {rtype} record '{target_name}' -> {content} (proxied: {proxied})...")
        res = cf_request(f"/zones/{ZONE_ID}/dns_records", method="POST", data=payload, headers=headers)

    if res.get("success"):
        print(f"  ✓ Success: {target_name} ({rtype}) -> {content}")
        return True
    else:
        print(f"  ❌ Failed: {res.get('errors')}")
        return False


def delete_records_pointing_to(headers: dict, ip_or_host: str):
    existing = list_records(headers)
    for r in existing:
        if r.get("content") == ip_or_host:
            rec_id = r["id"]
            print(f"🗑️ Deleting stale legacy record: {r['name']} ({r['type']}) -> {ip_or_host} (ID: {rec_id})...")
            cf_request(f"/zones/{ZONE_ID}/dns_records/{rec_id}", method="DELETE", headers=headers)


def configure_all(email: str, key: str, use_cname_for_portal: bool = True):
    headers = get_headers(email, key)

    print("\n========================================================")
    print("📡 1. Querying current DNS records for chaoscomputerclub.in...")
    records = list_records(headers)
    print(f"Found {len(records)} existing records:")
    for r in records:
        print(f"  • {r['type']} {r['name']} -> {r['content']} (proxied: {r['proxied']}, ID: {r['id']})")

    print("\n🧹 2. Purging legacy single-origin IP (143.198.38.205)...")
    delete_records_pointing_to(headers, "143.198.38.205")

    print("\n⚡ 3. Configuring Vercel Records...")
    # Delete any existing A record on @
    for r in list_records(headers):
        if r["name"] == ZONE_NAME and r["type"] == "A":
            cf_request(f"/zones/{ZONE_ID}/dns_records/{r['id']}", method="DELETE", headers=headers)

    # Root: chaoscomputerclub.in -> Vercel CNAME (Cloudflare automatically flattens CNAME on apex/root)
    upsert_record(headers, "CNAME", "@", VERCEL_CNAME_TARGET, proxied=False, comment="Vercel Root Host")

    # Portal: medicaps.chaoscomputerclub.in -> Vercel CNAME
    upsert_record(headers, "CNAME", "medicaps", VERCEL_CNAME_TARGET, proxied=False, comment="Vercel Medi-Caps Portal")

    print("\n✅ DNS records successfully synchronized with Vercel!")
    print("========================================================")


if __name__ == "__main__":
    email = os.getenv("CF_API_EMAIL", "santushtkotai1221@gmail.com")
    key = os.getenv("CF_API_KEY")

    if len(sys.argv) >= 3:
        email = sys.argv[1]
        key = sys.argv[2]
    elif len(sys.argv) == 2:
        key = sys.argv[1]

    if not key:
        print("Usage: python3 scripts/cf_dns_manager.py [CF_EMAIL] <CF_GLOBAL_API_KEY>")
        print("   or: export CF_API_KEY='<key>' && python3 scripts/cf_dns_manager.py")
        sys.exit(1)

    configure_all(email, key)
