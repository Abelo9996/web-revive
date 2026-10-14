# Changelog

All notable changes to this project are documented here. The format is based on
Keep a Changelog, and this project aims to follow Semantic Versioning.

## [0.1.0] - 2026-10-14

First release. An MVP that revives Flash and Java web games in a modern browser.

### Added
- `find`: parse embedded games from a page (`<object>`/`<embed>`/`<applet>`/swfobject/AC_FL_RunContent);
  fall back to the Internet Archive CDX API, pick the best capture, and download it. One request at a time,
  with a User-Agent naming the tool.
- `inspect`: SWF header and tag parsing (compression, version, stage, frame rate, AS1/AS2 vs AS3, external
  loads) and JAR/class parsing (manifest, applet/main class, Java version, networking, file access, native
  libraries), with a compatibility verdict.
- `runtime`: fetch and cache Ruffle's self-hosted web build from GitHub releases (records tag and SHA-256);
  describe the CheerpJ CDN loader and its license.
- `package`: assemble a self-contained static site sized to the stage, with loading state, fullscreen,
  keyboard focus, an error panel, credits, and the runtime.
- `serve`: local static preview with the correct wasm MIME type.
- `verify`: open the packaged site in headless Chromium (Playwright) and record start state, console errors,
  runtime warnings, non-blank/changing frames, fps, scripted click and keys, and screenshots.
- `report`: Markdown and JSON evidence bundle.
- `setup`: register the MCP server with Claude Code, Codex, and Cursor (dry-run by default, backups,
  idempotent).
- MCP server over stdio and agent instructions in `skills/web-revive/SKILL.md`.
- Examples revived end to end: an open-source Flash animation, NASA's FoilSim Java applet, and Internet
  Archive `find` runs.
