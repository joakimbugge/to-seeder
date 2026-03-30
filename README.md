# to-seeder

Monorepo for decorator-based entity seeding. Four packages — framework-agnostic core libraries and NestJS integration modules for TypeORM and MikroORM.

## Packages

| Package | Version | Description |
|---|---|---|
| [`typeorm-seeder`](packages/typeorm-seeder) | [![npm](https://img.shields.io/npm/v/@joakimbugge/typeorm-seeder)](https://www.npmjs.com/package/@joakimbugge/typeorm-seeder) | Core seeding library for TypeORM |
| [`nest-typeorm-seeder`](packages/nest-typeorm-seeder) | [![npm](https://img.shields.io/npm/v/@joakimbugge/nest-typeorm-seeder)](https://www.npmjs.com/package/@joakimbugge/nest-typeorm-seeder) | NestJS module for TypeORM |
| [`mikroorm-seeder`](packages/mikroorm-seeder) | [![npm](https://img.shields.io/npm/v/@joakimbugge/mikroorm-seeder)](https://www.npmjs.com/package/@joakimbugge/mikroorm-seeder) | Core seeding library for MikroORM |
| [`nest-mikroorm-seeder`](packages/nest-mikroorm-seeder) | [![npm](https://img.shields.io/npm/v/@joakimbugge/nest-mikroorm-seeder)](https://www.npmjs.com/package/@joakimbugge/nest-mikroorm-seeder) | NestJS module for MikroORM |

---

## typeorm-seeder

Annotate entity properties with `@Seed()`, then create or persist fully populated entity graphs with a single call — including relations, embedded types, and circular guards.

```ts
@Entity()
class Author {
  @Seed(() => faker.person.fullName())
  @Column()
  name!: string

  @Seed({ count: 3 })
  @OneToMany(() => Book, (b) => b.author)
  books!: Book[]
}

const author = await seed(Author).save({ dataSource })
// author.id     → assigned by the database
// author.books  → 3 persisted Book instances
```

Organise complex seeding scenarios into `@Seeder` classes with declared dependencies. The library topologically sorts and runs them in the correct order.

```ts
@Seeder({ dependencies: [UserSeeder] })
class PostSeeder implements SeederInterface {
  async run(ctx: SeedContext) {
    await seed(Post).saveMany(50, ctx)
  }
}

await runSeeders([PostSeeder], { dataSource })
// UserSeeder runs first, then PostSeeder
```

**[Full documentation →](packages/typeorm-seeder/README.md)**

---

## nest-typeorm-seeder

A NestJS module that runs your `@Seeder` classes on application bootstrap. Import `SeederModule` with the seeders you want executed and they run automatically when the app starts.

```ts
import { SeederModule } from '@joakimbugge/nest-typeorm-seeder'

@Module({
  imports: [
    TypeOrmModule.forRoot({ ... }),
    SeederModule.forRoot({ seeders: [PostSeeder] }),
  ],
})
export class AppModule {}
```

**[Full documentation →](packages/nest-typeorm-seeder/README.md)**

---

## mikroorm-seeder

The same seeding API as `typeorm-seeder`, but for MikroORM. Uses `EntityManager` instead of `DataSource`.

```ts
@Entity()
class Author {
  @Seed(() => faker.person.fullName())
  @Property()
  name!: string

  @Seed({ count: 3 })
  @OneToMany(() => Book, (b) => b.author)
  books!: Book[]
}

const author = await seed(Author).save({ em })
// author.id     → assigned by the database
// author.books  → 3 persisted Book instances
```

**[Full documentation →](packages/mikroorm-seeder/README.md)**

---

## nest-mikroorm-seeder

A NestJS module that runs your `@Seeder` classes on application bootstrap. Import `SeederModule` with the seeders you want executed and they run automatically when the app starts.

```ts
import { SeederModule } from '@joakimbugge/nest-mikroorm-seeder'

@Module({
  imports: [
    MikroOrmModule.forRoot({ ... }),
    SeederModule.forRoot({ seeders: [PostSeeder] }),
  ],
})
export class AppModule {}
```

**[Full documentation →](packages/nest-mikroorm-seeder/README.md)**

---

## Development

### Prerequisites

- Node.js >= 18.19.0
- [pnpm](https://pnpm.io/) >= 10

### Setup

```bash
pnpm install
```

### Scripts

| Command | Description |
|---|---|
| `pnpm -r run build` | Build all packages |
| `pnpm -r run test:run` | Run all tests |
| `pnpm -r run typecheck` | Type-check all packages |
| `pnpm -r run lint` | Lint all packages |
| `pnpm -r run fmt` | Format all packages |
| `pnpm run dev:watch` | Watch-build all packages in parallel |

### Toolchain

- **Build:** [tsdown](https://github.com/sxzz/tsdown) — bundles ESM and CommonJS outputs with declaration files
- **Test:** [vitest](https://vitest.dev/) — runs against an in-memory SQLite database
- **Lint:** [oxlint](https://oxc.rs/docs/guide/usage/linter.html)
- **Format:** [oxfmt](https://github.com/nicolo-ribaudo/oxfmt)
- **Git hooks:** [lefthook](https://github.com/evilmartians/lefthook) — runs lint and format on pre-commit

### Release

Releases are managed with [changesets](https://github.com/changesets/changesets). Each package is versioned independently.

**1. Add a changeset**

Run this at any point while working on your changes — once per logical release, not per commit:

```bash
pnpm changeset
```

Select the affected packages, choose a bump type (patch / minor / major), and write a short summary. This creates a `.changeset/*.md` file — commit it alongside your changes.

**2. Push to `main`**

Once your commits and the changeset file land on `main`, CI runs and the release workflow automatically opens a "chore: release packages" PR. That PR bumps the versions and updates each package's `CHANGELOG.md`.

**3. Merge the release PR**

Merging triggers another run of the release workflow, which publishes all bumped packages to npm and redeploys the docs.

## License

MIT
