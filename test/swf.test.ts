import { describe, expect, it } from "vitest";
import { parseSwf } from "../src/parsers/swf.js";
import { buildSwf, swfTag } from "./fixtures.js";

describe("parseSwf", () => {
  it("reads an uncompressed FWS header and stage size", () => {
    const swf = buildSwf({ signature: "FWS", version: 6, stagePx: { width: 550, height: 400 }, frameRate: 24, frameCount: 10 });
    const info = parseSwf(swf);
    expect(info.signature).toBe("FWS");
    expect(info.compression).toBe("none");
    expect(info.version).toBe(6);
    expect(info.stage).toEqual({ widthPx: 550, heightPx: 400 });
    expect(info.frameRate).toBe(24);
    expect(info.frameCount).toBe(10);
  });

  it("inflates a CWS (zlib) body", () => {
    const swf = buildSwf({ signature: "CWS", version: 8, stagePx: { width: 320, height: 240 } });
    const info = parseSwf(swf);
    expect(info.compression).toBe("zlib");
    expect(info.bodyParsed).toBe(true);
    expect(info.stage).toEqual({ widthPx: 320, heightPx: 240 });
  });

  it("classifies AS1/AS2 from a DoAction tag", () => {
    const doAction = swfTag(12, Buffer.from("fake-bytecode", "latin1"));
    const info = parseSwf(buildSwf({ version: 6, tags: [doAction] }));
    expect(info.actionScript).toBe("AS1/AS2");
  });

  it("classifies AS3 from the FileAttributes ActionScript3 bit", () => {
    const fileAttrs = swfTag(69, Buffer.from([0x08, 0, 0, 0])); // AS3 bit set
    const info = parseSwf(buildSwf({ version: 10, tags: [fileAttrs] }));
    expect(info.actionScript).toBe("AS3");
    expect(info.actionScriptEvidence).toMatch(/ActionScript3 bit/);
  });

  it("classifies AS3 from a DoABC tag", () => {
    const doAbc = swfTag(82, Buffer.from("abc", "latin1"));
    const info = parseSwf(buildSwf({ version: 10, tags: [doAbc] }));
    expect(info.actionScript).toBe("AS3");
  });

  it("surfaces external-load strings", () => {
    const tag = swfTag(12, Buffer.from("loadMovieNum http://example.com/next.swf", "latin1"));
    const info = parseSwf(buildSwf({ tags: [tag] }));
    expect(info.externalRefs.some((r) => r.includes("next.swf"))).toBe(true);
  });

  it("rejects a non-SWF buffer", () => {
    expect(() => parseSwf(Buffer.from("not a swf at all"))).toThrow(/not a SWF/);
  });
});
