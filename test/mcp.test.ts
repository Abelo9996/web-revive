import { describe, expect, it } from "vitest";
import { createServer } from "../src/mcp/server.js";

describe("MCP server", () => {
  it("creates a server with the expected tools registered", () => {
    const server = createServer();
    // The McpServer keeps registered tools on an internal map; assert they exist.
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools;
    expect(tools).toBeTruthy();
    for (const name of ["find", "inspect", "runtime", "package", "serve", "verify", "report"]) {
      expect(Object.keys(tools)).toContain(name);
    }
  });
});
