# Revival report: Bounce: open-source Flash animation revived with Ruffle

Generated 2026-10-14T05:34:51.225Z

## Compatibility

- Kind: flash
- Runtime: ruffle
- Verdict: likely
- SWF: FWS v6, ActionScript AS1/AS2, stage 400x300, 24 fps, 48 frames

Findings:
- [ok] ActionScript 1/2 movie: Ruffle's AS1/AS2 support is substantially more complete than its AS3 support, so this is the stronger case.

## Runtime

- Ruffle release: nightly-2026-10-13
- Asset: ruffle-nightly-2026_10_13-web-selfhosted.zip
- SHA-256: 9a8fea298e54c11146ecc3f22eaeea925c0d6cd0089860b1221d8aafa413f804
- note: Ruffle is MIT/Apache-2.0 open source. The self-hosted web build above was downloaded from the official GitHub releases.
- note: Using the cached Ruffle build. Pass force to re-download.

## Package

- Site: /Users/abelyagubyan/Downloads/web-revive/.work/flash/site
- Runtime: ruffle
- Stage: 400x300
- Files: bounce.swf, index.html, ruffle

## Verification

- Result: pass
- Started: yes
- Stage non-blank: yes (changed: yes)
- Frames: 121, 60.4 fps over 2003 ms
- Interactions: click:#wr-stage, key:Space, key:ArrowRight

Screenshots: start.png, end.png

## Limits

- The demo has no sound; it is a timeline animation with no ActionScript.

## Commands run

