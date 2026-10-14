import type { JavaInfo } from "../types.js";
import { readZipEntries, readZipEntry } from "./zip.js";

/** class-file major version -> human Java version. */
const MAJOR_TO_VERSION: Record<number, string> = {
  45: "1.1",
  46: "1.2",
  47: "1.3",
  48: "1.4",
  49: "5",
  50: "6",
  51: "7",
  52: "8",
  53: "9",
  54: "10",
  55: "11",
  56: "12",
  57: "13",
  58: "14",
  59: "15",
  60: "16",
  61: "17",
  62: "18",
  63: "19",
  64: "20",
  65: "21",
  66: "22",
  67: "23",
};

const APPLET_REFS = ["java/applet/Applet", "javax/swing/JApplet"];
const NET_REFS = [
  "java/net/Socket",
  "java/net/ServerSocket",
  "java/net/DatagramSocket",
  "java/net/URL",
  "java/net/URLConnection",
  "java/net/HttpURLConnection",
];
const FILE_REFS = [
  "java/io/File",
  "java/io/FileInputStream",
  "java/io/FileOutputStream",
  "java/io/RandomAccessFile",
  "java/nio/file/",
];
const NATIVE_LIB_EXT = [".so", ".dll", ".jnilib", ".dylib"];
const MAIN_DESCRIPTOR = "([Ljava/lang/String;)V";

/** Parse a JAR (a ZIP) into a Java compatibility picture. */
export function parseJar(buf: Buffer): JavaInfo {
  const entries = readZipEntries(buf);
  const manifestEntry = entries.find((e) => e.name.toUpperCase() === "META-INF/MANIFEST.MF");
  const manifest = manifestEntry ? parseManifest(readZipEntry(buf, manifestEntry).toString("utf8")) : {};

  const classEntries = entries.filter((e) => e.name.endsWith(".class"));
  const nativeLibEntries = entries
    .filter((e) => NATIVE_LIB_EXT.some((ext) => e.name.toLowerCase().endsWith(ext)))
    .map((e) => e.name);

  const appletClasses: string[] = [];
  const entryClasses: string[] = [];
  const evidence: string[] = [];
  let usesNetworking = false;
  let usesFileAccess = false;
  let usesNativeLibs = nativeLibEntries.length > 0;
  let maxMajor: number | null = null;

  const limit = Math.min(classEntries.length, 600);
  for (let i = 0; i < limit; i++) {
    const e = classEntries[i]!;
    let data: Buffer;
    try {
      data = readZipEntry(buf, e);
    } catch {
      continue;
    }
    const major = classMajor(data);
    if (major !== null && (maxMajor === null || major > maxMajor)) maxMajor = major;

    const text = data.toString("latin1");
    const className = e.name.replace(/\.class$/, "").replace(/\//g, ".");
    if (APPLET_REFS.some((r) => text.includes(r))) appletClasses.push(className);
    if (text.includes(MAIN_DESCRIPTOR) && text.includes("main")) entryClasses.push(className);
    if (!usesNetworking && NET_REFS.some((r) => text.includes(r))) usesNetworking = true;
    if (!usesFileAccess && FILE_REFS.some((r) => text.includes(r))) usesFileAccess = true;
    if (!usesNativeLibs && text.includes("loadLibrary")) usesNativeLibs = true;
  }

  if (nativeLibEntries.length) evidence.push(`native library files bundled: ${nativeLibEntries.join(", ")}`);
  if (appletClasses.length) evidence.push(`applet classes: ${appletClasses.join(", ")}`);
  if (manifest["Main-Class"]) evidence.push(`manifest Main-Class: ${manifest["Main-Class"]}`);

  return {
    manifest,
    mainClass: manifest["Main-Class"] ?? null,
    appletClasses,
    entryClasses,
    classCount: classEntries.length,
    maxMajor,
    javaVersion: maxMajor !== null ? `Java ${MAJOR_TO_VERSION[maxMajor] ?? "?"} (class major ${maxMajor})` : null,
    usesNetworking,
    usesFileAccess,
    usesNativeLibs,
    nativeLibEntries,
    evidence,
  };
}

/** Parse a single .class file into the same shape (one class, no manifest). */
export function parseClassFile(buf: Buffer, name = "class"): JavaInfo {
  const major = classMajor(buf);
  if (major === null) throw new Error("not a Java class file (missing 0xCAFEBABE magic)");
  const text = buf.toString("latin1");
  const isApplet = APPLET_REFS.some((r) => text.includes(r));
  const hasMain = text.includes(MAIN_DESCRIPTOR) && text.includes("main");
  return {
    manifest: {},
    mainClass: null,
    appletClasses: isApplet ? [name] : [],
    entryClasses: hasMain ? [name] : [],
    classCount: 1,
    maxMajor: major,
    javaVersion: `Java ${MAJOR_TO_VERSION[major] ?? "?"} (class major ${major})`,
    usesNetworking: NET_REFS.some((r) => text.includes(r)),
    usesFileAccess: FILE_REFS.some((r) => text.includes(r)),
    usesNativeLibs: text.includes("loadLibrary"),
    nativeLibEntries: [],
    evidence: [],
  };
}

/** Read the class-file major version, or null if the magic is wrong. */
function classMajor(buf: Buffer): number | null {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0xcafebabe) return null;
  return buf.readUInt16BE(6);
}

/** Parse MANIFEST.MF, joining continuation lines (those starting with a space). */
export function parseManifest(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const logical: string[] = [];
  for (const raw of text.split(/\r\n|\r|\n/)) {
    if (raw.startsWith(" ") && logical.length) {
      logical[logical.length - 1] += raw.slice(1);
    } else {
      logical.push(raw);
    }
  }
  for (const line of logical) {
    const idx = line.indexOf(":");
    if (idx > 0) out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

export function isZip(buf: Buffer): boolean {
  return buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50;
}

export function isClassFile(buf: Buffer): boolean {
  return buf.length >= 4 && buf.readUInt32BE(0) === 0xcafebabe;
}
