import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { DownloadedFile, EmbeddedGame, FindResult, WaybackCapture } from "../types.js";
import { parseEmbeds, resolve } from "../parsers/embed.js";
import { buildCdxUrl, parseCdx, pickBest } from "../parsers/cdx.js";
import { httpGet, sha256 } from "../util/http.js";

export interface FindOptions {
  /** Max CDX rows to request per URL. */
  limit?: number;
  /** Directory to download the best capture of each game file into. */
  saveDir?: string;
  timeoutMs?: number;
}

const POLITE_DELAY_MS = 400;

/**
 * Locate the embedded game on a page or a direct file URL. If the page or file
 * is gone, fall back to the Internet Archive: find captures, pick the best, and
 * (when a save directory is given) download it. Every URL contacted is recorded.
 */
export async function find(source: string, options: FindOptions = {}): Promise<FindResult> {
  const limit = options.limit ?? 20;
  const timeoutMs = options.timeoutMs ?? 30000;
  const result: FindResult = {
    source,
    pageFetched: false,
    pageLive: false,
    games: [],
    pageCaptures: [],
    assetCaptures: [],
    downloaded: [],
    requests: [],
    notes: [],
  };

  if (!/^https?:\/\//i.test(source)) {
    result.notes.push("find works on URLs. For a local file, run inspect directly.");
    return result;
  }

  const direct = /\.(swf|jar|class)(\?|$)/i.test(source);
  if (direct) {
    await findDirectFile(source, result, { limit, timeoutMs, saveDir: options.saveDir });
    return result;
  }

  await findOnPage(source, result, { limit, timeoutMs, saveDir: options.saveDir });
  return result;
}

interface Ctx {
  limit: number;
  timeoutMs: number;
  saveDir?: string;
}

async function findDirectFile(url: string, result: FindResult, ctx: Ctx): Promise<void> {
  const type = /\.jar(\?|$)/i.test(url) || /\.class(\?|$)/i.test(url) ? "java" : "flash";
  const live = await tryGet(url, result, ctx.timeoutMs, "direct game file");
  if (live?.ok) {
    result.pageLive = true;
    const game: EmbeddedGame = { type, src: url, width: null, height: null, evidence: "direct file URL (live)" };
    result.games.push(game);
    if (ctx.saveDir && live.body) {
      result.downloaded.push(await saveBuffer(live.body, url, ctx.saveDir, null));
    }
    return;
  }
  result.notes.push("Direct file is not reachable live; looking in the Internet Archive.");
  const captures = await cdxLookup(url, result, ctx);
  result.assetCaptures.push({ requested: url, captures });
  const best = pickBest(captures);
  const game: EmbeddedGame = { type, src: url, width: null, height: null, evidence: "direct file URL (archived)" };
  result.games.push(game);
  if (best && ctx.saveDir) await downloadCapture(best, url, result, ctx);
}

async function findOnPage(url: string, result: FindResult, ctx: Ctx): Promise<void> {
  const live = await tryGet(url, result, ctx.timeoutMs, "page");
  let html: string | null = null;
  let baseUrl = url;

  if (live?.ok && isHtml(live.contentType)) {
    result.pageLive = true;
    result.pageFetched = true;
    html = live.body!.toString("utf8");
    baseUrl = live.finalUrl;
  } else {
    if (live) result.notes.push(`Page returned status ${live.status}; looking in the Internet Archive.`);
    else result.notes.push("Page did not load; looking in the Internet Archive.");
    const captures = await cdxLookup(url, result, ctx);
    result.pageCaptures = captures;
    const best = pickBest(captures);
    if (best) {
      const archived = await tryGet(best.rawUrl, result, ctx.timeoutMs, "archived page");
      if (archived?.ok) {
        result.pageFetched = true;
        html = archived.body!.toString("utf8");
        // Resolve embeds against the original page URL, not the archive wrapper.
        baseUrl = best.originalUrl;
        result.notes.push(`Using page capture from ${best.timestamp}.`);
      }
    }
  }

  if (!html) {
    result.notes.push("No page HTML could be read, live or archived.");
    return;
  }

  result.games = parseEmbeds(html, baseUrl);
  if (!result.games.length) {
    result.notes.push("No <object>/<embed>/<applet>/swfobject game was found in the page.");
    return;
  }

  // For each game file, confirm or recover it. When the page was dead, the
  // files almost certainly are too, so go to the archive for them.
  for (const game of result.games) {
    const fileUrls = gameFileUrls(game, baseUrl);
    for (const fileUrl of fileUrls) {
      const got = result.pageLive ? await tryGet(fileUrl, result, ctx.timeoutMs, "game file") : null;
      if (got?.ok) {
        if (ctx.saveDir && got.body) result.downloaded.push(await saveBuffer(got.body, fileUrl, ctx.saveDir, null));
        continue;
      }
      const captures = await cdxLookup(fileUrl, result, ctx);
      result.assetCaptures.push({ requested: fileUrl, captures });
      const best = pickBest(captures);
      if (best && ctx.saveDir) await downloadCapture(best, fileUrl, result, ctx);
    }
  }
}

