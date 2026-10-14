// make-swf.mjs - build a tiny animated SWF with no external tools.
// MIT licensed, part of the web-revive examples. This is an original work
// written to give web-revive a redistributable Flash animation to revive: a
// square that bounces across the stage. No ActionScript, just timeline and
// shape tags, which is exactly the shape of content Ruffle handles best.
//
// Usage: node make-swf.mjs > bounce.swf   (or: node make-swf.mjs bounce.swf)
import { writeFileSync } from "node:fs";
import zlib from "node:zlib";

/** MSB-first bit writer with signed support, matching the SWF bit order. */
class BitWriter {
  constructor() {
    this.bits = [];
  }
  ub(value, n) {
    for (let i = n - 1; i >= 0; i--) this.bits.push((value >> i) & 1);
  }
  sb(value, n) {
    // two's complement in n bits
    const masked = value & ((1 << n) - 1);
    this.ub(masked >>> 0, n);
  }
  align() {
    while (this.bits.length % 8 !== 0) this.bits.push(0);
  }
  toBuffer() {
    this.align();
    const bytes = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | this.bits[i + j];
      bytes.push(b);
    }
    return Buffer.from(bytes);
  }
}

function sbBits(v) {
  const a = Math.abs(v);
  let n = 2;
  while (a >= 1 << (n - 1)) n++;
  return n + 1; // sign bit margin
}

function rect(xmax, ymax) {
  const w = new BitWriter();
  // RECT fields are signed (SB); +1 for the sign bit so positive values stay positive.
  const nbits = Math.max(2, bitsNeeded(xmax) + 1, bitsNeeded(ymax) + 1);
  w.ub(nbits, 5);
  w.sb(0, nbits);
  w.sb(xmax, nbits);
  w.sb(0, nbits);
  w.sb(ymax, nbits);
  return w.toBuffer();
}
function bitsNeeded(v) {
  if (v <= 0) return 1;
  return Math.floor(Math.log2(v)) + 1;
}

function tag(type, body) {
  if (body.length < 0x3f) {
    const h = Buffer.alloc(2);
    h.writeUInt16LE((type << 6) | body.length, 0);
    return Buffer.concat([h, body]);
  }
  const h = Buffer.alloc(6);
  h.writeUInt16LE((type << 6) | 0x3f, 0);
  h.writeUInt32LE(body.length, 2);
  return Buffer.concat([h, body]);
}

// DefineShape (type 2): a solid-filled rectangle, w x h twips, colour rgb.
function defineShape(shapeId, w, h, rgb) {
  const head = Buffer.alloc(2);
  head.writeUInt16LE(shapeId, 0);
  const bounds = rect(w, h);

  const b = new BitWriter();
  // One fill style: solid colour (type 0x00) + RGB.
  const fillHeader = Buffer.from([0x01, 0x00, rgb[0], rgb[1], rgb[2]]);
  const lineHeader = Buffer.from([0x00]); // no line styles
  // numFillBits = 1, numLineBits = 0
  b.ub(1, 4);
  b.ub(0, 4);
  // StyleChangeRecord: set fillStyle1 = 1 and move to (0,0). The edges below
  // wind clockwise (right, down, left, up), so the interior is on the right of
  // each edge, which is the fillStyle1 side.
  b.ub(0, 1); // edge/type flag = 0 (non-edge)
  b.ub(0, 1); // StateNewStyles
  b.ub(0, 1); // StateLineStyle
  b.ub(1, 1); // StateFillStyle1
  b.ub(0, 1); // StateFillStyle0
  b.ub(1, 1); // StateMoveTo
  const moveBits = Math.max(sbBits(w), sbBits(h));
  b.ub(moveBits, 5);
  b.sb(0, moveBits); // moveX
  b.sb(0, moveBits); // moveY
  b.ub(1, 1); // fillStyle1 index = 1 (numFillBits=1)
  // Four straight edges forming a rectangle.
  const edges = [
    [w, 0],
    [0, h],
    [-w, 0],
    [0, -h],
  ];
  for (const [dx, dy] of edges) {
    const nb = Math.max(2, sbBits(dx), sbBits(dy));
    b.ub(1, 1); // edge
    b.ub(1, 1); // straight
    b.ub(nb - 2, 4); // numBits
    b.ub(1, 1); // general line
    b.sb(dx, nb);
    b.sb(dy, nb);
  }
  // EndShapeRecord
  b.ub(0, 1);
  b.ub(0, 5);

  return tag(2, Buffer.concat([head, bounds, fillHeader, lineHeader, b.toBuffer()]));
}

function matrix(tx, ty) {
  const b = new BitWriter();
  b.ub(0, 1); // HasScale
  b.ub(0, 1); // HasRotate
  const nb = Math.max(sbBits(tx), sbBits(ty));
  b.ub(nb, 5);
  b.sb(tx, nb);
  b.sb(ty, nb);
  return b.toBuffer();
}

function placeObject2(move, depth, charId, tx, ty) {
  let flags = 0;
  flags |= 0x04; // HasMatrix
  if (move) flags |= 0x01;
  else flags |= 0x02; // HasCharacter
  const head = Buffer.alloc(move ? 3 : 5);
  head.writeUInt8(flags, 0);
  head.writeUInt16LE(depth, 1);
  if (!move) head.writeUInt16LE(charId, 3);
  return tag(26, Buffer.concat([head, matrix(tx, ty)]));
}

function build(as3 = false) {
  const stageW = 400,
    stageH = 300; // px
  const squarePx = 40;
  const square = squarePx * 20; // twips
  const frames = 48;
  const version = as3 ? 10 : 6;

  const tags = [];
  if (as3) {
    // FileAttributes with the ActionScript3 bit set. This marks the movie AS3
    // without shipping any AS3 program, which is enough to show how web-revive
    // flags AS3 content (Ruffle's AS3 support is only partial).
    tags.push(tag(69, Buffer.from([0x08, 0x00, 0x00, 0x00])));
  }
  tags.push(tag(9, Buffer.from([0x10, 0x14, 0x28]))); // SetBackgroundColor (navy)
  tags.push(defineShape(1, square, square, [0x5b, 0x9d, 0xd9])); // blue square

  for (let f = 0; f < frames; f++) {
    const t = f / (frames - 1);
    const x = Math.round((stageW - squarePx) * t * 20);
    const y = Math.round(((stageH - squarePx) / 2) * 20 + Math.sin(t * Math.PI * 2) * 80 * 20);
    tags.push(placeObject2(f !== 0, 1, 1, x, y));
    tags.push(tag(1, Buffer.alloc(0))); // ShowFrame
  }
  tags.push(tag(0, Buffer.alloc(0))); // End

  const stageRect = rect(stageW * 20, stageH * 20);
  const fr = Buffer.alloc(2);
  fr.writeUInt16LE(24 * 256, 0); // 24 fps
  const fc = Buffer.alloc(2);
  fc.writeUInt16LE(frames, 0);
  const body = Buffer.concat([stageRect, fr, fc, ...tags]);

  const head = Buffer.alloc(8);
  head.write("FWS", 0, "latin1");
  head.writeUInt8(version, 3);
  head.writeUInt32LE(8 + body.length, 4);
  return Buffer.concat([head, body]);
}

const args = process.argv.slice(2);
const as3 = args.includes("--as3");
const outFile = args.find((a) => !a.startsWith("--"));
const swf = build(as3);
if (outFile) writeFileSync(outFile, swf);
else process.stdout.write(swf);
void zlib; // kept for anyone extending this to emit CWS
