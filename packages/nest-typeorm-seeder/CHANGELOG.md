# Changelog

## [0.9.2](https://github.com/joakimbugge/seeders/compare/nest-typeorm-seeder-v0.9.1...nest-typeorm-seeder-v0.9.2) (2026-04-22)


### Features

* new lifecycle hooks (onBefore, onSuccess, onError, onFinally) ([4b32a9d](https://github.com/joakimbugge/seeders/commit/4b32a9d6253c4ae9bc7b77ae64a70cc3a17f206b))

## [0.9.1](https://github.com/joakimbugge/seeders/compare/nest-typeorm-seeder-v0.9.0...nest-typeorm-seeder-v0.9.1) (2026-04-13)


### Bug Fixes

* correct types and remove unncessary explicit types ([4c1517f](https://github.com/joakimbugge/seeders/commit/4c1517f635facfbee407fcf0d9eb31085045e432))

## [0.9.0](https://github.com/joakimbugge/seeders/compare/nest-typeorm-seeder-v0.8.0...nest-typeorm-seeder-v0.9.0) (2026-04-13)


### Features

* add llms.txt ([cec5be6](https://github.com/joakimbugge/seeders/commit/cec5be634d7dcaf397d76dd547ef55c10005d29a))

## [0.8.0](https://github.com/joakimbugge/seeders/compare/nest-typeorm-seeder-v0.7.1...nest-typeorm-seeder-v0.8.0) (2026-04-10)


### Features

* loadEntities and loadSeeders now only exist in @joakimbugge/seeder ([6b396e1](https://github.com/joakimbugge/seeders/commit/6b396e1701b21b00f4335935e1f51c5434a1d7b2))

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
