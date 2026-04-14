# Seeder suites

For production seeding scripts or structured test fixtures, organize your seeding logic into `@Seeder` classes. Declare dependencies between seeders and let the library figure out the execution order.

```ts
import { Seeder, runSeeders, seed } from '@joakimbugge/mikroorm-seeder'
import type { SeederInterface, SeederRunContext } from '@joakimbugge/mikroorm-seeder'

@Seeder()
class UserSeeder implements SeederInterface {
  async run(ctx: SeederRunContext) {
    await seed(User).saveMany(10, ctx)
  }
}

@Seeder({ dependencies: [UserSeeder] })
class PostSeeder implements SeederInterface {
  async run(ctx: SeederRunContext) {
    await seed(Post).saveMany(50, ctx)
  }
}

// Run from your seed script or test setup:
await runSeeders([PostSeeder], { em })
// UserSeeder runs first, then PostSeeder
```

`runSeeders` accepts the root seeders you want to execute. It collects all transitive dependencies, topologically sorts them, and runs each once in the correct order. Passing the same seeder as both a root and a dependency of another root is safe — it will only run once.

Circular dependencies between seeders are detected at runtime and throw an error naming the seeders involved.

## Execution order

Dependencies always complete before the seeders that declare them. Seeders that have no dependency relationship with each other run **concurrently**.

In the diamond pattern below, `UserSeeder` and `PostSeeder` have no dependency on each other so they run at the same time. `ReportSeeder` starts only after both have finished:

```ts
@Seeder()
class UserSeeder { … }          // ┐ run concurrently
                                // │
@Seeder()                       // │
class PostSeeder { … }          // ┘

@Seeder({ dependencies: [UserSeeder, PostSeeder] })
class ReportSeeder { … }        // starts after both complete
```

::: tip Using NestJS?
[nest-mikroorm-seeder](/nest-mikroorm/) wraps `runSeeders` in a `SeederModule` that runs your seeders automatically on application bootstrap — no seed script needed. It also tracks which seeders have already run so watch-mode restarts don't re-seed.
:::

## Returning seeded entities

A seeder's `run` method can return a value. `runSeeders` collects these into a typed map keyed by seeder class — no casting needed.

The minimal approach is to annotate the return type on `run`:

```ts
@Seeder()
class UserSeeder implements SeederInterface {
  async run(ctx: SeederRunContext): Promise<User[]> {
    return await seed(User).createMany(10, ctx)
  }
}

const results = await runSeeders([UserSeeder], { em })
const users = results.get(UserSeeder) // User[] — inferred, no cast
```

To also have TypeScript enforce the return type as part of the interface contract — catching drift if the implementation changes — pass it as the second type parameter to `SeederInterface`:

```ts
@Seeder()
class UserSeeder implements SeederInterface<SeederRunContext, User[]> {
  async run(ctx: SeederRunContext) {
    return await seed(User).createMany(10, ctx)
  }
}
```

Both approaches produce the same inferred type at the call site. The explicit form adds a compile-time guarantee that `run` always returns `User[]`.

This is especially useful with `create` and `createMany` — since those don't write to the database, the return value is often the only way to get the instances back. The map contains an entry for every seeder that ran; skipped seeders are not included.

## Accessing dependency results in run()

`runSeeders` forwards a live `results` map through `SeederRunContext`. When a dependent seeder's `run` method is called, `ctx.results` already contains the return values of every seeder that has completed — including all transitive dependencies:

```ts
@Seeder()
class UserSeeder implements SeederInterface {
  async run(ctx: SeederRunContext) {
    return await seed(User).createMany(5, ctx)   // return value is stored in results
  }
}

@Seeder({ dependencies: [UserSeeder] })
class BookingSeeder implements SeederInterface {
  async run(ctx: SeederRunContext) {
    const users = ctx.results?.get(UserSeeder) as User[]

    return await seed(Booking).createMany(10, {
      ...ctx,
      values: { user: () => faker.helpers.arrayElement(users) },
    })
  }
}

await runSeeders([BookingSeeder], { em })
```

`ctx.results` is the same `Map` instance that `runSeeders` returns, so any code that runs after `runSeeders` completes can also read from it. Seeders that ran concurrently at the same dependency level are all present by the time the next level starts.

::: info
Spreading `ctx` into `createMany` or `saveMany` options also makes `ctx.results` available inside `@Seed` factory callbacks — useful when a decorator-level factory needs to pick from a previously seeded pool.
:::

## Seeding without `@Seed()`

`@Seed()` is a convenience — it is not required. Complex seeding logic that would clutter entity decorators belongs in the seeder suite instead. Use the `values` option to inject the result at call time, keeping your entities simple:

```ts
@Seeder({ dependencies: [UserSeeder] })
class BookingSeeder implements SeederInterface {
  async run({ em }: SeederRunContext): Promise<void> {
    const users = await em!.find(User, {})
    const user = faker.helpers.arrayElement(users)

    // user is resolved here and injected — Booking stays simple
    await seed(Booking).saveMany(10, { em, values: { user } })
  }
}
```

If you need full control — inserting specific rows, running raw queries, or using MikroORM's `EntityManager` API directly — the `em` from `SeederRunContext` gives you direct access to any MikroORM operation.

## Using MikroORM's seeder manager

MikroORM has its own seeder package (`@mikro-orm/seeder`) with a `Seeder` base class, `SeedManager`, and CLI integration. You can use `@Seed()` and `seed()` inside MikroORM's native seeders — they are plain functions that work with any `EntityManager`:

```ts
import { Seeder } from '@mikro-orm/seeder'
import type { EntityManager } from '@mikro-orm/core'
import { seed } from '@joakimbugge/mikroorm-seeder'

export class UserSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    await seed(User).saveMany(10, { em })
  }
}

export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    await this.call(em, [UserSeeder])
  }
}
```

Then run via MikroORM's CLI or `SeedManager`:

```ts
await orm.getSeeder().seed(DatabaseSeeder)
```

The `@Seeder()` decorator and `runSeeders` are not involved here — dependency ordering is handled by `this.call()` instead. If you already use `@mikro-orm/seeder` for CLI-driven seeding, `@Seed()` and `seed()` integrate naturally into that workflow.

::: info
`@Seeder`, `runSeeders`, `SeederInterface`, and related types originate in [`@joakimbugge/seeder`](/seeder/) — the ORM-agnostic core. They are re-exported from `@joakimbugge/mikroorm-seeder` for convenience, so no additional dependency is needed.
:::

Next: [Running scripts](/mikroorm/running-scripts) covers how to execute a seeder suite directly with Node.js or ts-node.
