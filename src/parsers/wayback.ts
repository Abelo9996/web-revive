/**
 * Helpers for Internet Archive (Wayback Machine) URLs. A user who already has a
 * capture in hand usually pastes a normal Wayback page link like
 * `https://web.archive.org/web/20071015/http://site/game.swf`. That rewritten
 * form is served through the archive's HTML-rewriting proxy, which, for a
 * direct asset, sometimes answers 500. The raw `id_` form returns the original
 * bytes unchanged and avoids that path. These functions are pure so the
 * normalization is unit-testable without the network.
 */

export interface WaybackRef {
  /** The capture timestamp, e.g. 20071015000000. */
  timestamp: string;
  /** The modifier right after the timestamp (id_, if_, "", or similar). */
  modifier: string;
  /** The original URL that was captured. */
  originalUrl: string;
}

const WAYBACK_RE = /^https?:\/\/web\.archive\.org\/web\/(\d{4,14})([a-z]{2}_)?\/(.+)$/i;

/** True if the URL is any form of Wayback Machine capture link. */
export function isWaybackUrl(url: string): boolean {
  return /^https?:\/\/web\.archive\.org\/web\//i.test(url);
}

/** Split a Wayback capture URL into timestamp, modifier, and original URL. */
export function parseWaybackUrl(url: string): WaybackRef | null {
  const m = WAYBACK_RE.exec(url.trim());
  if (!m) return null;
  return { timestamp: m[1]!, modifier: m[2] ?? "", originalUrl: m[3]! };
}

/**
 * Normalize a Wayback capture URL to its raw `id_` form, which returns the
 * original bytes and skips the rewriting proxy that can 500 on direct assets.
 * A non-Wayback URL is returned unchanged.
 */
export function toRawWaybackUrl(url: string): string {
  const ref = parseWaybackUrl(url);
  if (!ref) return url;
  if (ref.modifier === "id_") return url;
  return `https://web.archive.org/web/${ref.timestamp}id_/${ref.originalUrl}`;
}
