import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { FindResult, InspectReport, PackageResult, RuntimeInfo, VerifyResult } from "../types.js";
import { Workspace } from "../util/evidence.js";

export interface ReportInput {
  title: string;
  limits?: string[];
}

export interface ReportBundle {
  title: string;
  generatedAt: string;
  find: FindResult | null;
  inspect: InspectReport | null;
  runtime: RuntimeInfo | null;
  package: PackageResult | null;
  verify: VerifyResult | null;
  limits: string[];
  commands: ReturnType<Workspace["getCommands"]>;
}

export async function report(workspaceRoot: string, input: ReportInput): Promise<{ md: string; json: string }> {
  const ws = new Workspace(workspaceRoot);
  await ws.ensure();

  const bundle: ReportBundle = {
    title: input.title,
    generatedAt: new Date().toISOString(),
    find: await ws.readJson<FindResult>("find.json"),
    inspect: await ws.readJson<InspectReport>("inspect.json"),
    runtime: await ws.readJson<RuntimeInfo>("runtime.json"),
    package: await ws.readJson<PackageResult>("package.json"),
    verify: await ws.readJson<VerifyResult>("verify.json"),
    limits: input.limits ?? [],
    commands: ws.getCommands(),
  };

  const jsonPath = path.join(ws.evidenceDir, "report.json");
  await writeFile(jsonPath, JSON.stringify(bundle, null, 2));
  const mdPath = path.join(ws.evidenceDir, "report.md");
  await writeFile(mdPath, renderMarkdown(bundle));
  return { md: mdPath, json: jsonPath };
}

