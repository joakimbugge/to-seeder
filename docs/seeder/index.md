# Overview

`@joakimbugge/seeder` is the ORM-agnostic foundation that `typeorm-seeder` and `mikroorm-seeder` are built on. It handles the full seeding pipeline — factory invocation, relation traversal, cycle protection, and persistence delegation — while leaving ORM integration to two small adapter interfaces.

**You do not need to install this package to use seeding with TypeORM or MikroORM.** It is published separately for cases where you want to support a different data layer.

## Architecture

The pipeline is split into two adapters injected at construction time:

- **`MetadataAdapter`** — reads ORM metadata to discover which properties are embeddeds and relations for a given class hierarchy.
- **`PersistenceAdapter`** — persists a batch of pre-created entity instances using the ORM connection.

ORM packages implement these interfaces and wire them into a `seed()` builder via `makeSeedBuilder`.

```
@Seed decorators
      │
      ▼
  create / save
      │
      ├── MetadataAdapter   ← ORM metadata (relations, embeddeds)
      │
      └── PersistenceAdapter ← ORM persistence (flush, save)
```

## Implementing a custom adapter

Install the package:

::: code-group

```bash [npm]
npm install @joakimbugge/seeder
```

```bash [yarn]
yarn add @joakimbugge/seeder
```

```bash [pnpm]
pnpm add @joakimbugge/seeder
```

:::

Define your adapters by implementing `MetadataAdapter` and `PersistenceAdapter`:

```ts
import type {
  MetadataAdapter,
  PersistenceAdapter,
  EmbeddedEntry,
  RelationEntry,
  EntityConstructor,
  EntityInstance,
  SeedContext,
} from '@joakimbugge/seeder'

const myMetadataAdapter: MetadataAdapter = {
  getEmbeddeds(hierarchy: EntityConstructor[]): EmbeddedEntry[] {
    // Return embedded property entries for the class hierarchy.
    // Each entry provides a `propertyName` and a `getClass` thunk.
    return []
  },

  getRelations(hierarchy: EntityConstructor[]): RelationEntry[] {
    // Return relation entries for the class hierarchy.
    // Only include properties with a resolvable constructor.
    // Set `isArray: true` for one-to-many / many-to-many.
    return []
  },
}

interface MyContext extends SeedContext {
  db: MyDatabaseConnection
}

const myPersistenceAdapter: PersistenceAdapter<MyContext> = {
  async save<T extends EntityInstance>(
    Entity: EntityConstructor<T>,
    entities: T[],
    context: MyContext,
  ): Promise<T[]> {
    return context.db.insertAll(entities)
  },
}
```

The `hierarchy` array passed to both adapter methods is ordered from the most-derived class to its base classes. If your ORM stores metadata per class (rather than aggregating inheritance), walk the full hierarchy to collect all entries.

## Wiring up a seed builder

Pass your adapters to `makeSeedBuilder` to produce a builder with the same `create` / `createMany` / `save` / `saveMany` API as the ORM packages:

```ts
import {
  makeSeedBuilder,
  makeMultiSeedBuilder,
} from '@joakimbugge/seeder'
import type { EntityConstructor, EntityInstance } from '@joakimbugge/seeder'

export function seed<T extends EntityInstance>(EntityClass: EntityConstructor<T>) {
  return makeSeedBuilder(EntityClass, myMetadataAdapter, myPersistenceAdapter)
}
```

The `@Seed` decorator is re-exported from this package and works the same way as in the ORM packages.

## API reference

See the [seeder API reference](/api/seeder/) for the full type reference.
