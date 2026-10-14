# java-reversi

Reversi (Othello), a real Java 1.1 AWT applet, revived in the browser with
CheerpJ. Pick a board size, click a square to place a disc, and the pieces you
trap flip to your colour; the computer plays the other side. Written by Keith
Fenske in 2004 and released under the GNU GPL.

Unlike NASA's FoilSim (whose repo states no license, so
[examples/java-foilsim](../java-foilsim) keeps only a report), this applet has a
clear open-source license, so the `.jar` is redistributed here.

## Source and license

- Repository: [github.com/kwfenske/reversi-game-java](https://github.com/kwfenske/reversi-game-java)
- Commit: `eb6c84670d7821ace403a6e3538b9a643ffed838`
- File: `revers2b.jar`
- License: GPL-3.0 (`LICENSE`, carried into this folder and into the packaged
  site). The author's own work; `Reversi2.java` carries the GPL header and the
  in-game credit line reads "Copyright (c) 2004 by Keith Fenske. GNU Public
  License."

## Revive it

```bash
WS=/tmp/reversi
mkdir -p $WS/game && cp revers2b.jar $WS/game/
web-revive inspect $WS/game/revers2b.jar --save $WS
web-revive runtime cheerpj --save $WS
web-revive package $WS --kind java --applet "Reversi2" \
  --width 700 --height 500 --title "Reversi" \
  --source-url https://github.com/kwfenske/reversi-game-java --license LICENSE
web-revive verify  $WS --seconds 6
web-revive report  $WS --title "Reversi"
```

## What inspect found

Kind `java`, runtime `cheerpj`, compatibility `likely`. The jar holds 3 classes
compiled for Java 1.1 (class major 45), and the applet class is `Reversi2`, which
`extends Applet`. Old AWT bytecode is exactly what CheerpJ's applet support
targets.

## Result on this Mac

`verify` reported `started: true`, `canvasNonBlank: true`, and the canvas content
changing across the observation window, in headless Chromium with CheerpJ 4.3,
with no console errors. The rendered board shows the controls (difficulty, rows,
columns, `New Game`, `Skip Turn`), the GPL credit line, and the four starting
discs in the classic Othello opening position.

The reported frame rate is low (about 1.7 fps). That is expected and honest: this
is an event-driven AWT applet that repaints on input, not a continuously animated
movie like FoilSim, so the frame counter only advances when the board changes.
The game is fully interactive; it is not running at a low frame rate while trying
to animate.

See [`evidence/report.md`](evidence/report.md) and the screenshots
[`evidence/screenshots/start.png`](evidence/screenshots/start.png) (CheerpJ still
loading) and [`evidence/screenshots/end.png`](evidence/screenshots/end.png) (the
board running).

## Rights

Reversi is Keith Fenske's own GPL-3.0 work; this folder redistributes the `.jar`
under that license and keeps `LICENSE` with it. CheerpJ is proprietary software
from Leaning Technologies, loaded from its CDN at runtime (free for personal use;
check its license for commercial use).
