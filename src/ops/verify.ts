import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GameplayAction, PackageResult, VerifyInteraction, VerifyResult } from "../types.js";
import { Workspace } from "../util/evidence.js";
import { serve } from "./serve.js";
import { defaultInputScript, judgeReachedGameplay } from "./gameplay.js";
import { decodePng, frameActivity, type DecodedImage } from "../util/png.js";
import { encodeGif } from "../util/gif.js";

export interface VerifyOptions {
  kind?: "flash" | "java";
  runtime?: "ruffle" | "cheerpj";
  /** Seconds to observe frames. */
  observeSeconds?: number;
  /** Scripted key presses, each after a delay. Used only without captureGameplay. */
  keys?: { key: string; afterMs: number }[];
  crossOriginIsolation?: boolean;
  /**
   * Run the generic "get past the menu" input script, judge whether gameplay
   * was reached, and (unless disabled) record a short gameplay GIF.
   */
  captureGameplay?: boolean;
  /** Write the gameplay GIF to this path. Defaults to evidence/gameplay.gif. */
  gifPath?: string;
  /** Set false to skip the GIF even when captureGameplay is on. */
  gif?: boolean;
}

interface PlaywrightModule {
  chromium: {
    launch: (opts: { headless: boolean; args?: string[] }) => Promise<Browser>;
  };
}
interface Browser {
  newPage: () => Promise<Page>;
  close: () => Promise<void>;
}
interface Page {
  goto: (url: string, opts?: { waitUntil?: string; timeout?: number }) => Promise<unknown>;
  waitForFunction: (fn: string, arg?: unknown, opts?: { timeout?: number }) => Promise<unknown>;
  evaluate: <T>(fn: string) => Promise<T>;
  screenshot: (opts?: { path?: string }) => Promise<Buffer>;
  keyboard: { press: (key: string) => Promise<void> };
  mouse: { click: (x: number, y: number) => Promise<void> };
  on: (event: string, cb: (msg: { type: () => string; text: () => string }) => void) => void;
  waitForTimeout: (ms: number) => Promise<void>;
  $: (selector: string) => Promise<ElementHandle | null>;
}
interface ElementHandle {
  screenshot: (opts?: { path?: string }) => Promise<Buffer>;
  click: () => Promise<void>;
  boundingBox: () => Promise<{ x: number; y: number; width: number; height: number } | null>;
}

// Hide Ruffle's informational hardware-acceleration modal, which lives in the
// player's shadow DOM, so evidence screenshots show the running game.
const DISMISS_OVERLAYS =
  "(function(){document.querySelectorAll('*').forEach(function(el){if(el.shadowRoot){var m=el.shadowRoot.getElementById&&el.shadowRoot.getElementById('hardware-acceleration-modal');if(m)m.classList.add('hidden');}});return true;})()";

async function loadPlaywright(): Promise<PlaywrightModule | null> {
  try {
    return (await import("playwright")) as unknown as PlaywrightModule;
  } catch {
    return null;
  }
}

/**
 * Open the packaged site in headless Chromium and gather evidence: whether the
 * game started, console errors, runtime warnings (unimplemented features),
 * whether the stage draws non-blank and changing frames, fps, response to a
 * scripted click and key presses, and screenshots. With captureGameplay on, it
 * also runs the generic input script, judges whether gameplay was reached, and
 * records a short gameplay GIF.
 */
