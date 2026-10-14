# Changelog

All notable changes to this project are documented here. The format is based on
Keep a Changelog, and this project aims to follow Semantic Versioning.

## [Unreleased]

### Added
- `examples/flash-mathslash`: Math Slash, a real open-source ActionScript 2 Flash game (GPL-3.0, from
  [andy-shi88/MathSlash](https://github.com/andy-shi88/MathSlash)), revived end to end. `verify` reported
  `started`, non-blank, changing frames at about 35.6 fps in headless Chromium (Ruffle nightly-2026-10-13)
  with no console errors or warnings; the intro animates into the menu. The `.swf` and its license are in
  the folder.
- `examples/java-reversi`: Reversi (Othello), a real GPL-3.0 Java 1.1 applet (from
  [kwfenske/reversi-game-java](https://github.com/kwfenske/reversi-game-java)), revived end to end with
  CheerpJ. `verify` reported `started`, non-blank, changing canvas with no console errors; the board, the
  controls, and the Othello opening position render. The `.jar` and its license are in the folder.

### Changed
- The README demo GIF is now the Math Slash revival (a real open-source game) instead of the generated
  bounce fixture. `flash-bounce` is retained as a minimal self-contained fixture rather than the headline.

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
