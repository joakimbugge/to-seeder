# mikroorm-seeder

Decorator-based entity seeding for MikroORM. Annotate your entity properties with `@Seed()`, then create or persist fully populated entity graphs with a single function call — including relations, embedded types, and circular guards.

[![CI](https://github.com/joakimbugge/seeders/actions/workflows/ci.yml/badge.svg)](https://github.com/joakimbugge/seeders/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/joakimbugge/seeders/branch/main/graph/badge.svg)](https://codecov.io/gh/joakimbugge/seeders)

Coded by AI. Reviewed by humans.

📖 **[Full documentation](https://joakimbugge.github.io/seeders/mikroorm/)** · [API reference](https://joakimbugge.github.io/seeders/api/mikroorm-seeder/)

---

## Installation

`@mikro-orm/core` and `reflect-metadata` are peer dependencies.

```bash
# npm
npm install @joakimbugge/mikroorm-seeder @mikro-orm/core reflect-metadata

# yarn
yarn add @joakimbugge/mikroorm-seeder @mikro-orm/core reflect-metadata

# pnpm
pnpm add @joakimbugge/mikroorm-seeder @mikro-orm/core reflect-metadata
```

Enable legacy decorators in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

> **Note:** Only legacy decorators are supported. ES decorators (TC39) are not currently supported.

## Quick example

Annotate entity properties with `@Seed()`, organize seeders into `@Seeder` classes, and run them with `runSeeders`:

```ts
import { Entity, PrimaryKey, Property, OneToMany } from '@mikro-orm/decorators/legacy'
import { faker } from '@faker-js/faker'
import { Seed, Seeder, runSeeders, seed } from '@joakimbugge/mikroorm-seeder'
import type { SeederInterface, SeedContext } from '@joakimbugge/mikroorm-seeder'

@Entity()
class Author {
  @PrimaryKey()
  id!: number

  @Seed(() => faker.person.fullName())
  @Property()
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

await runSeeders([AuthorSeeder], { em })
```

## License

MIT
