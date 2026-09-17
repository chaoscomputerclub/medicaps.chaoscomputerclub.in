#!/usr/bin/env python3
"""
Chaos Computer Club — Cloudflare Global API DNS Manager
Automates adding and updating DNS records (A / CNAME) for admin.chaoscomputerclub.in
via Cloudflare Global API (X-Auth-Email + X-Auth-Key) or API Token (Bearer).
"""

import sys
import os
import json
import urllib.request
import urllib.error

CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"
DEFAULT_ZONE_NAME = "chaoscomputerclub.in"
DEFAULT_RECORD_NAME = "admin"
DEFAULT_TARGET_IP = "143.198.38.205"


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


def main():
    print("======================================================================")
    print("⚡ Cloudflare DNS Automation — Chaos Computer Club India")
    print("======================================================================")

    # 1. Resolve Credentials
    api_email = os.getenv("CF_API_EMAIL") or (sys.argv[1] if len(sys.argv) > 1 and "@" in sys.argv[1] else None)
    api_key = os.getenv("CF_API_KEY") or (sys.argv[2] if len(sys.argv) > 2 else (sys.argv[1] if len(sys.argv) > 1 and "@" not in sys.argv[1] else None))
    api_token = os.getenv("CF_API_TOKEN")

    if not (api_token or (api_email and api_key)):
        print("\n🔑 Cloudflare Authentication Required:")
        print("Please provide your Cloudflare Global API Key or API Token.")
        print("\nUsage options:")
        print("  1) Run with arguments:")
        print("     python3 scripts/add_cloudflare_dns.py <CF_EMAIL> <CF_GLOBAL_API_KEY>")
        print("  2) Or set environment variables:")
        print("     export CF_API_EMAIL='your-cloudflare-email@domain.com'")
        print("     export CF_API_KEY='your_cloudflare_global_api_key'")
        print("     python3 scripts/add_cloudflare_dns.py")
        print("----------------------------------------------------------------------")

        try:
            api_email = input("Enter Cloudflare Account Email: ").strip()
            api_key = input("Enter Cloudflare Global API Key: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(1)

    # Prepare Auth Headers
    if api_email and api_key:
        headers = {
            "X-Auth-Email": api_email,
            "X-Auth-Key": api_key,
            "Content-Type": "application/json",
        }
    else:
        headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        }

    # 2. Get Zone ID for chaoscomputerclub.in
    print(f"\n📡 Querying Cloudflare for zone '{DEFAULT_ZONE_NAME}'...")
    zones_res = cf_request(f"/zones?name={DEFAULT_ZONE_NAME}", headers=headers)

    if not zones_res.get("success") or not zones_res.get("result"):
        print(f"❌ Failed to find zone for '{DEFAULT_ZONE_NAME}':")
        for err in zones_res.get("errors", []):
            print(f"   • {err.get('message')}")
        sys.exit(1)

    zone = zones_res["result"][0]
    zone_id = zone["id"]
    print(f"  ✓ Zone Found: {zone['name']} (ID: {zone_id})")

    # 3. Check for existing 'admin' DNS record
    record_full_name = f"{DEFAULT_RECORD_NAME}.{DEFAULT_ZONE_NAME}"
    print(f"\n🔍 Checking existing DNS records for '{record_full_name}'...")
    records_res = cf_request(f"/zones/{zone_id}/dns_records?name={record_full_name}", headers=headers)

    existing_records = records_res.get("result", []) if records_res.get("success") else []

    payload = {
        "type": "A",
        "name": DEFAULT_RECORD_NAME,
        "content": DEFAULT_TARGET_IP,
        "ttl": 1,  # 1 = Automatic
        "proxied": False,  # Direct connection to server Nginx (for Let's Encrypt / WebSockets / SSE)
        "comment": "CCC Dedicated Faculty Proctor & Admin Console",
    }

    if existing_records:
        rec_id = existing_records[0]["id"]
        print(f"  → Record exists (ID: {rec_id}, Target: {existing_records[0].get('content')}). Updating...")
        update_res = cf_request(f"/zones/{zone_id}/dns_records/{rec_id}", method="PUT", data=payload, headers=headers)
        if update_res.get("success"):
            print(f"  ✓ Successfully updated {record_full_name} -> {DEFAULT_TARGET_IP}")
        else:
            print("❌ Failed to update DNS record:", update_res.get("errors"))
            sys.exit(1)
    else:
        print(f"  → Creating new A record for {record_full_name} -> {DEFAULT_TARGET_IP}...")
        create_res = cf_request(f"/zones/{zone_id}/dns_records", method="POST", data=payload, headers=headers)
        if create_res.get("success"):
            print(f"  ✓ Successfully created {record_full_name} -> {DEFAULT_TARGET_IP}")
        else:
            print("❌ Failed to create DNS record:", create_res.get("errors"))
            sys.exit(1)

    print("\n======================================================================")
    print(f"✨ DNS RECORD CONFIGURED ON CLOUDFLARE!")
    print(f"   Domain:  https://{record_full_name}")
    print(f"   Target:  {DEFAULT_TARGET_IP}")
    print(f"   Status:  Active (DNS only, direct Nginx reverse-proxy)")
    print("======================================================================")


if __name__ == "__main__":
    main()
