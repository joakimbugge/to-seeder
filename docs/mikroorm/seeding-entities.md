# Seeding entities

The `seed(EntityClass)` function returns a builder with four methods: `create`, `createMany`, `save`, and `saveMany`. Entities are populated according to their `@Seed()` decorators — see [Decorating entities](/mikroorm/decorating-entities) to learn how to write those.

```ts
import { seed } from '@joakimbugge/mikroorm-seeder'
```

## Creating without saving

`create()` and `createMany()` build entity instances without touching the database. Useful for unit tests or for preparing entities before passing them to your own persistence logic.

```ts
const author = await seed(Author).create()
// Plain Author instance — no id, fully populated relations

const books = await seed(Book).createMany(10)
// [Book, Book, …] — each with its own seeded Author
```

## Saving to the database

`save()` and `saveMany()` create instances and write them to the database in one step. Pass an `EntityManager` in the options.

```ts
const author = await seed(Author).save({ em })
// author.id  → assigned by the database
// author.books → 3 persisted Book instances

const authors = await seed(Author).saveMany(5, { em })
// [Author, Author, Author, Author, Author] — each with their own books
```

## Seeding multiple entity types at once

Pass an array of entity classes to seed one of each:

```ts
const [author, book] = await seed([Author, Book]).create()
const [author, book] = await seed([Author, Book]).save({ em })
```

Relation seeding is **disabled by default** in this form — each entity is created independently, so there is no overlap between the `Author` you asked for and the `Author` that would have been auto-created inside `Book`. Pass `relations: true` to override:

```ts
const [author, book] = await seed([Author, Book]).save({ em, relations: true })
// author.books → seeded  |  book.author → seeded (independently)
```

`createMany` and `saveMany` return an array per class:

```ts
const [authors, books] = await seed([Author, Book]).createMany(3)
// authors → [Author, Author, Author]
// books   → [Book, Book, Book]
```

## Disabling relation seeding

Pass `relations: false` to create a flat entity with no relation properties set — useful when you want to wire relations yourself or need to seed only the primary entity:

```ts
const author = await seed(Author).create({ relations: false })
// author.books → undefined

const book = await seed(Book).save({ em, relations: false })
// book.author → null in the database
```

## Overriding seeded values

Pass a `values` map to inject specific values after all `@Seed` factories have run. This works for properties with `@Seed()` decorators and for properties with no decorator at all:

```ts
// Status is set even if Booking has no @Seed on it
const booking = await seed(Booking).create({ values: { status: 'confirmed' } })
const booking = await seed(Booking).save({ em, values: { user, status: 'confirmed' } })

// All 5 get the same user
const bookings = await seed(Booking).createMany(5, { values: { user } })
const bookings = await seed(Booking).saveMany(5, { em, values: { user } })
```

Each property in `values` can also be a factory function — it is called once per entity, so every instance can receive a unique generated value:

```ts
const bookings = await seed(Booking).saveMany(10, {
  em,
  values: {
    price: () => faker.number.float({ min: 10, max: 500 }), // unique per booking
    status: 'confirmed',                                     // same for all
  },
})
```

Factory entries in `values` receive the same `(context, self, index)` arguments as `@Seed` factories, so you can read already-applied properties from `self`, query the database via `context.em`, or use the [sequence index](/mikroorm/decorating-entities#using-the-sequence-index) to generate unique values per entity.

When a property has both a `@Seed` factory and a `values` entry, the `@Seed` factory still runs but its result is overwritten by `values`.

::: info
`values` are applied **after** all `@Seed` factories have finished, so they are never visible on `self` inside a `@Seed` factory callback.
:::
