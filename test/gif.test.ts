import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { decodePng, frameActivity, type DecodedImage } from "../src/util/png.js";
import { encodeGif } from "../src/util/gif.js";

/** Build a minimal truecolor-alpha PNG (filter 0 rows, CRCs left zero). */
function buildPng(width: number, height: number, rgba: number[]): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      raw[p++] = rgba[i]!;
      raw[p++] = rgba[i + 1]!;
      raw[p++] = rgba[i + 2]!;
      raw[p++] = rgba[i + 3]!;
    }
  }
  const idat = deflateSync(raw);
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    return Buffer.concat([len, Buffer.from(type, "latin1"), data, Buffer.alloc(4)]);
  };
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function solid(width: number, height: number, r: number, g: number, b: number): DecodedImage {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

describe("decodePng", () => {
  it("round-trips pixels of a hand-built PNG", () => {
    const rgba = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255];
    const img = decodePng(buildPng(2, 2, rgba));
    expect(img.width).toBe(2);
    expect(img.height).toBe(2);
    expect([...img.data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect([...img.data.slice(4, 8)]).toEqual([0, 255, 0, 255]);
  });

  it("rejects non-PNG input", () => {
    expect(() => decodePng(Buffer.from("not a png"))).toThrow(/not a PNG/);
  });
});

describe("frameActivity", () => {
  it("is zero for identical frames and grows with change", () => {
    const a = solid(4, 4, 0, 0, 0);
    expect(frameActivity(a, solid(4, 4, 0, 0, 0))).toBe(0);
    expect(frameActivity(a, solid(4, 4, 255, 255, 255))).toBe(1);
  });

  it("returns zero on a size mismatch", () => {
    expect(frameActivity(solid(2, 2, 0, 0, 0), solid(3, 3, 0, 0, 0))).toBe(0);
  });
});

describe("encodeGif", () => {
  it("writes a valid looping GIF89a with a trailer", () => {
    const frames = [solid(8, 8, 200, 30, 30), solid(8, 8, 30, 30, 200)];
    const gif = encodeGif(frames, { delayMs: 100, maxWidth: 8 });
    expect(gif.subarray(0, 6).toString("latin1")).toBe("GIF89a");
    expect(gif.includes(Buffer.from("NETSCAPE2.0", "latin1"))).toBe(true);
    expect(gif[gif.length - 1]).toBe(0x3b);
    expect(gif.length).toBeGreaterThan(20);
  });

  it("throws with no frames", () => {
    expect(() => encodeGif([], { delayMs: 100 })).toThrow(/no frames/);
  });

  it("downscales wide frames to the target width", () => {
    const gif = encodeGif([solid(100, 50, 10, 20, 30)], { delayMs: 100, maxWidth: 20 });
    // Logical screen width is bytes 6-7, little-endian.
    expect(gif.readUInt16LE(6)).toBe(20);
    expect(gif.readUInt16LE(8)).toBe(10);
  });
});
