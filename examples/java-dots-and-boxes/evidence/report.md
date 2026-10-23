# Revival report: Dots and Boxes

Generated 2026-10-23T09:22:26.333Z

## Source

- Input: https://github.com/kwfenske/dots-and-boxes-game-java/raw/main/dotbox2b.jar
- Page reached: no (live: yes)
- Found java game: https://github.com/kwfenske/dots-and-boxes-game-java/raw/main/dotbox2b.jar (direct file URL (live))

Downloaded files:
- dotbox2b.jar 10485 bytes, sha256 0738458fc234521bf4082ba93190f82717eacbe44129ca7d1bfffee76ffe5e7d

## Compatibility

- Kind: java
- Runtime: cheerpj
- Verdict: likely
- Java: Java 1.1 (class major 45), 3 classes, applet DotsAndBoxes2, Main-Class DotsAndBoxes2

Findings:
- [ok] Java applet: Extends Applet/JApplet. CheerpJ runs applets through its <applet> tag support on Java 8.
- note: CheerpJ is proprietary software from Leaning Technologies, loaded at runtime from its CDN. Free for personal use; check its license for commercial use.

## Runtime

- CheerpJ loader: https://cjrtnc.leaningtech.com/4.3/loader.js (version 4.3)
- CheerpJ is proprietary software from Leaning Technologies. Free for personal use; check its license for commercial use. The page loads it from Leaning Technologies' servers at runtime.
- note: CheerpJ is not downloaded or bundled. The packaged page references the CDN loader above.

## Package

- Site: <workspace>/site
- Runtime: cheerpj
- Stage: 800x600
- Files: dotbox2b.jar, index.html

## Verification

- Result: pass
- Started: yes
- Stage non-blank: yes (changed: yes)
- Frames: 36, 5.1 fps over 7105 ms
- Reached: boots only (idle activity 0.1994, post-input 0.0005)
  - The stage stayed static after input; still on the title screen or not responding to generic input.
- Gameplay GIF: gameplay.gif
- Interactions: click:#wr-stage (focus), click:center (400,300), click:play-area (400,372), click:lower-menu (400,468), key:Enter, key:Space, key:ArrowRight, key:ArrowUp

Screenshots: start.png, end.png

## Commands run

