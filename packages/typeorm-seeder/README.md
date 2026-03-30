# typeorm-seeder

Decorator-based entity seeding for TypeORM. Annotate your entity properties with `@Seed()`, then create or persist fully populated entity graphs with a single function call — including relations, embedded types, and circular guards.

[![CI](https://github.com/joakimbugge/seeders/actions/workflows/ci.yml/badge.svg)](https://github.com/joakimbugge/seeders/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/joakimbugge/seeders/branch/main/graph/badge.svg)](https://codecov.io/gh/joakimbugge/seeders)

Coded by AI. Reviewed by humans.

📖 **[Full documentation](https://joakimbugge.github.io/seeders/)** · [API reference](https://joakimbugge.github.io/seeders/api/typeorm-seeder/)

---

## Installation

`typeorm` and `reflect-metadata` are peer dependencies.

```bash
# npm
npm install @joakimbugge/typeorm-seeder typeorm reflect-metadata

# yarn
yarn add @joakimbugge/typeorm-seeder typeorm reflect-metadata

# pnpm
pnpm add @joakimbugge/typeorm-seeder typeorm reflect-metadata
```

Verify these are enabled in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Quick example

Annotate entity properties with `@Seed()`, organize seeders into `@Seeder` classes, and run them with `runSeeders`:

```ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'
import { faker } from '@faker-js/faker'
import { Seed, Seeder, runSeeders, seed } from '@joakimbugge/typeorm-seeder'
import type { SeederInterface, SeedContext } from '@joakimbugge/typeorm-seeder'

@Entity()
class Author {
  @PrimaryGeneratedColumn()
  id!: number

  @Seed(() => faker.person.fullName())
  @Column()
  name!: string

  @Seed({ count: 3 })
  @OneToMany(() => Book, (b) => b.author)
  books!: Book[]
}

@Seeder()
class AuthorSeeder implements SeederInterface {
  async run(ctx: SeedContext) {
    await seed(Author).saveMany(10, ctx)
  }
}

await runSeeders([AuthorSeeder], { dataSource })
```

## License

MIT
