import { cp, copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { PackageResult } from "../types.js";
import { Workspace } from "../util/evidence.js";
import { flashShell, javaShell, type CreditsInfo } from "../templates/shell.js";

export interface PackageInput {
  gameFile: string;
  kind: "flash" | "java";
  title?: string;
  width?: number | null;
  height?: number | null;
  flashvars?: Record<string, string>;
  appletClass?: string | null;
  mainClass?: string | null;
  sourceUrl?: string | null;
  captureTimestamp?: string | null;
  licenseFile?: string | null;
  /** Extra files found alongside the game to carry into the site. */
  assets?: string[];
  /** Flash: path to the cached Ruffle build directory (holds ruffle.js). */
  rufflePath?: string;
  /** Java: the CheerpJ loader URL, version, and license note. */
  cheerpjLoaderUrl?: string;
  cheerpjVersion?: string;
  cheerpjLicenseNote?: string;
}

const DEFAULT_FLASH = { width: 640, height: 480 };
const DEFAULT_JAVA = { width: 800, height: 600 };

/**
 * Assemble a self-contained static site: the game file, the runtime (Ruffle
 * copied in, or the CheerpJ loader referenced), any extra assets, and a sized
 * page with loading state, fullscreen, keyboard focus, an error panel, and a
 * credits section naming the original URL and archive capture.
 */
export async function packageSite(workspaceRoot: string, input: PackageInput): Promise<PackageResult> {
  const ws = new Workspace(workspaceRoot);
  await ws.ensure();
  await mkdir(ws.siteDir, { recursive: true });

  if (!existsSync(input.gameFile)) throw new Error(`game file not found: ${input.gameFile}`);
  const gameName = path.basename(input.gameFile);
  await copyFile(input.gameFile, path.join(ws.siteDir, gameName));

  for (const asset of input.assets ?? []) {
    if (existsSync(asset)) await copyFile(asset, path.join(ws.siteDir, path.basename(asset)));
  }

  let licenseName: string | null = null;
  if (input.licenseFile) {
    const licensePath = resolveLicense(input.licenseFile, input.gameFile);
    licenseName = path.basename(licensePath);
    await copyFile(licensePath, path.join(ws.siteDir, licenseName));
  }

  const width = input.width ?? (input.kind === "flash" ? DEFAULT_FLASH.width : DEFAULT_JAVA.width);
  const height = input.height ?? (input.kind === "flash" ? DEFAULT_FLASH.height : DEFAULT_JAVA.height);

  let html: string;
  if (input.kind === "flash") {
    if (!input.rufflePath || !existsSync(path.join(input.rufflePath, "ruffle.js"))) {
      throw new Error("cannot package Flash: no Ruffle build. Run `web-revive runtime ruffle` first.");
    }
    await cp(input.rufflePath, path.join(ws.siteDir, "ruffle"), { recursive: true });
    const credits: CreditsInfo = {
      sourceUrl: input.sourceUrl,
      captureTimestamp: input.captureTimestamp,
      runtimeName: "Ruffle (open source Flash Player emulator)",
      extra: licenseName ? [`License: ${licenseName}`] : [],
    };
    html = flashShell({
      title: input.title ?? gameName,
      swfFile: gameName,
      width,
      height,
      flashvars: input.flashvars,
      rufflePath: "ruffle",
      credits,
    });
  } else {
    const credits: CreditsInfo = {
      sourceUrl: input.sourceUrl,
      captureTimestamp: input.captureTimestamp,
      runtimeName: "CheerpJ",
      runtimeVersion: input.cheerpjVersion ?? null,
      licenseNote: input.cheerpjLicenseNote ?? "CheerpJ is proprietary; loaded from Leaning Technologies' CDN.",
      extra: licenseName ? [`License: ${licenseName}`] : [],
    };
    html = javaShell({
      title: input.title ?? gameName,
      width,
      height,
      loaderUrl: input.cheerpjLoaderUrl ?? "https://cjrtnc.leaningtech.com/4.3/loader.js",
      appletClass: input.appletClass ?? null,
      jarFiles: [gameName],
      mainClass: input.mainClass ?? null,
      credits,
    });
  }

  const indexPath = path.join(ws.siteDir, "index.html");
  await writeFile(indexPath, html);

  const result: PackageResult = {
    siteDir: ws.siteDir,
    indexHtml: indexPath,
    files: (await readdir(ws.siteDir)).sort(),
    kind: input.kind,
    runtime: input.kind === "flash" ? "ruffle" : "cheerpj",
    stage: { width, height },
  };
  await ws.writeJson("package.json", result);
  return result;
}

/**
 * Find the license file to ship. A relative path is looked up next to the game
 * file first, then from the current directory, so a bare `LICENSE` never picks
 * up an unrelated license from wherever the command happens to run. A missing
 * file is an error: shipping a game without its license, or with the wrong
 * one, is worse than not packaging it.
 */
export function resolveLicense(licenseFile: string, gameFile: string): string {
  const candidates = path.isAbsolute(licenseFile)
    ? [licenseFile]
    : [path.resolve(path.dirname(gameFile), licenseFile), path.resolve(licenseFile)];
  const found = candidates.find((c) => existsSync(c));
  if (!found) throw new Error(`license file not found: ${licenseFile} (looked in: ${candidates.join(", ")})`);
  return found;
}
