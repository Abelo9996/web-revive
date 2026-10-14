#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { find } from "./ops/find.js";
import { inspect } from "./ops/inspect.js";
import { fetchRuntime } from "./ops/runtime.js";
import { packageSite, type PackageInput } from "./ops/package.js";
import { serve } from "./ops/serve.js";
import { verify } from "./ops/verify.js";
import { report } from "./ops/report.js";
import { runSetup } from "./setup/setup.js";
import { startMcpServer } from "./mcp/server.js";
import { Workspace } from "./util/evidence.js";
import type { InspectReport, RuntimeInfo } from "./types.js";

const program = new Command();
program.name("web-revive").description("Bring dead Flash and Java web games back to life in a modern browser.").version("0.1.0");

function out(json: boolean, data: unknown, human: () => void): void {
  if (json) process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  else human();
}

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

async function saveTo(workspace: string | undefined, name: string, data: unknown): Promise<void> {
  if (!workspace) return;
  const ws = new Workspace(workspace);
  await ws.ensure();
  await ws.writeJson(name, data);
}

program
  .command("find")
  .argument("<url>", "URL of an old page, or a direct .swf/.jar URL")
  .option("--json", "output JSON", false)
  .option("--save <workspace>", "download the best capture into <workspace>/game and record evidence")
  .option("--limit <n>", "max Internet Archive captures to request per URL", (v) => parseInt(v, 10), 20)
  .action(async (url, opts) => {
    const saveDir = opts.save ? path.join(path.resolve(opts.save), "game") : undefined;
    const r = await find(url, { saveDir, limit: opts.limit });
    await saveTo(opts.save, "find.json", r);
    out(opts.json, r, () => {
      console.log(`Source: ${r.source} (page reached: ${r.pageFetched}, live: ${r.pageLive})`);
      for (const g of r.games) console.log(`  ${g.type}: ${g.src ?? g.code ?? "?"}  [${g.evidence}]`);
      if (r.pageCaptures.length) console.log(`  page captures: ${r.pageCaptures.length} (best ${r.pageCaptures[0]!.timestamp})`);
      for (const a of r.assetCaptures) console.log(`  captures of ${a.requested}: ${a.captures.length}`);
      for (const d of r.downloaded) console.log(`  downloaded ${path.basename(d.path)} (${d.bytes} bytes)`);
      for (const n of r.notes) console.log(`  note: ${n}`);
    });
  });

program
  .command("inspect")
  .argument("<file>", "local .swf/.jar/.class or a direct URL to one")
  .option("--json", "output JSON", false)
  .option("--save <workspace>", "write the report to <workspace>/evidence/inspect.json")
  .action(async (file, opts) => {
    const r = await inspect(file);
    await saveTo(opts.save, "inspect.json", r);
    out(opts.json, r, () => {
      console.log(`Source: ${r.source}`);
      console.log(`Kind: ${r.kind}  Runtime: ${r.runtime}  Compatibility: ${r.compatibility}`);
      if (r.swf) console.log(`SWF: ${r.swf.signature} v${r.swf.version}, ${r.swf.actionScript}${r.swf.stage ? `, stage ${r.swf.stage.widthPx}x${r.swf.stage.heightPx}` : ""}`);
      if (r.java) console.log(`Java: ${r.java.javaVersion ?? "?"}, ${r.java.classCount} classes${r.java.appletClasses.length ? `, applet ${r.java.appletClasses[0]}` : ""}`);
      for (const f of r.findings) console.log(`  [${f.severity}] ${f.what}: ${f.reason}`);
      for (const n of r.notes) console.log(`  note: ${n}`);
    });
  });

program
  .command("runtime")
  .argument("<kind>", "ruffle | cheerpj")
  .option("--json", "output JSON", false)
  .option("--cache <dir>", "cache root (default ~/.web-revive/runtimes)")
  .option("--force", "re-download even if cached", false)
  .option("--save <workspace>", "record the runtime info in <workspace>")
  .action(async (kind, opts) => {
    if (kind !== "ruffle" && kind !== "cheerpj") throw new Error("kind must be ruffle or cheerpj");
    const r = await fetchRuntime(kind, { cacheRoot: opts.cache, force: opts.force });
    await saveTo(opts.save, "runtime.json", r);
    out(opts.json, r, () => {
      console.log(`Runtime: ${r.kind} (cached: ${r.cached})`);
      if (r.kind === "ruffle") {
        console.log(`  release: ${r.releaseTag}`);
        console.log(`  asset: ${r.assetName}`);
        console.log(`  sha256: ${r.sha256}`);
        console.log(`  dir: ${r.cacheDir}`);
      } else {
        console.log(`  loader: ${r.loaderUrl} (version ${r.version})`);
        console.log(`  ${r.licenseNote}`);
      }
      for (const n of r.notes) console.log(`  note: ${n}`);
    });
  });

program
  .command("package")
  .argument("<workspace>", "workspace directory (holds game/ and evidence/)")
  .option("--game <file>", "game file to package (default: the file in <workspace>/game)")
  .option("--kind <kind>", "flash | java (default: from inspect.json)")
  .option("--title <title>", "page title")
  .option("--width <px>", "stage width", (v) => parseInt(v, 10))
  .option("--height <px>", "stage height", (v) => parseInt(v, 10))
  .option("--applet <class>", "Java applet class (code attribute)")
  .option("--main <class>", "Java Main-Class for a non-applet app")
  .option("--source-url <url>", "original page URL for the credits")
  .option("--capture <timestamp>", "Internet Archive capture timestamp for the credits")
  .option("--license <file>", "license file to carry into the site (relative paths are looked up next to the game file first)")
  .option("--ruffle <dir>", "Ruffle build directory (default: cached one from runtime.json)")
  .option("--asset <file>", "extra asset to include (repeatable)", collect, [])
  .option("--json", "output JSON", false)
  .action(async (workspace, opts) => {
    const input = await buildPackageInput(workspace, opts);
    const r = await packageSite(workspace, input);
    out(opts.json, r, () => {
      console.log(`Site: ${r.siteDir}`);
      console.log(`Runtime: ${r.runtime}  Stage: ${r.stage ? `${r.stage.width}x${r.stage.height}` : "default"}`);
      console.log(`Files: ${r.files.join(", ")}`);
    });
  });