export async function verify(workspaceRoot: string, options: VerifyOptions = {}): Promise<VerifyResult> {
  const ws = new Workspace(workspaceRoot);
  await ws.ensure();
  const shotsDir = path.join(ws.evidenceDir, "screenshots");
  await mkdir(shotsDir, { recursive: true });

  const pkg = await ws.readJson<PackageResult>("package.json");
  const kind: "flash" | "java" = options.kind ?? (pkg?.kind === "java" ? "java" : "flash");
  const runtime = options.runtime ?? pkg?.runtime ?? (kind === "flash" ? "ruffle" : "cheerpj");

  const pw = await loadPlaywright();
  if (!pw) {
    const result = baseResult(kind, runtime);
    result.notes.push("Playwright is not installed. Run `npm i playwright` and `npx playwright install chromium` to enable verify.");
    await ws.writeJson("verify.json", result);
    return result;
  }

  const server = await serve(ws.siteDir, { crossOriginIsolation: options.crossOriginIsolation });
  const browser = await pw.chromium.launch({ headless: true });
  const consoleErrors: string[] = [];

  try {
    const page = await browser.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (msg: unknown) => consoleErrors.push(String((msg as { message?: string }).message ?? msg)));

    const result = baseResult(kind, runtime);
    result.consoleErrors = consoleErrors;
    await page.goto(server.url, { waitUntil: "load", timeout: 30000 });

    const startedTimeout = kind === "java" ? 45000 : 30000;
    await page
      .waitForFunction("window.__wr && window.__wr.started === true", undefined, { timeout: startedTimeout })
      .then(() => {
        result.started = true;
      })
      .catch(() => {
        result.notes.push(`Runtime did not report started within ${startedTimeout / 1000}s.`);
      });

    // Ruffle shows an informational "hardware acceleration disabled" modal when
    // Chromium renders WebGL in software (common in headless). The movie runs
    // behind it; hide it so the screenshots show the game, not the notice. This
    // only touches the verify run, never the packaged page users ship.
    await page.evaluate<boolean>(DISMISS_OVERLAYS).catch(() => false);

    const startShot = path.join(shotsDir, "start.png");
    const startBuf = await shootStage(page, startShot);
    result.screenshots.push(startShot);

    if (options.captureGameplay) {
      await runGameplayCapture(page, result, options, pkg, shotsDir);
    } else {
      await runBasicInteraction(page, result, options);
    }

    await page.evaluate<boolean>(DISMISS_OVERLAYS).catch(() => false);
    const endShot = path.join(shotsDir, "end.png");
    const endBuf = await shootStage(page, endShot);
    result.screenshots.push(endShot);

    const SOLID_PNG_MAX = 2500;
    const changed = startBuf !== null && endBuf !== null && !startBuf.equals(endBuf);
    const hasContent = (startBuf?.length ?? 0) > SOLID_PNG_MAX || (endBuf?.length ?? 0) > SOLID_PNG_MAX;
    result.canvasChanged = changed;
    result.canvasNonBlank = changed || hasContent;
    if (changed) result.notes.push("Stage content changed across the observation window.");

    result.warnings = await page.evaluate<string[]>("window.__wr.warnings").catch(() => []);
    result.runtimeWarnings = result.warnings.filter((w) => /unimplemented|unsupported|not implemented|stub/i.test(w));
    result.metadata = await page.evaluate<Record<string, unknown> | null>("window.__wr.metadata").catch(() => null);

    result.ok = result.started && result.canvasNonBlank && consoleErrors.length === 0;
    await ws.writeJson("verify.json", result);
    return result;
  } finally {
    await browser.close();
    await server.close();
  }
}

/** The original lightweight path: click the stage, press a few keys, observe frames. */
async function runBasicInteraction(page: Page, result: VerifyResult, options: VerifyOptions): Promise<void> {
  const stage = await page.$("#wr-stage");
  if (stage) {
    await stage.click().catch(() => undefined);
    result.interactions.push({ kind: "click", detail: "#wr-stage" });
  }
  const keys = options.keys ?? [
    { key: "Space", afterMs: 300 },
    { key: "ArrowRight", afterMs: 300 },
  ];
  for (const step of keys) {
    await page.waitForTimeout(step.afterMs);
    await page.keyboard.press(step.key).catch(() => undefined);
    result.interactions.push({ kind: "key", detail: step.key });
  }

  const observeMs = (options.observeSeconds ?? 3) * 1000;
  const framesBefore = await page.evaluate<number>("window.__wr.frames");
  const t0 = Date.now();
  await page.waitForTimeout(observeMs);
  const framesAfter = await page.evaluate<number>("window.__wr.frames");
  const elapsed = Date.now() - t0;
  result.frames = framesAfter - framesBefore;
  result.fps = elapsed > 0 ? Math.round((result.frames / elapsed) * 1000 * 10) / 10 : null;
  result.durationMs = elapsed;
}

/**
 * Sample the idle title, run the generic input script, sample again, judge
 * whether gameplay was reached, and encode a short GIF of the run. The GIF
 * spans the whole short clip (the title, the input, then what the stage does
 * after), so it is representative whether or not gameplay was reached, and it
 * captures the title-to-gameplay transition when there is one. The judgment,
 * though, uses only the idle-versus-post comparison. One browser session, one
 * stage, so the GIF is the same run that was judged.
 */
