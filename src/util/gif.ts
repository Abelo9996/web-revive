import type { DecodedImage } from "./png.js";

/**
 * A small animated-GIF encoder with no dependencies, so `revive` can always
 * produce its shareable artifact without a system tool like ffmpeg. Frames are
 * downscaled, reduced to one shared palette by median cut, LZW-compressed, and
 * written as a looping GIF89a. Quality is deliberately modest (a few hundred KB
 * for a few seconds); the point is a small, portable clip anyone can open.
 */
export interface GifOptions {
  /** Milliseconds per frame. */
  delayMs: number;
  /** Target width in pixels; frames are scaled down to fit. */
  maxWidth?: number;
  /** Max palette colors (<= 256). */
  maxColors?: number;
}

export function encodeGif(frames: DecodedImage[], options: GifOptions): Buffer {
  if (frames.length === 0) throw new Error("no frames to encode");
  const maxWidth = options.maxWidth ?? 360;
  // Cap at 255 so one slot is always free for the transparent index.
  const maxColors = Math.min(255, Math.max(2, options.maxColors ?? 255));

  const scaled = frames.map((f) => downscale(f, maxWidth));
  const width = scaled[0]!.width;
  const height = scaled[0]!.height;

  const palette = buildPalette(scaled, maxColors);
  // One extra slot past the palette is the transparent index. Pixels that did
  // not change since the previous frame are written transparent and left in
  // place (disposal 1), which is what keeps a game with a static background to
  // a small file instead of storing every pixel of every frame.
  const transparentIndex = palette.length;
  const totalColors = palette.length + 1;
  const gctBits = Math.max(1, Math.ceil(Math.log2(totalColors)));
  const gctColors = 1 << gctBits;
  const minCodeSize = Math.max(2, gctBits);

  const nearestCache = new Map<number, number>();
  const mapped = scaled.map((f) => mapToPalette(f, palette, nearestCache));
  const indexFrames = mapped.map((indices, k) => {
    if (k === 0) return indices;
    const prev = mapped[k - 1]!;
    const out = indices.slice();
    for (let p = 0; p < out.length; p++) {
      if (out[p] === prev[p]) out[p] = transparentIndex;
    }
    return out;
  });

  const delayCs = Math.max(2, Math.round(options.delayMs / 10)); // GIF delay is in 1/100 s
  const chunks: Buffer[] = [];

  // Header + logical screen descriptor with a global color table.
  chunks.push(Buffer.from("GIF89a", "latin1"));
  const lsd = Buffer.alloc(7);
  lsd.writeUInt16LE(width, 0);
  lsd.writeUInt16LE(height, 2);
  lsd[4] = 0x80 | ((gctBits - 1) << 4) | (gctBits - 1); // GCT present, color resolution, GCT size
  lsd[5] = 0; // background color index
  lsd[6] = 0; // pixel aspect ratio
  chunks.push(lsd);
  const gct = Buffer.alloc(gctColors * 3);
  for (let i = 0; i < palette.length; i++) {
    gct[i * 3] = palette[i]![0];
    gct[i * 3 + 1] = palette[i]![1];
    gct[i * 3 + 2] = palette[i]![2];
  }
  chunks.push(gct);

  // NETSCAPE2.0 application extension: loop forever.
  chunks.push(Buffer.from([0x21, 0xff, 0x0b]));
  chunks.push(Buffer.from("NETSCAPE2.0", "latin1"));
  chunks.push(Buffer.from([0x03, 0x01, 0x00, 0x00, 0x00]));

  for (const indices of indexFrames) {
    // Graphic control extension: per-frame delay, disposal 1 (leave in place),
    // transparent index set so unchanged pixels fall through to the frame below.
    const gce = Buffer.alloc(8);
    gce[0] = 0x21;
    gce[1] = 0xf9;
    gce[2] = 0x04;
    gce[3] = 0x05; // disposal method 1 (0x04) | transparent color flag (0x01)
    gce.writeUInt16LE(delayCs, 4);
    gce[6] = transparentIndex; // transparent color index
    gce[7] = 0x00; // block terminator
    chunks.push(gce);

    // Image descriptor (no local color table).
    const idesc = Buffer.alloc(10);
    idesc[0] = 0x2c;
    idesc.writeUInt16LE(0, 1);
    idesc.writeUInt16LE(0, 3);
    idesc.writeUInt16LE(width, 5);
    idesc.writeUInt16LE(height, 7);
    idesc[9] = 0x00;
    chunks.push(idesc);

    chunks.push(Buffer.from([minCodeSize]));
    chunks.push(packSubBlocks(lzwEncode(indices, minCodeSize)));
  }

  chunks.push(Buffer.from([0x3b])); // trailer
  return Buffer.concat(chunks);
}

