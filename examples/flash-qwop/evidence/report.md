# Revival report: QWOP

Generated 2026-10-23T09:21:17.027Z

## Source

- Input: https://archive.org/download/flash_games/qwop.swf
- Page reached: no (live: yes)
- Found flash game: https://archive.org/download/flash_games/qwop.swf (direct file URL (live))

Downloaded files:
- qwop.swf 137929 bytes, sha256 9fa3d3c459500b73cd148759579036cfc03a681c79b89c65a2bda9aaca93670e

## Compatibility

- Kind: flash
- Runtime: ruffle
- Verdict: may-have-problems
- SWF: CWS v9, ActionScript AS3, stage 640x400, 30 fps, 1 frames
- External references: <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org..., clear!http://adobe.com/AS3/2006/builtin, flash.net

Findings:
- [warn] ActionScript 3 movie: Ruffle's AS3 support is partial. Many AS3 movies run, but some features are unimplemented. Confirm with verify.
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
- Stage: 640x400
- Files: index.html, qwop.swf, ruffle

## Verification

- Result: pass
- Started: yes
- Stage non-blank: yes (changed: yes)
- Frames: 428, 59.5 fps over 7196 ms
- Reached: gameplay (idle activity 0, post-input 0.0228)
  - Sustained stage change after input, clearly above the idle title animation.
- Gameplay GIF: gameplay.gif
- Interactions: click:#wr-stage (focus), click:center (320,200), click:play-area (320,248), click:lower-menu (320,312), key:Enter, key:Space, key:ArrowRight, key:ArrowUp

Screenshots: start.png, end.png

## Limits

- Score saving, logins, or leaderboards that called a server will not work offline.

## Commands run

