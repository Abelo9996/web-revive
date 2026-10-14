import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { RuntimeInfo } from "../types.js";
import { httpGet, sha256 } from "../util/http.js";
import { readZipEntries, readZipEntry } from "../parsers/zip.js";

export interface RuntimeOptions {
  /** Root for cached runtimes. Defaults to ~/.web-revive/runtimes. Tests pass a temp dir. */
  cacheRoot?: string;
  /** Re-download even if a cached build exists. */
  force?: boolean;
  timeoutMs?: number;
}

// CheerpJ is loaded from Leaning Technologies' CDN at runtime; we never download
// it. 4.3 is the current loader line and the one whose applet support runs on
// Java 8.
export const CHEERPJ_LOADER_URL = "https://cjrtnc.leaningtech.com/4.3/loader.js";
export const CHEERPJ_VERSION = "4.3";

const RUFFLE_RELEASES_API = "https://api.github.com/repos/ruffle-rs/ruffle/releases?per_page=10";

export function defaultCacheRoot(): string {
  return path.join(homedir(), ".web-revive", "runtimes");
}

/** Fetch and cache a runtime. Ruffle is downloaded; CheerpJ is described. */
export async function fetchRuntime(kind: "ruffle" | "cheerpj", options: RuntimeOptions = {}): Promise<RuntimeInfo> {
  if (kind === "cheerpj") return cheerpjInfo();
  return fetchRuffle(options);
}

export function cheerpjInfo(): RuntimeInfo {
  return {
    kind: "cheerpj",
    cached: true,
    loaderUrl: CHEERPJ_LOADER_URL,
    version: CHEERPJ_VERSION,
    proprietary: true,
    licenseNote:
      "CheerpJ is proprietary software from Leaning Technologies. Free for personal use; check its license for commercial use. The page loads it from Leaning Technologies' servers at runtime.",
    notes: ["CheerpJ is not downloaded or bundled. The packaged page references the CDN loader above."],
  };
}

const RUFFLE_META = "ruffle.meta.json";

function ruffleDir(cacheRoot: string): string {
  return path.join(cacheRoot, "ruffle");
}

/** Read a cached Ruffle build's metadata, if one is present. */
export async function cachedRuffle(cacheRoot = defaultCacheRoot()): Promise<RuntimeInfo | null> {
  const meta = path.join(ruffleDir(cacheRoot), RUFFLE_META);
  if (!existsSync(meta)) return null;
  try {
    const info = JSON.parse(await readFile(meta, "utf8")) as RuntimeInfo;
    if (info.cacheDir && existsSync(path.join(info.cacheDir, "ruffle.js"))) return info;
  } catch {
    // fall through
  }
  return null;
}

async function fetchRuffle(options: RuntimeOptions): Promise<RuntimeInfo> {
  const cacheRoot = options.cacheRoot ?? defaultCacheRoot();
  const timeoutMs = options.timeoutMs ?? 60000;

  if (!options.force) {
    const cached = await cachedRuffle(cacheRoot);
    if (cached) {
      cached.cached = true;
      cached.notes = [...cached.notes, "Using the cached Ruffle build. Pass force to re-download."];
      return cached;
    }
  }

  const releasesRes = await httpGet(RUFFLE_RELEASES_API, { timeoutMs, accept: "application/vnd.github+json" });
  if (!releasesRes.ok) throw new Error(`GitHub releases request failed: HTTP ${releasesRes.status}`);
  const releases = JSON.parse(releasesRes.body.toString("utf8")) as GhRelease[];
  const picked = pickSelfhostedAsset(releases);
  if (!picked) throw new Error("no web-selfhosted asset found in the latest Ruffle releases");

  const zipRes = await httpGet(picked.asset.browser_download_url, { timeoutMs, politeDelayMs: 300 });
  if (!zipRes.ok) throw new Error(`Ruffle download failed: HTTP ${zipRes.status}`);
  const checksum = sha256(zipRes.body);

  const dir = ruffleDir(cacheRoot);
  await mkdir(dir, { recursive: true });
  const files = await extractZip(zipRes.body, dir);

  const info: RuntimeInfo = {
    kind: "ruffle",
    cached: false,
    releaseTag: picked.release.tag_name,
    assetName: picked.asset.name,
    assetUrl: picked.asset.browser_download_url,
    sha256: checksum,
    cacheDir: dir,
    files,
    notes: [
      "Ruffle is MIT/Apache-2.0 open source. The self-hosted web build above was downloaded from the official GitHub releases.",
    ],
  };
  await writeFile(path.join(dir, RUFFLE_META), JSON.stringify(info, null, 2));
  return info;
}

interface GhAsset {
  name: string;
  browser_download_url: string;
}
interface GhRelease {
  tag_name: string;
  assets: GhAsset[];
}

export function pickSelfhostedAsset(releases: GhRelease[]): { release: GhRelease; asset: GhAsset } | null {
  for (const release of releases) {
    const asset = (release.assets ?? []).find((a) => /web-selfhosted\.zip$/i.test(a.name));
    if (asset) return { release, asset };
  }
  return null;
}

async function extractZip(buf: Buffer, destDir: string): Promise<string[]> {
  const root = path.resolve(destDir);
  const entries = readZipEntries(buf);
  const written: string[] = [];
  for (const entry of entries) {
    if (entry.name.endsWith("/")) continue;
    const safeRel = entry.name.replace(/\\/g, "/").replace(/^(\.\.(\/|$))+/, "");
    const dest = path.resolve(root, safeRel);
    if (dest !== root && !dest.startsWith(root + path.sep)) continue;
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, readZipEntry(buf, entry));
    written.push(safeRel);
  }
  return written.sort();
}
