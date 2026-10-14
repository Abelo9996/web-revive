import type { EmbeddedGame } from "../types.js";

/**
 * Find embedded Flash and Java games in an old HTML page. Covers the common
 * ways they were placed: <object>/<embed>, swfobject, Adobe's AC_FL_RunContent
 * helper, and <applet>. Regex over HTML is imperfect, but these embed shapes
 * are stable and this keeps the parser dependency-free and unit-testable.
 */
export function parseEmbeds(html: string, baseUrl?: string): EmbeddedGame[] {
  const games: EmbeddedGame[] = [];
  games.push(...parseObjects(html, baseUrl));
  games.push(...parseStandaloneEmbeds(html, baseUrl));
  games.push(...parseApplets(html, baseUrl));
  games.push(...parseSwfObject(html, baseUrl));
  games.push(...parseAcFlRunContent(html, baseUrl));
  return dedupe(games);
}

function parseObjects(html: string, baseUrl?: string): EmbeddedGame[] {
  const out: EmbeddedGame[] = [];
  const re = /<object\b([^>]*)>([\s\S]*?)<\/object>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const attrs = parseAttrs(m[1]!);
    const inner = m[2]!;
    const params = parseParams(inner);
    const isFlash =
      /x-shockwave-flash/i.test(attrs.type ?? "") ||
      /d27cdb6e/i.test(attrs.classid ?? "") ||
      /\.swf(\?|$)/i.test(attrs.data ?? "") ||
      Boolean(params.movie) ||
      /\.swf(\?|$)/i.test(params.src ?? "");
    if (!isFlash) continue;
    const src = params.movie ?? params.src ?? attrs.data ?? null;
    const flashvars = mergeFlashvars(params.flashvars, inner, attrs);
    out.push({
      type: "flash",
      src: resolve(src, baseUrl),
      width: toInt(attrs.width ?? params.width),
      height: toInt(attrs.height ?? params.height),
      flashvars,
      evidence: "<object> with Flash movie param",
    });
  }
  return out;
}

function parseStandaloneEmbeds(html: string, baseUrl?: string): EmbeddedGame[] {
  const out: EmbeddedGame[] = [];
  const re = /<embed\b([^>]*?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const attrs = parseAttrs(m[1]!);
    const src = attrs.src ?? "";
    if (!/\.swf(\?|$)/i.test(src) && !/x-shockwave-flash/i.test(attrs.type ?? "")) continue;
    out.push({
      type: "flash",
      src: resolve(attrs.src ?? null, baseUrl),
      width: toInt(attrs.width),
      height: toInt(attrs.height),
      flashvars: attrs.flashvars ? parseQuery(attrs.flashvars) : {},
      evidence: "<embed> Flash tag",
    });
  }
  return out;
}

function parseApplets(html: string, baseUrl?: string): EmbeddedGame[] {
  const out: EmbeddedGame[] = [];
  const re = /<applet\b([^>]*)>([\s\S]*?)<\/applet>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const attrs = parseAttrs(m[1]!);
    const params = parseParams(m[2]!);
    const codebase = attrs.codebase ?? undefined;
    const archive = attrs.archive
      ? attrs.archive
          .split(",")
          .map((a) => resolveWithCodebase(a.trim(), codebase, baseUrl))
          .filter((x): x is string => Boolean(x))
      : [];
    out.push({
      type: "java",
      src: archive[0] ?? resolveWithCodebase(attrs.code ?? null, codebase, baseUrl),
      width: toInt(attrs.width),
      height: toInt(attrs.height),
      code: attrs.code,
      archive,
      codebase,
      params,
      evidence: "<applet> tag",
    });
  }
  return out;
}

