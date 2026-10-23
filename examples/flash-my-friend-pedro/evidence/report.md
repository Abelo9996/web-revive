# Revival report: My Friend Pedro

Generated 2026-10-23T09:21:43.735Z

## Source

- Input: https://archive.org/download/flash_games/my_friend_pedro.swf
- Page reached: no (live: yes)
- Found flash game: https://archive.org/download/flash_games/my_friend_pedro.swf (direct file URL (live))

Downloaded files:
- my_friend_pedro.swf 4084774 bytes, sha256 824e7411ce4802c3c0e34375161bf19a5efb8af96a507cc47fcb9a0dee6ceaa3

## Compatibility

- Kind: flash
- Runtime: ruffle
- Verdict: may-have-problems
- SWF: CWS v15, ActionScript AS1/AS2, stage 600x400, 32 fps, 24 frames
- External references: You can create an API ID for this submission at http://newgrounds.com/account/flashapi, http://www.deadtoast.com/dtads/mfp/, dtads_policy.xml, http://www.y8.com, http://www.deadtoast.com, http://www.y8.com/games/my_friend_pedro, http://www.ngads.com/gateway_v2.php, getURL

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
- Stage: 600x400
- Files: index.html, my_friend_pedro.swf, ruffle

## Verification

- Result: fail
- Started: yes
- Stage non-blank: yes (changed: no)
- Frames: 392, 60 fps over 6530 ms
- Reached: boots only (idle activity 0, post-input 0)
  - The stage stayed static after input; still on the title screen or not responding to generic input.
- Gameplay GIF: gameplay.gif
- Interactions: click:#wr-stage (focus), click:center (300,200), click:play-area (300,248), click:lower-menu (300,312), key:Enter, key:Space, key:ArrowRight, key:ArrowUp

Console errors:
- Access to fetch at 'http://www.deadtoast.com/dtads/mfp/dtads.txt' from origin 'http://127.0.0.1:49324' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
- Failed to load resource: net::ERR_FAILED

Screenshots: start.png, end.png

## Limits

- Score saving, logins, or leaderboards that called a server will not work offline.
- Extra levels or content loaded from other SWF files must be captured too, or those parts will be missing.
- Data loaded from XML files at runtime must be present alongside the game, or that content will be missing.

## Commands run

