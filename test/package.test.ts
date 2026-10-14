import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { packageSite, resolveLicense } from "../src/ops/package.js";
import { buildSwf, buildZip, fakeClass } from "./fixtures.js";

describe("packageSite", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "wr-pkg-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("builds a Flash site that references the bundled Ruffle and the game", async () => {
    const ruffleDir = path.join(dir, "ruffle-cache");
    await mkdir(ruffleDir, { recursive: true });
    await writeFile(path.join(ruffleDir, "ruffle.js"), "// ruffle");
    const gameFile = path.join(dir, "game.swf");
    await writeFile(gameFile, buildSwf({ stagePx: { width: 320, height: 240 } }));

    const ws = path.join(dir, "work");
    const r = await packageSite(ws, {
      gameFile,
      kind: "flash",
      title: "My Game",
      width: 320,
      height: 240,
      sourceUrl: "https://old.example.com/play.html",
      captureTimestamp: "20080101000000",
      rufflePath: ruffleDir,
    });
    expect(r.runtime).toBe("ruffle");
    expect(r.stage).toEqual({ width: 320, height: 240 });
    expect(r.files).toContain("ruffle");
    expect(r.files).toContain("game.swf");

    const html = await readFile(r.indexHtml, "utf8");
    expect(html).toContain('"game.swf"');
    expect(html).toContain("ruffle/ruffle.js");
    expect(html).toContain("320px");
    expect(html).toContain("old.example.com/play.html");
  });

  it("builds a Java site that references the CheerpJ loader and an applet tag", async () => {
    const gameFile = path.join(dir, "applet.jar");
    await writeFile(gameFile, buildZip([{ name: "A.class", data: fakeClass(52) }]));
    const ws = path.join(dir, "work-java");
    const r = await packageSite(ws, {
      gameFile,
      kind: "java",
      appletClass: "com.example.A",
      cheerpjLoaderUrl: "https://cjrtnc.leaningtech.com/4.3/loader.js",
      cheerpjVersion: "4.3",
    });
    expect(r.runtime).toBe("cheerpj");
    const html = await readFile(r.indexHtml, "utf8");
    expect(html).toContain("cjrtnc.leaningtech.com/4.3/loader.js");
    expect(html).toContain('code="com.example.A"');
    expect(html).toContain('archive="applet.jar"');
    expect(html).toContain("cheerpjInit()");
  });

  it("refuses to package Flash without a Ruffle build", async () => {
    const gameFile = path.join(dir, "g.swf");
    await writeFile(gameFile, buildSwf());
    await expect(packageSite(path.join(dir, "w2"), { gameFile, kind: "flash" })).rejects.toThrow(/Ruffle/);
  });
  it("looks up a relative license next to the game before the current directory", async () => {
    const gameDir = path.join(dir, "game");
    await mkdir(gameDir, { recursive: true });
    const gameFile = path.join(gameDir, "game.swf");
    await writeFile(gameFile, "x");
    await writeFile(path.join(gameDir, "LICENSE"), "GPL");
    // The test runs from the repo root, which has its own LICENSE; it must not be picked.
    expect(resolveLicense("LICENSE", gameFile)).toBe(path.join(gameDir, "LICENSE"));
  });

  it("fails instead of silently dropping a missing license", async () => {
    const gameFile = path.join(dir, "game.swf");
    await writeFile(gameFile, "x");
    expect(() => resolveLicense("NO-SUCH-LICENSE.md", gameFile)).toThrow(/license file not found/);
  });
});
