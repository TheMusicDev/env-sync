# env-sync — working notes

Session-continuity doc: decisions, status, and next steps so a fresh chat
session can pick up without re-deriving anything.

## Status (2026-09-13)

- Extracted to this repo (`TheMusicDev/env-sync`, private) via
  `git filter-repo --subdirectory-filter` — history of the 3 env-sync commits
  preserved from the conventions repo.
- `bun test` 8 pass · `tsc --noEmit` clean · CLI smoke-tested (create → write → check).

## Decisions made

- **Contract**: each app's `.env.example` declares everything. A
  `# .env.mapping` header lists vars pulled from root `.env` (bare name =
  same-name from root; `APP_VAR=ROOT_VAR` = rename, rare — framework-mandated
  names like `PORT=API_PORT` only). Body vars not in header = **local-only**,
  never synced. Header var missing in root `.env` = **hard error** (check exits
  1, write aborts that file, never half-writes).
- **Root owns per-app names**: root `.env` uses `API_PORT` / `WORKERS_PORT`
  style, not shared `PORT`. Two apps wanting the same root var with different
  values is an anti-pattern — per-app root var names, no escape-hatch syntax.
- Undeclared keys in a real `.env`: flagged by `check`, preserved by `write`
  (with a marker comment pointing back at `.env.example`).
- **Commands**: `env-sync check` (dry-run, exit 1 on errors) / `write`
  (regenerate, preserve local values + extras) / `create` (scaffold root
  `.env` + `.env.example` from union of headers; never overwrites existing).
- Citty CLI, Bun runs TS directly — no build step. Binary name `env-sync` is
  constant across all install methods.
- package.json uses the convention set: never pin versions (caret ranges only),
  `packageManager: bun@1.3.14` pin is the one exception.

## Consuming repos — three stages

1. **Now (this machine)**: `bun link` in this dir, then
   `bun link @themusicdev/env-sync` in any project.
2. **Next repo**: `bun add file:../mono-repo-skill/env-sync`.
3. **Real (DONE — this repo)**:
   `bun add git+ssh://git@github.com/TheMusicDev/env-sync.git`.
   ⚠️ Private repo gotcha: the `github:TheMusicDev/env-sync` shorthand 404s —
   bun fetches its tarball via the unauthenticated GitHub API. Use the SSH git
   URL. npm publish later → plain `bun add @themusicdev/env-sync`. Root
   scripts never change:
   ```json
   { "env:check": "env-sync check", "env:sync": "env-sync write" }
   ```

## Extraction plan (own repo later)

Option A — keep history (`brew install git-filter-repo`):
```sh
git clone --no-hardlinks git@github.com:TheMusicDev/monorepo-conventions.git env-sync-repo
cd env-sync-repo
git filter-repo --subdirectory-filter env-sync
git remote set-url origin git@github.com:TheMusicDev/env-sync.git
git push
```
Option B — copy dir into fresh repo, first commit = start. Fine; tool is small.

(`git mv` itself is only for renames inside the same repo — irrelevant here.)

## Extraction plan — DONE (kept for reference)

Was in `TheMusicDev/monorepo-conventions` under `env-sync/`; carved out with
`git clone --no-hardlinks` + `git filter-repo --subdirectory-filter env-sync`,
remote repointed, pushed. `git mv` itself only renames inside one repo.

## Starter wiring — TODO

- [ ] Add `env:check` / `env:sync` root scripts to `monorepo-starter/` +
      dep on `github:TheMusicDev/env-sync` (now real).
- [ ] turbo.json: add `.env` to `globalEnv` (or task `env` keys) — otherwise
      every sync silently poisons turbo's task-cache keys.
- [ ] New convention concept in `monorepo-conventions/` (e.g. `env/env-sync.md`)
      describing the contract + root-var naming rule; update `run-scripts.md`
      with the `env:*` scripts; add log.md entry.

## Env-var convention background

Chose plain `.env` files over Infisical/Doppler/sops. Infisical (self-hosted
on Dokploy) stays the future option if pain triggers appear: second machine,
collaborators, drift across machines. Root `.env` + `.env.example` committed
example; per-app `.env` gitignored (starter `.gitignore` already covers
`.env` / `.env.*` with `!.env.example` negation).

## WebStorm note

Bundled package.json schema predates bun → squiggle on
`packageManager: "bun@1.3.14"`. Fixed via remote SchemaStore mapping:
Settings → Languages & Frameworks → Schemas and DTDs → JSON Schema Mappings →
`https://json.schemastore.org/package.json` on `package.json` pattern.