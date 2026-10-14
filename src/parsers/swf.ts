import zlib from "node:zlib";
import type { SwfInfo } from "../types.js";

/**
 * Parse a SWF file enough to judge whether Ruffle can run it. We read the
 * header (compression, version, stage size, frame rate and count), decide
 * ActionScript version from tags, and scan for strings that hint the movie
 * pulls in things from outside itself. We never execute anything.
 *
 * FWS = uncompressed, CWS = zlib, ZWS = LZMA. We cannot inflate LZMA without a
 * dependency, so for ZWS we report the header fields that live in the clear and
 * say the body was not parsed.
 */
export function parseSwf(buf: Buffer): SwfInfo {
  if (buf.length < 8) throw new Error("file is too small to be a SWF");
  const sig = buf.subarray(0, 3).toString("latin1");
  if (sig !== "FWS" && sig !== "CWS" && sig !== "ZWS") {
    throw new Error(`not a SWF file (signature ${JSON.stringify(sig)}; expected FWS, CWS, or ZWS)`);
  }
  const signature = sig as SwfInfo["signature"];
  const version = buf[3]!;
  const fileLength = buf.readUInt32LE(4);
  const compression: SwfInfo["compression"] = sig === "FWS" ? "none" : sig === "CWS" ? "zlib" : "lzma";

  let body: Buffer | null = null;
  if (sig === "FWS") {
    body = buf.subarray(8);
  } else if (sig === "CWS") {
    try {
      body = zlib.inflateSync(buf.subarray(8));
    } catch {
      body = null;
    }
  } else {
    // ZWS: LZMA compressed body. Left unparsed on purpose.
    body = null;
  }

  const info: SwfInfo = {
    signature,
    compression,
    version,
    fileLength,
    stage: null,
    frameRate: null,
    frameCount: null,
    actionScript: "unknown",
    actionScriptEvidence: null,
    externalRefs: [],
    bodyParsed: body !== null,
  };

  if (!body) return info;

  const reader = new BitReader(body);
  const rect = reader.readRect();
  info.stage = {
    widthPx: Math.round(((rect.xmax - rect.xmin) / 20) * 100) / 100,
    heightPx: Math.round(((rect.ymax - rect.ymin) / 20) * 100) / 100,
  };
  reader.align();
  const frameRate = body.readUInt16LE(reader.bytePos);
  info.frameRate = Math.round((frameRate / 256) * 100) / 100;
  info.frameCount = body.readUInt16LE(reader.bytePos + 2);
  const tagsStart = reader.bytePos + 4;

  const { actionScript, evidence } = classifyActionScript(body, tagsStart, version);
  info.actionScript = actionScript;
  info.actionScriptEvidence = evidence;

  info.externalRefs = scanExternalRefs(body);
  return info;
}

interface Rect {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

/** Minimal big-endian bit reader for the one bit-packed field SWF has: RECT. */
class BitReader {
  private buf: Buffer;
  bytePos = 0;
  private bitPos = 0;

  constructor(buf: Buffer) {
    this.buf = buf;
  }

  private readBit(): number {
    const byte = this.buf[this.bytePos] ?? 0;
    const bit = (byte >> (7 - this.bitPos)) & 1;
    this.bitPos++;
    if (this.bitPos === 8) {
      this.bitPos = 0;
      this.bytePos++;
    }
    return bit;
  }

  readUB(n: number): number {
    let value = 0;
    for (let i = 0; i < n; i++) value = (value << 1) | this.readBit();
    return value >>> 0;
  }

  /** Read n bits as a two's-complement signed value. */
  readSB(n: number): number {
    if (n === 0) return 0;
    const raw = this.readUB(n);
    const signBit = 1 << (n - 1);
    return raw & signBit ? raw - (1 << n) : raw;
  }

  /** SWF stores RECT fields as signed (SB); min is almost always 0. */
  readRect(): Rect {
    const nbits = this.readUB(5);
    return {
      xmin: this.readSB(nbits),
      xmax: this.readSB(nbits),
      ymin: this.readSB(nbits),
      ymax: this.readSB(nbits),
    };
  }

