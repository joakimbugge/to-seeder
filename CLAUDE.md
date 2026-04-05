# Monorepo structure

Four packages across two ORM families:
- `@joakimbugge/typeorm-seeder` + `@joakimbugge/nest-typeorm-seeder`
- `@joakimbugge/mikroorm-seeder` + `@joakimbugge/nest-mikroorm-seeder`

NestJS packages are thin DI wrappers around their core counterparts.

## Commands

```bash
pnpm build          # Build all packages
pnpm test           # Run all tests (vitest)
pnpm typecheck      # Type-check all packages
pnpm lint:fix       # Lint with oxlint
pnpm fmt            # Format with oxfmt
pnpm run dev:watch  # Watch mode for all packages in parallel
```

## Tooling

- Bundler: `tsdown` (dual ESM/CJS output with `.mjs`/`.cjs` extensions)
- Linter: `oxlint` — not ESLint
- Formatter: `oxfmt` — not Prettier
- Tests: `vitest` with globals enabled (no imports needed for `describe`/`it`/`expect`)

# Versioning and release

Releases are fully automated via [Release Please](https://github.com/googleapis/release-please). There are no changeset files — do not create them.

## How it works

After CI passes on a push to `main`, Release Please reads the conventional commit prefixes and the files each commit touched to determine which packages need a new version. It opens and maintains a single "chore: release" PR. Merging that PR publishes to npm and redeploys the docs.

## Bump type mapping

| Conventional commit | Bump |
|---|---|
| `fix:`, `docs:` (public-facing) | patch |
| `feat:` | minor |
| `feat!:` / `BREAKING CHANGE` | minor (no 1.0 releases yet — use minor instead of major) |
| `docs:`, `chore:`, `refactor:` touching only non-package files | no release |

## Package attribution

Release Please determines which packages a commit belongs to by looking at which files were changed — not by commit scope. A commit touching `packages/mikroorm-seeder/src/...` is attributed to `@joakimbugge/mikroorm-seeder` only. A commit touching files in multiple package directories is attributed to all of them.

## What not to do

- Do not run `pnpm changeset` — changesets have been removed.
- Do not manually edit `package.json` version fields — Release Please owns those.
- Do not manually edit `CHANGELOG.md` files — Release Please owns those too.
