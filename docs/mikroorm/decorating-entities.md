# Decorating entities

Use `@Seed()` on any entity property to describe how it should be populated. Plain column properties (scalars) take a factory function; relation properties take the bare decorator (or a `count` option for collections).

```ts
import { Entity, PrimaryKey, Property, OneToMany, ManyToOne } from '@mikro-orm/decorators/legacy'
import { faker } from '@faker-js/faker'
import { Seed } from '@joakimbugge/mikroorm-seeder'

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
```

## Passing an EntityManager to factories

If a factory needs to query the database during seeding, the `em` you provide in options is forwarded to every factory via the context's first argument:

```ts
@Seed(async ({ em }) => {
  const role = await em!.findOneOrFail(Role, { name: 'admin' })
  return role
})
@ManyToOne(() => Role)
role!: Role
```

This is useful for lookups — finding an existing record and reusing it rather than creating a new one. For more complex logic — such as picking a random element from a result set or conditional branching — consider using the [`values` option](/mikroorm/seeding-entities#overriding-seeded-values) instead. It keeps that logic in the call site rather than the entity decorator.

## Depending on earlier instances in a batch

When using `createMany` or `saveMany`, each factory receives a `previous` map on the context. `ctx.previous.get(EntityClass)` returns a snapshot of all instances of that type created so far in the current batch — so instance `i` sees instances `0..i-1`:

```ts
@Entity()
class Booking {
  @Seed((ctx) => {
    const last = (ctx.previous?.get(Booking) as Booking[] | undefined)?.at(-1)
    return last ? last.to.plus({ days: 1 }) : DateTime.now()
  })
  @Property()
  from!: DateTime

  @Seed((_, self: Booking) => self.from.plus({ days: faker.number.int({ min: 2, max: 14 }) }))
  @Property()
  to!: DateTime
}

const bookings = await seed(Booking).createMany(5)
// bookings[0].from → now
// bookings[1].from → bookings[0].to + 1 day
// bookings[2].from → bookings[1].to + 1 day  … and so on
```

`previous` is a `Map` keyed by entity class, so when a child entity is created as part of a relation it can also read the parent's batch:

```ts
@Entity()
class Comment {
  @Seed((ctx) => {
    // How many Posts have already been created in this batch?
    const posts = ctx.previous?.get(Post) as Post[] | undefined
    return posts?.at(-1)?.id ?? null
  })
  @Property({ nullable: true })
  latestPostId!: number | null
}
```

Each `createMany` call starts with an empty entry for the type being batched, so Books created for `Author[0]` and Books created for `Author[1]` each see only their own siblings — never each other's.

## Depending on earlier properties

Properties are seeded in declaration order. Each factory receives the partially-built entity as its second argument (`self`), so a property can read any value that was seeded above it:

```ts
@Entity()
class Event {
  @Seed(() => faker.date.past())
  @Property()
  beginDate!: Date

  @Seed((_, self: Event) => faker.date.future({ refDate: self.beginDate }))
  @Property()
  endDate!: Date
}
```

Annotating `self` with the entity class (`self: Event` above) gives full type inference and autocompletion. Without the annotation `self` is typed as `any`, so property access still works — the annotation is only needed for type safety.

Properties declared *below* the current property are not yet set and will be `undefined` on `self` at that point.

## Using the sequence index

Every factory receives a zero-based index as its third argument. When called from `createMany` or `saveMany`, the index counts up across the batch — useful for generating unique sequential values:

```ts
@Seed((_, __, i) => `user-${i}@example.com`)
@Property()
email!: string
```

When called from `create` or `save` (single entity), the index is always `0`.

## Circular relations

When seeding an entity with relations, those related entities are seeded too. If a related entity has a back-reference to the parent, you have a cycle:

```ts
@Entity()
class Author {
  @Seed()
  @OneToMany(() => Book, (b) => b.author)
  books!: Book[]
}

@Entity()
class Book {
  @Seed()
  @ManyToOne(() => Author)
  author!: Author  // back-reference creates a cycle
}
```

Without intervention, this would loop forever: seeding `Author` seeds its books, each book seeds its author, which seeds more books, and so on.

### How cycles are broken

`mikroorm-seeder` breaks cycles at the point where a type would re-enter itself:

- Seeding `Author` → author.books are seeded → each book's author is **not** seeded (cycle detected)
- Seeding `Book` directly → book.author is seeded fully → book.author.books are **not** seeded (cycle detected)

The property is left `undefined` when the cycle is detected. If you need a value there, use the [`values` option](/mikroorm/seeding-entities#overriding-seeded-values) to inject it after creation:

```ts
const books = await seed(Book).createMany(5, {
  values: { author } // inject a specific Author across all books
})
```

### When relations are disabled

Cycles are only a concern when seeding relations. If you pass `relations: false`, no related entities are seeded at all — the cycle is avoided entirely:

```ts
const author = await seed(Author).create({ relations: false })
// author.books → undefined (no relations seeded)

const book = await seed(Book).create({ relations: false })
// book.author → null in the database (no relation seeded)
```

## Embedded types

`@Embedded` properties are seeded automatically. Annotate the embedded class's properties with `@Seed()` just like a regular entity:

```ts
import { Embeddable, Embedded, Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

@Embeddable()
class Address {
  @Seed(() => faker.location.streetAddress())
  @Property()
  street!: string

  @Seed(() => faker.location.city())
  @Property()
  city!: string
}

@Entity()
class User {
  @PrimaryKey()
  id!: number

  @Seed()
  @Embedded(() => Address)
  address!: Address
}
```

Calling `create(User)` builds a `User` with a fully populated `Address` instance on `user.address`.

## MikroORM `defineEntity()`

`@Seed()` is designed for the decorator-based entity style (`@Entity()`, `@Property()`, etc.) and is **not compatible** with `defineEntity()`.

MikroORM's schema-first approach looks like this:

```ts
import { defineEntity, p } from '@mikro-orm/core'

const BookSchema = defineEntity({
  name: 'Book',
  properties: {
    title: p.string(),
    author: () => p.manyToOne(Author),
  },
})

export class Book extends BookSchema.class {}
BookSchema.setClass(Book)
```

Even in this hybrid form, MikroORM never runs `@Entity()` on the class, so the seeder cannot resolve its property metadata at runtime. `@Seed()` applied to `Book` properties will not be picked up.

Use standard MikroORM decorators (`@Entity()`, `@Property()`, `@ManyToOne()`, etc.) to take full advantage of `mikroorm-seeder`.
