# nest-mikroorm-seeder

NestJS module for [mikroorm-seeder](../mikroorm-seeder). Runs your `@Seeder` classes automatically on application bootstrap — once per seeder by default, tracked in a database table so watch-mode restarts do not re-seed.

[![CI](https://github.com/joakimbugge/seeders/actions/workflows/ci.yml/badge.svg)](https://github.com/joakimbugge/seeders/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/joakimbugge/seeders/branch/main/graph/badge.svg)](https://codecov.io/gh/joakimbugge/seeders)

Coded by AI. Reviewed by humans.

📖 **[Full documentation](https://joakimbugge.github.io/seeders/nest-mikroorm/)** · [API reference](https://joakimbugge.github.io/seeders/api/nest-mikroorm-seeder/)

---

## Installation

```bash
# npm
npm install @joakimbugge/nest-mikroorm-seeder @joakimbugge/mikroorm-seeder

# yarn
yarn add @joakimbugge/nest-mikroorm-seeder @joakimbugge/mikroorm-seeder

# pnpm
pnpm add @joakimbugge/nest-mikroorm-seeder @joakimbugge/mikroorm-seeder
```

The peer dependencies (`@nestjs/common`, `@nestjs/core`, `@mikro-orm/core`, `@mikro-orm/nestjs`, `reflect-metadata`) are required, but if you are adding this to an existing NestJS + MikroORM project they are already present.

## Quick example

Import `SeederModule` in your root module. It auto-detects the `MikroORM` instance registered by `MikroOrmModule`:

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

## License

MIT
