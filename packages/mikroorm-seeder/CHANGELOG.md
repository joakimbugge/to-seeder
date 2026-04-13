# @joakimbugge/mikroorm-seeder

## [0.6.0](https://github.com/joakimbugge/seeders/compare/mikroorm-seeder-v0.5.0...mikroorm-seeder-v0.6.0) (2026-04-13)


### Features

* populate context with previously seeded entities ([6daf871](https://github.com/joakimbugge/seeders/commit/6daf871eb34e958d3b9c30d4e20ede46ecf33135))


### Bug Fixes

* correct types and remove unncessary explicit types ([4c1517f](https://github.com/joakimbugge/seeders/commit/4c1517f635facfbee407fcf0d9eb31085045e432))


### Documentation

* reorganize and expand documentation ([acd75d2](https://github.com/joakimbugge/seeders/commit/acd75d270d2635e67e8379764574434b4dc1003c))

## [0.5.0](https://github.com/joakimbugge/seeders/compare/mikroorm-seeder-v0.4.0...mikroorm-seeder-v0.5.0) (2026-04-13)


### Features

* add llms.txt ([cec5be6](https://github.com/joakimbugge/seeders/commit/cec5be634d7dcaf397d76dd547ef55c10005d29a))

## [0.4.0](https://github.com/joakimbugge/seeders/compare/mikroorm-seeder-v0.3.0...mikroorm-seeder-v0.4.0) (2026-04-10)


### Features

* base ORM seeders on the new core seeder package ([4682a20](https://github.com/joakimbugge/seeders/commit/4682a2065679b9a2832cc2db62685f7beebfa20d))
* loadEntities and loadSeeders now only exist in @joakimbugge/seeder ([6b396e1](https://github.com/joakimbugge/seeders/commit/6b396e1701b21b00f4335935e1f51c5434a1d7b2))
* move seeder suits, runner and decorator to core package ([56eff84](https://github.com/joakimbugge/seeders/commit/56eff84c7adf12eb111ef31b8140b0c95f15a7dd))


### Bug Fixes

* make reflect-metadata an optional peer dependency ([dc4fde0](https://github.com/joakimbugge/seeders/commit/dc4fde07be95b89d64218cc6ba3112d0e50590a3))


### Miscellaneous

* minor explicit type removals ([7bfeb8b](https://github.com/joakimbugge/seeders/commit/7bfeb8b866d2bfbf72dc359bd2695afb7220a333))

## [0.3.0](https://github.com/joakimbugge/seeders/compare/mikroorm-seeder-v0.2.0...mikroorm-seeder-v0.3.0) (2026-04-02)


### Features

* add --dry-run flag to seed:run and seed:entities ([4c0ea51](https://github.com/joakimbugge/seeders/commit/4c0ea51159998613427af7589a18beec3baa1c4f))
* add index to seed factory ([0ad6d39](https://github.com/joakimbugge/seeders/commit/0ad6d3960b52c8fe9978fa658660c3d2d8256227))
* add seed:list command to CLI ([adfff59](https://github.com/joakimbugge/seeders/commit/adfff596c19985dba4251b885749fdd8f1f97eaa))
* add seed:untrack cli command ([5145ace](https://github.com/joakimbugge/seeders/commit/5145aced67f3df8c984dc61c5f0c3df956dbdd8e))
* run non-dependent seeders concurrently ([d3a3d06](https://github.com/joakimbugge/seeders/commit/d3a3d06b75b08b651796f99af4bf5190b4521c86))

## [0.2.0](https://github.com/joakimbugge/seeders/compare/mikroorm-seeder-v0.1.1...mikroorm-seeder-v0.2.0) (2026-03-30)


### Features

* add mikroorm-seeder cli ([e15f711](https://github.com/joakimbugge/seeders/commit/e15f711637a799e60b53c33c7012a2bfca0b63c2))

## 0.1.1

### Patch Changes

- [`5f65343`](https://github.com/joakimbugge/seeders/commit/5f653435000e87d40f63a398d5150a61d5983d1f) Thanks [@joakimbugge](https://github.com/joakimbugge)! - Export previously internal types: `SingleSeed`, `MultiSeed`, `MapToInstances`, and `MapToInstanceArrays` from the core seeder packages; `SeederModuleSeedersOptions`, `SeederModuleRunOptions`, and `SeederModuleFeatureOnlyOptions` from the NestJS integration packages.
