import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "node:path";
import { find } from "../ops/find.js";
import { inspect } from "../ops/inspect.js";
import { fetchRuntime } from "../ops/runtime.js";
import { packageSite } from "../ops/package.js";
import { serve } from "../ops/serve.js";
import { verify } from "../ops/verify.js";
import { report } from "../ops/report.js";
import { revive } from "../ops/revive.js";
import { Workspace } from "../util/evidence.js";
import type { RuntimeInfo } from "../types.js";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function fail(err: unknown) {
  return { isError: true, content: [{ type: "text" as const, text: String(err instanceof Error ? err.message : err) }] };
}

async function save(workspace: string | undefined, name: string, data: unknown): Promise<void> {
  if (!workspace) return;
  const ws = new Workspace(workspace);
  await ws.ensure();
  await ws.writeJson(name, data);
}

/**
 * The MCP server exposes each operation as a tool. The tool does the reliable
 * work and returns evidence; the host agent decides what to run next. The tool
 * itself never calls a model.
 */
export function createServer(): McpServer {
  const server = new McpServer({ name: "web-revive", version: "0.2.0" });

  server.tool(
    "revive",
    "One call: find the game (live or from the Internet Archive), inspect it, fetch Ruffle or CheerpJ, package a static site, verify it in headless Chrome, run an input script to reach gameplay, record a gameplay GIF, and (unless noServe) start a preview server and return the link. Returns an honest blocker if it cannot.",
    {
      source: z.string().describe("page URL, direct .swf/.jar URL, local file, or an Internet Archive capture URL"),
      out: z.string().optional().describe("workspace directory"),
      title: z.string().optional(),
      seconds: z.number().default(4),
      gif: z.boolean().default(true),
      noServe: z.boolean().default(false),
    },
    async (a) => {
      try {
        const r = await revive(a.source, {
          outDir: a.out,
          title: a.title,
          observeSeconds: a.seconds,
          noGif: !a.gif,
        });
        if (r.ok && !a.noServe && r.siteDir) {
          const handle = await serve(r.siteDir);
          r.url = handle.url;
        }
        return json(r);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "find",
    "Locate the embedded Flash/Java game on a page or direct file URL. If it is gone, find the best Internet Archive capture and (with workspace) download it.",
    { url: z.string(), workspace: z.string().optional().describe("download into <workspace>/game and record evidence"), limit: z.number().default(20) },
    async ({ url, workspace, limit }) => {
      try {
        const saveDir = workspace ? path.join(workspace, "game") : undefined;
        const r = await find(url, { saveDir, limit });
        await save(workspace, "find.json", r);
        return json(r);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "inspect",
    "Parse a local or URL .swf/.jar/.class and report a compatibility verdict (likely / may have problems / not supported) with reasons.",
    { file: z.string(), workspace: z.string().optional() },
    async ({ file, workspace }) => {
      try {
        const r = await inspect(file);
        await save(workspace, "inspect.json", r);
        return json(r);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "runtime",
    "Fetch and cache a runtime: Ruffle (downloaded from GitHub releases, with tag and checksum) or CheerpJ (CDN loader described).",
    { kind: z.enum(["ruffle", "cheerpj"]), workspace: z.string().optional(), cacheRoot: z.string().optional(), force: z.boolean().default(false) },
    async ({ kind, workspace, cacheRoot, force }) => {
      try {
        const r = await fetchRuntime(kind, { cacheRoot, force });
        await save(workspace, "runtime.json", r);
        return json(r);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "package",
    "Assemble a self-contained static site: the game, the runtime, assets, and a sized page with loading, fullscreen, error panel, and credits.",
    {
      workspace: z.string(),
      gameFile: z.string(),
      kind: z.enum(["flash", "java"]),
      title: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      flashvars: z.record(z.string()).optional(),
      appletClass: z.string().optional(),
      mainClass: z.string().optional(),
      sourceUrl: z.string().optional(),
      captureTimestamp: z.string().optional(),
      licenseFile: z.string().optional(),
      assets: z.array(z.string()).default([]),
      rufflePath: z.string().optional(),
    },
    async (a) => {
      try {
        const ws = new Workspace(a.workspace);
        await ws.ensure();
        const runtimeInfo = await ws.readJson<RuntimeInfo>("runtime.json");
        const rufflePath = a.rufflePath ?? (runtimeInfo?.kind === "ruffle" ? runtimeInfo.cacheDir : undefined);
        const r = await packageSite(a.workspace, {
          gameFile: a.gameFile,
          kind: a.kind,
          title: a.title,
          width: a.width ?? null,
          height: a.height ?? null,
          flashvars: a.flashvars,
          appletClass: a.appletClass ?? null,
          mainClass: a.mainClass ?? null,
          sourceUrl: a.sourceUrl ?? null,
          captureTimestamp: a.captureTimestamp ?? null,
          licenseFile: a.licenseFile,
          assets: a.assets,
          rufflePath,
          cheerpjLoaderUrl: runtimeInfo?.kind === "cheerpj" ? runtimeInfo.loaderUrl : undefined,
          cheerpjVersion: runtimeInfo?.kind === "cheerpj" ? runtimeInfo.version : undefined,
          cheerpjLicenseNote: runtimeInfo?.kind === "cheerpj" ? runtimeInfo.licenseNote : undefined,
        });
        return json(r);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "serve",
    "Start a local static preview server with correct wasm MIME type. The server stays up while the MCP process runs.",
    { siteDir: z.string(), port: z.number().optional(), coi: z.boolean().default(false) },
    async (a) => {
      try {
        const handle = await serve(a.siteDir, { port: a.port, crossOriginIsolation: a.coi });
        return json({ url: handle.url, port: handle.port });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "verify",
    "Open the packaged site in headless Chromium: whether the game started, console errors, runtime warnings, non-blank/changing stage, fps, scripted click and keys, screenshots.",
    { workspace: z.string(), seconds: z.number().default(3), coi: z.boolean().default(false) },
    async (a) => {
      try {
        return json(await verify(a.workspace, { observeSeconds: a.seconds, crossOriginIsolation: a.coi }));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "report",
    "Write a Markdown and JSON evidence bundle from the workspace.",
    { workspace: z.string(), title: z.string(), limits: z.array(z.string()).default([]) },
    async (a) => {
      try {
        return json(await report(a.workspace, { title: a.title, limits: a.limits }));
      } catch (err) {
        return fail(err);
      }
    },
  );

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
