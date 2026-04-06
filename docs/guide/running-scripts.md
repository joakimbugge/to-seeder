# Running scripts

A seed script is just a `.js` or `.ts` file you execute directly — there is nothing special about it. It can call `seed()`, `runSeeders()`, or anything else; the name just means "the file responsible for seeding."

::: tip Prefer skipping the script entirely?
The [CLI](/guide/cli) can load and run your seeders directly from the terminal — no seed script needed.
:::

## Running seed scripts

When running a seed script directly with Node.js, `reflect-metadata` must be the very first import — before any entity is loaded. TypeORM's decorators depend on it being in place when the class is evaluated.

```ts
import 'reflect-metadata'
import { seed } from '@joakimbugge/typeorm-seeder'
import { User } from './entities/User.js'

await seed(User).save({ dataSource })
```

### TypeScript execution

```bash
# ESM
node --no-warnings --loader ts-node/esm src/seed.ts

# CommonJS
npx ts-node src/seed.ts
```

> [ts-node](https://github.com/TypeStrong/ts-node) is the right tool here — the popular [tsx](https://github.com/privatenumber/tsx) uses esbuild internally which strips decorator metadata, causing TypeORM to fail.

## Loading entities from paths

:::info
`loadEntities` and `loadSeeders` are ORM-agnostic and live in `@joakimbugge/seeder`, not the TypeORM package. Import them from there.
:::

`loadEntities` resolves a mixed array of entity constructors and glob patterns into a flat array of constructors — the same format TypeORM accepts in its `entities` DataSource option:

```ts
import { loadEntities } from '@joakimbugge/seeder'
import { seed } from '@joakimbugge/typeorm-seeder'

const classes = await loadEntities([User, 'dist/entities/**/*.js'])
await seed(classes).saveMany(10, { dataSource })
```

String entries are expanded with glob and each matched file is dynamically imported. Every exported class constructor found in the module is collected. Constructor entries are passed through as-is.

When running with ts-node, you can point directly at source files:

```ts
const classes = await loadEntities(['src/entities/**/*.ts'])
```

## Loading seeders from paths

`loadSeeders` works the same way as `loadEntities` but collects only constructors decorated with `@Seeder`. Non-seeder exports in matched files are ignored.

```ts
import { loadSeeders } from '@joakimbugge/seeder'
import { runSeeders } from '@joakimbugge/typeorm-seeder'

const seeders = await loadSeeders(['dist/seeders/**/*.js'])
await runSeeders(seeders, { dataSource })
```

Constructor entries are passed through as-is, so you can mix explicit references with glob patterns:

```ts
const seeders = await loadSeeders([UserSeeder, 'dist/seeders/Post*.js'])
await runSeeders(seeders, { dataSource })
```

When running with ts-node, you can point directly at source files:

```ts
const seeders = await loadSeeders(['src/seeders/**/*.ts'])
```
