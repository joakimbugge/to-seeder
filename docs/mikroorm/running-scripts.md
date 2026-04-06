# Running scripts

A seed script is just a `.js` or `.ts` file you execute directly — there is nothing special about it. It can call `seed()`, `runSeeders()`, or anything else; the name just means "the file responsible for seeding."

## Running seed scripts

If you are using `ReflectMetadataProvider`, `reflect-metadata` must be the very first import in your seed script — before any entity is loaded. MikroORM's decorators rely on it being in place when the class is evaluated.

```ts
import 'reflect-metadata'
import { seed } from '@joakimbugge/mikroorm-seeder'
import { User } from './entities/User.js'

await seed(User).save({ em })
```

If you are using `TsMorphMetadataProvider`, no `reflect-metadata` import is needed.

### TypeScript execution

**With `ReflectMetadataProvider`:**

```bash
# ESM
node --no-warnings --loader ts-node/esm src/seed.ts

# CommonJS
npx ts-node src/seed.ts
```

> [ts-node](https://github.com/TypeStrong/ts-node) is the right tool here — the popular [tsx](https://github.com/privatenumber/tsx) uses esbuild internally which strips decorator metadata, causing MikroORM to fail.

**With `TsMorphMetadataProvider`:**

```bash
npx tsx src/seed.ts
```

## Loading seeders from paths

:::info
`loadSeeders` is ORM-agnostic and lives in `@joakimbugge/seeder`, not the MikroORM package. Import it from there.
:::

`loadSeeders` resolves a mixed array of seeder constructors and glob patterns into a flat array of constructors — only classes decorated with `@Seeder` are collected:

```ts
import { loadSeeders } from '@joakimbugge/seeder'
import { runSeeders } from '@joakimbugge/mikroorm-seeder'

const seeders = await loadSeeders(['dist/seeders/**/*.js'])
await runSeeders(seeders, { em })
```

Constructor entries are passed through as-is, so you can mix explicit references with glob patterns:

```ts
const seeders = await loadSeeders([UserSeeder, 'dist/seeders/Post*.js'])
await runSeeders(seeders, { em })
```

When running with ts-node or tsx, you can point directly at source files:

```ts
const seeders = await loadSeeders(['src/seeders/**/*.ts'])
```
