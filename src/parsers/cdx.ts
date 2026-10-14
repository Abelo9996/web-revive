import type { WaybackCapture } from "../types.js";

/**
 * Build a Wayback Machine CDX API query for one URL. We ask for explicit fields
 * and collapse by digest so identical captures are not repeated.
 */
export function buildCdxUrl(targetUrl: string, limit = 20): string {
  const params = new URLSearchParams({
    url: targetUrl,
    output: "json",
    fl: "timestamp,original,mimetype,statuscode,digest,length",
    collapse: "digest",
    limit: String(limit),
  });
  return `https://web.archive.org/cdx/search/cdx?${params.toString()}`;
}

/** The URL that returns the raw original bytes (the id_ form, no rewriting). */
export function rawCaptureUrl(timestamp: string, originalUrl: string): string {
  return `https://web.archive.org/web/${timestamp}id_/${originalUrl}`;
}

/**
 * Parse a CDX JSON response. The first row is the field header; we map the rest
 * by the header order so field reordering by the API does not break us.
 */
export function parseCdx(jsonText: string): WaybackCapture[] {
  const trimmed = jsonText.trim();
  if (!trimmed) return [];
  let rows: string[][];
  try {
    rows = JSON.parse(trimmed) as string[][];
  } catch {
    return [];
  }
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const header = rows[0]!;
  const idx = (name: string) => header.indexOf(name);
  const ti = idx("timestamp");
  const oi = idx("original");
  const mi = idx("mimetype");
  const si = idx("statuscode");
  const di = idx("digest");
  const li = idx("length");

  const out: WaybackCapture[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    const timestamp = r[ti] ?? "";
    const originalUrl = r[oi] ?? "";
    if (!timestamp || !originalUrl) continue;
    out.push({
      timestamp,
      originalUrl,
      mimetype: r[mi] ?? "",
      statusCode: r[si] ?? "",
      digest: r[di] ?? "",
      length: li >= 0 ? r[li] ?? null : null,
      rawUrl: rawCaptureUrl(timestamp, originalUrl),
    });
  }
  return out;
}

/**
 * Pick the capture most likely to actually load: a 200 response, and among
 * those the most recent (old games were usually most complete near the end of
 * their life). Falls back to the most recent capture of any status.
 */
export function pickBest(captures: WaybackCapture[]): WaybackCapture | null {
  if (!captures.length) return null;
  const ok = captures.filter((c) => c.statusCode === "200");
  const pool = ok.length ? ok : captures;
  return [...pool].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] ?? null;
}
