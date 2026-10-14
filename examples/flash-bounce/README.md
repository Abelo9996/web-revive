# flash-bounce

A small Flash animation, built here so web-revive has a Flash file it can
legally share. `make-swf.mjs` writes `bounce.swf` directly, with no Flash tools:
a blue square that moves across a navy stage over 48 frames at 24 fps. It uses
only timeline and shape tags, no ActionScript, which is the content Ruffle
handles best.

This whole example is original work under the MIT license (see `LICENSE`), so
the `.swf` is safe to redistribute.

## Rebuild the SWF

```bash
node make-swf.mjs bounce.swf           # AS1/AS2 timeline animation
node make-swf.mjs bounce-as3.swf --as3 # same movie, marked ActionScript 3
```

## Revive it

```bash
WS=/tmp/bounce
mkdir -p $WS/game && cp bounce.swf $WS/game/
web-revive inspect $WS/game/bounce.swf --save $WS
web-revive runtime ruffle --save $WS
web-revive package $WS --title "Bounce"
web-revive verify  $WS --seconds 3
web-revive report  $WS --title "Bounce"
```

## Result on this Mac

`verify` reported `started: true`, `canvasNonBlank: true`, and the stage
content changing across the observation window, at about 60 fps in headless
Chromium with Ruffle nightly-2026-10-13. See
[`evidence/report.md`](evidence/report.md), the screenshot
[`evidence/screenshots/bounce.png`](evidence/screenshots/bounce.png), and the
loop in [`evidence/demo.gif`](evidence/demo.gif).

## The AS3 variant

`bounce-as3.swf` is the same movie with the FileAttributes ActionScript 3 bit
set. `web-revive inspect bounce-as3.swf` rates it `may-have-problems` and says
why: Ruffle's AS3 support is only partial. It is the honest "this one is
riskier" case.
