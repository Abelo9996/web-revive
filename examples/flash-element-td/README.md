# Flash Element TD (revived from a dead page in the Wayback Machine)

[Flash Element TD](https://en.wikipedia.org/wiki/Tower_defense#History) (2007) is one of the games that
popularized the tower-defense genre. Its original page is gone; the domain no longer serves it. It was
revived here straight from the dead page URL, which `revive` recovered through the Internet Archive:

```bash
web-revive revive http://www.novelconcepts.co.uk/flashelementtd/ --title "Flash Element TD"
```

## Result (one run, Apple Silicon, Ruffle nightly)

- The page did not load live. `find` queried the Wayback CDX API, took the page capture from
  **2007-02-03**, and parsed the embed.
- The capture referenced two `.swf` files: a 3 KB `Protected_...swf` sitelock stub and the real
  `FlashElementTD.swf`. `revive` validated the file headers and picked the real **181,320-byte** movie, not
  the stub.
- `inspect`: Flash, ActionScript 1/2.
- `verify`: started, non-blank; the input script reached gameplay, about 55.1 fps.
- One console error was logged: `net::ERR_CONNECTION_REFUSED`. That is the game trying to reach its old
  server (now dead), exactly the kind of online feature `revive` reports will not work offline. The game
  itself runs.

## What is here

The report, a start screenshot, and the gameplay GIF. The `.swf` is **not** redistributed (copyrighted).
Reproduce the run with the command above.
