# QWOP (revived in one command)

[QWOP](https://en.wikipedia.org/wiki/QWOP) is Bennett Foddy's ragdoll sprinting game (2008), an
ActionScript 3 Flash movie. It was revived here from the Internet Archive's Flash collection with a single
command:

```bash
web-revive revive https://archive.org/download/flash_games/qwop.swf --title "QWOP"
```

## Result (one run, Apple Silicon, Ruffle nightly)

- Recovered `qwop.swf` (137,929 bytes) from archive.org.
- `inspect`: Flash, ActionScript 3.
- `verify`: started, non-blank, no console errors; the input script reached gameplay (sustained stage
  change well above the idle title), about 59.5 fps in headless Chrome.
- A gameplay GIF was recorded.

ActionScript 3 is the harder case for Ruffle; this one runs. The "reached gameplay" verdict comes from a
generic input script and can vary between runs.

## What is here

The report, a start screenshot, and the gameplay GIF. The `.swf` is **not** redistributed: QWOP is Bennett
Foddy's copyrighted work. Reproduce the run yourself with the command above.
