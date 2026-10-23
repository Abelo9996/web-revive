# My Friend Pedro (revived in one command)

[My Friend Pedro](https://en.wikipedia.org/wiki/My_Friend_Pedro) began as a 2014 browser Flash game (by
DeadToast Entertainment) before the console release. The original Flash version was revived from the
Internet Archive's Flash collection:

```bash
web-revive revive https://archive.org/download/flash_games/my_friend_pedro.swf --title "My Friend Pedro"
```

## Result (one run, Apple Silicon, Ruffle nightly)

- Recovered `my_friend_pedro.swf` (4,084,774 bytes) from archive.org.
- `inspect`: Flash, ActionScript 1/2.
- `verify`: started, non-blank, about 60.0 fps. The generic input script did not get past this game's own
  title/menu, so the run is reported honestly as **boots and animates**, not reached gameplay.
- Two console errors were logged: the game tries to fetch `http://www.deadtoast.com/dtads/mfp/dtads.txt`
  (an online config/ad call), which is blocked by CORS and fails. That is one of the offline limits `revive`
  reports; the game itself runs.
- A GIF of the run was recorded.

## What is here

The report, a start screenshot, and the GIF. The `.swf` is **not** redistributed (copyrighted). Reproduce
the run with the command above.
