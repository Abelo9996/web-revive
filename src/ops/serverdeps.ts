import type { InspectReport } from "../types.js";

/**
 * Translate the external-load evidence from `inspect` into plain sentences
 * about what will not work once the game is a local, offline bundle. A revived
 * game is cut off from whatever servers it used to call, so scores, logins, and
 * downloaded levels silently stop working; saying so up front is more honest
 * than letting the user discover it. Pure, so it is unit-testable.
 */
export function describeOfflineLimits(inspect: InspectReport | null): string[] {
  if (!inspect) return [];
  const out: string[] = [];
  const add = (s: string) => {
    if (!out.includes(s)) out.push(s);
  };

  if (inspect.swf) {
    const refs = inspect.swf.externalRefs;
    const has = (re: RegExp) => refs.some((r) => re.test(r));
    if (has(/Socket/i)) {
      add("Live or multiplayer features that used a socket connection will not work: browsers have no raw TCP sockets.");
    }
    if (has(/loadVariables|URLLoader|URLRequest|sendAndLoad|https?:\/\//i)) {
      add("Score saving, logins, or leaderboards that called a server will not work offline.");
    }
    if (has(/loadMovie|\.swf/i)) {
      add("Extra levels or content loaded from other SWF files must be captured too, or those parts will be missing.");
    }
    if (has(/\.xml/i)) {
      add("Data loaded from XML files at runtime must be present alongside the game, or that content will be missing.");
    }
  }

  if (inspect.java) {
    if (inspect.java.usesNetworking) {
      add("Online features (scores, logins, level downloads) that used java.net will not connect: CheerpJ networking is limited.");
    }
    if (inspect.java.usesFileAccess) {
      add("Saving or loading files to disk will not behave as it did on the desktop: CheerpJ uses a virtual in-browser filesystem.");
    }
  }

  return out;
}