function downscale(img: DecodedImage, maxWidth: number): DecodedImage {
  if (img.width <= maxWidth) return img;
  const scale = maxWidth / img.width;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(img.height - 1, Math.floor(y / scale));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.floor(x / scale));
      const src = (sy * img.width + sx) * 4;
      const dst = (y * w + x) * 4;
      out[dst] = img.data[src]!;
      out[dst + 1] = img.data[src + 1]!;
      out[dst + 2] = img.data[src + 2]!;
      out[dst + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

type Rgb = [number, number, number];

function buildPalette(frames: DecodedImage[], maxColors: number): Rgb[] {
  // Sample pixels across all frames to keep median cut fast.
  const samples: number[] = [];
  const stride = 4 * 7; // every 7th pixel is plenty for a palette
  for (const f of frames) {
    const data = f.data;
    for (let i = 0; i < data.length; i += stride) {
      samples.push(data[i]!, data[i + 1]!, data[i + 2]!);
    }
  }
  if (samples.length === 0) return [[0, 0, 0]];
  const boxes: number[][] = [range(samples.length / 3)];
  const px = samples;

  while (boxes.length < maxColors) {
    let target = -1;
    let bestRange = -1;
    for (let b = 0; b < boxes.length; b++) {
      if (boxes[b]!.length < 2) continue;
      const r = channelRange(px, boxes[b]!);
      if (r.range > bestRange) {
        bestRange = r.range;
        target = b;
      }
    }
    if (target < 0) break;
    const box = boxes[target]!;
    const { channel } = channelRange(px, box);
    box.sort((i, j) => px[i * 3 + channel]! - px[j * 3 + channel]!);
    const mid = box.length >> 1;
    const lo = box.slice(0, mid);
    const hi = box.slice(mid);
    boxes.splice(target, 1, lo, hi);
  }

  return boxes.map((box) => averageColor(px, box));
}

function range(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i);
  return out;
}

function channelRange(px: number[], box: number[]): { channel: number; range: number } {
  const min = [255, 255, 255];
  const max = [0, 0, 0];
  for (const i of box) {
    for (let c = 0; c < 3; c++) {
      const v = px[i * 3 + c]!;
      if (v < min[c]!) min[c] = v;
      if (v > max[c]!) max[c] = v;
    }
  }
  let channel = 0;
  let range = -1;
  for (let c = 0; c < 3; c++) {
    const r = max[c]! - min[c]!;
    if (r > range) {
      range = r;
      channel = c;
    }
  }
  return { channel, range };
}

function averageColor(px: number[], box: number[]): Rgb {
  if (box.length === 0) return [0, 0, 0];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const i of box) {
    r += px[i * 3]!;
    g += px[i * 3 + 1]!;
    b += px[i * 3 + 2]!;
  }
  const n = box.length;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function mapToPalette(img: DecodedImage, palette: Rgb[], cache: Map<number, number>): number[] {
  const out = new Array<number>(img.width * img.height);
  const data = img.data;
  for (let p = 0; p < out.length; p++) {
    const o = p * 4;
    const key = (data[o]! << 16) | (data[o + 1]! << 8) | data[o + 2]!;
    let idx = cache.get(key);
    if (idx === undefined) {
      idx = nearest(data[o]!, data[o + 1]!, data[o + 2]!, palette);
      cache.set(key, idx);
    }
    out[p] = idx;
  }
  return out;
}

function nearest(r: number, g: number, b: number, palette: Rgb[]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const dr = r - palette[i]![0];
    const dg = g - palette[i]![1];
    const db = b - palette[i]![2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function lzwEncode(indices: number[], minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const out: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;
  const emit = (code: number, size: number) => {
    bitBuffer |= code << bitCount;
    bitCount += size;
    while (bitCount >= 8) {
      out.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  let codeSize = minCodeSize + 1;
  let dict = new Map<string, number>();
  const resetDict = () => {
    dict = new Map();
    for (let i = 0; i < clearCode; i++) dict.set(String(i), i);
  };
  resetDict();
  let nextCode = endCode + 1;

  emit(clearCode, codeSize);
  let w = String(indices[0]);
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]!;
    const wk = w + "," + k;
    if (dict.has(wk)) {
      w = wk;
    } else {
      emit(dict.get(w)!, codeSize);
      if (nextCode < 4096) {
        // Widen the code before assigning a value that would not fit.
        if (nextCode === 1 << codeSize && codeSize < 12) codeSize++;
        dict.set(wk, nextCode++);
      } else {
        emit(clearCode, codeSize);
        resetDict();
        codeSize = minCodeSize + 1;
        nextCode = endCode + 1;
      }
      w = String(k);
    }
  }
  emit(dict.get(w)!, codeSize);
  emit(endCode, codeSize);
  if (bitCount > 0) out.push(bitBuffer & 0xff);
  return Uint8Array.from(out);
}

function packSubBlocks(data: Uint8Array): Buffer {
  const parts: Buffer[] = [];
  for (let i = 0; i < data.length; i += 255) {
    const slice = data.subarray(i, Math.min(i + 255, data.length));
    parts.push(Buffer.from([slice.length]));
    parts.push(Buffer.from(slice));
  }
  parts.push(Buffer.from([0x00])); // block terminator
  return Buffer.concat(parts);
}
