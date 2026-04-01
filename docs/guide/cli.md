# CLI

The package ships a CLI binary so you can run seeders or seed entities directly from the terminal without writing a seed script.

::: tip TypeScript
To use `.ts` files directly, install `ts-node` as a dev dependency and the CLI will pick it up automatically. Compiled `.js` files work without it.
:::

## `seed:run`

Loads all `@Seeder`-decorated classes from a glob pattern and runs them in topological order.

Pass `--dry-run` (`-n`) to see which seeders would run without executing them or touching the database:

::: code-group

```bash [npm]
npx @joakimbugge/typeorm-seeder seed:run './src/seeders/*.ts' -d ./src/datasource.ts
```

```bash [yarn]
yarn @joakimbugge/typeorm-seeder seed:run './src/seeders/*.ts' -d ./src/datasource.ts
```

```bash [pnpm]
pnpm exec @joakimbugge/typeorm-seeder seed:run './src/seeders/*.ts' -d ./src/datasource.ts
```

:::

```bash
npx @joakimbugge/typeorm-seeder seed:run './src/seeders/*.ts' --dry-run
# Dry run — seeders will not run
#
# 3 seeders found:
#   UserSeeder
#   PostSeeder
#   CommentSeeder
```

## `seed:entities`

Loads entity constructors from a glob pattern, filters to those with at least one `@Seed` decorator, and persists `--count` instances of each (default: 1).

Pass `--dry-run` (`-n`) to create entities in memory and print them without writing to the database:

::: code-group

```bash [npm]
npx @joakimbugge/typeorm-seeder seed:entities './src/entities/*.ts' -d ./src/datasource.ts --count 20
```

```bash [yarn]
yarn @joakimbugge/typeorm-seeder seed:entities './src/entities/*.ts' -d ./src/datasource.ts --count 20
```

```bash [pnpm]
pnpm exec @joakimbugge/typeorm-seeder seed:entities './src/entities/*.ts' -d ./src/datasource.ts --count 20
```

:::

```bash
npx @joakimbugge/typeorm-seeder seed:entities './src/entities/*.ts' --dry-run --count 3
# Dry run — nothing will be written to the database
#
# 3 × User
# User { name: 'Alice Smith', email: 'alice@example.com', age: 27 }
# User { name: 'Bob Jones', email: 'bob@example.com', age: 34 }
# User { name: 'Carol White', email: 'carol@example.com', age: 22 }
```

## `seed:untrack`

Removes a seeder from the history table so it runs again on the next application boot:

::: code-group

```bash [npm]
npx @joakimbugge/typeorm-seeder seed:untrack UserSeeder -d ./src/datasource.ts
```

```bash [yarn]
yarn @joakimbugge/typeorm-seeder seed:untrack UserSeeder -d ./src/datasource.ts
```

```bash [pnpm]
pnpm exec @joakimbugge/typeorm-seeder seed:untrack UserSeeder -d ./src/datasource.ts
```

:::

If your NestJS module uses a custom `historyTableName`, pass `--table` (`-t`) to match:

```bash
npx @joakimbugge/typeorm-seeder seed:untrack UserSeeder -d ./src/datasource.ts --table seed_history
```

## npm scripts

A common pattern is to define scripts in `package.json` with the paths baked in:

```json
{
  "scripts": {
    "seed:run": "typeorm-seeder seed:run './src/seeders/*.ts' -d ./src/datasource.ts",
    "seed:entities": "typeorm-seeder seed:entities './src/entities/*.ts' -d ./src/datasource.ts"
  }
}
```

Run them with your package manager:

::: code-group

```bash [npm]
npm run seed:run
```

```bash [yarn]
yarn seed:run
```

```bash [pnpm]
pnpm seed:run
```

:::

To pass extra arguments at call time, npm and pnpm require a `--` separator before any flags; yarn does not:

::: code-group

```bash [npm]
npm run seed:entities -- --count 50
```

```bash [yarn]
yarn seed:entities --count 50
```

```bash [pnpm]
pnpm seed:entities -- --count 50
```

:::

## DataSource

Pass `--datasource` (`-d`) with a path to a file that exports a DataSource:

```ts
// datasource.ts
import { DataSource } from 'typeorm'
export default new DataSource({ ... })
```

If the flag is omitted the CLI looks for `typeorm-seeder.config.ts` then `typeorm-seeder.config.js` in the current working directory.

::: tip
Wrap glob patterns in single quotes to prevent your shell from expanding them before they reach the CLI. Without quotes, the shell resolves the glob and the CLI receives a list of individual file paths — which also works, but prevents the CLI from using tinyglobby's pattern matching.
:::
