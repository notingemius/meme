// ============================================================================
// QA flag store — collects "bad meme" reports from the app.
// ----------------------------------------------------------------------------
// Flags are appended to a JSON-lines file inside QA_DATA_DIR (a folder on the
// server). On Bunny attach a volume at that path to persist across redeploys;
// otherwise the folder lives for as long as the container runs.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.QA_DATA_DIR || path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'bad-memes.jsonl');

export type MemeFlag = {
  memeId: number;
  title?: string;
  imageUrl?: string;
  phase?: string;
  situation?: string;
  by?: string;
  ts: number;
};

let flags: MemeFlag[] = [];

function ensureDir(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}

// Load any previously persisted flags on startup.
export function loadFlags(): void {
  ensureDir();
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    flags = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as MemeFlag);
  } catch {
    flags = [];
  }
  console.log(`[qa] loaded ${flags.length} meme flag(s) from ${FILE}`);
}

export function addFlag(input: Omit<MemeFlag, 'ts'> & { ts?: number }): MemeFlag {
  ensureDir();
  const rec: MemeFlag = { ...input, ts: input.ts ?? Date.now() };
  flags.push(rec);
  try {
    fs.appendFileSync(FILE, JSON.stringify(rec) + '\n');
  } catch (e) {
    console.error('[qa] failed to persist flag', e);
  }
  return rec;
}

export function allFlags(): MemeFlag[] {
  return flags;
}

// Aggregated counts per meme, most-flagged first — the curation worklist.
export function summary(): { memeId: number; title?: string; count: number }[] {
  const byId = new Map<number, { memeId: number; title?: string; count: number }>();
  for (const f of flags) {
    const e = byId.get(f.memeId) ?? { memeId: f.memeId, title: f.title, count: 0 };
    e.count += 1;
    if (!e.title && f.title) e.title = f.title;
    byId.set(f.memeId, e);
  }
  return [...byId.values()].sort((a, b) => b.count - a.count);
}

export function toCsv(): string {
  const header = ['ts', 'memeId', 'title', 'phase', 'situation', 'by'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = flags.map((f) => [
    new Date(f.ts).toISOString(),
    f.memeId,
    f.title ?? '',
    f.phase ?? '',
    f.situation ?? '',
    f.by ?? '',
  ]);
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}
