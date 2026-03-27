# TODO

## typeorm-seeder — special entity compatibility

Tracked in `packages/typeorm-seeder/tests/seed/special.test.ts`. Tests marked `it.skip` below are known failures pending investigation.

---

### tree: materialized-path — save()

**Symptom:** `TypeError: Cannot read properties of undefined (reading 'find')` inside TypeORM's `MaterializedPathSubjectExecutor` when saving via standard `getRepository().save()`.

**Root cause:** TypeORM's materialized-path executor expects children to already be in a specific state relative to the parent path. Our `saveBatch` builds the full in-memory graph first and saves everything in one shot, which doesn't satisfy that expectation.

**Possible fix:** Use `getTreeRepository().save()` instead of `getRepository().save()` for tree entities, or save the root first (without children) and then save children in a second pass.

---

### tree: closure-table — save()

**Symptom:** `CannotAttachTreeChildrenEntityError: Cannot attach entity "ClosureTableItem" to its parent. Please make sure parent is saved in the database before saving children nodes.`

**Root cause:** Closure-table strategy requires the parent row to exist in the database before inserting children so that the closure table can be populated. Our batch save inserts everything simultaneously.

**Possible fix:** Detect closure-table entities and use a two-phase save: persist the parent first, then persist children with the parent's assigned ID. May need to use `getTreeRepository()`.

---

### tree: nested-set — save()

**Symptom:** `TypeError: Cannot read properties of undefined (reading 'find')` inside TypeORM's `NestedSetSubjectExecutor`.

**Root cause:** Nested-set requires left/right column recalculation based on already-persisted sibling data. The in-memory graph we pass to `repository.save()` does not include the sibling context needed for this.

**Possible fix:** Use `getTreeRepository().save()`, or save the root node without children first and then attach children using the tree repository API. Nested-set is the most complex strategy — it may require a fundamentally different approach than the other strategies.

---

### multiple databases — @Entity({ database: '...' })

**Symptom:** `TypeError: The "path" argument must be of type string. Received undefined` during `DataSource.initialize()`.

**Root cause:** better-sqlite3's TypeORM driver tries to resolve a file path for the secondary database when it encounters `@Entity({ database: 'secondary' })`. This does not work with `:memory:` databases and has no ATTACH DATABASE support via the DataSource API.

**Possible fix:** Test this against a real multi-database setup (e.g., MySQL with two named databases, or two separate SQLite files with ATTACH). The seeder itself likely works fine — this is purely a test environment limitation. May be worth verifying manually or with a separate integration test that sets up real files.
