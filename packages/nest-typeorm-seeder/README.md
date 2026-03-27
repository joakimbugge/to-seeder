# @joakimbugge/nest-typeorm-seeder

NestJS module for [@joakimbugge/typeorm-seeder](../typeorm-seeder). Runs your `@Seeder` classes automatically on application bootstrap — once per seeder by default, tracked in a database table so watch-mode restarts do not re-seed. For simple cases, a `run` callback lets you seed without any class boilerplate.

> [!TIP]
> This package handles the NestJS integration. The seeding itself — `@Seed()`, `@Seeder`, `seed()`, entity factories — is all defined in [@joakimbugge/typeorm-seeder](../typeorm-seeder/README.md). Familiarity with that package will make this one much easier to use.

[![CI](https://github.com/joakimbugge/to-seeder/actions/workflows/ci.yml/badge.svg)](https://github.com/joakimbugge/to-seeder/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/joakimbugge/to-seeder/branch/main/graph/badge.svg)](https://codecov.io/gh/joakimbugge/to-seeder)

Coded by AI. Reviewed by humans.

---

- [Installation](#installation)
- [Basic usage](#basic-usage)
  - [Providing a DataSource explicitly](#providing-a-datasource-explicitly)
  - [Async configuration](#async-configuration)
- [Feature modules](#feature-modules)
  - [Cross-module dependencies](#cross-module-dependencies)
- [Running once](#running-once)
  - [In combination with `dropSchema`](#in-combination-with-dropschema)
  - [Evolving seed data](#evolving-seed-data)
  - [Re-seeding](#re-seeding)
- [Seed scripts](#seed-scripts)
  - [Using both together](#using-both-together)
- [API reference](#api-reference)

---

## Installation

```bash
npm install @joakimbugge/nest-typeorm-seeder @joakimbugge/typeorm-seeder
```

The peer dependencies (`@nestjs/common`, `@nestjs/core`, `typeorm`, `reflect-metadata`) are required, but if you are adding this to an existing NestJS + TypeORM project they are already present.

---

## Basic usage

Import `SeederModule` in your root module. It auto-detects the `DataSource` registered by `TypeOrmModule`, so no extra wiring is needed in the common case:

```ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SeederModule } from '@joakimbugge/nest-typeorm-seeder'
import { UserSeeder } from './seeders/UserSeeder.js'

@Module({
  imports: [
    TypeOrmModule.forRoot({ ... }),
    SeederModule.forRoot({ seeders: [UserSeeder] }),
  ],
})
export class AppModule {}
```

If your seeders declare dependencies on each other via the `@Seeder` decorator, they are sorted and executed in the correct order automatically — see [@joakimbugge/typeorm-seeder](../typeorm-seeder#seeder-suites) for details.

### Providing a DataSource explicitly

If you manage the `DataSource` yourself rather than through `TypeOrmModule`, pass it directly:

```ts
SeederModule.forRoot({
  seeders: [UserSeeder],
  dataSource: myDataSource,
})
```

> [!IMPORTANT]
> A DataSource passed this way must already be initialized before the app bootstraps. The module does not call `initialize()` on it.

### Async configuration

Use `forRootAsync` to resolve options from the DI container — useful when the `DataSource` or environment config is injected:

```ts
import { ConfigService } from '@nestjs/config'

SeederModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    seeders: [UserSeeder],
    enabled: config.get('SEED') === 'true',
  }),
})
```

---

## Feature modules

Use `forFeature()` to register seeders alongside the entities they belong to, rather than centralising everything in the root module:

```ts
// UserModule.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    SeederModule.forFeature([UserSeeder]),
  ],
})
export class UserModule {}
```

```ts
// AppModule.ts
@Module({
  imports: [
    TypeOrmModule.forRoot({ ... }),
    SeederModule.forRoot({}),
    UserModule,
  ],
})
export class AppModule {}
```

All seeders — from `forRoot` and any number of `forFeature` calls — are collected and passed to `runSeeders` as a single flat list before execution begins. Dependency sorting and run-once tracking work exactly as they do when all seeders are declared in `forRoot`.

### Cross-module dependencies

A seeder in one feature module can depend on a seeder in another without any extra wiring — just declare the dependency via `@Seeder`:

```ts
@Seeder({ dependencies: [TenantSeeder] })  // TenantSeeder lives in TenantModule
export class UserSeeder implements SeederInterface { ... }
```

As long as both modules are imported into the app, the dependency is resolved correctly.

---

## Running once

By default (`runOnce: true`) each seeder is tracked in a `seeders` table — similar to how TypeORM tracks migrations. On the next boot — including watch-mode restarts — seeders already recorded in that table are skipped.

### In combination with `dropSchema`

When TypeORM's `dropSchema: true` is set, the entire schema — including the `seeders` table — is dropped on every start, so all seeders run regardless of `runOnce`.

| `dropSchema` | `runOnce` | What happens |
|---|---|---|
| `true` | `true` | Tracking table dropped → all seeders run (fresh schema needs fresh seeds) |
| `true` | `false` | Always runs |
| `false` | `true` | Tracking table persists → already-run seeders are skipped |
| `false` | `false` | Always runs (tracking disabled) |

`dropSchema: true` is typical in development when you want a clean slate on every restart — seeding every run is exactly what you want in that scenario. `runOnce: true` with a persistent schema is the right default for staging and production, where duplicate data is the concern.

### Evolving seed data

Treat seeders the way you treat migrations: once a seeder has run in a persistent environment, consider it immutable. If you need more data or different data, create a new seeder class rather than editing the existing one:

```ts
@Seeder()
class UserSeeder implements SeederInterface { ... }      // already ran, leave it alone

@Seeder({ dependencies: [UserSeeder] })
class UserSeederV2 implements SeederInterface { ... }   // adds more users on next boot
```

This keeps the history table accurate and avoids the question of what re-running a seeder would mean for data that already exists. This applies to environments where `dropSchema: false` and `runOnce: true` — in development with `dropSchema: true`, the schema is wiped on every restart anyway.

### Re-seeding

To force a seeder to run again, delete its row from the `seeders` table:

```sql
DELETE FROM "seeders" WHERE name = 'UserSeeder';
```

To reset everything and re-run all seeders on next boot:

```sql
DELETE FROM "seeders";
```

> [!NOTE]
> If your factories use random data (e.g. via Faker), setting `runOnce: false` means you will get a completely different dataset on every restart. This can be useful in some development setups, but is usually not what you want.

---

## Seed scripts

For simple cases where named, tracked seeders are more structure than you need, provide a `run` callback instead. It receives the resolved `DataSource` and executes on every boot — no run-once tracking applies:

```ts
SeederModule.forRoot({
  async run({ dataSource }) {
    await seed(User).saveMany(10, { dataSource })
  },
})
```

`run` is the escape hatch for seeding that should always happen. If you need run-once semantics, the named `@Seeder` pattern is the right tool.

> [!NOTE]
> Because `run` always executes, `runOnce` is not accepted when `seeders` is omitted — TypeScript will reject it at compile time.

### Using both together

`seeders` and `run` can coexist. Seeders run first (sorted, tracked per their `runOnce` setting), then `run` is called. This means the callback can safely assume seeder data is already in place:

```ts
SeederModule.forRoot({
  seeders: [UserSeeder],
  async run({ dataSource }) {
    // UserSeeder has already run
    await seed(AdminUser).save({ dataSource })
  },
})
```

`runOnce` applies only to `seeders` — `run` always executes regardless.

---

## API reference

### `SeederModule.forRoot(options)`

Registers the module with static options.

### `SeederModule.forRootAsync(options)`

Registers the module with options resolved from the DI container.

### `SeederModule.forFeature(seeders)`

Registers seeder classes scoped to a feature module. Accepts an array of `SeederCtor[]`. No additional options — `runOnce`, `historyTableName`, hooks, and `enabled` are all controlled from `forRoot`.

**`SeederModuleAsyncOptions`**

| Property | Type | Description |
|---|---|---|
| `imports` | `any[]?` | Modules to import for the factory's dependencies. |
| `inject` | `any[]?` | Providers to inject into the factory. |
| `useFactory` | `(...args) => SeederModuleOptions \| Promise<SeederModuleOptions>` | Factory that returns the module options. |

---

### `SeederModuleOptions`

`SeederModuleOptions` is a discriminated union with two shapes depending on which properties are provided.

**Shared properties** (available in both shapes)

| Property | Type | Default | Description |
|---|---|---|---|
| `dataSource` | `DataSource?` | — | Explicit DataSource. When omitted, the module resolves the DataSource registered by `TypeOrmModule`. |
| `relations` | `boolean?` | `true` | Passed through to `runSeeders`. Set to `false` to skip relation seeding. |
| `enabled` | `boolean?` | `true` | When `false`, seeding is skipped entirely. Useful for gating on an environment variable. |
| `onBefore` | `(seeder) => void \| Promise<void>` | — | Called before each seeder runs. |
| `onAfter` | `(seeder, durationMs) => void \| Promise<void>` | — | Called after each seeder completes successfully. |
| `onError` | `(seeder, error) => void \| Promise<void>` | — | Called when a seeder throws. The error is still re-thrown after this returns. |

The hooks behave identically to the hooks in [`runSeeders`](../typeorm-seeder/README.md#hooks) and are passed through to it directly.

**With `seeders`** — `run` is optional; `runOnce` and `historyTableName` apply

| Property | Type | Default | Description |
|---|---|---|---|
| `seeders` | `SeederCtor[]` | — | Seeder classes to run. Transitive dependencies are resolved automatically. |
| `run` | `RunCallback?` | — | Inline callback executed after all seeders. Always runs — `runOnce` does not apply to it. |
| `runOnce` | `boolean?` | `true` | Track executed seeders in the database and skip them on subsequent boots. |
| `historyTableName` | `string?` | `'seeders'` | Name of the table used to track which seeders have run. |

**With `run` only** — no `seeders`, no `runOnce`

| Property | Type | Description |
|---|---|---|
| `run` | `RunCallback` | Inline callback executed on every boot. No run-once tracking is applied. |

---

## License

MIT
