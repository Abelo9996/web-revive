# Contributing

Thanks for your interest in web-revive.

## Setup

```bash
npm install
npm run build
npm test          # vitest, offline and fast
npm run lint
npm run typecheck
```

## Guidelines

- Keep the tool deterministic and honest. It drives real tools (Ruffle, CheerpJ,
  the Internet Archive, a headless browser) and records evidence. It never calls
  an LLM, and it does not invent results.
- Tests are offline and fast. Parsers are tested against small fixtures generated
  in the tests. Anything that needs the network is marked and skipped by default
  (run with `WEB_REVIVE_NETWORK_TESTS=1`).
- Be polite on the network: one request at a time, always with the tool's
  User-Agent.
- Only redistribute game content you have the right to share. For anything else,
  keep only a report and a screenshot.
- No em dashes or en dashes in prose. Plain, specific sentences. Do not invent
  numbers; quote what the tools actually reported.

## Pull requests

Keep changes focused, with a clear description and tests where it makes sense.
Run lint, typecheck, and the test suite before opening a PR.
