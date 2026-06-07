# Bunny Magic Containers — portable config

Recreate the MemKarti online server on **any** Bunny account from this saved
config. No secrets are stored here — the API key is read from an env var.

## Files
- `app.config.json` — the full server spec (name, region = DE, image, port 3000).
- `provision.py` — applies the spec to a Bunny account (no dependencies, pure Python).

## Use on a new API profile
```bash
# create (or update) the app on the account that owns this API key
BUNNY_API_KEY=<new-account-key> python3 deploy/bunny/provision.py

# show the public endpoint URL
BUNNY_API_KEY=<key> python3 deploy/bunny/provision.py --status

# tear it down (stop spending credits)
BUNNY_API_KEY=<key> python3 deploy/bunny/provision.py --delete
```

The script:
1. finds the built-in public **GitHub** registry on that account (by host `ghcr.io`),
2. creates the `memkarti-server` app (or reuses it if it already exists — idempotent),
3. locks the region to **DE** and exposes container port **3000** over HTTPS,
4. prints the endpoint URL to put into `EXPO_PUBLIC_SERVER_URL`.

> The image `ghcr.io/notingemius/memkarti-server:latest` is public, so Bunny pulls
> it without credentials. Rebuild/republish it via the `bunny-image.yml` workflow.
