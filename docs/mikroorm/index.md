# Getting started

Decorator-based entity seeding for MikroORM. Annotate entity properties with `@Seed()`, then create or persist fully populated entity graphs with a single call — including relations, embedded types, and circular guards. Organize complex seeding scenarios into `@Seeder` classes with declared dependencies that are automatically ordered and executed.

## Installation

::: code-group

```bash [npm]
npm install @joakimbugge/mikroorm-seeder @mikro-orm/core
```

```bash [yarn]
yarn add @joakimbugge/mikroorm-seeder @mikro-orm/core
```

```bash [pnpm]
pnpm add @joakimbugge/mikroorm-seeder @mikro-orm/core
```

:::

## Metadata providers

`mikroorm-seeder` works with both `ReflectMetadataProvider` and `TsMorphMetadataProvider`. See the [MikroORM docs](https://mikro-orm.io/docs/using-decorators) for setup.

::: warning ES decorators are not supported
`mikroorm-seeder` requires **legacy decorators** (`experimentalDecorators: true`). The newer TC39 ES decorator proposal — which MikroORM also supports via `@mikro-orm/decorators` — is not currently supported. Attempting to use ES decorators will result in relations and embedded properties not being auto-seeded.
:::

## Basic usage

Import entity decorators from `@mikro-orm/decorators/legacy`, annotate properties with `@Seed()`, then call `create()` or `save()`:

```ts
import { Entity, PrimaryKey, Property, OneToMany, ManyToOne } from '@mikro-orm/decorators/legacy'
import { faker } from '@faker-js/faker'
import { Seed, create, save } from '@joakimbugge/mikroorm-seeder'

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

@Entity()
class Book {
  @PrimaryKey()
  id!: number

  @Seed(() => faker.lorem.words(4))
  @Property()
  title!: string

  @Seed()
  @ManyToOne(() => Author)
  author!: Author
}

// Create in memory — no database required
const author = await create(Author)
// author.name → full name
// author.books → 3 Book instances each with their own seeded properties

// Create and persist to the database
const saved = await save(Author, { em })
// saved.id → assigned by MikroORM after flush
```
