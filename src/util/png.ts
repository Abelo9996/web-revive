import { inflateSync } from "node:zlib";

/**
 * A minimal PNG decoder, enough for the screenshots Playwright produces:
 * 8-bit, non-interlaced, truecolor with or without alpha. It exists so the
 * tool can measure frame-to-frame change and encode a GIF without pulling in an
 * image library. Anything outside that shape throws, which is fine: the only
 * producer here is headless Chromium, which is consistent.
 */
export interface DecodedImage {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row-major. */
  data: Uint8Array;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function decodePng(buf: Buffer): DecodedImage {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error("not a PNG");
  }
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];

  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    const dataStart = pos + 8;
    const dataEnd = dataStart + len;
    if (dataEnd > buf.length) break;
    const data = buf.subarray(dataStart, dataEnd);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]!;
      colorType = data[9]!;
      interlace = data[12]!;
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    pos = dataEnd + 4; // skip the 4-byte CRC
  }

  if (bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${bitDepth}`);
  if (interlace !== 0) throw new Error("interlaced PNG is not supported");
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (channels === 0) throw new Error(`unsupported PNG color type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  let rawPos = 0;
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[rawPos++]!;
    for (let i = 0; i < stride; i++) cur[i] = raw[rawPos++]!;
    unfilter(filter, cur, prev, channels, stride);
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x++) {
      const src = x * channels;
      const dst = rowStart + x * 4;
      out[dst] = cur[src]!;
      out[dst + 1] = cur[src + 1]!;
      out[dst + 2] = cur[src + 2]!;
      out[dst + 3] = channels === 4 ? cur[src + 3]! : 255;
    }
    prev.set(cur);
  }
  return { width, height, data: out };
}

function unfilter(filter: number, cur: Uint8Array, prev: Uint8Array, bpp: number, stride: number): void {
  switch (filter) {
    case 0:
      return;
    case 1: // Sub
      for (let i = bpp; i < stride; i++) cur[i] = (cur[i]! + cur[i - bpp]!) & 0xff;
      return;
    case 2: // Up
      for (let i = 0; i < stride; i++) cur[i] = (cur[i]! + prev[i]!) & 0xff;
      return;
    case 3: // Average
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? cur[i - bpp]! : 0;
        cur[i] = (cur[i]! + ((a + prev[i]!) >> 1)) & 0xff;
      }
      return;
    case 4: // Paeth
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? cur[i - bpp]! : 0;
        const b = prev[i]!;
        const c = i >= bpp ? prev[i - bpp]! : 0;
        cur[i] = (cur[i]! + paeth(a, b, c)) & 0xff;
      }
      return;
    default:
      throw new Error(`unknown PNG filter ${filter}`);
  }
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * The fraction of pixels that differ between two equally sized RGBA images,
 * counting a pixel as changed when any channel moves by more than `threshold`.
 * Used as the frame-to-frame activity metric. Returns 0 on a size mismatch.
 */
export function frameActivity(a: DecodedImage, b: DecodedImage, threshold = 16): number {
  if (a.width !== b.width || a.height !== b.height) return 0;
  const n = a.width * a.height;
  if (n === 0) return 0;
  let changed = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (
      Math.abs(a.data[o]! - b.data[o]!) > threshold ||
      Math.abs(a.data[o + 1]! - b.data[o + 1]!) > threshold ||
      Math.abs(a.data[o + 2]! - b.data[o + 2]!) > threshold
    ) {
      changed++;
    }
  }
  return changed / n;
}
