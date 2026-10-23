# Interactive Buddy (revived in one command)

[Interactive Buddy](https://en.wikipedia.org/wiki/Interactive_Buddy) (2005) is the classic ActionScript 2
sandbox toy. Revived from the Internet Archive's Flash collection:

```bash
web-revive revive https://archive.org/download/flash_games/interactive_buddy.swf --title "Interactive Buddy"
```

## Result (one run, Apple Silicon, Ruffle nightly)

- Recovered `interactive_buddy.swf` (1,517,761 bytes) from archive.org.
- `inspect`: Flash, ActionScript 1/2.
- `verify`: started, non-blank, no console errors; the input script reached gameplay, about 58.1 fps.
- A gameplay GIF was recorded.

`revive` reports that score saving and any extra content this game loaded from a server will not work
offline. The "reached gameplay" verdict comes from a generic input script and can vary between runs.

## What is here

The report, a start screenshot, and the gameplay GIF. The `.swf` is **not** redistributed (copyrighted).
Reproduce the run with the command above.
