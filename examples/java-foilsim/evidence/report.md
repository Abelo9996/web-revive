# Revival report: FoilSim III (NASA BGA) Java applet revived with CheerpJ

Generated 2026-10-14T05:34:51.443Z

## Compatibility

- Kind: java
- Runtime: cheerpj
- Verdict: likely
- Java: Java 1.1 (class major 45), 41 classes, applet Foil

Findings:
- [ok] Java applet: Extends Applet/JApplet. CheerpJ runs applets through its <applet> tag support on Java 8.
- note: CheerpJ is proprietary software from Leaning Technologies, loaded at runtime from its CDN. Free for personal use; check its license for commercial use.

## Runtime

- CheerpJ loader: https://cjrtnc.leaningtech.com/4.3/loader.js (version 4.3)
- CheerpJ is proprietary software from Leaning Technologies. Free for personal use; check its license for commercial use. The page loads it from Leaning Technologies' servers at runtime.
- note: CheerpJ is not downloaded or bundled. The packaged page references the CDN loader above.

## Package

- Site: /Users/abelyagubyan/Downloads/web-revive/.work/java/site
- Runtime: cheerpj
- Stage: 950x450
- Files: FoilSim.jar, index.html

## Verification

- Result: pass
- Started: yes
- Stage non-blank: yes (changed: yes)
- Frames: 87, 21.7 fps over 4008 ms
- Interactions: click:#wr-stage, key:Space, key:ArrowRight

Screenshots: start.png, end.png

## Limits

- FoilSim's license is not stated by NASA's repo, so the .jar is not redistributed here; reproduce with the download command in the README.
- CheerpJ is proprietary and loads from Leaning Technologies' CDN at runtime.

## Commands run

