# nest-typeorm-seeder

NestJS module for [typeorm-seeder](../typeorm-seeder). Runs your `@Seeder` classes automatically on application bootstrap — once per seeder by default, tracked in a database table so watch-mode restarts do not re-seed.

[![CI](https://github.com/joakimbugge/seeders/actions/workflows/ci.yml/badge.svg)](https://github.com/joakimbugge/seeders/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/joakimbugge/seeders/branch/main/graph/badge.svg)](https://codecov.io/gh/joakimbugge/seeders)

Coded by AI. Reviewed by humans.

📖 **[Full documentation](https://joakimbugge.github.io/seeders/nest/)** · [API reference](https://joakimbugge.github.io/seeders/api/nest-typeorm-seeder/)

---

## Installation

```bash
# npm
npm install @joakimbugge/nest-typeorm-seeder @joakimbugge/typeorm-seeder

# yarn
yarn add @joakimbugge/nest-typeorm-seeder @joakimbugge/typeorm-seeder

# pnpm
pnpm add @joakimbugge/nest-typeorm-seeder @joakimbugge/typeorm-seeder
```

The peer dependencies (`@nestjs/common`, `@nestjs/core`, `typeorm`, `reflect-metadata`) are required, but if you are adding this to an existing NestJS + TypeORM project they are already present.

## Quick example

Import `SeederModule` in your root module. It auto-detects the `DataSource` registered by `TypeOrmModule`:

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

## License

MIT
