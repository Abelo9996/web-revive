import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CompatFinding, InspectReport, JavaInfo, SwfInfo } from "../types.js";
import { parseSwf } from "../parsers/swf.js";
import { isClassFile, isZip, parseClassFile, parseJar } from "../parsers/jar.js";
import { httpGet } from "../util/http.js";

export interface InspectOptions {
  timeoutMs?: number;
}

/** Inspect a local .swf/.jar/.class file or a direct URL to one. */
export async function inspect(source: string, options: InspectOptions = {}): Promise<InspectReport> {
  const { bytes, path: resolvedPath } = await load(source, options.timeoutMs ?? 30000);
  const sig = bytes.subarray(0, 3).toString("latin1");

  if (sig === "FWS" || sig === "CWS" || sig === "ZWS") {
    return flashReport(source, resolvedPath, parseSwf(bytes));
  }
  if (isZip(bytes)) {
    return javaReport(source, resolvedPath, parseJar(bytes));
  }
  if (isClassFile(bytes)) {
    return javaReport(source, resolvedPath, parseClassFile(bytes, path.basename(resolvedPath)));
  }

  return {
    source,
    path: resolvedPath,
    kind: "unknown",
    swf: null,
    java: null,
    runtime: "none",
    compatibility: "not-supported",
    findings: [
      {
        what: "Unrecognized file",
        reason: "Not a SWF (FWS/CWS/ZWS), a JAR/ZIP, or a Java class file. This MVP revives Flash and Java games.",
        severity: "block",
      },
    ],
    notes: [],
  };
}

async function load(source: string, timeoutMs: number): Promise<{ bytes: Buffer; path: string }> {
  if (/^https?:\/\//i.test(source)) {
    const res = await httpGet(source, { timeoutMs });
    if (!res.ok) throw new Error(`could not download ${source}: HTTP ${res.status}`);
    return { bytes: res.body, path: source };
  }
  const resolved = path.resolve(source);
  return { bytes: await readFile(resolved), path: resolved };
}

function flashReport(source: string, filePath: string, swf: SwfInfo): InspectReport {
  const findings: CompatFinding[] = [];
  const notes: string[] = [];

  if (swf.actionScript === "AS1/AS2") {
    findings.push({
      what: "ActionScript 1/2 movie",
      reason: "Ruffle's AS1/AS2 support is substantially more complete than its AS3 support, so this is the stronger case.",
      severity: "ok",
    });
  } else if (swf.actionScript === "AS3") {
    findings.push({
      what: "ActionScript 3 movie",
      reason: "Ruffle's AS3 support is partial. Many AS3 movies run, but some features are unimplemented. Confirm with verify.",
      severity: "warn",
    });
  } else {
    findings.push({
      what: "ActionScript version unknown",
      reason: "No ActionScript tags were found, or the body could not be read. Behavior in Ruffle is unconfirmed until verify.",
      severity: "warn",
    });
  }

  if (!swf.bodyParsed) {
    notes.push("Body is LZMA-compressed (ZWS) and was not decompressed, so stage size and tags were not read. Ruffle can still load it.");
  }

  const sockets = swf.externalRefs.filter((r) => /Socket/.test(r));
  if (sockets.length) {
    findings.push({
      what: "Uses sockets",
      reason: "The movie references XMLSocket/Socket. Browsers have no raw TCP sockets, so socket connections will not work.",
      severity: "warn",
    });
  }
  const loads = swf.externalRefs.filter((r) => /(loadMovie|loadVariables|URLLoader|URLRequest|\.swf|\.xml|https?:\/\/)/.test(r));
  if (loads.length) {
    findings.push({
      what: "Loads external files",
      reason: "The movie pulls in other files at runtime (other SWFs, XML, or server calls). Those must be present too, or captured from the archive.",
      severity: "warn",
    });
  }

  const hasWarn = findings.some((f) => f.severity === "warn");
  return {
    source,
    path: filePath,
    kind: "flash",
    swf,
    java: null,
    runtime: "ruffle",
    compatibility: hasWarn ? "may-have-problems" : "likely",
    findings,
    notes,
  };
}

function javaReport(source: string, filePath: string, java: JavaInfo): InspectReport {
  const findings: CompatFinding[] = [];
  const notes: string[] = [];

  if (java.usesNativeLibs) {
    findings.push({
      what: "Uses native libraries (JNI)",
      reason: `Native code cannot run in the browser. ${java.nativeLibEntries.length ? "Bundled: " + java.nativeLibEntries.join(", ") + ". " : ""}CheerpJ runs JVM bytecode only.`,
      severity: "block",
    });
  }

  const runnable = java.appletClasses.length > 0 || java.mainClass !== null || java.entryClasses.length > 0;
  if (!runnable) {
    findings.push({
      what: "No entry point found",
      reason: "No applet class (extends Applet/JApplet), no Main-Class in the manifest, and no main() method. This looks like a library, not a runnable game.",
      severity: "block",
    });
  }

  if (java.appletClasses.length) {
    findings.push({
      what: "Java applet",
      reason: "Extends Applet/JApplet. CheerpJ runs applets through its <applet> tag support on Java 8.",
      severity: "ok",
    });
  } else if (runnable) {
    findings.push({
      what: "Java application (not an applet)",
      reason: "Has a main() entry point. CheerpJ can run it with cheerpjRunMain/cheerpjRunJar and a created display.",
      severity: "ok",
    });
  }

  if (java.maxMajor !== null && java.maxMajor > 52) {
    findings.push({
      what: "Targets newer than Java 8",
      reason: `Class files are ${java.javaVersion}. CheerpJ runs applets on Java 8; newer bytecode may not load.`,
      severity: "warn",
    });
  }
  if (java.usesNetworking) {
    findings.push({
      what: "Uses java.net",
      reason: "CheerpJ networking is limited (it needs a Tailscale-based network backend). Online features may not connect.",
      severity: "warn",
    });
  }
  if (java.usesFileAccess) {
    findings.push({
      what: "Reads or writes files",
      reason: "CheerpJ uses a virtual filesystem. Local file paths will not resolve the way they did on the desktop.",
      severity: "warn",
    });
  }

  notes.push("CheerpJ is proprietary software from Leaning Technologies, loaded at runtime from its CDN. Free for personal use; check its license for commercial use.");

  const blocked = findings.some((f) => f.severity === "block");
  const hasWarn = findings.some((f) => f.severity === "warn");
  const compatibility = blocked ? "not-supported" : hasWarn ? "may-have-problems" : "likely";

  return {
    source,
    path: filePath,
    kind: "java",
    swf: null,
    java,
    runtime: blocked && !runnable ? "none" : "cheerpj",
    compatibility,
    findings,
    notes,
  };
}
