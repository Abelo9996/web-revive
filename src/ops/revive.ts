import { existsSync } from "node:fs";
import { open, readdir } from "node:fs/promises";
import path from "node:path";
import type { DownloadedFile, EmbeddedGame, FindResult, InspectReport, ReviveResult, RuntimeInfo } from "../types.js";
import { Workspace } from "../util/evidence.js";
import { find } from "./find.js";
import { inspect } from "./inspect.js";
import { fetchRuntime } from "./runtime.js";
import { packageSite } from "./package.js";
import { verify } from "./verify.js";
import { report } from "./report.js";
import { describeOfflineLimits } from "./serverdeps.js";
import { isWaybackUrl, toRawWaybackUrl } from "../parsers/wayback.js";

export interface ReviveOptions {
  /** Workspace directory. Defaults to .web-revive/<name> under the cwd. */
  outDir?: string;
  /** Seconds to observe frames during verify. */
  observeSeconds?: number;
  /** Page title and report title. */
  title?: string;
  /** Skip the gameplay GIF. */
  noGif?: boolean;
  /** Runtime cache root (tests pass a temp dir). */
  cacheRoot?: string;
  /** Called with a human-readable line as each step happens. */
  onEvent?: (msg: string) => void;
}

const LICENSE_NAMES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING", "COPYING.md", "License.md"];

function isUrl(source: string): boolean {
  return /^https?:\/\//i.test(source);
}

function deriveName(source: string): string {
  let base: string;
  if (isUrl(source)) {
    const ref = isWaybackUrl(source) ? toRawWaybackUrl(source) : source;
    try {
      const u = new URL(ref);
      base = path.basename(u.pathname) || u.hostname;
    } catch {
      base = "game";
    }
  } else {
    base = path.basename(source);
  }
  base = base.replace(/\.(swf|jar|class|html?)$/i, "");
  return base.replace(/[^A-Za-z0-9._-]/g, "-").replace(/^-+|-+$/g, "") || "game";
}

async function retry<T>(label: string, attempts: number, emit: (m: string) => void, fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let n = 1; n <= attempts; n++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (n < attempts) emit(`${label} failed (attempt ${n}/${attempts}): ${errMsg(err)}; retrying`);
    }
  }
  throw last;
}

function errMsg(err: unknown): string {
  return String(err instanceof Error ? err.message : err);
}

/**
 * Choose the real game among the recovered files. A dead page often yields more
 * than one `.swf`: a tiny sitelock wrapper or an error stub alongside the actual
 * movie. Prefer files whose first bytes are a real SWF/JAR/class header, then
 * the largest, so a 3 KB protection stub never wins over the 180 KB game.
 */
async function pickGameFile(downloaded: DownloadedFile[]): Promise<DownloadedFile | null> {
  const games = downloaded.filter((d) => /\.(swf|jar|class)$/i.test(d.path));
  const pool = games.length ? games : downloaded;
  if (pool.length === 0) return null;
  const scored = await Promise.all(pool.map(async (d) => ({ d, valid: await hasGameMagic(d.path) })));
  const valid = scored.filter((s) => s.valid).map((s) => s.d);
  const ranked = [...(valid.length ? valid : pool)].sort((a, b) => b.bytes - a.bytes);
  return ranked[0] ?? null;
}

async function hasGameMagic(file: string): Promise<boolean> {
  let fh: Awaited<ReturnType<typeof open>> | null = null;
  try {
    fh = await open(file, "r");
    const { buffer, bytesRead } = await fh.read(Buffer.alloc(4), 0, 4, 0);
    if (bytesRead < 4) return false;
    const sig3 = buffer.toString("latin1", 0, 3);
    if (sig3 === "FWS" || sig3 === "CWS" || sig3 === "ZWS") return true; // SWF
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) return true; // PK: zip/jar
    if (buffer[0] === 0xca && buffer[1] === 0xfe && buffer[2] === 0xba && buffer[3] === 0xbe) return true; // class
    return false;
  } catch {
    return false;
  } finally {
    await fh?.close();
  }
}

