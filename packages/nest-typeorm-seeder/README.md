# @joakimbugge/nest-typeorm-seeder

NestJS module for [@joakimbugge/typeorm-seeder](../typeorm-seeder). Runs your `@Seeder` classes automatically on application bootstrap — once per seeder by default, tracked in a database table so watch-mode restarts do not re-seed.

> [!TIP]
> This package handles the NestJS integration. The seeding itself — `@Seed()`, `@Seeder`, `seed()`, entity factories — is all defined in [@joakimbugge/typeorm-seeder](../typeorm-seeder/README.md). Familiarity with that package will make this one much easier to use.

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

## API reference

### `SeederModule.forRoot(options)`

Registers the module with static options.

### `SeederModule.forRootAsync(options)`

Registers the module with options resolved from the DI container.

**`SeederModuleAsyncOptions`**

| Property | Type | Description |
|---|---|---|
| `imports` | `any[]?` | Modules to import for the factory's dependencies. |
| `inject` | `any[]?` | Providers to inject into the factory. |
| `useFactory` | `(...args) => SeederModuleOptions \| Promise<SeederModuleOptions>` | Factory that returns the module options. |

---

### `SeederModuleOptions`

| Property | Type | Default | Description |
|---|---|---|---|
| `seeders` | `SeederCtor[]` | — | Seeder classes to run. Transitive dependencies are resolved automatically. |
| `dataSource` | `DataSource?` | — | Explicit DataSource. When omitted, the module resolves the DataSource registered by `TypeOrmModule`. |
| `relations` | `boolean?` | `true` | Passed through to `runSeeders`. Set to `false` to skip relation seeding. |
| `enabled` | `boolean?` | `true` | When `false`, seeding is skipped entirely. Useful for gating on an environment variable. |
| `runOnce` | `boolean?` | `true` | Track executed seeders in the database and skip them on subsequent boots. |
| `historyTableName` | `string?` | `'seeders'` | Name of the table used to track which seeders have run. |
| `onBefore` | `(seeder) => void \| Promise<void>` | — | Called before each seeder runs. |
| `onAfter` | `(seeder, durationMs) => void \| Promise<void>` | — | Called after each seeder completes successfully. |
| `onError` | `(seeder, error) => void \| Promise<void>` | — | Called when a seeder throws. The error is still re-thrown after this returns. |

These hooks behave identically to the hooks in [`runSeeders`](../typeorm-seeder/README.md#hooks) and are passed through to it directly.

---

## License

MIT
