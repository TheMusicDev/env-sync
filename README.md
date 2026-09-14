# @themusicdev/env-sync

CLI that syncs a monorepo root `.env` into per-app `.env` files. Each app's
`.env.example` declares its contract: a `# .env.mapping` header lists which
vars to pull from root, the body lists all vars (header + local-only).

## Contract

```dotenv
# apps/api/.env.example
# .env.mapping        ← marker: sync list starts
# API_PORT            ← same-name var from root .env (must exist in root)
# PORT=API_PORT       ← rename syntax (rare — framework-mandated names)

API_PORT=             ← header vars get root values on `env-sync write`
LOG_LEVEL=debug       ← body-not-in-header = local-only, never synced
```

Rules:

- Header var missing in root `.env` → hard error (check exits 1, write aborts).
- Body vars not in header are local-only — left alone.
- Keys in an app `.env` not declared in its example are flagged (check) and
  preserved (write).

## Commands

| Command | What it does |
|---|---|
| `env-sync check` | Dry-run drift report. Exit 1 on errors. |
| `env-sync write` | Regenerate per-app `.env` from root + headers, preserving local values and undeclared extras. |
| `env-sync create` | Scaffold root `.env` + `.env.example` from the union of all app headers. Skips existing root files. |

Run from the monorepo root. Root files live at `./.env` and `./.env.example`.

## Install

```sh
bun add github:TheMusicDev/env-sync   # from GitHub
bun add @themusicdev/env-sync         # from npm
bun link @themusicdev/env-sync        # local dev, after `bun link` in this dir
```

Typical root scripts in the consuming repo:

```json
{
    "env:check": "env-sync check",
    "env:sync": "env-sync write"
}
```

## Turbo note

Turbo hashes env files into cache keys — add `.env` to `globalEnv` (or task
`env` keys) in `turbo.json`, or every sync silently poisons cache correctness.

## License

[MIT](LICENSE) — contributions welcome, see [CONTRIBUTING.md](CONTRIBUTING.md).