  /** Move to the next whole byte boundary. */
  align(): void {
    if (this.bitPos !== 0) {
      this.bitPos = 0;
      this.bytePos++;
    }
  }
}

const TAG_DO_ACTION = 12;
const TAG_DO_INIT_ACTION = 59;
const TAG_FILE_ATTRIBUTES = 69;
const TAG_SYMBOL_CLASS = 76;
const TAG_DO_ABC = 82;
const TAG_DO_ABC_DEFINE = 72;
const TAG_END = 0;

/**
 * Walk the tag list and decide the ActionScript generation. AS3 is signalled by
 * the FileAttributes tag's AS3 bit or by any DoABC tag. AS1/AS2 is signalled by
 * DoAction. We stop at the End tag or the end of the body.
 */
function classifyActionScript(
  body: Buffer,
  start: number,
  version: number,
): { actionScript: SwfInfo["actionScript"]; evidence: string | null } {
  let pos = start;
  let sawFileAttributes = false;
  let fileAttributesAs3 = false;
  let sawDoAbc = false;
  let sawSymbolClass = false;
  let sawDoAction = false;

  while (pos + 2 <= body.length) {
    const recordHeader = body.readUInt16LE(pos);
    pos += 2;
    const tagType = recordHeader >> 6;
    let length = recordHeader & 0x3f;
    if (length === 0x3f) {
      if (pos + 4 > body.length) break;
      length = body.readUInt32LE(pos);
      pos += 4;
    }
    const tagBodyStart = pos;
    if (tagType === TAG_END) break;

    if (tagType === TAG_FILE_ATTRIBUTES && length >= 1) {
      sawFileAttributes = true;
      // Bit layout from MSB: reserved, UseDirectBlit, UseGPU, HasMetadata,
      // ActionScript3, reserved, reserved, UseNetwork.
      fileAttributesAs3 = ((body[tagBodyStart]! >> 3) & 1) === 1;
    } else if (tagType === TAG_DO_ABC || tagType === TAG_DO_ABC_DEFINE) {
      sawDoAbc = true;
    } else if (tagType === TAG_SYMBOL_CLASS) {
      sawSymbolClass = true;
    } else if (tagType === TAG_DO_ACTION || tagType === TAG_DO_INIT_ACTION) {
      sawDoAction = true;
    }

    pos = tagBodyStart + length;
  }

  if (fileAttributesAs3 || sawDoAbc) {
    const parts: string[] = [];
    if (fileAttributesAs3) parts.push("FileAttributes ActionScript3 bit set");
    if (sawDoAbc) parts.push("DoABC tag present");
    if (sawSymbolClass) parts.push("SymbolClass tag present");
    return { actionScript: "AS3", evidence: parts.join("; ") };
  }
  if (sawDoAction) {
    return { actionScript: "AS1/AS2", evidence: "DoAction tag present, no DoABC" };
  }
  if (sawFileAttributes && !fileAttributesAs3) {
    return { actionScript: "AS1/AS2", evidence: "FileAttributes present with ActionScript3 bit clear" };
  }
  if (version < 9) {
    return { actionScript: "AS1/AS2", evidence: `SWF version ${version} with no AS3 tags` };
  }
  return { actionScript: "unknown", evidence: "no ActionScript tags found" };
}

const REF_TOKENS = [
  "loadMovie",
  "loadMovieNum",
  "loadVariables",
  "LoadVars",
  "getURL",
  "navigateToURL",
  "URLLoader",
  "URLRequest",
  "URLStream",
  "sendAndLoad",
  "XMLSocket",
  "Socket",
  "flash.net",
  "SharedObject",
  "ExternalInterface",
  "fscommand",
  "http://",
  "https://",
  ".swf",
  ".xml",
  ".php",
  ".jsp",
  ".asp",
];

/**
 * Pull printable ASCII runs out of the decompressed body and keep the ones that
 * look like external loads or network calls. These are hints for the report,
 * not a guarantee; an agent reads them and decides.
 */
function scanExternalRefs(body: Buffer): string[] {
  const text = body.toString("latin1");
  const runs = text.match(/[\x20-\x7e]{4,}/g) ?? [];
  const found = new Set<string>();
  for (const run of runs) {
    for (const token of REF_TOKENS) {
      if (run.includes(token)) {
        const trimmed = run.length > 120 ? run.slice(0, 120) + "..." : run;
        found.add(trimmed);
        break;
      }
    }
    if (found.size >= 40) break;
  }
  return [...found];
}
