---
name: web-revive
description: Bring a dead Flash (.swf) or Java (.jar/applet) web game back to life so it runs in a modern browser. Use when the user wants to play an old Flash game or Java applet again, revive a game from a dead web page or the Internet Archive, or make an abandoned browser game runnable. Drives Ruffle, CheerpJ, the Internet Archive, a static site builder, and a headless browser; records evidence at every step.
---

# web-revive

You give the user the power to revive a dead Flash or Java web game. You decide what to do; the
`web-revive` tools do the reliable work (finding the game, parsing it, fetching Ruffle or CheerpJ,
packaging, headless-browser verification) and record evidence. The tools never call a model. You call them
in order and read their output.

## What is supported

- Flash: `.swf` files, run with Ruffle. AS1/AS2 support is much more complete than AS3; say so.
- Java: `.jar` applets and applications, and single `.class` files, run with CheerpJ (Java 8, from its CDN).
- Inputs: a local file, a direct URL to one, or the URL of an old page that embedded one. If the page or
  file is gone, the Internet Archive is the fallback.

Native-code JARs (JNI), raw sockets, and server-side calls cannot be revived. Say so plainly; do not pretend.

## The loop

1. `find <url>` when you start from a page or a URL. Read the located games and their sizes. If the page or
   file is dead, it queries the Internet Archive and, with a workspace, downloads the best capture into
   `<workspace>/game`. Record the capture timestamp for the credits.
2. `inspect <file>` on the game file. Read the verdict: `likely`, `may-have-problems`, or `not-supported`,
   and each finding. If `not-supported` (for example a JNI native library), tell the user and stop.
3. `runtime ruffle` for Flash, or `runtime cheerpj` for Java. Save it to the workspace so `package` can find
   it. Ruffle is downloaded and cached; CheerpJ is referenced from its CDN.
4. `package <workspace>`. It reads `inspect.json` and `runtime.json` to size the stage and pick the runtime.
   For Java applets pass `appletClass` (the applet's class). Pass `sourceUrl`, `captureTimestamp`, and a
   `licenseFile` so the credits and the shipped license are right.
5. `verify <workspace>`. Read `started`, `canvasNonBlank`, `frames`/`fps`, `consoleErrors`, and
   `runtimeWarnings`. Quote these, do not invent them.
6. `serve <workspace>/site` if the user wants to play it locally.
7. `report <workspace>` with a title and honest limits.

## Rules

- Every claim you make must be backed by evidence in the workspace. Do not invent fps, frame counts, or "it
  works". Quote the verify output.
- One workspace directory per revival. Pass the same `workspace` to inspect, runtime, package, verify, report.
- Make sure the user has the right to share a game before packaging it for publishing. If the license is
  unclear, keep only the report and a screenshot.
- If a step fails, read the recorded output in the workspace `evidence/` folder and fix the real cause. Do
  not loosen a check to make it pass.

## Example (Flash)

```
find     https://old.example.com/play.html   workspace=/tmp/game
inspect  /tmp/game/game/thing.swf             workspace=/tmp/game
runtime  ruffle                               workspace=/tmp/game
package  workspace=/tmp/game  sourceUrl=https://old.example.com/play.html
verify   workspace=/tmp/game  seconds=3
report   workspace=/tmp/game  title="Thing"
```

## Example (Java applet)

```
inspect  /tmp/foil/game/FoilSim.jar           workspace=/tmp/foil
runtime  cheerpj                              workspace=/tmp/foil
package  workspace=/tmp/foil  kind=java  appletClass=Foil.class  width=950  height=450
verify   workspace=/tmp/foil  seconds=4
report   workspace=/tmp/foil  title="FoilSim"
```
