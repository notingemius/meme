// ============================================================================
// Self-hosted OTA updates (Expo Updates protocol) — served from OUR Bunny box.
// ----------------------------------------------------------------------------
// This lets the app pull JS-only updates over the air WITHOUT reinstalling the
// whole APK and WITHOUT depending on expo.dev / EAS. It implements the Expo
// Updates manifest + asset protocol (v0/v1, no code signing), adapted from
// Expo's reference "custom-expo-updates-server".
//
// The exported JS bundle (`expo export --platform android`) is baked into the
// container image at OTA_DIST_DIR (default ./ota-dist). The app's
// `runtimeVersion` must match OTA_RUNTIME_VERSION — bump it only when native
// code changes (which then requires a full APK rebuild anyway).
// ============================================================================
import type { Request, Response } from 'express';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import FormData from 'form-data';

const OTA_DIR = process.env.OTA_DIST_DIR || path.join(process.cwd(), 'ota-dist');
const RUNTIME_VERSION = process.env.OTA_RUNTIME_VERSION || '1';

// ---- helpers (ported from Expo's reference server) -------------------------

function createHash(buf: crypto.BinaryLike, algo: string, enc: crypto.BinaryToTextEncoding) {
  return crypto.createHash(algo).update(buf).digest(enc);
}

function base64URL(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sha256ToUUID(v: string): string {
  return `${v.slice(0, 8)}-${v.slice(8, 12)}-${v.slice(12, 16)}-${v.slice(16, 20)}-${v.slice(20, 32)}`;
}

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', ttf: 'font/ttf', otf: 'font/otf',
  woff: 'font/woff', woff2: 'font/woff2', json: 'application/json', mp3: 'audio/mpeg',
  mp4: 'video/mp4', wav: 'audio/wav',
};
function contentTypeForExt(ext: string | null | undefined): string {
  if (!ext) return 'application/octet-stream';
  return MIME[ext.toLowerCase()] ?? 'application/octet-stream';
}

// True when an exported bundle exists for the requested runtime version.
export function otaAvailable(): boolean {
  try {
    return fs.existsSync(path.join(OTA_DIR, 'metadata.json'));
  } catch {
    return false;
  }
}

type AssetEntry = {
  hash: string;
  key: string;
  fileExtension: string;
  contentType: string;
  url: string;
};

async function assetMetadata(opts: {
  baseUrl: string;
  filePath: string;
  ext: string | null;
  isLaunchAsset: boolean;
  platform: string;
}): Promise<AssetEntry> {
  const abs = path.resolve(OTA_DIR, opts.filePath);
  const buf = await fsp.readFile(abs);
  const hash = base64URL(createHash(buf, 'sha256', 'base64'));
  const key = createHash(buf, 'md5', 'hex');
  const ext = opts.isLaunchAsset ? 'bundle' : opts.ext ?? 'dat';
  const contentType = opts.isLaunchAsset ? 'application/javascript' : contentTypeForExt(opts.ext);
  return {
    hash,
    key,
    fileExtension: `.${ext}`,
    contentType,
    url: `${opts.baseUrl}/api/assets?asset=${encodeURIComponent(opts.filePath)}&runtimeVersion=${RUNTIME_VERSION}&platform=${opts.platform}`,
  };
}

async function readMetadata() {
  const metaPath = path.join(OTA_DIR, 'metadata.json');
  const buf = await fsp.readFile(metaPath);
  const json = JSON.parse(buf.toString('utf8'));
  const stat = await fsp.stat(metaPath);
  return { json, createdAt: new Date(stat.mtime).toISOString(), id: createHash(buf, 'sha256', 'hex') };
}

function baseUrlOf(req: Request): string {
  // Behind Bunny CDN; honour forwarded proto/host so asset URLs are public.
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  return `${proto}://${host}`;
}

// ---- GET /api/manifest -----------------------------------------------------

