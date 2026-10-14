# wayback

`find` against dead URLs, showing the Internet Archive fallback. Each run
records every URL it contacted. No game files are kept here; these pages are
other people's content.

## A dead page

```bash
web-revive find "http://www.albinoblacksheep.com/flash/badger"
```

The page returns 404 today. `find` queried the Wayback CDX API and listed the
captures it holds. For this URL the only snapshots are a 2004 redirect (302) and
a 2015 soft-404, so there was no clean page to rebuild from. The full trail is
in [`find-badger.json`](find-badger.json): `page -> 404`, `wayback CDX -> 200`
(2 captures), `archived page -> 404`.

## A dead file, recovered from the archive

```bash
web-revive find "http://www.homestarrunner.com/main.swf" --save /tmp/hsr
```

This file does not load live. `find` went to the archive, found a capture, and
downloaded it (see [`find-homestar-main-swf.json`](find-homestar-main-swf.json)).
Running `web-revive inspect` on the result showed it was a Wayback placeholder
page, not the real movie, so the tool reported it as an unrecognized file rather
than pretending it was a game. That is the honest outcome: `find` recovers
whatever the archive actually has, and `inspect` tells you what it is.

## What this shows

- A direct live file or page is read in place, and its embeds are parsed
  (`<object>`/`<embed>`/`<applet>`/swfobject).
- When the page or file is gone, `find` queries the CDX API, picks the best
  capture (a 200 first, then the most recent), and downloads the raw bytes with
  the `id_` form so the archive does not rewrite them.
- Every request, status, and capture timestamp is recorded for the report.
