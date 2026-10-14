import zlib from "node:zlib";

/** Write bits MSB-first, the order SWF uses for RECT. */
class BitWriter {
  private bits: number[] = [];
  writeUB(value: number, n: number): void {
    for (let i = n - 1; i >= 0; i--) this.bits.push((value >> i) & 1);
  }
  toBuffer(): Buffer {
    const bytes: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | (this.bits[i + j] ?? 0);
      bytes.push(b);
    }
    return Buffer.from(bytes);
  }
}

function bitsNeeded(v: number): number {
  if (v <= 0) return 1;
  return Math.floor(Math.log2(v)) + 1;
}

/** Build a SWF RECT (twips) with signed fields. min values are 0 here. */
export function buildRect(xmax: number, ymax: number): Buffer {
  // +1 for the sign bit: RECT fields are SB (signed).
  const nbits = Math.max(2, bitsNeeded(xmax) + 1, bitsNeeded(ymax) + 1);
  const w = new BitWriter();
  w.writeUB(nbits, 5);
  w.writeUB(0, nbits); // xmin
  w.writeUB(xmax, nbits);
  w.writeUB(0, nbits); // ymin
  w.writeUB(ymax, nbits);
  return w.toBuffer();
}

/** Build one SWF tag record. */
export function swfTag(type: number, body: Buffer = Buffer.alloc(0)): Buffer {
  if (body.length < 0x3f) {
    const header = Buffer.alloc(2);
    header.writeUInt16LE((type << 6) | body.length, 0);
    return Buffer.concat([header, body]);
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE((type << 6) | 0x3f, 0);
  header.writeUInt32LE(body.length, 2);
  return Buffer.concat([header, body]);
}

export interface SwfSpec {
  signature?: "FWS" | "CWS";
  version?: number;
  stagePx?: { width: number; height: number };
  frameRate?: number;
  frameCount?: number;
  tags?: Buffer[];
}

/** Assemble a minimal but valid SWF for tests. */
export function buildSwf(spec: SwfSpec = {}): Buffer {
  const signature = spec.signature ?? "FWS";
  const version = spec.version ?? 6;
  const stage = spec.stagePx ?? { width: 550, height: 400 };
  const rect = buildRect(stage.width * 20, stage.height * 20);
  const frameRate = Buffer.alloc(2);
  frameRate.writeUInt16LE(Math.round((spec.frameRate ?? 24) * 256), 0);
  const frameCount = Buffer.alloc(2);
  frameCount.writeUInt16LE(spec.frameCount ?? 1, 0);
  const tags = Buffer.concat([...(spec.tags ?? []), swfTag(0)]); // End tag
  const body = Buffer.concat([rect, frameRate, frameCount, tags]);

  const head = Buffer.alloc(8);
  head.write(signature, 0, "latin1");
  head.writeUInt8(version, 3);
  head.writeUInt32LE(8 + body.length, 4);

  if (signature === "CWS") {
    return Buffer.concat([head, zlib.deflateSync(body)]);
  }
  return Buffer.concat([head, body]);
}

/** Build a stored (uncompressed) ZIP from entries. */
export function buildZip(entries: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt32LE(0, 14); // crc (reader ignores it)
    local.writeUInt32LE(e.data.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const localBuf = Buffer.concat([local, name, e.data]);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 10); // stored
    central.writeUInt32LE(e.data.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));

    locals.push(localBuf);
    offset += localBuf.length;
  }
  const centralDir = Buffer.concat(centrals);
  const localPart = Buffer.concat(locals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(localPart.length, 16);
  return Buffer.concat([localPart, centralDir, eocd]);
}

/** A fake Java class file: valid magic/major, plus constant-pool-like text. */
export function fakeClass(major: number, extraText = ""): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(0xcafebabe, 0);
  head.writeUInt16BE(0, 4); // minor
  head.writeUInt16BE(major, 6);
  return Buffer.concat([head, Buffer.from(extraText, "latin1")]);
}
