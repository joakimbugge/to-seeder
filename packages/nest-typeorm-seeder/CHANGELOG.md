# Changelog

## 0.7.2

### Patch Changes

- [`be74a16`](https://github.com/joakimbugge/seeders/commit/be74a165115a538ca2f31a23229af7e86ec06238) Thanks [@joakimbugge](https://github.com/joakimbugge)! - **`@joakimbugge/mikroorm-seeder`:** `runSeeders` now accepts `logging: 'mikroorm'` to delegate seeder progress output through MikroORM's own logger (`em.config.getLogger()`). Whether output is shown depends on MikroORM's `debug` configuration — the seeder passes messages through and MikroORM decides. Silently no-ops when no `em` is provided.

  **All packages:** Updated repository URLs, homepage, and bug tracker links following the repository rename from `to-seeder` to `seeders`. Updated documentation links in package READMEs to point to the correct API reference paths.

- Updated dependencies [[`be74a16`](https://github.com/joakimbugge/seeders/commit/be74a165115a538ca2f31a23229af7e86ec06238)]:
  - @joakimbugge/typeorm-seeder@0.8.2

## 0.7.1

### Patch Changes

- [`5f65343`](https://github.com/joakimbugge/seeders/commit/5f653435000e87d40f63a398d5150a61d5983d1f) Thanks [@joakimbugge](https://github.com/joakimbugge)! - Export previously internal types: `SingleSeed`, `MultiSeed`, `MapToInstances`, and `MapToInstanceArrays` from the core seeder packages; `SeederModuleSeedersOptions`, `SeederModuleRunOptions`, and `SeederModuleFeatureOnlyOptions` from the NestJS integration packages.

- Updated dependencies [[`5f65343`](https://github.com/joakimbugge/seeders/commit/5f653435000e87d40f63a398d5150a61d5983d1f)]:
  - @joakimbugge/typeorm-seeder@0.8.1

## [0.7.0](https://github.com/joakimbugge/seeders/compare/nest-typeorm-seeder-v0.6.0...nest-typeorm-seeder-v0.7.0) (2026-03-29)

### Features

- **packages/nest-typeorm-seeder:** toggle logging option ([b398195](https://github.com/joakimbugge/seeders/commit/b3981950de46069ee977a6d0f2f572e063c2c3f2))

## [0.6.0](https://github.com/joakimbugge/seeders/compare/nest-typeorm-seeder-v0.5.0...nest-typeorm-seeder-v0.6.0) (2026-03-28)

### Features

- **packages/nest-typeorm-seeder:** finally enable bare SeederModule ([d2309a3](https://github.com/joakimbugge/seeders/commit/d2309a3cb717e4affbefdc65963bdd34ffa533df))
- **packages/nest-typeorm-seeder:** support importing without forRoot() ([bbae7c3](https://github.com/joakimbugge/seeders/commit/bbae7c3e0b71786ebb743f3accd752163e0c8c3e))

### Bug Fixes

- **packages/nest-typeorm-seeder:** revert bare SeederModule, allow empty forRoot() ([262ba59](https://github.com/joakimbugge/seeders/commit/262ba59daa749029c34c14373a62475e19dc466d))

## [0.5.0](https://github.com/joakimbugge/seeders/compare/nest-typeorm-seeder-v0.4.1...nest-typeorm-seeder-v0.5.0) (2026-03-28)

### Features

- **packages/nest-typeorm-seeder:** support seeders from paths ([8ecfb29](https://github.com/joakimbugge/seeders/commit/8ecfb2904f339801cb5ff8a5fcd01993af91cda5))

## [0.4.1](https://github.com/joakimbugge/seeders/compare/nest-typeorm-seeder-v0.4.0...nest-typeorm-seeder-v0.4.1) (2026-03-27)

### Bug Fixes

- **packages/nest-typeorm-seeder:** add more comments ([4d06dea](https://github.com/joakimbugge/seeders/commit/4d06dea9ddd5b1d0ffa2ffe84b51e31cf86aeae3))

## [0.4.0](https://github.com/joakimbugge/seeders/compare/nest-typeorm-seeder-v0.3.0...nest-typeorm-seeder-v0.4.0) (2026-03-27)

### Features

- **packages/nest-typeorm-seeder:** add forFeature() ([e6c1422](https://github.com/joakimbugge/seeders/commit/e6c1422c5857a7e556626c8af05e9277f8a8ae52))

## [0.3.0](https://github.com/joakimbugge/seeders/compare/nest-typeorm-seeder-v0.2.0...nest-typeorm-seeder-v0.3.0) (2026-03-27)

### Features

- **packages/nest-typeorm-seeder:** add run() for simplicity ([7876613](https://github.com/joakimbugge/seeders/commit/78766131aaf62001c2dd470816e4a716c90fb530))
- **packages/nest-typeorm-seeder:** expose typeorm-seeder hooks ([497b28a](https://github.com/joakimbugge/seeders/commit/497b28af1484f018801da47d1c109c2f555404e2))

## [0.2.0](https://github.com/joakimbugge/seeders/compare/nest-typeorm-seeder-v0.1.0...nest-typeorm-seeder-v0.2.0) (2026-03-26)

### Features

- **packages/nest-typeorm-seeder:** add enabled and runOnce options ([0b27709](https://github.com/joakimbugge/seeders/commit/0b27709cab3d7d5b96a5f6e0d5e9b94aee61bd0c))
