# Getting started

NestJS module for [typeorm-seeder](/guide/). Runs your `@Seeder` classes automatically on application bootstrap — once per seeder by default, tracked in a database table so watch-mode restarts do not re-seed. For simple cases, a `run` callback lets you seed without any class boilerplate.

::: info
This package handles the NestJS integration. The seeding itself — `@Seed()`, `@Seeder`, `seed()`, entity factories — is all defined in [typeorm-seeder](/guide/). Familiarity with that package will make this one much easier to use.
:::

## Installation

::: code-group

```bash [npm]
npm install @joakimbugge/nest-typeorm-seeder @joakimbugge/typeorm-seeder
```

```bash [yarn]
yarn add @joakimbugge/nest-typeorm-seeder @joakimbugge/typeorm-seeder
```

```bash [pnpm]
pnpm add @joakimbugge/nest-typeorm-seeder @joakimbugge/typeorm-seeder
```

:::

The peer dependencies (`@nestjs/common`, `@nestjs/core`, `typeorm`, `reflect-metadata`) are required, but if you are adding this to an existing NestJS + TypeORM project they are already present.

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

If your seeders declare dependencies on each other via the `@Seeder` decorator, they are sorted and executed in the correct order automatically — see [seeder suites](/guide/seeder-suites) for details.

`seeders` also accepts glob patterns alongside constructors. Patterns are expanded at bootstrap time and only classes decorated with `@Seeder` are collected:

```ts
SeederModule.forRoot({ seeders: [UserSeeder, 'dist/seeders/**/*.js'] })
```

TypeScript source files work too — no extra configuration needed. When running via `nest start` or `ts-node`, the TypeScript loader is already active and `.ts` patterns resolve just like `.js` ones:

```ts
SeederModule.forRoot({ seeders: ['src/seeders/**/*.ts'] })
```

## Providing a DataSource explicitly

If you manage the `DataSource` yourself rather than through `TypeOrmModule`, pass it directly:

```ts
SeederModule.forRoot({
  seeders: [UserSeeder],
  dataSource: myDataSource,
})
```

::: warning
A DataSource passed this way must already be initialized before the app bootstraps. The module does not call `initialize()` on it.
:::

## Async configuration

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