program
  .command("serve")
  .argument("<siteDir>", "static site directory")
  .option("--port <port>", "port", (v) => parseInt(v, 10))
  .option("--coi", "add COOP/COEP headers", false)
  .action(async (siteDir, opts) => {
    const handle = await serve(siteDir, { port: opts.port, crossOriginIsolation: opts.coi });
    console.log(`Serving ${siteDir} at ${handle.url}`);
    console.log("Press Ctrl+C to stop.");
    process.on("SIGINT", async () => {
      await handle.close();
      process.exit(0);
    });
  });

program
  .command("verify")
  .argument("<workspace>", "workspace directory")
  .option("--seconds <n>", "seconds to observe frames", (v) => parseInt(v, 10), 3)
  .option("--coi", "add COOP/COEP headers", false)
  .option("--json", "output JSON", false)
  .action(async (workspace, opts) => {
    const r = await verify(workspace, { observeSeconds: opts.seconds, crossOriginIsolation: opts.coi });
    out(opts.json, r, () => {
      console.log(`Verify ${r.ok ? "pass" : "fail"} (${r.kind}/${r.runtime})`);
      console.log(`Started: ${r.started}  Non-blank: ${r.canvasNonBlank}  Frames: ${r.frames}${r.fps !== null ? `, fps ${r.fps}` : ""}`);
      for (const w of r.runtimeWarnings.slice(0, 10)) console.log(`  runtime warning: ${w}`);
      for (const e of r.consoleErrors.slice(0, 10)) console.log(`  console error: ${e}`);
      for (const n of r.notes) console.log(`  note: ${n}`);
    });
    if (!r.ok) process.exitCode = 1;
  });

program
  .command("report")
  .argument("<workspace>", "workspace directory")
  .requiredOption("--title <title>", "report title")
  .option("--limit <text>", "a known limit to state (repeatable)", collect, [])
  .option("--json", "output JSON", false)
  .action(async (workspace, opts) => {
    const r = await report(workspace, { title: opts.title, limits: opts.limit });
    out(opts.json, r, () => {
      console.log("Report written:");
      console.log(`  ${r.md}`);
      console.log(`  ${r.json}`);
    });
  });

program
  .command("setup")
  .description("register the MCP server with Claude Code, Codex, and Cursor")
  .option("--yes", "apply changes (default is a dry run)", false)
  .option("--json", "output JSON", false)
  .action(async (opts) => {
    const r = await runSetup({ apply: opts.yes });
    out(opts.json, r, () => {
      console.log(r.apply ? "Applied setup:" : "Dry run (pass --yes to apply):");
      for (const a of r.actions) console.log(`  [${a.target}] ${a.status}: ${a.detail}`);
    });
  });

program
  .command("mcp")
  .description("run the MCP server over stdio")
  .action(async () => {
    await startMcpServer();
  });

async function buildPackageInput(workspace: string, opts: Record<string, unknown>): Promise<PackageInput> {
  const ws = new Workspace(workspace);
  await ws.ensure();
  const inspectReport = await ws.readJson<InspectReport>("inspect.json");
  const runtimeInfo = await ws.readJson<RuntimeInfo>("runtime.json");

  const gameFile = (opts.game as string | undefined) ?? (await pickGameFile(ws.gameDir));
  if (!gameFile) throw new Error("no game file found; pass --game or run find --save first");

  const kind = ((opts.kind as string | undefined) ?? inspectReport?.kind ?? "flash") as "flash" | "java";
  const stage = inspectReport?.swf?.stage;
  const rufflePath = (opts.ruffle as string | undefined) ?? (runtimeInfo?.kind === "ruffle" ? runtimeInfo.cacheDir : undefined);

  return {
    gameFile,
    kind,
    title: opts.title as string | undefined,
    width: (opts.width as number | undefined) ?? (stage ? Math.round(stage.widthPx) : null),
    height: (opts.height as number | undefined) ?? (stage ? Math.round(stage.heightPx) : null),
    appletClass: (opts.applet as string | undefined) ?? inspectReport?.java?.appletClasses[0] ?? null,
    mainClass: (opts.main as string | undefined) ?? inspectReport?.java?.mainClass ?? null,
    sourceUrl: (opts.sourceUrl as string | undefined) ?? null,
    captureTimestamp: (opts.capture as string | undefined) ?? null,
    licenseFile: opts.license as string | undefined,
    assets: opts.asset as string[],
    rufflePath,
    cheerpjLoaderUrl: runtimeInfo?.kind === "cheerpj" ? runtimeInfo.loaderUrl : undefined,
    cheerpjVersion: runtimeInfo?.kind === "cheerpj" ? runtimeInfo.version : undefined,
    cheerpjLicenseNote: runtimeInfo?.kind === "cheerpj" ? runtimeInfo.licenseNote : undefined,
  };
}

async function pickGameFile(gameDir: string): Promise<string | null> {
  if (!existsSync(gameDir)) return null;
  const entries = await readdir(gameDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && /\.(swf|jar|class)$/i.test(e.name)).map((e) => path.join(gameDir, e.name));
  return files[0] ?? null;
}

program.parseAsync(process.argv).catch((err) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exit(1);
});