function renderMarkdown(b: ReportBundle): string {
  const L: string[] = [];
  L.push(`# Revival report: ${b.title}`, "");
  L.push(`Generated ${b.generatedAt}`, "");

  if (b.find) {
    L.push("## Source", "");
    L.push(`- Input: ${b.find.source}`);
    L.push(`- Page reached: ${b.find.pageFetched ? "yes" : "no"} (live: ${b.find.pageLive ? "yes" : "no"})`);
    for (const g of b.find.games) {
      L.push(`- Found ${g.type} game: ${g.src ?? g.code ?? "unknown"} (${g.evidence})`);
    }
    if (b.find.pageCaptures.length) {
      L.push("", "Page captures (Internet Archive):");
      for (const c of b.find.pageCaptures.slice(0, 5)) L.push(`- ${c.timestamp} status ${c.statusCode} ${c.originalUrl}`);
    }
    for (const a of b.find.assetCaptures) {
      L.push("", `Captures of ${a.requested}:`);
      for (const c of a.captures.slice(0, 5)) L.push(`- ${c.timestamp} status ${c.statusCode} (${c.mimetype})`);
    }
    if (b.find.downloaded.length) {
      L.push("", "Downloaded files:");
      for (const d of b.find.downloaded) {
        L.push(`- ${path.basename(d.path)} ${d.bytes} bytes, sha256 ${d.sha256}${d.captureTimestamp ? ", capture " + d.captureTimestamp : ""}`);
      }
    }
    L.push("");
  }

  if (b.inspect) {
    L.push("## Compatibility", "");
    L.push(`- Kind: ${b.inspect.kind}`);
    L.push(`- Runtime: ${b.inspect.runtime}`);
    L.push(`- Verdict: ${b.inspect.compatibility}`);
    if (b.inspect.swf) {
      const s = b.inspect.swf;
      L.push(`- SWF: ${s.signature} v${s.version}, ActionScript ${s.actionScript}${s.stage ? `, stage ${s.stage.widthPx}x${s.stage.heightPx}` : ""}${s.frameRate ? `, ${s.frameRate} fps, ${s.frameCount} frames` : ""}`);
      if (s.externalRefs.length) L.push(`- External references: ${s.externalRefs.slice(0, 8).join(", ")}`);
    }
    if (b.inspect.java) {
      const j = b.inspect.java;
      L.push(`- Java: ${j.javaVersion ?? "version unknown"}, ${j.classCount} classes${j.appletClasses.length ? `, applet ${j.appletClasses.join(", ")}` : ""}${j.mainClass ? `, Main-Class ${j.mainClass}` : ""}`);
    }
    L.push("", "Findings:");
    for (const f of b.inspect.findings) L.push(`- [${f.severity}] ${f.what}: ${f.reason}`);
    for (const n of b.inspect.notes) L.push(`- note: ${n}`);
    L.push("");
  }

  if (b.runtime) {
    L.push("## Runtime", "");
    if (b.runtime.kind === "ruffle") {
      L.push(`- Ruffle release: ${b.runtime.releaseTag ?? "unknown"}`);
      L.push(`- Asset: ${b.runtime.assetName ?? "unknown"}`);
      if (b.runtime.sha256) L.push(`- SHA-256: ${b.runtime.sha256}`);
    } else {
      L.push(`- CheerpJ loader: ${b.runtime.loaderUrl} (version ${b.runtime.version})`);
      if (b.runtime.licenseNote) L.push(`- ${b.runtime.licenseNote}`);
    }
    for (const n of b.runtime.notes) L.push(`- note: ${n}`);
    L.push("");
  }

  if (b.package) {
    L.push("## Package", "");
    L.push(`- Site: ${b.package.siteDir}`);
    L.push(`- Runtime: ${b.package.runtime}`);
    if (b.package.stage) L.push(`- Stage: ${b.package.stage.width}x${b.package.stage.height}`);
    L.push(`- Files: ${b.package.files.join(", ")}`);
    L.push("");
  }

  if (b.verify) {
    L.push("## Verification", "");
    L.push(`- Result: ${b.verify.ok ? "pass" : "fail"}`);
    L.push(`- Started: ${b.verify.started ? "yes" : "no"}`);
    L.push(`- Stage non-blank: ${b.verify.canvasNonBlank ? "yes" : "no"} (changed: ${b.verify.canvasChanged ? "yes" : "no"})`);
    L.push(`- Frames: ${b.verify.frames}${b.verify.fps !== null ? `, ${b.verify.fps} fps` : ""} over ${b.verify.durationMs} ms`);
    if (b.verify.gameplay) {
      const g = b.verify.gameplay;
      L.push(`- Reached: ${g.reached ? "gameplay" : "boots only"} (idle activity ${g.idleActivity}, post-input ${g.postInputActivity})`);
      L.push(`  - ${g.reason}`);
    }
    if (b.verify.gifPath) L.push(`- Gameplay GIF: ${path.basename(b.verify.gifPath)}`);
    if (b.verify.interactions.length) L.push(`- Interactions: ${b.verify.interactions.map((i) => `${i.kind}:${i.detail}`).join(", ")}`);
    if (b.verify.runtimeWarnings.length) {
      L.push("", "Runtime warnings (unimplemented features):");
      for (const w of b.verify.runtimeWarnings.slice(0, 15)) L.push(`- ${w}`);
    }
    if (b.verify.consoleErrors.length) {
      L.push("", "Console errors:");
      for (const e of b.verify.consoleErrors.slice(0, 15)) L.push(`- ${e}`);
    }
    if (b.verify.screenshots.length) L.push("", `Screenshots: ${b.verify.screenshots.map((s) => path.basename(s)).join(", ")}`);
    L.push("");
  }

  if (b.limits.length) {
    L.push("## Limits", "");
    for (const l of b.limits) L.push(`- ${l}`);
    L.push("");
  }

  L.push("## Commands run", "");
  for (const c of b.commands) {
    L.push(`- [${c.label}] exit ${c.exitCode}, ${c.durationMs} ms: \`${truncate(c.command, 160)}\``);
  }
  L.push("");
  return L.join("\n");
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "...";
}
