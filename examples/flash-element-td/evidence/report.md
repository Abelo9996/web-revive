# Revival report: Flash Element TD

Generated 2026-10-23T09:22:12.953Z

## Source

- Input: http://www.novelconcepts.co.uk/flashelementtd/
- Page reached: yes (live: no)
- Found flash game: http://novelconcepts.co.uk/flashelementtd/Protected_FlashElementTDv2007-02-01.swf (<object> with Flash movie param)
- Found flash game: http://novelconcepts.co.uk/FlashElementTD/FlashElementTD.swf (<embed> Flash tag)

Page captures (Internet Archive):
- 20070111051417 status 200 http://novelconcepts.co.uk:80/FlashElementTD/
- 20070117103929 status 301 http://novelconcepts.co.uk:80/FlashElementTD
- 20070117103929 status 200 http://novelconcepts.co.uk:80/FlashElementTD/
- 20070202011121 status 200 http://novelconcepts.co.uk:80/FlashElementTd/
- 20070203154852 status 301 http://www.novelconcepts.co.uk:80/FlashElementTD

Captures of http://novelconcepts.co.uk/flashelementtd/Protected_FlashElementTDv2007-02-01.swf:
- 20070203194431 status 200 (application/x-shockwave-flash)
- 20080723112315 status 200 (text/html)
- 20220412010205 status 302 (text/html)

Captures of http://novelconcepts.co.uk/FlashElementTD/FlashElementTD.swf:
- 20070203171940 status 200 (application/x-shockwave-flash)
- 20100424184759 status 400 (text/html)
- 20150413155554 status 302 (unk)

Downloaded files:
- Protected_FlashElementTDv2007-02-01.swf 3112 bytes, sha256 3f580c13fb6372f023eb73dcffadc9725a70dc2137ed996e516af6a2a1baafaa, capture 20080723112315
- FlashElementTD.swf 181320 bytes, sha256 b04e6cb4ff483900cd1acf8a51d47c6ee4ea13a6cc8538e994a2dad58cb479e0, capture 20070203171940

## Compatibility

- Kind: flash
- Runtime: ruffle
- Verdict: may-have-problems
- SWF: CWS v8, ActionScript AS1/AS2, stage 650x450, 40 fps, 10 frames
- External references: http://, /my/core.swf?mv=7&fv=, loadMovie, http://x.mochiads.com/srv/1/, .swf, http://novelconcepts.co.uk/FlashElementTD/submitScore.asp?score=

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
- Stage: 650x450
- Files: FlashElementTD.swf, index.html, ruffle

## Verification

- Result: fail
- Started: yes
- Stage non-blank: yes (changed: yes)
- Frames: 489, 55.1 fps over 8875 ms
- Reached: gameplay (idle activity 0.0004, post-input 0.0358)
  - Sustained stage change after input, clearly above the idle title animation.
- Gameplay GIF: gameplay.gif
- Interactions: click:#wr-stage (focus), click:center (325,225), click:play-area (325,279), click:lower-menu (325,351), key:Enter, key:Space, key:ArrowRight, key:ArrowUp

Console errors:
- Failed to load resource: net::ERR_CONNECTION_REFUSED

Screenshots: start.png, end.png

## Limits

- Score saving, logins, or leaderboards that called a server will not work offline.
- Extra levels or content loaded from other SWF files must be captured too, or those parts will be missing.

## Commands run

