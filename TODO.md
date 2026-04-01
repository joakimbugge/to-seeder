# TODO

Items identified from documentation review. Ordered roughly by impact.

---

## ~~Factory sequence index~~ ✓ done

~~Factory functions currently receive `(context, instance)`. They have no access to a sequence number, making it impossible to produce unique sequential values like `user-${i}@example.com` without external mutable state.~~

`SeedFactory` now receives `index: number` as its third argument. Counts from 0 across `createMany`/`saveMany` batches; always `0` for single `create`/`save` calls. Applies to both `@Seed` factories and `values` map factories.

---

## `seed:list` CLI command

There is a `seed:untrack` command to remove history entries, but no way to inspect the history table — to see which seeders have run, which are pending, and when they last ran. A `seed:list` command is the natural companion.

Affects `typeorm-seeder` and `mikroorm-seeder` CLIs.

---

## Parallel seeder execution

`runSeeders` executes seeders sequentially even when multiple seeders at the same topological level have no dependency on each other. Running independent levels in parallel would reduce total time for large suites.

Affects all four packages.

---

## MikroORM `defineEntity` support

MikroORM supports a `defineEntity()` function for schema-first / non-decorator entity definitions. Investigate whether `@Seed()` can be used alongside it — specifically when `defineEntity` is combined with a class body (the hybrid form). Two open questions:

1. Can `@Seed()` decorators be applied to properties inside the class part of a `defineEntity` + class definition, and will `reflect-metadata` still pick them up?
2. Is there anything useful `mikroorm-seeder` can hook into in the `defineEntity()` function call itself (e.g. a property schema passed to it)?

If the class-based hybrid form works, no library changes may be needed — just documentation. If the pure schema-first form does not, a separate integration path may be required.

---

## MikroORM tree entities

MikroORM v7 does not have tree entity support at the ORM level — there are no `@Tree`, `@TreeParent`, or `@TreeChildren` decorators. Parity with the TypeORM `guide/tree-entities.md` page is therefore not applicable. No documentation or implementation work needed.

---

## `--dry-run` CLI flag

No way to preview what `seed:run` or `seed:entities` would execute without writing to the database. Useful for CI pipelines and sanity checks.

Affects `typeorm-seeder` and `mikroorm-seeder` CLIs.

---

## Chunked persistence for `saveMany`

`saveMany(N)` persists all entities in a single operation. For large N this can cause memory pressure and oversized transactions. A `chunkSize` option would split the work into batches.

Affects all four packages.

---

## Dynamic `count` in `@Seed`

`@Seed({ count: 3 })` accepts only a static number. A factory function would allow the count to vary based on context:

```ts
@Seed({ count: (ctx) => ctx.relations ? 3 : 0 })
@OneToMany(() => Book, b => b.author)
books!: Book[]
```

Affects all four packages.
