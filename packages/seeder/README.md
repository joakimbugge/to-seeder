# seeder

ORM-agnostic foundation for decorator-based entity seeding. This is the core package that `typeorm-seeder` and `mikroorm-seeder` are built on.

**If you are using TypeORM or MikroORM, install the ORM-specific package instead** — you do not need this package directly.

📖 **[Full documentation](https://joakimbugge.github.io/seeders/seeder/)** · [API reference](https://joakimbugge.github.io/seeders/api/seeder/)

---

## When to use this package

Install `@joakimbugge/seeder` directly when you want to build seeder support for a data layer that is not TypeORM or MikroORM. It provides the `@Seed` decorator, the full creation and persistence pipeline, and two adapter interfaces for plugging in your ORM.

## Installation

```bash
# npm
npm install @joakimbugge/seeder

# yarn
yarn add @joakimbugge/seeder

# pnpm
pnpm add @joakimbugge/seeder
```

## Quick example

Implement `MetadataAdapter` and `PersistenceAdapter`, then wire them into a `seed()` function:

```ts
import {
  makeSeedBuilder,
  Seed,
} from '@joakimbugge/seeder'
import type {
  MetadataAdapter,
  PersistenceAdapter,
  EntityConstructor,
  EntityInstance,
  SeedContext,
} from '@joakimbugge/seeder'

const metadataAdapter: MetadataAdapter = {
  getEmbeddeds: () => [],
  getRelations: () => [],
}

interface MyContext extends SeedContext {
  db: MyDatabaseConnection
}

const persistenceAdapter: PersistenceAdapter<MyContext> = {
  async save(_EntityClass, entities, { db }) {
    return db.insertAll(entities)
  },
}

export function seed<T extends EntityInstance>(EntityClass: EntityConstructor<T>) {
  return makeSeedBuilder(EntityClass, metadataAdapter, persistenceAdapter)
}
```

Then annotate entities and seed as usual:

```ts
import { faker } from '@faker-js/faker'

class User {
  @Seed(() => faker.person.fullName())
  name!: string
}

const user = await seed(User).create()
// user.name → seeded full name

await seed(User).save({ db })
// persisted via your adapter
```

## License

MIT
