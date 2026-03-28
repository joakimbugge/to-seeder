# TODO

## typeorm-seeder — special entity compatibility

Tracked in `packages/typeorm-seeder/tests/seed/special.test.ts`. Tests marked `it.skip` below are known failures pending investigation.

---

### multiple databases — @Entity({ database: '...' })

**Symptom:** `TypeError: The "path" argument must be of type string. Received undefined` during `DataSource.initialize()`.

**Root cause:** better-sqlite3's TypeORM driver tries to resolve a file path for the secondary database when it encounters `@Entity({ database: 'secondary' })`. This does not work with `:memory:` databases and has no ATTACH DATABASE support via the DataSource API.

**Possible fix:** Test this against a real multi-database setup (e.g., MySQL with two named databases, or two separate SQLite files with ATTACH). The seeder itself likely works fine — this is purely a test environment limitation. May be worth verifying manually or with a separate integration test that sets up real files.
