import { describe, expect, it } from "vitest";
import { isWaybackUrl, parseWaybackUrl, toRawWaybackUrl } from "../src/parsers/wayback.js";

describe("isWaybackUrl", () => {
  it("recognizes Wayback capture links", () => {
    expect(isWaybackUrl("https://web.archive.org/web/20071015000000/http://site/game.swf")).toBe(true);
    expect(isWaybackUrl("http://web.archive.org/web/2007/http://site/")).toBe(true);
    expect(isWaybackUrl("https://example.com/game.swf")).toBe(false);
  });
});

describe("parseWaybackUrl", () => {
  it("splits timestamp, modifier, and original URL", () => {
    const ref = parseWaybackUrl("https://web.archive.org/web/20071015000000/http://site.com/game.swf");
    expect(ref).toEqual({ timestamp: "20071015000000", modifier: "", originalUrl: "http://site.com/game.swf" });
  });

  it("reads the id_ raw modifier", () => {
    const ref = parseWaybackUrl("https://web.archive.org/web/20071015000000id_/http://site.com/game.swf");
    expect(ref?.modifier).toBe("id_");
  });

  it("returns null for a non-Wayback URL", () => {
    expect(parseWaybackUrl("https://example.com/game.swf")).toBeNull();
  });
});

describe("toRawWaybackUrl", () => {
  it("rewrites a normal capture link to the raw id_ form that avoids the 500-prone proxy", () => {
    expect(toRawWaybackUrl("https://web.archive.org/web/20071015000000/http://site.com/game.swf")).toBe(
      "https://web.archive.org/web/20071015000000id_/http://site.com/game.swf",
    );
  });

  it("leaves an already-raw link unchanged", () => {
    const raw = "https://web.archive.org/web/20071015000000id_/http://site.com/game.swf";
    expect(toRawWaybackUrl(raw)).toBe(raw);
  });

  it("leaves a non-Wayback URL unchanged", () => {
    expect(toRawWaybackUrl("https://example.com/game.swf")).toBe("https://example.com/game.swf");
  });
});
