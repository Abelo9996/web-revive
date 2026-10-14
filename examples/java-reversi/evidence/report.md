# Revival report: Reversi

Generated 2026-10-14T05:50:34.980Z

## Compatibility

- Kind: java
- Runtime: cheerpj
- Verdict: likely
- Java: Java 1.1 (class major 45), 3 classes, applet Reversi2, Main-Class Reversi2

Findings:
- [ok] Java applet: Extends Applet/JApplet. CheerpJ runs applets through its <applet> tag support on Java 8.
- note: CheerpJ is proprietary software from Leaning Technologies, loaded at runtime from its CDN. Free for personal use; check its license for commercial use.

## Runtime

- CheerpJ loader: https://cjrtnc.leaningtech.com/4.3/loader.js (version 4.3)
- CheerpJ is proprietary software from Leaning Technologies. Free for personal use; check its license for commercial use. The page loads it from Leaning Technologies' servers at runtime.
- note: CheerpJ is not downloaded or bundled. The packaged page references the CDN loader above.

## Package

- Site: /Users/abelyagubyan/Downloads/web-revive/.work/java-reversi/site
- Runtime: cheerpj
- Stage: 700x500
- Files: LICENSE, index.html, revers2b.jar

## Verification

- Result: pass
- Started: yes
- Stage non-blank: yes (changed: yes)
- Frames: 10, 1.7 fps over 6006 ms
- Interactions: click:#wr-stage, key:Space, key:ArrowRight

Screenshots: start.png, end.png

## Commands run

