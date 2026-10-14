import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { inspect } from "../src/ops/inspect.js";
import { buildSwf, swfTag, buildZip, fakeClass } from "./fixtures.js";

describe("inspect", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "wr-inspect-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function write(name: string, buf: Buffer): Promise<string> {
    const p = path.join(dir, name);
    await writeFile(p, buf);
    return p;
  }

  it("rates an AS2 Flash movie as likely on Ruffle", async () => {
    const swf = buildSwf({ version: 6, tags: [swfTag(12, Buffer.from("do-action"))] });
    const r = await inspect(await write("game.swf", swf));
    expect(r.kind).toBe("flash");
    expect(r.runtime).toBe("ruffle");
    expect(r.swf!.actionScript).toBe("AS1/AS2");
    expect(r.compatibility).toBe("likely");
  });

  it("warns on an AS3 movie", async () => {
    const swf = buildSwf({ version: 10, tags: [swfTag(82, Buffer.from("abc"))] });
    const r = await inspect(await write("as3.swf", swf));
    expect(r.swf!.actionScript).toBe("AS3");
    expect(r.compatibility).toBe("may-have-problems");
  });

  it("rates a Java applet jar as likely on CheerpJ", async () => {
    const applet = fakeClass(52, "java/applet/Applet");
    const jar = buildZip([
      { name: "META-INF/MANIFEST.MF", data: Buffer.from("Manifest-Version: 1.0\r\n\r\n") },
      { name: "Game.class", data: applet },
    ]);
    const r = await inspect(await write("game.jar", jar));
    expect(r.kind).toBe("java");
    expect(r.runtime).toBe("cheerpj");
    expect(r.compatibility).toBe("likely");
    expect(r.findings.some((f) => f.what === "Java applet")).toBe(true);
  });

  it("rejects a jar with native libraries as not supported", async () => {
    const jar = buildZip([
      { name: "Game.class", data: fakeClass(52, "java/applet/Applet loadLibrary") },
      { name: "native.dll", data: Buffer.from([0, 1]) },
    ]);
    const r = await inspect(await write("native.jar", jar));
    expect(r.compatibility).toBe("not-supported");
    expect(r.findings.some((f) => f.severity === "block")).toBe(true);
  });

  it("reports an unrecognized file as not supported", async () => {
    const r = await inspect(await write("weird.bin", Buffer.from("just some bytes here")));
    expect(r.kind).toBe("unknown");
    expect(r.compatibility).toBe("not-supported");
  });
});
