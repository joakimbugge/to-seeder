# Seeder suites

For production seeding scripts or structured test fixtures, organize your seeding logic into `@Seeder` classes. Declare dependencies between seeders and let the library figure out the execution order.

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
[nest-typeorm-seeder](/nest/) wraps `runSeeders` in a `SeederModule` that runs your seeders automatically on application bootstrap — no seed script needed. It also tracks which seeders have already run so watch-mode restarts don't re-seed.
:::

## Returning seeded entities

A seeder's `run` method can return a value. `runSeeders` collects these into a `Map` keyed by seeder class:

```ts
@Seeder()
class UserSeeder implements SeederInterface {
  async run(ctx: SeedContext) {
    return await seed(User).createMany(10, ctx)
  }
}

const results = await runSeeders([UserSeeder], { dataSource })
const users = results.get(UserSeeder) as User[]
```

This is especially useful with `create` and `createMany` — since those don't write to the database, the return value is often the only way to get the instances back. The map contains an entry for every seeder that ran; skipped seeders are not included.

## Seeding without `@Seed()`

`@Seed()` is a convenience — it is not required. Complex seeding logic that would clutter entity decorators belongs in the seeder suite instead. Use the `values` option to inject the result at call time, keeping your entities simple:

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

Next: [Running scripts](/guide/running-scripts) covers how to execute a seeder suite directly with Node.js or ts-node.
