# @joakimbugge/typeorm-seeder

Decorator-based entity seeding for TypeORM. Annotate your entity properties with `@Seed()`, then create or persist fully populated entity graphs with a single function call — including relations, embedded types, and circular guards. Organise complex seeding scenarios into `@Seeder` classes with declared dependencies that are automatically ordered and executed for you.

[![CI](https://github.com/joakimbugge/to-seeder/actions/workflows/ci.yml/badge.svg)](https://github.com/joakimbugge/to-seeder/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/joakimbugge/to-seeder/branch/main/graph/badge.svg)](https://codecov.io/gh/joakimbugge/to-seeder)

Coded by AI. Reviewed by humans.

---

- [Installation](#installation)
- [Decorating entities](#decorating-entities)
- [Seeding entities](#seeding-entities)
  - [Saving](#saving)
  - [Without saving](#without-saving)
  - [Multiple entity types at once](#multiple-entity-types-at-once)
  - [Skipping relations](#skipping-relations)
  - [Passing a DataSource to factories](#passing-a-datasource-to-factories)
  - [Overriding seeded values](#overriding-seeded-values)
  - [Depending on earlier properties](#depending-on-earlier-properties)
- [Seeder suites](#seeder-suites)
- [Seeding without `@Seed()`](#seeding-without-seed)
- [Logging](#logging)
- [Hooks](#hooks)
- [Skipping seeders](#skipping-seeders)
- [Running seed scripts](#running-seed-scripts)
  - [TypeScript execution](#typescript-execution)
- [Loading entities from paths](#loading-entities-from-paths)
- [Loading seeders from paths](#loading-seeders-from-paths)
- [API reference](#api-reference)

---

## Installation

```bash
npm install @joakimbugge/typeorm-seeder
```

`typeorm` and `reflect-metadata` are peer dependencies and must be installed alongside it.

```bash
npm install typeorm reflect-metadata
```

Your `tsconfig.json` must have decorator support enabled:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

---

## Decorating entities

Use `@Seed()` on any entity property to describe how it should be populated. Plain column properties (scalars) take a factory function; relation properties take the bare decorator (or a `count` option for collections).

```ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne } from 'typeorm'
import { faker } from '@faker-js/faker'
import { Seed } from '@joakimbugge/typeorm-seeder'

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

@Entity()
class Book {
  @PrimaryGeneratedColumn()
  id!: number

  @Seed(() => faker.lorem.words(4))
  @Column()
  title!: string

  @Seed()
  @ManyToOne(() => Author, (a) => a.books)
  author!: Author
}
```

> [!IMPORTANT]
> **How circular relations are handled**
>
> When seeding `Author`, its `books` are seeded too. Each `Book` has an `author` relation back to `Author` — but seeding that would loop back to `Author`, which would seed more books, and so on forever.
>
> @joakimbugge/typeorm-seeder breaks the cycle at the point where a type would re-enter itself. In the example above, `book.author` is left `undefined` when seeding from `Author`. Seeding a `Book` directly works fine and does populate `book.author` — the cycle only cuts when a type is already being seeded higher up in the same chain.

---

## Seeding entities

Call `seed(EntityClass)` to get a builder with four methods: `create`, `createMany`, `save`, and `saveMany`.

```ts
import { seed } from '@joakimbugge/typeorm-seeder'
```

### Saving

`save()` and `saveMany()` create instances and write them to the database in one step. Pass a `DataSource` in the options.

```ts
const author = await seed(Author).save({ dataSource })
// author.id  → assigned by the database
// author.books → 3 persisted Book instances

const authors = await seed(Author).saveMany(5, { dataSource })
// [Author, Author, Author, Author, Author] — each with their own books
```

### Without saving

`create()` and `createMany()` build entity instances without touching the database. Useful for unit tests or for preparing entities before passing them to your own persistence logic.

```ts
const author = await seed(Author).create()
// Plain Author instance — no id, fully populated relations

const books = await seed(Book).createMany(10)
// [Book, Book, …] — each with its own seeded Author
```

### Multiple entity types at once

Pass an array of entity classes to seed one of each:

```ts
const [author, book] = await seed([Author, Book]).create()
const [author, book] = await seed([Author, Book]).save({ dataSource })
```

Relation seeding is **disabled by default** in this form — each entity is created independently, so there is no overlap between the `Author` you asked for and the `Author` that would have been auto-created inside `Book`. Pass `relations: true` to override:

```ts
const [author, book] = await seed([Author, Book]).save({ dataSource, relations: true })
// author.books → seeded  |  book.author → seeded (independently)
```

`createMany` and `saveMany` return an array per class:

```ts
const [authors, books] = await seed([Author, Book]).createMany(3)
// authors → [Author, Author, Author]
// books   → [Book, Book, Book]
```

### Skipping relations

Pass `relations: false` to create a flat entity with no relation properties set — useful when you want to wire relations yourself:

```ts
const author = await seed(Author).create({ relations: false })
// author.books → undefined

const book = await seed(Book).save({ dataSource, relations: false })
// book.author → null in the database
```

### Passing a DataSource to factories

If a factory needs to query the database, the `dataSource` you provide in options is forwarded to every factory via `SeedContext`:

```ts
@Seed(async ({ dataSource }) => {
  const existing = await dataSource!.getRepository(Role).findOneBy({ name: 'admin' })
  return existing!
})
@ManyToOne(() => Role)
role!: Role
```

> [!TIP]
> For anything more complex than a simple lookup — such as picking a random element from a result set — prefer the [`values` option](#overriding-seeded-values) instead. It keeps that logic in the call site rather than the entity decorator.

### Overriding seeded values

Pass a `values` map to inject specific values after all `@Seed` factories have run:

```ts
// Status is set even if Booking has no @Seed on it
const booking = await seed(Booking).create({ values: { status: 'confirmed' } })
const booking = await seed(Booking).save({ dataSource, values: { user, status: 'confirmed' } })
// All 5 get the same user
const bookings = await seed(Booking).createMany(5, { values: { user } })
const bookings = await seed(Booking).saveMany(5, { dataSource, values: { user } })
```

Each property in `values` can also be a factory function — it is called once per entity, so every instance can receive a unique generated value:

```ts
const bookings = await seed(Booking).saveMany(10, {
  dataSource,
  values: {
    // Unique per booking
    price: () => faker.number.float({ min: 10, max: 500 }),
    // Same for all
    status: 'confirmed',                                     
  },
})
```

Factory entries in `values` receive the same `(context, self)` arguments as `@Seed` factories, so you can read already-applied properties from `self` or query the database via `context.dataSource`.

`values` wins unconditionally: if a property has a `@Seed` factory, the factory still runs but its result is overwritten. `values` also works for properties with no `@Seed` decorator at all.

> [!NOTE]
> `values` are applied **after** all `@Seed` factories have finished, so they are never visible on `self` inside a `@Seed` factory callback.

---

### Depending on earlier properties

Properties are seeded in declaration order. Each factory receives the partially-built entity as its second argument (`self`), so a property can read any value that was seeded above it:

```ts
@Entity()
class Event {
  @Seed(() => faker.date.past())
  @Column()
  beginDate!: Date

  @Seed((_, self: Event) => faker.date.future({ refDate: self.beginDate }))
  @Column()
  endDate!: Date
}
```

Annotating `self` with the entity class (`self: Event` above) gives full type inference and autocompletion. Without the annotation `self` is typed as `any`, so property access still works — the annotation is only needed for type safety.

Properties declared *below* the current property are not yet set and will be `undefined` on `self` at that point.

---

## Seeder suites

For production seeding scripts or structured test fixtures, organise your seeding logic into `@Seeder` classes. Declare dependencies between seeders and let the library figure out the execution order.

```ts
import { Seeder, runSeeders, seed } from '@joakimbugge/typeorm-seeder'
import type { SeederInterface, SeedContext } from '@joakimbugge/typeorm-seeder'

@Seeder()
class UserSeeder implements SeederInterface {
  async run(ctx: SeedContext) {
    await seed(User).saveMany(10, ctx)
  }
}

@Seeder({ dependencies: [UserSeeder] })
class PostSeeder implements SeederInterface {
  async run(ctx: SeedContext) {
    await seed(Post).saveMany(50, ctx)
  }
}

// Run from your seed script or test setup:
await runSeeders([PostSeeder], { dataSource })
// UserSeeder runs first, then PostSeeder
```

`runSeeders` accepts the root seeders you want to execute. It collects all transitive dependencies, topologically sorts them, and runs each once in the correct order. Passing the same seeder as both a root and a dependency of another root is safe — it will only run once.

Circular dependencies between seeders are detected at runtime and throw an error naming the seeders involved.

> [!TIP]
> Using NestJS? [@joakimbugge/nest-typeorm-seeder](https://github.com/joakimbugge/to-seeder/tree/main/packages/nest-typeorm-seeder) wraps `runSeeders` in a `SeederModule` that runs your seeders automatically on application bootstrap — no seed script needed. It also tracks which seeders have already run so watch-mode restarts don't re-seed.

---

## Seeding without `@Seed()`

`@Seed()` is a convenience — it is not required. Complex seeding logic that would clutter entity decorators belongs in the seeder suite instead. Use the [`values` option](#overriding-seeded-values) to inject the result at call time, keeping your entities simple:

```ts
@Seeder({ dependencies: [UserSeeder] })
class BookingSeeder implements SeederInterface {
  async run({ dataSource }: SeedContext): Promise<void> {
    const users = await dataSource!.getRepository(User).find()
    const user = faker.helpers.arrayElement(users)

    // user is resolved here and injected — Booking stays simple
    await seed(Booking).saveMany(10, { dataSource, values: { user } })
  }
}
```

If you need full control — inserting specific rows, running raw queries, or using TypeORM's `EntityManager` — the `dataSource` from `SeedContext` gives you direct access to any TypeORM API.

---

## Logging

By default `runSeeders` logs each seeder's progress:

```
[UserSeeder] Starting...
[UserSeeder] Done in 42ms
```

When a seeder throws, a warning is logged before the error is re-thrown:

```
[UserSeeder] Failed after 3ms
```

Logging is routed through **TypeORM's own logger** when a `dataSource` is provided, so seeder output respects the same `logging` configuration as the rest of your TypeORM setup. To see seeder output, ensure your DataSource has `logging: true`, `logging: 'all'`, or `logging: ['log']`. Falls back to `console` when no `dataSource` is available.

Pass `logging: false` to silence all built-in output regardless of TypeORM's configuration.

---

## Hooks

`runSeeders` accepts lifecycle callbacks that fire around each seeder:

```ts
await runSeeders([UserSeeder, PostSeeder], {
  dataSource,
  onBefore: (seeder) => console.log(`Starting ${seeder.name}...`),
  onAfter: (seeder, durationMs) => console.log(`${seeder.name} done in ${durationMs}ms`),
  onError: (seeder, error) => console.error(`${seeder.name} failed`, error),
})
```

| Callback | When it fires |
|---|---|
| `onBefore(seeder)` | Before each seeder runs |
| `onAfter(seeder, durationMs)` | After each seeder completes successfully |
| `onError(seeder, error)` | When a seeder throws — the error is still re-thrown after this returns |

---

## Skipping seeders

Pass a `skip` callback to conditionally bypass individual seeders. Return `true` to skip, `false` (or nothing) to run:

```ts
const alreadyRun = new Set(['UserSeeder'])

await runSeeders([UserSeeder, PostSeeder], {
  dataSource,
  skip: (seeder) => alreadyRun.has(seeder.name),
})
// UserSeeder is skipped, PostSeeder runs normally
```

Skipped seeders do not trigger `onBefore`, `onAfter`, or `onError`.

---

## Running seed scripts

When running a seed script directly with Node.js, `reflect-metadata` must be the very first import — before any entity is loaded. TypeORM's decorators depend on it being in place when the class is evaluated.

```ts
import 'reflect-metadata'
import { seed } from '@joakimbugge/typeorm-seeder'
import { User } from './entities/User.js'

await seed(User).save({ dataSource })
```

### TypeScript execution

[tsx](https://github.com/privatenumber/tsx) is a popular choice for running TypeScript directly, but it uses esbuild under the hood which does not support `emitDecoratorMetadata`. This causes TypeORM to fail when inferring column types. Use [ts-node](https://github.com/TypeStrong/ts-node) instead.

**ESM projects** (`"type": "module"` or `"module": "nodenext"` in tsconfig):

```bash
node --no-warnings --loader ts-node/esm src/seed.ts
```

`--no-warnings` suppresses two noisy but harmless warnings emitted by ts-node itself: one about `--loader` being experimental (Node.js may eventually replace it with `register()`), and one about ts-node internally using a deprecated `fs.Stats` constructor.

**CommonJS projects:**

```bash
npx ts-node src/seed.ts
```

---

## Loading entities from paths

`loadEntities` resolves a mixed array of entity constructors and glob patterns into a flat array of constructors — the same format TypeORM accepts in its `entities` DataSource option:

```ts
import { loadEntities, seed } from '@joakimbugge/typeorm-seeder'

const classes = await loadEntities([User, 'dist/entities/**/*.js'])
await seed(classes).saveMany(10, { dataSource })
```

String entries are expanded with glob and each matched file is dynamically imported. Every exported class constructor found in the module is collected. Constructor entries are passed through as-is.

---

## Loading seeders from paths

`loadSeeders` works the same way as `loadEntities` but collects only constructors decorated with `@Seeder`. Non-seeder exports in matched files are ignored.

```ts
import { loadSeeders, runSeeders } from '@joakimbugge/typeorm-seeder'

const seeders = await loadSeeders(['dist/seeders/**/*.js'])
await runSeeders(seeders, { dataSource })
```

Constructor entries are passed through as-is, so you can mix explicit references with glob patterns:

```ts
const seeders = await loadSeeders([UserSeeder, 'dist/seeders/Post*.js'])
await runSeeders(seeders, { dataSource })
```

---

## API reference

### `@Seed(factory?, options?)`

Property decorator. Marks a property for automatic seeding.

| Signature | Behaviour |
|---|---|
| `@Seed(factory)` | Calls `factory(context, self)` and assigns the result |
| `@Seed(factory, options)` | Same, with additional options |
| `@Seed(options)` | Relation seed with options (e.g. `count`) |
| `@Seed()` | Bare relation seed — auto-creates one related entity |

**`SeedFactory<T, TEntity>`**

```ts
type SeedFactory<T = unknown, TEntity = any> = (context: SeedContext, self: TEntity) => T | Promise<T>
```

`self` is the entity instance as it exists when the factory runs — properties declared above this one are already populated, properties below are `undefined`. Annotate `self` with the entity class to get type inference:

```ts
@Seed((_, self: MyEntity) => ...)
```

**`SeedOptions`**

| Property | Type | Description |
|---|---|---|
| `count` | `number` | Number of related entities to create. Only applies to `one-to-many` and `many-to-many` relations. |

---

### `seed(EntityClass)`

Returns a builder for creating and persisting seed entities.

```ts
seed(Author).create(context?): Promise<Author>
seed(Author).createMany(count, context?): Promise<Author[]>
seed(Author).save(options): Promise<Author>
seed(Author).saveMany(count, options): Promise<Author[]>
```

The array form returns a tuple of instances (or arrays of instances for `createMany`/`saveMany`):

```ts
seed([Author, Book]).create(context?): Promise<[Author, Book]>
seed([Author, Book]).createMany(count, context?): Promise<[Author[], Book[]]>
seed([Author, Book]).save(options): Promise<[Author, Book]>
seed([Author, Book]).saveMany(count, options): Promise<[Author[], Book[]]>
```

**`CreateOptions<T>`** — passed to `create()` and `createMany()` on the single-class form

| Property | Type | Description |
|---|---|---|
| `dataSource` | `DataSource?` | Forwarded to factory functions via `SeedContext`. |
| `relations` | `boolean?` | Set to `false` to skip relation seeding. Defaults to `true`. |
| `values` | `SeedValues<T>?` | Property values applied after all `@Seed` factories have run. Each entry can be a static value or a factory called once per entity. Wins unconditionally — `@Seed` factories still execute but their output is overwritten. Also works for properties with no `@Seed` decorator. |

**`SaveOptions<T>`** — passed to `save()` and `saveMany()` on the single-class form

| Property | Type | Description |
|---|---|---|
| `dataSource` | `DataSource` | Required. Active TypeORM data source used to persist entities. |
| `relations` | `boolean?` | Set to `false` to skip relation seeding. Defaults to `true`. |
| `values` | `SeedValues<T>?` | Property values applied after seeding and before persisting. Each entry can be a static value or a factory called once per entity. Wins unconditionally — `@Seed` factories still execute but their output is overwritten. Also works for properties with no `@Seed` decorator. |

---

### `loadEntities(sources)`

Resolves a mixed array of entity constructors and glob patterns to a flat array of constructors.

```ts
loadEntities(sources: (EntityConstructor | string)[]): Promise<EntityConstructor[]>
```

String entries are treated as glob patterns, expanded to file paths, and dynamically imported. Every exported class constructor found in the matched modules is collected. Constructor entries pass through unchanged.

---

### `loadSeeders(sources)`

Resolves a mixed array of seeder constructors and glob patterns to a flat array of seeder constructors.

```ts
loadSeeders(sources: (SeederCtor | string)[]): Promise<SeederCtor[]>
```

Behaves identically to `loadEntities` except that only constructors decorated with `@Seeder` are collected — other exports in matched files are ignored. Constructor entries pass through unchanged.

---

### `@Seeder(options?)`

Class decorator. Registers a class as a seeder and declares its dependencies.

**`SeederOptions`**

| Property | Type | Description |
|---|---|---|
| `dependencies` | `SeederInterface[]` | Seeders that must run before this one. |

---

### `runSeeders(seeders, options?)`

Topologically sorts and runs the given seeders plus all their transitive dependencies.

```ts
runSeeders([PostSeeder], { dataSource }): Promise<void>
```

Throws if a circular dependency is detected.

**`RunSeedersOptions`** extends `SeedContext`

| Property | Type | Default | Description |
|---|---|---|---|
| `dataSource` | `DataSource?` | — | Passed through to each seeder's `run()` and to factory functions. |
| `relations` | `boolean?` | `true` | Passed through to each seeder's `run()`. |
| `logging` | `boolean?` | `true` | Log seeder progress to the console. Set to `false` when handling output via hooks. |
| `onBefore` | `(seeder) => void \| Promise<void>` | — | Called before each seeder runs. |
| `onAfter` | `(seeder, durationMs) => void \| Promise<void>` | — | Called after each seeder completes successfully. |
| `onError` | `(seeder, error) => void \| Promise<void>` | — | Called when a seeder throws. The error is re-thrown after this returns. |
| `skip` | `(seeder) => boolean \| Promise<boolean>` | — | Return `true` to skip a seeder. Skipped seeders bypass all hooks. |

---

### `SeedContext`

Passed to factory functions and `SeederInterface.run()`.

| Property | Type | Description |
|---|---|---|
| `dataSource` | `DataSource?` | Active TypeORM data source. |
| `relations` | `boolean?` | Set to `false` to skip relation seeding. Defaults to `true`. |

---

## License

MIT
