/** Shared types used across operations and the evidence bundle. */

export type GameKind = "flash" | "java" | "unknown";
export type RuntimeKind = "ruffle" | "cheerpj" | "none";
export type Compatibility = "likely" | "may-have-problems" | "not-supported";

/** One embedded game located on a page, from an <object>/<embed>/<applet>/swfobject. */
export interface EmbeddedGame {
  type: "flash" | "java";
  /** Resolved absolute URL (or path) to the .swf / .jar / .class, when known. */
  src: string | null;
  width: number | null;
  height: number | null;
  /** Flash: FlashVars parsed into key/value. */
  flashvars?: Record<string, string>;
  /** Java applet: the applet class ("code" attribute). */
  code?: string;
  /** Java applet: jar archives ("archive" attribute, split on commas). */
  archive?: string[];
  /** Java applet: codebase directory. */
  codebase?: string;
  /** Java applet: <param> values. */
  params?: Record<string, string>;
  /** How this game was matched, for the report. */
  evidence: string;
}

/** A single Wayback Machine capture row from the CDX API. */
export interface WaybackCapture {
  timestamp: string;
  originalUrl: string;
  mimetype: string;
  statusCode: string;
  digest: string;
  length: string | null;
  /** The URL that returns the raw original bytes (the id_ form, no rewriting). */
  rawUrl: string;
}

export interface DownloadedFile {
  requestedUrl: string;
  path: string;
  bytes: number;
  sha256: string;
  captureTimestamp: string | null;
}

export interface FindResult {
  source: string;
  pageFetched: boolean;
  pageLive: boolean;
  games: EmbeddedGame[];
  /** Captures of the page itself, best first. */
  pageCaptures: WaybackCapture[];
  /** Captures of each game file we went looking for. */
  assetCaptures: { requested: string; captures: WaybackCapture[] }[];
  downloaded: DownloadedFile[];
  /** Every URL contacted, in order, for the evidence trail. */
  requests: { url: string; note: string; status: number | null }[];
  notes: string[];
}

export interface SwfInfo {
  signature: "FWS" | "CWS" | "ZWS";
  compression: "none" | "zlib" | "lzma";
  version: number;
  fileLength: number;
  stage: { widthPx: number; heightPx: number } | null;
  frameRate: number | null;
  frameCount: number | null;
  actionScript: "AS1/AS2" | "AS3" | "unknown";
  actionScriptEvidence: string | null;
  /** Strings that suggest the movie loads things from outside itself. */
  externalRefs: string[];
  /** True when the body (past the 8-byte header) could be read. */
  bodyParsed: boolean;
}

export interface JavaInfo {
  manifest: Record<string, string>;
  mainClass: string | null;
  appletClasses: string[];
  entryClasses: string[];
  classCount: number;
  maxMajor: number | null;
  javaVersion: string | null;
  usesNetworking: boolean;
  usesFileAccess: boolean;
  usesNativeLibs: boolean;
  nativeLibEntries: string[];
  evidence: string[];
}

export interface CompatFinding {
  what: string;
  reason: string;
  severity: "ok" | "warn" | "block";
}

export interface InspectReport {
  source: string;
  path: string;
  kind: GameKind;
  swf: SwfInfo | null;
  java: JavaInfo | null;
  runtime: RuntimeKind;
  compatibility: Compatibility;
  findings: CompatFinding[];
  notes: string[];
}

export interface RuntimeInfo {
  kind: "ruffle" | "cheerpj";
  cached: boolean;
  /** Ruffle: the GitHub release tag, asset, checksum and cache location. */
  releaseTag?: string;
  assetName?: string;
  assetUrl?: string;
  sha256?: string;
  cacheDir?: string;
  files?: string[];
  /** CheerpJ: the CDN loader and its license terms. */
  loaderUrl?: string;
  version?: string;
  proprietary?: boolean;
  licenseNote?: string;
  notes: string[];
}

export interface PackageResult {
  siteDir: string;
  indexHtml: string;
  files: string[];
  kind: GameKind;
  runtime: "ruffle" | "cheerpj";
  stage: { width: number; height: number } | null;
}

export interface VerifyInteraction {
  kind: "click" | "key";
  detail: string;
}

/** One step of the generic "get past the menu" input script. */
export type GameplayAction =
  | { kind: "click"; x: number; y: number; label: string }
  | { kind: "key"; key: string };

/** The verdict on whether the input script reached gameplay. */
export interface GameplayJudgment {
  reached: boolean;
  reason: string;
  /** Mean fraction of pixels changing per frame before input (idle baseline). */
  idleActivity: number;
  /** Mean fraction of pixels changing per frame after the input script. */
  postInputActivity: number;
}

export interface VerifyResult {
  ok: boolean;
  kind: GameKind;
  runtime: "ruffle" | "cheerpj";
  started: boolean;
  consoleErrors: string[];
  /** All console warnings captured, for evidence. */
  warnings: string[];
  /** The subset of warnings that look like unimplemented-feature notices. */
  runtimeWarnings: string[];
  canvasNonBlank: boolean;
  canvasChanged: boolean;
  frames: number;
  fps: number | null;
  durationMs: number;
  interactions: VerifyInteraction[];
  metadata: Record<string, unknown> | null;
  screenshots: string[];
  notes: string[];
  /** Gameplay judgment, when verify ran the input script. */
  gameplay: GameplayJudgment | null;
  /** Path to the recorded gameplay GIF, when one was captured. */
  gifPath: string | null;
}

/** The result of the one-command `revive`. */
export interface ReviveResult {
  ok: boolean;
  /** The workspace directory holding game/, site/, and evidence/. */
  workspace: string;
  /** The packaged site directory, when packaging succeeded. */
  siteDir: string | null;
  /** The preview URL, when a server was started (not with --no-serve). */
  url: string | null;
  kind: GameKind;
  runtime: RuntimeKind;
  /** "boots" (started and animates) or "gameplay" (reached play) or null. */
  stage: "boots" | "gameplay" | null;
  fps: number | null;
  /** Total wall-clock time for the whole revival, in milliseconds. */
  durationMs: number;
  /** Path to the gameplay GIF, when one was captured. */
  gifPath: string | null;
  /** Plain-language features that will not work offline. */
  offlineLimits: string[];
  /** An honest reason the revival could not complete, when ok is false. */
  blocker: string | null;
  /** Paths to the written report (markdown and json). */
  report: { md: string; json: string } | null;
}

export interface RecordedCommand {
  label: string;
  command: string;
  cwd: string;
  exitCode: number | null;
  durationMs: number;
  stdoutTail: string;
  stderrTail: string;
}
