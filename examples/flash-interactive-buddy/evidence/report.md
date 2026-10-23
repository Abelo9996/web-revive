# Revival report: Interactive Buddy

Generated 2026-10-23T09:21:32.288Z

## Source

- Input: https://archive.org/download/flash_games/interactive_buddy.swf
- Page reached: no (live: yes)
- Found flash game: https://archive.org/download/flash_games/interactive_buddy.swf (direct file URL (live))

Downloaded files:
- interactive_buddy.swf 1517761 bytes, sha256 76da8a05bfe3472afe4a2bca2c09486b5be614881d45621489fa2f2686d16b0f

## Compatibility

- Kind: flash
- Runtime: ruffle
- Verdict: may-have-problems
- SWF: FWS v7, ActionScript AS1/AS2, stage 550x400, 40 fps, 42 frames
- External references: <FONT COLOR="#0000FF"><U><A HREF="http://shock-value.deviantart.com">shock-value.deviantart.com</A></U></FONT></P>, unloadMovie, loadMovie, http://shock-value.t35.com/mailsv.php, sendAndLoad, SharedObject, initSharedObject, LoadVars

Findings:
- [ok] ActionScript 1/2 movie: Ruffle's AS1/AS2 support is substantially more complete than its AS3 support, so this is the stronger case.
- [warn] Loads external files: The movie pulls in other files at runtime (other SWFs, XML, or server calls). Those must be present too, or captured from the archive.

## Runtime

- Ruffle release: nightly-2026-10-13
- Asset: ruffle-nightly-2026_10_13-web-selfhosted.zip
- SHA-256: 9a8fea298e54c11146ecc3f22eaeea925c0d6cd0089860b1221d8aafa413f804
- note: Ruffle is MIT/Apache-2.0 open source. The self-hosted web build above was downloaded from the official GitHub releases.
- note: Using the cached Ruffle build. Pass force to re-download.

## Package

- Site: <workspace>/site
- Runtime: ruffle
- Stage: 550x400
- Files: index.html, interactive_buddy.swf, ruffle

## Verification

- Result: pass
- Started: yes
- Stage non-blank: yes (changed: yes)
- Frames: 395, 58.1 fps over 6799 ms
- Reached: gameplay (idle activity 0.0038, post-input 0.0084)
  - Sustained stage change after input, clearly above the idle title animation.
- Gameplay GIF: gameplay.gif
- Interactions: click:#wr-stage (focus), click:center (275,200), click:play-area (275,248), click:lower-menu (275,312), key:Enter, key:Space, key:ArrowRight, key:ArrowUp

Screenshots: start.png, end.png

## Limits

- Score saving, logins, or leaderboards that called a server will not work offline.
- Extra levels or content loaded from other SWF files must be captured too, or those parts will be missing.

## Commands run

