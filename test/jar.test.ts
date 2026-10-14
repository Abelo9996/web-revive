import { describe, expect, it } from "vitest";
import { parseJar, parseClassFile, parseManifest, isZip, isClassFile } from "../src/parsers/jar.js";
import { readZipEntries } from "../src/parsers/zip.js";
import { buildZip, fakeClass } from "./fixtures.js";

const MANIFEST = "Manifest-Version: 1.0\r\nMain-Class: com.example.Game\r\n\r\n";

describe("zip reader", () => {
  it("lists stored entries", () => {
    const zip = buildZip([
      { name: "a.txt", data: Buffer.from("hello") },
      { name: "b.txt", data: Buffer.from("world") },
    ]);
    const entries = readZipEntries(zip);
    expect(entries.map((e) => e.name)).toEqual(["a.txt", "b.txt"]);
  });
});

describe("parseManifest", () => {
  it("parses key/value lines", () => {
    const m = parseManifest(MANIFEST);
    expect(m["Main-Class"]).toBe("com.example.Game");
    expect(m["Manifest-Version"]).toBe("1.0");
  });
});

describe("parseJar", () => {
  it("reads manifest, applet class, java version, and networking", () => {
    const applet = fakeClass(52, "java/applet/Applet main ([Ljava/lang/String;)V java/net/Socket");
    const plain = fakeClass(49, "some/other/Class");
    const jar = buildZip([
      { name: "META-INF/MANIFEST.MF", data: Buffer.from(MANIFEST) },
      { name: "com/example/Game.class", data: applet },
      { name: "com/example/Helper.class", data: plain },
    ]);
    const info = parseJar(jar);
    expect(info.mainClass).toBe("com.example.Game");
    expect(info.classCount).toBe(2);
    expect(info.appletClasses).toContain("com.example.Game");
    expect(info.maxMajor).toBe(52);
    expect(info.javaVersion).toMatch(/Java 8/);
    expect(info.usesNetworking).toBe(true);
  });

  it("flags bundled native libraries", () => {
    const jar = buildZip([
      { name: "META-INF/MANIFEST.MF", data: Buffer.from(MANIFEST) },
      { name: "Main.class", data: fakeClass(52, "main ([Ljava/lang/String;)V") },
      { name: "libnative.so", data: Buffer.from([0, 1, 2]) },
    ]);
    const info = parseJar(jar);
    expect(info.usesNativeLibs).toBe(true);
    expect(info.nativeLibEntries).toContain("libnative.so");
  });
});

describe("parseClassFile", () => {
  it("reads a single class file version and applet flag", () => {
    const info = parseClassFile(fakeClass(49, "javax/swing/JApplet"), "MyApplet.class");
    expect(info.maxMajor).toBe(49);
    expect(info.javaVersion).toMatch(/Java 5/);
    expect(info.appletClasses).toEqual(["MyApplet.class"]);
  });
});

describe("type guards", () => {
  it("recognizes zip and class signatures", () => {
    expect(isZip(buildZip([{ name: "x", data: Buffer.from("y") }]))).toBe(true);
    expect(isClassFile(fakeClass(52))).toBe(true);
    expect(isZip(fakeClass(52))).toBe(false);
  });
});
