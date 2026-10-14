# Revival report: Math Slash

Generated 2026-10-14T05:50:20.419Z

## Compatibility

- Kind: flash
- Runtime: ruffle
- Verdict: may-have-problems
- SWF: CWS v10, ActionScript AS1/AS2, stage 800x600, 24 fps, 8 frames
- External references: <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"> <rdf:Description rdf:about="" xmlns:xmp="http://ns.ado..., https://www.facebook.com/ryuzakia1

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

- Site: /Users/abelyagubyan/Downloads/web-revive/.work/flash-mathslash/site
- Runtime: ruffle
- Stage: 800x600
- Files: License.md, MathSlash.swf, index.html, ruffle

## Verification

- Result: pass
- Started: yes
- Stage non-blank: yes (changed: yes)
- Frames: 179, 35.6 fps over 5027 ms
- Interactions: click:#wr-stage, key:Space, key:ArrowRight

Screenshots: start.png, end.png

## Limits

- inspect flags external loads (a getURL/Facebook link); the game renders fully with no extra files

## Commands run