async function runGameplayCapture(
  page: Page,
  result: VerifyResult,
  options: VerifyOptions,
  pkg: PackageResult | null,
  shotsDir: string,
): Promise<void> {
  const stage = await page.$("#wr-stage");
  const box = stage ? await stage.boundingBox().catch(() => null) : null;
  const width = pkg?.stage?.width ?? Math.round(box?.width ?? 640);
  const height = pkg?.stage?.height ?? Math.round(box?.height ?? 480);

  const framesBefore = await page.evaluate<number>("window.__wr.frames").catch(() => 0);
  const t0 = Date.now();

  // Frames for the GIF are gathered across the whole run.
  const gifFrames: DecodedImage[] = [];

  // Idle baseline: what the title does on its own, before any input.
  const idle = await sampleActivity(page, stage, 6, 110, gifFrames);

  // The generic input script: click the stage and likely button spots, then
  // press the keys games use to start or move. Give the stage focus first.
  if (stage) {
    await stage.click().catch(() => undefined);
    result.interactions.push({ kind: "click", detail: "#wr-stage (focus)" });
  }
  const script = defaultInputScript(width, height);
  for (const action of script) {
    if (action.kind === "click" && box) {
      await page.mouse.click(box.x + action.x, box.y + action.y).catch(() => undefined);
      result.interactions.push({ kind: "click", detail: `${action.label} (${action.x},${action.y})` });
    } else if (action.kind === "key") {
      await page.keyboard.press(action.key).catch(() => undefined);
      result.interactions.push({ kind: "key", detail: action.key });
    }
    await page.waitForTimeout(140);
  }

  // Post-input: sample activity and keep the decoded frames for the GIF.
  const post = await sampleActivity(page, stage, 24, 110, gifFrames);

  const framesAfter = await page.evaluate<number>("window.__wr.frames").catch(() => 0);
  const elapsed = Date.now() - t0;
  result.frames = framesAfter - framesBefore;
  result.fps = elapsed > 0 ? Math.round((result.frames / elapsed) * 1000 * 10) / 10 : null;
  result.durationMs = elapsed;

  const judgment = judgeReachedGameplay(idle, post);
  result.gameplay = judgment;
  result.notes.push(
    `Gameplay judgment: ${judgment.reached ? "reached gameplay" : "boots only"} (idle ${judgment.idleActivity}, post-input ${judgment.postInputActivity}). ${judgment.reason}`,
  );

  if (options.gif !== false && gifFrames.length >= 2) {
    try {
      const gifPath = options.gifPath ?? path.join(shotsDir, "gameplay.gif");
      const gif = encodeGif(gifFrames, { delayMs: 110, maxWidth: 360 });
      await writeFile(gifPath, gif);
      result.gifPath = gifPath;
      result.notes.push(`Recorded gameplay GIF (${gifFrames.length} frames, ${Math.round(gif.length / 1024)} KB).`);
    } catch (err) {
      result.notes.push(`GIF capture failed: ${String(err instanceof Error ? err.message : err)}`);
    }
  }
}

/**
 * Take `count` stage screenshots `gapMs` apart and return the per-frame
 * activity (fraction of pixels changed since the previous frame). When a
 * `collect` array is given, each decoded frame is pushed into it for the GIF.
 */
async function sampleActivity(
  page: Page,
  stage: ElementHandle | null,
  count: number,
  gapMs: number,
  collect?: DecodedImage[],
): Promise<number[]> {
  const activity: number[] = [];
  let prev: DecodedImage | null = null;
  for (let i = 0; i < count; i++) {
    await page.evaluate<boolean>(DISMISS_OVERLAYS).catch(() => false);
    let buf: Buffer | null = null;
    try {
      buf = stage ? await stage.screenshot() : await page.screenshot();
    } catch {
      buf = null;
    }
    if (buf) {
      try {
        const img = decodePng(buf);
        if (collect) collect.push(img);
        if (prev) activity.push(frameActivity(prev, img));
        prev = img;
      } catch {
        // A frame that will not decode is skipped; the rest still inform the judgment.
      }
    }
    await page.waitForTimeout(gapMs);
  }
  return activity;
}

function baseResult(kind: "flash" | "java", runtime: "ruffle" | "cheerpj"): VerifyResult {
  return {
    ok: false,
    kind,
    runtime,
    started: false,
    consoleErrors: [],
    runtimeWarnings: [],
    canvasNonBlank: false,
    canvasChanged: false,
    frames: 0,
    fps: null,
    durationMs: 0,
    interactions: [],
    metadata: null,
    screenshots: [],
    notes: [],
    warnings: [],
    gameplay: null,
    gifPath: null,
  };
}

/** Screenshot the stage element, falling back to the full page. */
async function shootStage(page: Page, file: string): Promise<Buffer | null> {
  const el = await page.$("#wr-stage");
  if (el) return el.screenshot({ path: file }).catch(() => null);
  await page.screenshot({ path: file });
  return null;
}

// Re-export for type consumers.
export type { VerifyInteraction, GameplayAction };
