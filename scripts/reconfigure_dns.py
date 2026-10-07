#!/usr/bin/env python3
"""
Chaos Computer Club — Medi-Caps Chapter
DNS Architecture Reconfiguration Script

TARGET ARCHITECTURE:
  chaoscomputerclub.in          → Vercel (frontend root)       [CNAME, NOT proxied]
  medicaps.chaoscomputerclub.in → Vercel (portal frontend)     [CNAME, NOT proxied]
  api-medicaps.chaoscomputerclub.in → CF Worker (edge router)  [Worker custom domain]

REMOVED:
  medicaps-api.chaoscomputerclub.in  (old name, removing)
  Any A records pointing to old VPS  (143.198.38.205)
  Any stale CNAME records
"""

import json, sys, urllib.request, urllib.error, os

ZONE_ID = "a3196336f1ca85fd084accffc269a81f"
ZONE_NAME = "chaoscomputerclub.in"
CF_API_BASE = "https://api.cloudflare.com/client/v4"

OAUTH_TOKEN = "cfoat_7HIO0Na3jLYMnu5VI-4d-vjAfWBfb8PwgWTnMBUcdj0.mOUme0G07wKwZTuHvliV85RgJ_-VT81Z68RaOqrpMog"

# Vercel CNAME target (matches existing setup)
VERCEL_CNAME = "6b22536f0c3f65cd.vercel-dns-017.com"

# Desired DNS records after reconfiguration
DESIRED_RECORDS = [
    # Root domain → Vercel (Cloudflare auto-flattens CNAME at apex)
    {"type": "CNAME", "name": "chaoscomputerclub.in", "content": VERCEL_CNAME, "proxied": False, "comment": "Root → Vercel frontend"},
    # Portal → Vercel
    {"type": "CNAME", "name": "medicaps", "content": VERCEL_CNAME, "proxied": False, "comment": "Portal → Vercel frontend"},
    # API subdomain (api-medicaps) is managed by CF Worker custom domain binding, NOT a DNS record we create manually
    # The Worker deployment sets this up automatically via wrangler routes
]

# Records to forcibly DELETE (by name + type pattern, regardless of content)
RECORDS_TO_DELETE = [
    # Old API subdomain name
    ("CNAME", "medicaps-api.chaoscomputerclub.in"),
    ("AAAA", "medicaps-api.chaoscomputerclub.in"),
    ("A",    "medicaps-api.chaoscomputerclub.in"),
    # Old VPS IP
]
OLD_VPS_IPS = {"143.198.38.205"}

HEADERS = {
    "Authorization": f"Bearer {OAUTH_TOKEN}",
    "Content-Type": "application/json",
}


def cf_req(endpoint, method="GET", data=None):
    url = f"{CF_API_BASE}{endpoint}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"success": False, "errors": [{"message": f"HTTP {e.code}: {e.reason}"}]}


def list_records():
    res = cf_req(f"/zones/{ZONE_ID}/dns_records?per_page=100")
    if not res.get("success"):
        print("❌ Failed to list records:", res.get("errors"))
        sys.exit(1)
    return res["result"]


def delete_record(rec_id, name, rtype):
    res = cf_req(f"/zones/{ZONE_ID}/dns_records/{rec_id}", method="DELETE")
    if res.get("success") or res.get("result", {}).get("id"):
        print(f"  🗑️  Deleted {rtype} {name}")
    else:
        print(f"  ⚠️  Delete failed for {name}: {res.get('errors')}")


def upsert_record(rtype, name, content, proxied, comment):
    """Create or update a DNS record."""
    records = list_records()
    # Resolve full name
    full_name = name if "." in name else f"{name}.{ZONE_NAME}"

    matched = [r for r in records if r["name"] == full_name and r["type"] == rtype]

    payload = {
        "type": rtype,
        "name": full_name,
        "content": content,
        "ttl": 1,
        "proxied": proxied,
        "comment": comment,
    }

    if matched:
        rec_id = matched[0]["id"]
        if matched[0]["content"] == content and matched[0]["proxied"] == proxied:
            print(f"  ✓ Already correct: {rtype} {full_name} → {content} (proxied={proxied})")
            return
        print(f"  🔄 Updating {rtype} {full_name} → {content} (proxied={proxied})...")
        res = cf_req(f"/zones/{ZONE_ID}/dns_records/{rec_id}", method="PUT", data=payload)
    else:
        print(f"  ➕ Creating {rtype} {full_name} → {content} (proxied={proxied})...")
        res = cf_req(f"/zones/{ZONE_ID}/dns_records", method="POST", data=payload)

    if res.get("success"):
        print(f"  ✓ Done: {rtype} {full_name} → {content}")
    else:
        print(f"  ❌ Failed: {res.get('errors')}")


def main():
    print("\n" + "=" * 65)
    print("🌐 CLOUDFLARE DNS ARCHITECTURE RECONFIGURATION")
    print("   chaoscomputerclub.in Zone")
    print("=" * 65)

    # ── Step 1: Audit current records ─────────────────────────────
    print("\n📋 Step 1: Auditing current DNS records...")
    records = list_records()
    print(f"   Found {len(records)} existing record(s):")
    for r in records:
        print(f"   {r['type']:6} {r['name']:50} → {r['content']} (proxied={r['proxied']})")

    # ── Step 2: Delete stale / obsolete records ────────────────────
    print("\n🧹 Step 2: Removing stale / obsolete records...")
    for r in records:
        # Delete old VPS A records
        if r["type"] == "A" and r["content"] in OLD_VPS_IPS:
            delete_record(r["id"], r["name"], r["type"])
            continue
        # Delete old API subdomain name (medicaps-api.*)
        if "medicaps-api." in r["name"]:
            delete_record(r["id"], r["name"], r["type"])
            continue
        # Delete api-medicaps AAAA/A records if any (worker will own this via custom domain)
        if r["name"] == f"api-medicaps.{ZONE_NAME}" and r["type"] in ("A", "AAAA", "CNAME"):
            delete_record(r["id"], r["name"], r["type"])
            continue

    # ── Step 3: Upsert desired records ────────────────────────────
    print("\n⚡ Step 3: Configuring target DNS records...")
    for rec in DESIRED_RECORDS:
        upsert_record(rec["type"], rec["name"], rec["content"], rec["proxied"], rec["comment"])

    # ── Step 4: Final audit ───────────────────────────────────────
    print("\n✅ Step 4: Final DNS state after reconfiguration:")
    final_records = list_records()
    for r in final_records:
        print(f"   {r['type']:6} {r['name']:50} → {r['content']} (proxied={r['proxied']})")

    print("\n" + "=" * 65)
    print("✨ DNS reconfiguration complete!")
    print("   Root:   chaoscomputerclub.in       → Vercel")
    print("   Portal: medicaps.chaoscomputerclub.in → Vercel")
    print("   API:    api-medicaps.chaoscomputerclub.in → CF Worker (set by wrangler)")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
