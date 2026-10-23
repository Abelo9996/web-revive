import { describe, expect, it } from "vitest";
import { describeOfflineLimits } from "../src/ops/serverdeps.js";
import type { InspectReport, SwfInfo, JavaInfo } from "../src/types.js";

function flash(externalRefs: string[]): InspectReport {
  const swf: SwfInfo = {
    signature: "FWS",
    compression: "none",
    version: 8,
    fileLength: 1000,
    stage: { widthPx: 640, heightPx: 480 },
    frameRate: 30,
    frameCount: 100,
    actionScript: "AS1/AS2",
    actionScriptEvidence: null,
    externalRefs,
    bodyParsed: true,
  };
  return { source: "x", path: "x", kind: "flash", swf, java: null, runtime: "ruffle", compatibility: "likely", findings: [], notes: [] };
}

function java(opts: Partial<JavaInfo>): InspectReport {
  const j: JavaInfo = {
    manifest: {},
    mainClass: null,
    appletClasses: ["Game"],
    entryClasses: [],
    classCount: 3,
    maxMajor: 52,
    javaVersion: "Java 8",
    usesNetworking: false,
    usesFileAccess: false,
    usesNativeLibs: false,
    nativeLibEntries: [],
    evidence: [],
    ...opts,
  };
  return { source: "x", path: "x", kind: "java", swf: null, java: j, runtime: "cheerpj", compatibility: "likely", findings: [], notes: [] };
}

describe("describeOfflineLimits", () => {
  it("returns nothing for a self-contained movie", () => {
    expect(describeOfflineLimits(flash([]))).toEqual([]);
  });

  it("flags sockets and server calls separately", () => {
    const limits = describeOfflineLimits(flash(["XMLSocket.connect", "loadVariables", "http://scores.example.com/post"]));
    expect(limits.some((l) => /socket/i.test(l))).toBe(true);
    expect(limits.some((l) => /score saving|logins|leaderboards/i.test(l))).toBe(true);
  });

  it("flags external SWF and XML loads", () => {
    const limits = describeOfflineLimits(flash(["loadMovie:level2.swf", "data.xml"]));
    expect(limits.some((l) => /other SWF/i.test(l))).toBe(true);
    expect(limits.some((l) => /XML/i.test(l))).toBe(true);
  });

  it("flags java networking and file access", () => {
    const limits = describeOfflineLimits(java({ usesNetworking: true, usesFileAccess: true }));
    expect(limits.some((l) => /java\.net|online features/i.test(l))).toBe(true);
    expect(limits.some((l) => /virtual in-browser filesystem/i.test(l))).toBe(true);
  });

  it("is empty for a clean java applet and for null input", () => {
    expect(describeOfflineLimits(java({}))).toEqual([]);
    expect(describeOfflineLimits(null)).toEqual([]);
  });
});
