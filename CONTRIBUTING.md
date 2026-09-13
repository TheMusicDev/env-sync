# Contributing

Small tool, low ceremony.

## Setup

```sh
bun install
bun test          # 8 tests, fast
bunx tsc --noEmit # types
bun run build     # node-compatible bundle into dist/ (bin target)
```

Source runs on both Bun and Node (node:fs APIs only); the published `bin` is
the `dist/` bundle built for Node. Dev-run without building:
`bun src/index.ts check`.

## Rules

- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:` …).
- Arrow functions by default; no classes unless the framework demands one.
- No new dependencies unless genuinely unavoidable — citty is the only one.
- Keep the parser hand-rolled: `.env` format is tiny, dependencies cost more
  than they save.
- Tests cover any behavior change. The contract (mapping header semantics,
  hard-error on missing root var) is not negotiable without an RFC in an issue
  first.

## Releasing

Maintainer bumps version, tags, `npm publish`.