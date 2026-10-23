import { createHash } from "node:crypto";

/**
 * The User-Agent every request carries, so the Internet Archive and any origin
 * server can see what is contacting them and how to reach the project.
 */
export const USER_AGENT = "web-revive/0.2.0 (+https://github.com/Abelo9996/web-revive)";

export interface HttpResponse {
  url: string;
  status: number;
  ok: boolean;
  headers: Headers;
  body: Buffer;
}

// A single-slot queue. Every network call in the tool goes through here, so we
// never open more than one request at a time. This is the "be polite" rule.
let chain: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  // Keep the chain alive regardless of whether a task rejects.
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export interface GetOptions {
  /** Abort if the request takes longer than this. */
  timeoutMs?: number;
  accept?: string;
  /** Extra delay before the request, to stay gentle with the server. */
  politeDelayMs?: number;
}

/** GET a URL politely: one request at a time, always with our User-Agent. */
export function httpGet(url: string, options: GetOptions = {}): Promise<HttpResponse> {
  return enqueue(async () => {
    if (options.politeDelayMs) await delay(options.politeDelayMs);
    const controller = new AbortController();
    const timer = options.timeoutMs ? setTimeout(() => controller.abort(), options.timeoutMs) : null;
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          ...(options.accept ? { accept: options.accept } : {}),
        },
      });
      const body = Buffer.from(await res.arrayBuffer());
      return { url: res.url, status: res.status, ok: res.ok, headers: res.headers, body };
    } finally {
      if (timer) clearTimeout(timer);
    }
  });
}

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
