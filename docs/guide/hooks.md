# Hooks

Lifecycle hooks fire at two levels: directly on the seeder class, and globally on `runSeeders`.

## Class-level hooks

Define hooks as methods on a seeder class to run logic around that specific seeder's `run()` call:

```ts
@Seeder({ dependencies: [UserSeeder] })
class PostSeeder implements SeederInterface {
  async onBefore() {
    console.log('PostSeeder starting...')
  }

  async run(ctx: SeederRunContext) {
    await seed(Post).saveMany(50, ctx)
  }

  async onSuccess(durationMs: number) {
    console.log(`PostSeeder done in ${durationMs}ms`)
  }

  async onError(error: unknown) {
    console.error('PostSeeder failed', error)
  }

  async onFinally(durationMs: number) {
    // Always runs — mirrors try/catch/finally
  }
}
```

| Method | When it fires |
|---|---|
| `onBefore()` | Before `run()` executes |
| `onSuccess(durationMs)` | After `run()` completes successfully |
| `onError(error)` | When `run()` throws — the error is re-thrown after this returns |
| `onFinally(durationMs)` | Always — whether `run()` succeeded or threw |

## Global hooks on `runSeeders`

Pass callbacks to `runSeeders` for cross-cutting concerns that span all seeders, such as notifications or metrics:

```ts
await runSeeders([UserSeeder, PostSeeder], {
  dataSource,
  onBefore: () => console.log('Seeding started'),
  onSuccess: (seeders, durationMs) =>
    console.log(`All done in ${durationMs}ms — ran: ${seeders.map((s) => s.name).join(', ')}`),
  onError: (seeder, error) =>
    console.error(`${seeder.name} failed`, error),
  onFinally: (durationMs) => console.log(`Seeding finished in ${durationMs}ms`),
})
```

| Callback | When it fires |
|---|---|
| `onBefore()` | Once, before any seeder runs |
| `onSuccess(seeders, durationMs)` | Once, after all seeders succeed — receives the list of seeders that ran (excluding skipped ones) and the total duration |
| `onError(seeder, error)` | Once, when a seeder throws — receives the failing seeder and the error. The error is re-thrown after this returns |
| `onFinally(durationMs)` | Once, always — whether all succeeded or one threw |

Class-level hooks fire first, then `runSeeders`-level hooks.

## Skipping seeders

Pass a `skip` callback to conditionally bypass individual seeders. Return `true` to skip, `false` (or nothing) to run:

```ts
const alreadyRun = new Set(['UserSeeder'])

await runSeeders([UserSeeder, PostSeeder], {
  dataSource,
  skip: (seeder) => alreadyRun.has(seeder.name),
})
// UserSeeder is skipped, PostSeeder runs normally
```

Skipped seeders do not trigger class-level hooks. The global `onSuccess` receives only the seeders that actually ran.
