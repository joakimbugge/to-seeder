# Getting started

NestJS module for [mikroorm-seeder](/mikroorm/). Runs your `@Seeder` classes automatically on application bootstrap — once per seeder by default, tracked in a database table so watch-mode restarts do not re-seed. For simple cases, a `run` callback lets you seed without any class boilerplate.

::: info
This package handles the NestJS integration. The seeding itself — `@Seed()`, `@Seeder`, `seed()`, entity factories — is all defined in [mikroorm-seeder](/mikroorm/). Familiarity with that package will make this one much easier to use.
:::

## Installation

::: code-group

```bash [npm]
npm install @joakimbugge/nest-mikroorm-seeder @joakimbugge/mikroorm-seeder
```

```bash [yarn]
yarn add @joakimbugge/nest-mikroorm-seeder @joakimbugge/mikroorm-seeder
```

```bash [pnpm]
pnpm add @joakimbugge/nest-mikroorm-seeder @joakimbugge/mikroorm-seeder
```

:::

The peer dependencies (`@nestjs/common`, `@nestjs/core`, `@mikro-orm/core`, `@mikro-orm/nestjs`, `reflect-metadata`) are required, but if you are adding this to an existing NestJS + MikroORM project they are already present.

## Basic usage

Import `SeederModule` in your root module. It auto-detects the `MikroORM` instance registered by `MikroOrmModule`, so no extra wiring is needed in the common case:

```ts
import { Module } from '@nestjs/common'
import { MikroOrmModule } from '@mikro-orm/nestjs'
import { SeederModule } from '@joakimbugge/nest-mikroorm-seeder'
import { UserSeeder } from './seeders/UserSeeder.js'

@Module({
  imports: [
    MikroOrmModule.forRoot({ ... }),
    SeederModule.forRoot({ seeders: [UserSeeder] }),
  ],
})
export class AppModule {}
```

If your seeders declare dependencies on each other via the `@Seeder` decorator, they are sorted and executed in the correct order automatically — see [seeder suites](/mikroorm/seeder-suites) for details.

`seeders` also accepts glob patterns alongside constructors. Patterns are expanded at bootstrap time and only classes decorated with `@Seeder` are collected:

```ts
SeederModule.forRoot({ seeders: [UserSeeder, 'dist/seeders/**/*.js'] })
```

TypeScript source files work too — no extra configuration needed. When running via `nest start` or `ts-node`, the TypeScript loader is already active and `.ts` patterns resolve just like `.js` ones:

```ts
SeederModule.forRoot({ seeders: ['src/seeders/**/*.ts'] })
```

## Providing an EntityManager explicitly

If you manage MikroORM yourself rather than through `MikroOrmModule`, pass an `EntityManager` directly:

```ts
SeederModule.forRoot({
  seeders: [UserSeeder],
  em: myEntityManager,
})
```

## Async configuration

Use `forRootAsync` to resolve options from the DI container — useful when the `EntityManager` or environment config is injected:

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
