# Changelog

All notable changes to this project are documented here. The format is based on
Keep a Changelog, and this project aims to follow Semantic Versioning.

## [Unreleased]

## [0.2.0] - unreleased

### Added
- `revive`: one command from a dead game's URL (or local file) to a playable link and a gameplay GIF. It
  runs find, inspect, runtime, package, verify, and report in order, then starts a preview server and prints
  the link, or ends with an honest reason it could not (AS3 feature gap, missing server, Java version, or a
  file found in no capture). A CLI subcommand (`web-revive revive <source>`, with `--no-serve`, `--no-gif`,
  `--out`, `--title`, `--json`) and an MCP tool.
- `revive` recovers dead pages through the Wayback Machine, following redirects and normalizing an Internet
  Archive capture URL to its raw `id_` form (which avoids the rewriting proxy that can answer 500 on a direct
  asset). When a dead page yields more than one `.swf` (a sitelock stub next to the real movie), it picks the
  file whose header is a real SWF/JAR/class and, among those, the largest.
- Getting past the menu: after boot, `revive` runs a short recorded input script (click the stage center and
  common button spots, then Enter, Space, and arrow keys) and judges "reached gameplay" versus "boots" by
  whether the stage keeps changing clearly more than the idle title animation did. The result reports which,
  honestly.
- Gameplay GIF: `revive` records a short, small GIF of the run in headless Chrome and saves it with the
  report. The encoder is dependency-free (median-cut palette, inter-frame transparency, LZW), so the
  shareable artifact is produced without ffmpeg or any system tool.
- Server dependence: `revive` states plainly, in the report and the final output, which features will not
  work offline (scores, logins, level downloads, external SWF/XML loads, sockets) based on what `inspect`
  found the game loading from outside itself.
- Internal, dependency-free utilities: a PNG decoder and animated-GIF encoder (`src/util`), with unit tests
  for the GIF structure, the input script and gameplay judging on synthetic frame sequences, Wayback URL
  handling, and server-dependence reporting.

### Added (0.1.x examples)
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

### Fixed
- `package --license` now looks up a relative path next to the game file first, then the current
  directory, and fails if the file is missing. Before, a bare `LICENSE` run from this repo picked up
  web-revive's own MIT license instead of the game's, and a missing file was silently dropped.

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
