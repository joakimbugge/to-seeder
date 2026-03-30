# @joakimbugge/mikroorm-seeder

## 0.2.0

### Minor Changes

- [`be74a16`](https://github.com/joakimbugge/seeders/commit/be74a165115a538ca2f31a23229af7e86ec06238) Thanks [@joakimbugge](https://github.com/joakimbugge)! - **`@joakimbugge/mikroorm-seeder`:** `runSeeders` now accepts `logging: 'mikroorm'` to delegate seeder progress output through MikroORM's own logger (`em.config.getLogger()`). Whether output is shown depends on MikroORM's `debug` configuration — the seeder passes messages through and MikroORM decides. Silently no-ops when no `em` is provided.

  **All packages:** Updated repository URLs, homepage, and bug tracker links following the repository rename from `to-seeder` to `seeders`. Updated documentation links in package READMEs to point to the correct API reference paths.

## 0.1.1

### Patch Changes

- [`5f65343`](https://github.com/joakimbugge/seeders/commit/5f653435000e87d40f63a398d5150a61d5983d1f) Thanks [@joakimbugge](https://github.com/joakimbugge)! - Export previously internal types: `SingleSeed`, `MultiSeed`, `MapToInstances`, and `MapToInstanceArrays` from the core seeder packages; `SeederModuleSeedersOptions`, `SeederModuleRunOptions`, and `SeederModuleFeatureOnlyOptions` from the NestJS integration packages.