function gameFileUrls(game: EmbeddedGame, baseUrl: string): string[] {
  if (game.type === "flash") return game.src ? [game.src] : [];
  const urls = (game.archive ?? []).map((a) => resolve(a, baseUrl)).filter((x): x is string => Boolean(x));
  return urls.length ? urls : game.src ? [game.src] : [];
}

async function cdxLookup(targetUrl: string, result: FindResult, ctx: Ctx): Promise<WaybackCapture[]> {
  const cdxUrl = buildCdxUrl(targetUrl, ctx.limit);
  const res = await tryGet(cdxUrl, result, ctx.timeoutMs, "wayback CDX");
  if (!res?.ok || !res.body) return [];
  return parseCdx(res.body.toString("utf8"));
}

async function downloadCapture(best: WaybackCapture, requestedUrl: string, result: FindResult, ctx: Ctx): Promise<void> {
  const res = await tryGet(best.rawUrl, result, ctx.timeoutMs, "archived game file");
  if (!res?.ok || !res.body) {
    result.notes.push(`Best capture of ${requestedUrl} (${best.timestamp}) did not download.`);
    return;
  }
  result.downloaded.push(await saveBuffer(res.body, requestedUrl, ctx.saveDir!, best.timestamp));
}

async function saveBuffer(body: Buffer, requestedUrl: string, saveDir: string, captureTimestamp: string | null): Promise<DownloadedFile> {
  await mkdir(saveDir, { recursive: true });
  const name = fileNameFor(requestedUrl);
  const dest = uniquePath(path.join(saveDir, name));
  await writeFile(dest, body);
  return { requestedUrl, path: dest, bytes: body.length, sha256: sha256(body), captureTimestamp };
}

interface GetOutcome {
  ok: boolean;
  status: number | null;
  body: Buffer | null;
  contentType: string;
  finalUrl: string;
}

async function tryGet(url: string, result: FindResult, timeoutMs: number, note: string): Promise<GetOutcome | null> {
  try {
    const res = await httpGet(url, { timeoutMs, politeDelayMs: POLITE_DELAY_MS });
    result.requests.push({ url, note, status: res.status });
    return {
      ok: res.ok,
      status: res.status,
      body: res.body,
      contentType: res.headers.get("content-type") ?? "",
      finalUrl: res.url,
    };
  } catch (err) {
    result.requests.push({ url, note: `${note} (error: ${String(err instanceof Error ? err.message : err)})`, status: null });
    return null;
  }
}

function isHtml(contentType: string): boolean {
  return /html/i.test(contentType) || contentType === "";
}

function fileNameFor(url: string): string {
  try {
    const u = new URL(url);
    const base = path.basename(u.pathname) || "game";
    return base.replace(/[^\w.\-]/g, "_");
  } catch {
    return "game";
  }
}

function uniquePath(p: string): string {
  if (!existsSync(p)) return p;
  const ext = path.extname(p);
  const stem = p.slice(0, p.length - ext.length);
  let i = 1;
  while (existsSync(`${stem}-${i}${ext}`)) i++;
  return `${stem}-${i}${ext}`;
}
