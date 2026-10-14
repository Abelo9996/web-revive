# flash-mathslash

Math Slash, a real ActionScript 2 Flash game, revived in the browser with
Ruffle. It is a fruit-slash-style arithmetic game (slice the tiles that solve
the equation) with an animated intro, a menu, and sound, built by a student at
STMIK Pontianak around 2013.

This is the headline example in the project README: a full, original Flash game
that someone shipped, running again in headless Chromium with nothing but
web-revive and Ruffle.

## Source and license

- Repository: [github.com/andy-shi88/MathSlash](https://github.com/andy-shi88/MathSlash)
- Commit: `fb08edf08eba01673150e4df9e3672d1f165323e`
- File: `Math Slash.swf` (renamed to `MathSlash.swf` here)
- License: GPL-3.0 (`License.md`, carried into this folder and into the packaged
  site). The author's own work; the repo's `ReadMe.md` confirms it.

The `.swf` is redistributed here under that license, with the license file next
to it.

## Revive it

```bash
WS=/tmp/mathslash
mkdir -p $WS/game && cp MathSlash.swf $WS/game/
web-revive inspect $WS/game/MathSlash.swf --save $WS
web-revive runtime ruffle --save $WS
web-revive package $WS --title "Math Slash" \
  --source-url https://github.com/andy-shi88/MathSlash --license License.md
web-revive verify  $WS --seconds 5
web-revive report  $WS --title "Math Slash"
```

## What inspect found

Kind `flash`, runtime `ruffle`. The movie is `CWS v10, AS1/AS2, stage 800x600`.
AS1/AS2 is exactly the content Ruffle handles best. inspect rates it
`may-have-problems` for one reason: it flags external references. Those turn out
to be an XMP metadata block and a `getURL` to a Facebook page
(`facebook.com/ryuzakia1`), not runtime asset loads, so the game renders fully
with no extra files. The flag is honest and conservative; the run proves the
movie is self-contained.

## Result on this Mac

`verify` reported `started: true`, `canvasNonBlank: true`, and the stage content
changing across the observation window, at about 35.6 fps in headless Chromium
with Ruffle nightly-2026-10-13, with no console errors and no runtime warnings.
The intro animates (a sword plunges in, a shuriken spins up) and resolves to the
main menu with `Play`, `Hint`, `Info`, and `Exit`.

See [`evidence/report.md`](evidence/report.md), the screenshots
[`evidence/screenshots/start.png`](evidence/screenshots/start.png) (intro) and
[`evidence/screenshots/end.png`](evidence/screenshots/end.png) (menu), and the
loop in [`evidence/demo.gif`](evidence/demo.gif).

## Rights

Math Slash is the author's own GPL-3.0 work; this folder redistributes the
`.swf` under that license and keeps `License.md` with it. Ruffle is MIT/Apache-2.0.
