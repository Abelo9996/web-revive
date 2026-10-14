# java-foilsim

FoilSim III, a Java applet from NASA's Beginner's Guide to Aeronautics, revived
in the browser with CheerpJ. It is a real airfoil simulator: streamlines over a
wing, live lift and drag output, and plots that update as you change the shape.

## The .jar is not in this folder

NASA's source repository ([github.com/nasa/BGA](https://github.com/nasa/BGA))
does not state a license, so this folder keeps only the report and a screenshot,
not `FoilSim.jar`. To reproduce, download the jar yourself (this copy is hosted
by Leaning Technologies' CheerpJ examples):

```bash
WS=/tmp/foilsim
mkdir -p $WS/game
curl -L -A "web-revive/0.1.0" \
  https://raw.githubusercontent.com/leaningtech/cheerpj-meta/main/examples/FoilSim-Applet/FoilSim.jar \
  -o $WS/game/FoilSim.jar
web-revive inspect $WS/game/FoilSim.jar --save $WS
web-revive runtime cheerpj --save $WS
web-revive package $WS --kind java --applet "Foil.class" --width 950 --height 450 --title "FoilSim III"
web-revive verify  $WS --seconds 4
web-revive report  $WS --title "FoilSim III"
```

## What inspect found

Kind `java`, runtime `cheerpj`, compatibility `likely`. The jar holds 41
classes compiled for Java 1.1, and the applet class is `Foil`.

## Result on this Mac

`verify` reported `started: true`, `canvasNonBlank: true`, content changing, at
about 21.7 fps in headless Chromium with CheerpJ 4.3. The screenshot
[`evidence/screenshots/foilsim.png`](evidence/screenshots/foilsim.png) shows the
full simulator running. See [`evidence/report.md`](evidence/report.md).

## Rights

FoilSim is NASA's work; this folder does not redistribute it. CheerpJ is
proprietary software from Leaning Technologies, loaded from its CDN at runtime
(free for personal use; check its license for commercial use).