async function findLicenseNear(gameFile: string): Promise<string | null> {
  const dir = path.dirname(gameFile);
  if (!existsSync(dir)) return null;
  const entries = await readdir(dir).catch(() => [] as string[]);
  const lower = new Map(entries.map((e) => [e.toLowerCase(), e]));
  for (const name of LICENSE_NAMES) {
    const hit = lower.get(name.toLowerCase());
    if (hit) return path.join(dir, hit);
  }
  return null;
}

/**
 * The one-command revival: find the game (on the live page, or recovered from
 * the Internet Archive), inspect it for a runtime verdict, fetch Ruffle or
 * CheerpJ, package a self-contained static site, then open it in headless
 * Chrome to prove it runs, get past the title screen, and record a gameplay
 * GIF. Returns a playable result with the report, or an honest blocker naming
 * why it could not. The caller starts the preview server.
 */
export async function revive(source: string, options: ReviveOptions = {}): Promise<ReviveResult> {
  const emit = options.onEvent ?? (() => {});
  const startedAt = Date.now();
  const name = deriveName(source);
  const root = path.resolve(options.outDir ?? path.join(process.cwd(), ".web-revive", name));
  const ws = new Workspace(root);
  await ws.ensure();

  const base: ReviveResult = {
    ok: false,
    workspace: root,
    siteDir: null,
    url: null,
    kind: "unknown",
    runtime: "none",
    stage: null,
    fps: null,
    durationMs: 0,
    gifPath: null,
    offlineLimits: [],
    blocker: null,
    report: null,
  };
  const done = (r: ReviveResult): ReviveResult => {
    r.durationMs = Date.now() - startedAt;
    return r;
  };
  const bail = (blocker: string): ReviveResult => done({ ...base, ok: false, blocker });

  // Resolve the game file. For a URL we run find (live, then the archive); for a
  // local file we inspect it in place.
  let gameFile: string;
  let sourceUrl: string | null = null;
  let captureTimestamp: string | null = null;
  let embedded: EmbeddedGame | null = null;

  if (isUrl(source)) {
    const findSource = isWaybackUrl(source) ? toRawWaybackUrl(source) : source;
    if (findSource !== source) emit(`normalized archive URL to its raw capture form`);
    emit(`find ${findSource}`);
    let findResult: FindResult;
    try {
      findResult = await retry("find", 3, emit, () => find(findSource, { saveDir: ws.gameDir }));
    } catch (err) {
      return bail(`could not reach the source or the Internet Archive: ${errMsg(err)}`);
    }
    await ws.writeJson("find.json", findResult);
    sourceUrl = isWaybackUrl(source) ? parseOriginal(source) : source;

    const picked = await pickGameFile(findResult.downloaded);
    // Match the embed metadata (size, flashvars) to the file actually chosen.
    embedded =
      findResult.games.find((g) => picked && g.src === picked.requestedUrl) ??
      findResult.games.find((g) => picked && path.basename(g.src ?? "") === path.basename(picked.path)) ??
      findResult.games[0] ??
      null;
    if (!picked) {
      const reason = findResult.games.length
        ? "the game was located but its file was not found live or in any Internet Archive capture"
        : "no embedded Flash or Java game was found on the page, live or archived";
      return bail(reason);
    }
    gameFile = picked.path;
    captureTimestamp = picked.captureTimestamp;
    emit(`recovered ${path.basename(gameFile)} (${picked.bytes} bytes)${captureTimestamp ? `, capture ${captureTimestamp}` : ""}`);
  } else {
    gameFile = path.resolve(source);
    if (!existsSync(gameFile)) return bail(`file not found: ${gameFile}`);
  }

  // Inspect.
  emit(`inspect ${path.basename(gameFile)}`);
  let report0: InspectReport;
  try {
    report0 = await inspect(gameFile);
  } catch (err) {
    return bail(`could not inspect the file: ${errMsg(err)}`);
  }
  await ws.writeJson("inspect.json", report0);
  base.kind = report0.kind;
  base.runtime = report0.runtime;
  base.offlineLimits = describeOfflineLimits(report0);

  if (report0.compatibility === "not-supported" || report0.kind === "unknown") {
    const block = report0.findings.find((f) => f.severity === "block");
    const reason = block ? `${block.what}: ${block.reason}` : "this file is not a Flash or Java game this tool can revive";
    emit(`not supported: ${reason}`);
    base.blocker = reason;
    base.report = await writeReport(ws, options.title ?? name, base.offlineLimits);
    return done(base);
  }

  // Runtime.
  const runtimeKind = report0.kind === "flash" ? "ruffle" : "cheerpj";
  emit(`runtime ${runtimeKind}`);
  let runtimeInfo: RuntimeInfo;
  try {
    runtimeInfo = await retry("runtime", 3, emit, () => fetchRuntime(runtimeKind, { cacheRoot: options.cacheRoot }));
  } catch (err) {
    return bail(`could not fetch the ${runtimeKind} runtime: ${errMsg(err)}`);
  }
  await ws.writeJson("runtime.json", runtimeInfo);

  // Package.
  emit(`package`);
  const licenseFile = await findLicenseNear(gameFile);
  const stage = report0.swf?.stage;
  try {
    await packageSite(root, {
      gameFile,
      kind: report0.kind === "java" ? "java" : "flash",
      title: options.title ?? name,
      width: embedded?.width ?? (stage ? Math.round(stage.widthPx) : null),
      height: embedded?.height ?? (stage ? Math.round(stage.heightPx) : null),
      flashvars: embedded?.flashvars,
      appletClass: report0.java?.appletClasses[0] ?? embedded?.code ?? null,
      mainClass: report0.java?.mainClass ?? null,
      sourceUrl,
      captureTimestamp,
      licenseFile: licenseFile ?? undefined,
      rufflePath: runtimeInfo.kind === "ruffle" ? runtimeInfo.cacheDir : undefined,
      cheerpjLoaderUrl: runtimeInfo.kind === "cheerpj" ? runtimeInfo.loaderUrl : undefined,
      cheerpjVersion: runtimeInfo.kind === "cheerpj" ? runtimeInfo.version : undefined,
      cheerpjLicenseNote: runtimeInfo.kind === "cheerpj" ? runtimeInfo.licenseNote : undefined,
    });
  } catch (err) {
    return bail(`could not package the site: ${errMsg(err)}`);
  }
  base.siteDir = ws.siteDir;

  // Verify, with the input script and gameplay GIF.
  emit(`verify (headless Chrome, input script, GIF)`);
  const v = await verify(root, {
    observeSeconds: options.observeSeconds ?? 4,
    captureGameplay: true,
    gif: !options.noGif,
  });
  base.fps = v.fps;
  base.gifPath = v.gifPath;
  base.stage = v.gameplay?.reached ? "gameplay" : v.started && v.canvasNonBlank ? "boots" : null;
  base.ok = v.started && v.canvasNonBlank;

  if (base.ok) {
    emit(`${base.stage === "gameplay" ? "reached gameplay" : "boots and animates"}${v.fps != null ? ` at ${v.fps} fps` : ""}`);
  } else {
    base.blocker = v.notes.join(" ") || "the game did not start or the stage stayed blank; see the report";
    emit(`did not run: ${base.blocker}`);
  }

  base.report = await writeReport(ws, options.title ?? name, base.offlineLimits);
  return done(base);
}

function parseOriginal(waybackUrl: string): string {
  const raw = toRawWaybackUrl(waybackUrl);
  const m = /web\.archive\.org\/web\/\d+id_\/(.+)$/.exec(raw);
  return m ? m[1]! : waybackUrl;
}

async function writeReport(ws: Workspace, title: string, offlineLimits: string[]): Promise<{ md: string; json: string }> {
  return report(ws.root, { title, limits: offlineLimits });
}
