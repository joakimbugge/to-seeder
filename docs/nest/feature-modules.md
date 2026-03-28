# Feature modules

Use `forFeature()` to register seeders alongside the entities they belong to, rather than centralising everything in the root module:

```ts
// UserModule.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    SeederModule.forFeature([UserSeeder]),
  ],
})
export class UserModule {}
```

```ts
// AppModule.ts
@Module({
  imports: [
    TypeOrmModule.forRoot({ ... }),
    SeederModule,
    UserModule,
  ],
})
export class AppModule {}
```

`SeederModule` must always be imported at the root even when no seeders are declared there — it is the module that actually runs the seeders collected from `forFeature()`.

Use `SeederModule.forRoot(options)` instead when you need to configure options such as `enabled`, `runOnce`, or `historyTableName`:

```ts
SeederModule.forRoot({ enabled: process.env.SEED === 'true' })
```

All seeders — from `forRoot` and any number of `forFeature` calls — are collected and passed to `runSeeders` as a single flat list before execution begins. Dependency sorting and run-once tracking work exactly as they do when all seeders are declared in `forRoot`.

## Cross-module dependencies

A seeder in one feature module can depend on a seeder in another without any extra wiring — just declare the dependency via `@Seeder`:

```ts
@Seeder({ dependencies: [TenantSeeder] })  // TenantSeeder lives in TenantModule
export class UserSeeder implements SeederInterface { ... }
```

As long as both modules are imported into the app, the dependency is resolved correctly.
