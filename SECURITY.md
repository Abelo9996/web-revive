# Security

## Reporting a vulnerability

If you find a security issue, please open a GitHub issue marked security, or
contact the maintainer privately. We will respond as soon as we can.

## What web-revive does on your machine

- It runs locally and never calls an LLM or sends telemetry.
- Network traffic is limited to: the page or file you point it at; the Internet
  Archive (only when something is missing); the Ruffle release download from
  GitHub; and, for Java, the CheerpJ loader, which the packaged page loads from
  Leaning Technologies' CDN at runtime.
- Every request carries a User-Agent naming the tool, and `find` makes one
  request at a time.
- `setup` only touches `~/.claude.json`, `~/.codex/config.toml`, and
  `~/.cursor/mcp.json`. It backs each up to `<file>.bak` before writing and is a
  dry run unless you pass `--yes`.

## Handling untrusted input

Game files you revive are untrusted data. web-revive parses them (it does not
execute them) and keeps downloads inside the workspace you name. When extracting
archives it rejects entries that would escape the destination directory. Ruffle
and CheerpJ run the game inside the browser sandbox, not on your host. Review
what you package before you publish it, and make sure you have the right to
share a game before sharing it.
