# Dots and Boxes (Java 1.1 applet, revived in one command)

[Dots and Boxes](https://en.wikipedia.org/wiki/Dots_and_Boxes) is the classic pencil-and-paper game. This
is Keith Fenske's open-source Java implementation ([kwfenske/dots-and-boxes-game-java](https://github.com/kwfenske/dots-and-boxes-game-java)),
a Java 1.1 applet released under the GNU GPL v3. Revived straight from the jar in the repository:

```bash
web-revive revive https://github.com/kwfenske/dots-and-boxes-game-java/raw/main/dotbox2b.jar --title "Dots and Boxes"
```

## Result (one run, Apple Silicon, CheerpJ 4.3)

- Recovered `dotbox2b.jar` (10,485 bytes).
- `inspect`: Java, applet class `DotsAndBoxes2`, class major 45 (Java 1.1). No networking, no file access,
  so nothing is reported as breaking offline.
- `verify`: started, the AWT applet draws a non-blank, changing canvas with no console errors, about 5.1 fps
  in CheerpJ. The generic input script did not force a new game, so it is reported as **boots and
  animates**.
- A GIF of the run was recorded.

## What is here

This game is GPL-3.0, so the jar and its license are kept here:

- `dotbox2b.jar` the applet.
- `LICENSE` the GNU GPL v3 it ships under.
- `evidence/` the report, a start screenshot, and the GIF.