export async function manifestHandler(req: Request, res: Response): Promise<void> {
  const protoHeader = req.headers['expo-protocol-version'];
  if (Array.isArray(protoHeader)) {
    res.status(400).json({ error: 'Unsupported protocol version. Expected 0 or 1.' });
    return;
  }
  const protocolVersion = parseInt((protoHeader as string) ?? '0', 10);

  const platform = (req.headers['expo-platform'] as string) ?? (req.query['platform'] as string);
  if (platform !== 'ios' && platform !== 'android') {
    res.status(400).json({ error: 'Unsupported platform. Expected ios or android.' });
    return;
  }

  const runtimeVersion =
    (req.headers['expo-runtime-version'] as string) ?? (req.query['runtime-version'] as string);
  if (!runtimeVersion) {
    res.status(400).json({ error: 'No runtimeVersion provided.' });
    return;
  }

  // We only host one runtime version's bundle.
  if (runtimeVersion !== RUNTIME_VERSION || !otaAvailable()) {
    res.status(404).json({ error: `No update for runtime version ${runtimeVersion}` });
    return;
  }

  try {
    const { json, createdAt, id } = await readMetadata();

    // protocol v1 supports "no update available" when the client already runs it.
    const currentUpdateId = req.headers['expo-current-update-id'];
    if (currentUpdateId === sha256ToUUID(id) && protocolVersion === 1) {
      const form = new FormData();
      form.append('directive', JSON.stringify({ type: 'noUpdateAvailable' }), {
        contentType: 'application/json',
        header: { 'content-type': 'application/json; charset=utf-8' },
      });
      res.statusCode = 200;
      res.setHeader('expo-protocol-version', 1);
      res.setHeader('expo-sfv-version', 0);
      res.setHeader('cache-control', 'private, max-age=0');
      res.setHeader('content-type', `multipart/mixed; boundary=${form.getBoundary()}`);
      res.end(form.getBuffer());
      return;
    }

    const baseUrl = baseUrlOf(req);
    const platformMeta = json.fileMetadata[platform];
    const manifest = {
      id: sha256ToUUID(id),
      createdAt,
      runtimeVersion,
      assets: await Promise.all(
        (platformMeta.assets as Array<{ path: string; ext: string }>).map((a) =>
          assetMetadata({ baseUrl, filePath: a.path, ext: a.ext, isLaunchAsset: false, platform }),
        ),
      ),
      launchAsset: await assetMetadata({
        baseUrl,
        filePath: platformMeta.bundle,
        ext: null,
        isLaunchAsset: true,
        platform,
      }),
      metadata: {},
      extra: {},
    };

    const form = new FormData();
    form.append('manifest', JSON.stringify(manifest), {
      contentType: 'application/json',
      header: { 'content-type': 'application/json; charset=utf-8' },
    });

    res.statusCode = 200;
    res.setHeader('expo-protocol-version', protocolVersion);
    res.setHeader('expo-sfv-version', 0);
    res.setHeader('cache-control', 'private, max-age=0');
    res.setHeader('content-type', `multipart/mixed; boundary=${form.getBoundary()}`);
    res.end(form.getBuffer());
  } catch (e) {
    console.error('[ota] manifest error', e);
    res.status(404).json({ error: String(e) });
  }
}

// ---- GET /api/assets -------------------------------------------------------

export async function assetHandler(req: Request, res: Response): Promise<void> {
  const assetName = req.query['asset'] as string;
  const platform = (req.query['platform'] as string) ?? 'android';
  if (!assetName) {
    res.status(400).json({ error: 'No asset name provided.' });
    return;
  }
  if (!otaAvailable()) {
    res.status(404).json({ error: 'No bundle hosted.' });
    return;
  }

  // Resolve within OTA_DIR and prevent path traversal.
  const abs = path.resolve(OTA_DIR, assetName);
  if (!abs.startsWith(path.resolve(OTA_DIR))) {
    res.status(403).json({ error: 'Forbidden.' });
    return;
  }
  if (!fs.existsSync(abs)) {
    res.status(404).json({ error: `Asset "${assetName}" does not exist.` });
    return;
  }

  try {
    const { json } = await readMetadata();
    const platformMeta = json.fileMetadata[platform];
    const isLaunchAsset =
      path.resolve(OTA_DIR, platformMeta.bundle) === abs;
    const assetEntry = (platformMeta.assets as Array<{ path: string; ext: string }>).find(
      (a) => path.resolve(OTA_DIR, a.path) === abs,
    );
    const contentType = isLaunchAsset
      ? 'application/javascript'
      : contentTypeForExt(assetEntry?.ext);
    res.setHeader('content-type', contentType);
    res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    res.end(await fsp.readFile(abs));
  } catch (e) {
    console.error('[ota] asset error', e);
    res.status(500).json({ error: String(e) });
  }
}

export const OTA_INFO = { dir: OTA_DIR, runtimeVersion: RUNTIME_VERSION };
