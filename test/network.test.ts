import { describe, expect, it } from "vitest";
import { find } from "../src/ops/find.js";
import { fetchRuntime } from "../src/ops/runtime.js";

// Network tests are skipped by default. Run them with:
//   WEB_REVIVE_NETWORK_TESTS=1 npx vitest run test/network.test.ts
const RUN = process.env.WEB_REVIVE_NETWORK_TESTS === "1";

describe.skipIf(!RUN)("network: find and runtime", () => {
  it("finds Internet Archive captures for a dead page", async () => {
    const r = await find("http://www.albinoblacksheep.com/flash/badger", { limit: 5 });
    expect(r.pageLive).toBe(false);
    expect(r.pageCaptures.length).toBeGreaterThan(0);
    expect(r.requests.some((q) => q.url.includes("web.archive.org/cdx"))).toBe(true);
  }, 60000);

  it("fetches the Ruffle self-hosted build", async () => {
    const info = await fetchRuntime("ruffle", { force: true });
    expect(info.kind).toBe("ruffle");
    expect(info.releaseTag).toMatch(/nightly/);
    expect(info.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(info.files?.some((f) => f === "ruffle.js")).toBe(true);
  }, 120000);
});
