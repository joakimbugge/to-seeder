# API reference

## `SeederModule.forRoot(options)`

Registers the module with static options.

## `SeederModule.forRootAsync(options)`

Registers the module with options resolved from the DI container.

## `SeederModule.forFeature(seeders)`

Registers seeders scoped to a feature module. Accepts an array of `(SeederCtor | string)[]` — the same mix of constructors and glob patterns accepted by `forRoot`. No additional options — `runOnce`, `historyTableName`, hooks, and `enabled` are all controlled from `forRoot`.

**`SeederModuleAsyncOptions`**

| Property | Type | Description |
|---|---|---|
| `imports` | `any[]?` | Modules to import for the factory's dependencies. |
| `inject` | `any[]?` | Providers to inject into the factory. |
| `useFactory` | `(...args) => SeederModuleOptions \| Promise<SeederModuleOptions>` | Factory that returns the module options. |

---

## `SeederModuleOptions`

`SeederModuleOptions` is a discriminated union with two shapes depending on which properties are provided.

**Shared properties** (available in both shapes)

| Property | Type | Default | Description |
|---|---|---|---|
| `dataSource` | `DataSource?` | — | Explicit DataSource. When omitted, the module resolves the DataSource registered by `TypeOrmModule`. |
| `relations` | `boolean?` | `true` | Passed through to `runSeeders`. Set to `false` to skip relation seeding. |
| `enabled` | `boolean?` | `true` | When `false`, seeding is skipped entirely. Useful for gating on an environment variable. |
| `logging` | `boolean?` | `true` | When `false`, suppresses all seeder progress output. When `true`, logs via NestJS's own `Logger` — output follows NestJS's logging configuration. |
| `onBefore` | `(seeder) => void \| Promise<void>` | — | Called before each seeder runs. |
| `onAfter` | `(seeder, durationMs) => void \| Promise<void>` | — | Called after each seeder completes successfully. |
| `onError` | `(seeder, error) => void \| Promise<void>` | — | Called when a seeder throws. The error is still re-thrown after this returns. |

The hooks behave identically to the [hooks in `runSeeders`](/guide/api#runSeeders) and are passed through to it directly.

**With `seeders`** — `run` is optional; `runOnce` and `historyTableName` apply

| Property | Type | Default | Description |
|---|---|---|---|
| `seeders` | `(SeederCtor \| string)[]` | — | Seeder classes or glob patterns resolving to seeder files (`.js` or `.ts`). Only classes decorated with `@Seeder` are collected. Transitive dependencies are resolved automatically. |
| `run` | `RunCallback?` | — | Inline callback executed after all seeders. Always runs — `runOnce` does not apply to it. |
| `runOnce` | `boolean?` | `true` | Track executed seeders in the database and skip them on subsequent boots. |
| `historyTableName` | `string?` | `'seeders'` | Name of the table used to track which seeders have run. |

**With `run` only** — no `seeders`, no `runOnce`

| Property | Type | Description |
|---|---|---|
| `run` | `RunCallback` | Inline callback executed on every boot. No run-once tracking is applied. |
