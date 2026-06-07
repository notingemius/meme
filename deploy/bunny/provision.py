#!/usr/bin/env python3
"""
Provision the MemKarti online server on Bunny Magic Containers from a portable
spec (app.config.json). Idempotent and account-independent: run it against ANY
Bunny account by supplying that account's API key.

  Usage:
    BUNNY_API_KEY=<key> python3 deploy/bunny/provision.py            # create/update
    BUNNY_API_KEY=<key> python3 deploy/bunny/provision.py --delete   # tear down
    BUNNY_API_KEY=<key> python3 deploy/bunny/provision.py --status   # show endpoint

The API key is read ONLY from the BUNNY_API_KEY env var. It is never written to
disk or committed. The container image is pulled from PUBLIC GHCR via Bunny's
built-in "GitHub Public" registry (resolved by host name, not a hard-coded id,
so it works on any account).
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

API = "https://api.bunny.net"
HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(HERE, "app.config.json")


def req(method, path, key, body=None):
    url = API + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("AccessKey", key)
    r.add_header("Accept", "application/json")
    if data:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}


def get_key():
    key = os.environ.get("BUNNY_API_KEY", "").strip()
    if not key:
        sys.exit("ERROR: set BUNNY_API_KEY env var (your Bunny account API key).")
    return key


def find_registry_id(key, host):
    _, data = req("GET", "/mc/registries", key)
    for item in data.get("items", []):
        if item.get("hostName") == host and item.get("isPublic"):
            return str(item["id"])
    sys.exit(f"ERROR: no public registry for host '{host}' on this account.")


def find_app_by_name(key, name):
    _, data = req("GET", "/mc/apps", key)
    for a in data.get("items", []):
        if a.get("name") == name:
            return a["id"]
    return None


def container_template(cfg, registry_id, with_endpoint=False):
    c = cfg["container"]
    t = {
        "name": c["name"],
        "imageRegistryId": registry_id,
        "imageNamespace": c["imageNamespace"],
        "imageName": c["imageName"],
        "imageTag": c["imageTag"],
        "imagePullPolicy": c["imagePullPolicy"],
    }
    if with_endpoint:
        t["endpoints"] = [{
            "displayName": cfg["endpoint"]["displayName"],
            "cdn": {"portMappings": [{"containerPort": cfg["endpoint"]["containerPort"]}]},
        }]
    return t


def provision(key, cfg):
    name = cfg["name"]
    registry_id = find_registry_id(key, cfg["container"]["registryHost"])
    print(f"-> registry '{cfg['container']['registryHost']}' resolved to id {registry_id}")

    app_id = find_app_by_name(key, name)
    if app_id:
        print(f"-> app '{name}' already exists ({app_id}); updating it.")
    else:
        status, data = req("POST", "/mc/apps", key, {
            "name": name,
            "runtimeType": cfg["runtimeType"],
            "autoScaling": cfg["autoScaling"],
            "containerTemplates": [container_template(cfg, registry_id)],
        })
        if status >= 300:
            sys.exit(f"ERROR creating app: {json.dumps(data)}")
        app_id = data["id"]
        print(f"-> created app {app_id}")

    # Lock region + attach endpoint (port mapping) in one update.
    r = cfg["region"]
    status, data = req("PATCH", f"/mc/apps/{app_id}", key, {
        "regionSettings": {
            "allowedRegionIds": [r["id"]],
            "requiredRegionIds": [r["id"]],
            "maxAllowedRegions": r["maxRegions"],
            "provisioningType": r["provisioning"],
        },
        "containerTemplates": [container_template(cfg, registry_id, with_endpoint=True)],
    })
    if status >= 300:
        sys.exit(f"ERROR configuring app: {json.dumps(data)}")
    print("-> region locked + endpoint configured")

    # Wait for the public endpoint to appear.
    for _ in range(20):
        _, app = req("GET", f"/mc/apps/{app_id}", key)
        ep = (app.get("displayEndpoint") or {}).get("address")
        if app.get("status", "").lower() == "active" and ep:
            print(f"\nDONE. Status: {app['status']}")
            print(f"Endpoint: https://{ep}")
            print(f"\nNext: set EXPO_PUBLIC_SERVER_URL=https://{ep} and rebuild the APK.")
            return
        time.sleep(6)
    print("App created; endpoint still provisioning. Re-run with --status shortly.")


def show_status(key, cfg):
    app_id = find_app_by_name(key, cfg["name"])
    if not app_id:
        sys.exit(f"No app named '{cfg['name']}' on this account.")
    _, app = req("GET", f"/mc/apps/{app_id}", key)
    ep = (app.get("displayEndpoint") or {}).get("address")
    print(f"status: {app.get('status')}")
    print(f"endpoint: https://{ep}" if ep else "endpoint: (not ready)")


def delete(key, cfg):
    app_id = find_app_by_name(key, cfg["name"])
    if not app_id:
        print(f"No app named '{cfg['name']}' to delete.")
        return
    status, _ = req("DELETE", f"/mc/apps/{app_id}", key)
    print(f"deleted {app_id} -> HTTP {status}")


def main():
    key = get_key()
    with open(CONFIG_PATH) as f:
        cfg = json.load(f)
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "--delete":
        delete(key, cfg)
    elif arg == "--status":
        show_status(key, cfg)
    else:
        provision(key, cfg)


if __name__ == "__main__":
    main()
