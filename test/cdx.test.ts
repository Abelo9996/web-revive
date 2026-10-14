import { describe, expect, it } from "vitest";
import { parseCdx, buildCdxUrl, pickBest, rawCaptureUrl } from "../src/parsers/cdx.js";

const SAMPLE = JSON.stringify([
  ["timestamp", "original", "mimetype", "statuscode", "digest", "length"],
  ["20050101000000", "http://site.com/game.swf", "application/x-shockwave-flash", "200", "AAA", "1000"],
  ["20100601120000", "http://site.com/game.swf", "application/x-shockwave-flash", "200", "BBB", "1200"],
  ["20120101000000", "http://site.com/game.swf", "application/x-shockwave-flash", "404", "CCC", "0"],
]);

describe("buildCdxUrl", () => {
  it("builds a CDX query URL", () => {
    const url = buildCdxUrl("http://site.com/game.swf", 5);
    expect(url).toContain("web.archive.org/cdx/search/cdx");
    expect(url).toContain("output=json");
    expect(url).toContain("limit=5");
  });
});

describe("parseCdx", () => {
  it("parses rows and builds raw URLs", () => {
    const caps = parseCdx(SAMPLE);
    expect(caps.length).toBe(3);
    expect(caps[0]!.timestamp).toBe("20050101000000");
    expect(caps[0]!.rawUrl).toBe("https://web.archive.org/web/20050101000000id_/http://site.com/game.swf");
  });

  it("returns empty for junk", () => {
    expect(parseCdx("")).toEqual([]);
    expect(parseCdx("not json")).toEqual([]);
    expect(parseCdx("[]")).toEqual([]);
  });
});

describe("pickBest", () => {
  it("prefers the most recent 200 capture", () => {
    const best = pickBest(parseCdx(SAMPLE));
    expect(best!.timestamp).toBe("20100601120000");
    expect(best!.statusCode).toBe("200");
  });

  it("falls back to the most recent of any status", () => {
    const only404 = parseCdx(
      JSON.stringify([
        ["timestamp", "original", "mimetype", "statuscode", "digest", "length"],
        ["20010101000000", "http://x/y.swf", "text/html", "404", "D", "0"],
        ["20020101000000", "http://x/y.swf", "text/html", "503", "E", "0"],
      ]),
    );
    expect(pickBest(only404)!.timestamp).toBe("20020101000000");
  });

  it("returns null for no captures", () => {
    expect(pickBest([])).toBeNull();
  });
});

describe("rawCaptureUrl", () => {
  it("adds the id_ suffix", () => {
    expect(rawCaptureUrl("20100601120000", "http://x/y.swf")).toBe("https://web.archive.org/web/20100601120000id_/http://x/y.swf");
  });
});