function parseSwfObject(html: string, baseUrl?: string): EmbeddedGame[] {
  const out: EmbeddedGame[] = [];
  // swfobject.embedSWF("movie.swf", "id", "550", "400", ...)
  const re = /embedSWF\s*\(\s*(['"])([^'"]+)\1\s*,\s*(['"])[^'"]*\3\s*,\s*(['"]?)([\d%]+)\4\s*,\s*(['"]?)([\d%]+)\6/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    out.push({
      type: "flash",
      src: resolve(m[2]!, baseUrl),
      width: toInt(m[5]),
      height: toInt(m[7]),
      flashvars: {},
      evidence: "swfobject.embedSWF() call",
    });
  }
  // new SWFObject("movie.swf", "id", "w", "h", ...)
  const re2 = /new\s+SWFObject\s*\(\s*(['"])([^'"]+)\1\s*,\s*(['"])[^'"]*\3\s*,\s*(['"]?)([\d%]+)\4\s*,\s*(['"]?)([\d%]+)\6/gi;
  while ((m = re2.exec(html))) {
    out.push({
      type: "flash",
      src: resolve(m[2]!, baseUrl),
      width: toInt(m[5]),
      height: toInt(m[7]),
      flashvars: {},
      evidence: "new SWFObject() call",
    });
  }
  return out;
}

function parseAcFlRunContent(html: string, baseUrl?: string): EmbeddedGame[] {
  const out: EmbeddedGame[] = [];
  const re = /AC_FL_RunContent\s*\(([\s\S]*?)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const pairs = [...m[1]!.matchAll(/(['"])([^'"]*)\1/g)].map((x) => x[2]!);
    const map: Record<string, string> = {};
    for (let i = 0; i + 1 < pairs.length; i += 2) map[pairs[i]!.toLowerCase()] = pairs[i + 1]!;
    const src = map.src ?? map.movie;
    if (!src) continue;
    out.push({
      type: "flash",
      src: resolve(/\.swf(\?|$)/i.test(src) ? src : src + ".swf", baseUrl),
      width: toInt(map.width),
      height: toInt(map.height),
      flashvars: map.flashvars ? parseQuery(map.flashvars) : {},
      evidence: "AC_FL_RunContent() call",
    });
  }
  return out;
}

function mergeFlashvars(
  paramValue: string | undefined,
  inner: string,
  attrs: Record<string, string>,
): Record<string, string> {
  const raw = paramValue ?? attrs.flashvars ?? embeddedFlashvars(inner);
  return raw ? parseQuery(raw) : {};
}

function embeddedFlashvars(inner: string): string | undefined {
  const m = /<embed\b[^>]*\bflashvars\s*=\s*(['"])([\s\S]*?)\1/i.exec(inner);
  return m?.[2];
}

function parseAttrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) {
    out[m[1]!.toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return out;
}

function parseParams(inner: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<param\b([^>]*?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner))) {
    const a = parseAttrs(m[1]!);
    if (a.name) out[a.name.toLowerCase()] = a.value ?? "";
  }
  return out;
}

function parseQuery(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of s.split("&")) {
    if (!pair) continue;
    const idx = pair.indexOf("=");
    const key = idx >= 0 ? pair.slice(0, idx) : pair;
    const val = idx >= 0 ? pair.slice(idx + 1) : "";
    try {
      out[decodeURIComponent(key)] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function toInt(v: string | undefined | null): number | null {
  if (v === undefined || v === null) return null;
  const m = /(\d+)/.exec(v);
  return m ? parseInt(m[1]!, 10) : null;
}

export function resolve(url: string | null, baseUrl?: string): string | null {
  if (!url) return null;
  if (!baseUrl) return url;
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

function resolveWithCodebase(url: string | null, codebase: string | undefined, baseUrl?: string): string | null {
  if (!url) return null;
  const base = codebase && baseUrl ? resolve(ensureSlash(codebase), baseUrl) ?? baseUrl : baseUrl;
  return resolve(url, base ?? undefined);
}

function ensureSlash(s: string): string {
  return s.endsWith("/") ? s : s + "/";
}

function dedupe(games: EmbeddedGame[]): EmbeddedGame[] {
  const seen = new Set<string>();
  const out: EmbeddedGame[] = [];
  for (const g of games) {
    const key = `${g.type}:${g.src ?? ""}:${g.code ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
  }
  return out;
}
