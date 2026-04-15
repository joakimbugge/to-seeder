# Changelog

## [0.12.1](https://github.com/joakimbugge/seeders/compare/typeorm-seeder-v0.12.0...typeorm-seeder-v0.12.1) (2026-04-15)


### Bug Fixes

* add seeder suite return type generic to prevent casting ([dedad13](https://github.com/joakimbugge/seeders/commit/dedad135f4a655e02f6412ed7196205590965615))
* prevent types naming conflicts between seeder and orm package ([4b8dd8b](https://github.com/joakimbugge/seeders/commit/4b8dd8b58c39c281ba9cb3d52144fe1d91d68e37))

## [0.12.0](https://github.com/joakimbugge/seeders/compare/typeorm-seeder-v0.11.0...typeorm-seeder-v0.12.0) (2026-04-13)


### Features

* populate context with previously seeded entities ([6daf871](https://github.com/joakimbugge/seeders/commit/6daf871eb34e958d3b9c30d4e20ede46ecf33135))


### Bug Fixes

* correct types and remove unncessary explicit types ([4c1517f](https://github.com/joakimbugge/seeders/commit/4c1517f635facfbee407fcf0d9eb31085045e432))

## [0.11.0](https://github.com/joakimbugge/seeders/compare/typeorm-seeder-v0.10.0...typeorm-seeder-v0.11.0) (2026-04-13)


### Features

* add llms.txt ([cec5be6](https://github.com/joakimbugge/seeders/commit/cec5be634d7dcaf397d76dd547ef55c10005d29a))

## [0.10.0](https://github.com/joakimbugge/seeders/compare/typeorm-seeder-v0.9.0...typeorm-seeder-v0.10.0) (2026-04-10)


### Features

* base ORM seeders on the new core seeder package ([4682a20](https://github.com/joakimbugge/seeders/commit/4682a2065679b9a2832cc2db62685f7beebfa20d))
* loadEntities and loadSeeders now only exist in @joakimbugge/seeder ([6b396e1](https://github.com/joakimbugge/seeders/commit/6b396e1701b21b00f4335935e1f51c5434a1d7b2))
* move seeder suits, runner and decorator to core package ([56eff84](https://github.com/joakimbugge/seeders/commit/56eff84c7adf12eb111ef31b8140b0c95f15a7dd))


### Miscellaneous

* minor explicit type removals ([7bfeb8b](https://github.com/joakimbugge/seeders/commit/7bfeb8b866d2bfbf72dc359bd2695afb7220a333))
* remove internal playground ([aa69de6](https://github.com/joakimbugge/seeders/commit/aa69de60a89f350d309a9fc87b0275e35a96c9e3))

## [0.9.0](https://github.com/joakimbugge/seeders/compare/typeorm-seeder-v0.8.1...typeorm-seeder-v0.9.0) (2026-04-02)


### Features

* add --dry-run flag to seed:run and seed:entities ([4c0ea51](https://github.com/joakimbugge/seeders/commit/4c0ea51159998613427af7589a18beec3baa1c4f))
* add index to seed factory ([0ad6d39](https://github.com/joakimbugge/seeders/commit/0ad6d3960b52c8fe9978fa658660c3d2d8256227))
* add seed:list command to CLI ([adfff59](https://github.com/joakimbugge/seeders/commit/adfff596c19985dba4251b885749fdd8f1f97eaa))
* add seed:untrack cli command ([5145ace](https://github.com/joakimbugge/seeders/commit/5145aced67f3df8c984dc61c5f0c3df956dbdd8e))
* run non-dependent seeders concurrently ([d3a3d06](https://github.com/joakimbugge/seeders/commit/d3a3d06b75b08b651796f99af4bf5190b4521c86))

## 0.8.1

### Patch Changes

- [`5f65343`](https://github.com/joakimbugge/seeders/commit/5f653435000e87d40f63a398d5150a61d5983d1f) Thanks [@joakimbugge](https://github.com/joakimbugge)! - Export previously internal types: `SingleSeed`, `MultiSeed`, `MapToInstances`, and `MapToInstanceArrays` from the core seeder packages; `SeederModuleSeedersOptions`, `SeederModuleRunOptions`, and `SeederModuleFeatureOnlyOptions` from the NestJS integration packages.

## [0.8.0](https://github.com/joakimbugge/seeders/compare/typeorm-seeder-v0.7.0...typeorm-seeder-v0.8.0) (2026-03-29)

### Features

- **packages/typeorm-seeder:** collect returns from seeder suites ([28a400d](https://github.com/joakimbugge/seeders/commit/28a400dd0fd49b3ce8d73472227d8b25cac960af))
- **packages/typeorm-seeder:** custom logger option ([c5fe394](https://github.com/joakimbugge/seeders/commit/c5fe394cbc77be57bca245f7e828b1dc1ec3cd05))

## [0.7.0](https://github.com/joakimbugge/seeders/compare/typeorm-seeder-v0.6.1...typeorm-seeder-v0.7.0) (2026-03-28)

### Features

- **packages/typeorm-seeder:** add CLI ([a1e64bc](https://github.com/joakimbugge/seeders/commit/a1e64bc776c0f9b85db8b61f4a32ade0dfbd65e8))
- **packages/typeorm-seeder:** path loading and TypeORM logging ([e748969](https://github.com/joakimbugge/seeders/commit/e748969e0403d83844ca781f9f7685edb9a4b0b5))
- **packages/typeorm-seeder:** support tree entities ([af0e097](https://github.com/joakimbugge/seeders/commit/af0e097b445e12a3f74349540bc56195b8fedc9a))

## [0.6.1](https://github.com/joakimbugge/seeders/compare/typeorm-seeder-v0.6.0...typeorm-seeder-v0.6.1) (2026-03-27)

### Bug Fixes

- **packages/typeorm-seeder:** allow SeedFactory in values properties ([e6232b3](https://github.com/joakimbugge/seeders/commit/e6232b372881e6dae706dff0189e78116dbc244d))

## [0.6.0](https://github.com/joakimbugge/seeders/compare/typeorm-seeder-v0.5.0...typeorm-seeder-v0.6.0) (2026-03-27)

### Features

- **packages/typeorm-seeder:** add values option ([daaa351](https://github.com/joakimbugge/seeders/commit/daaa351779ad814d7b1bcb3dfc724c4b79509364))
- **packages/typeorm-seeder:** consistent types naming ([2f93900](https://github.com/joakimbugge/seeders/commit/2f9390005ee2353e09c5ce1afb252fb0668f736d))
- **packages/typeorm-seeder:** simplify creator and persist methods naming ([7c50f6f](https://github.com/joakimbugge/seeders/commit/7c50f6fb93f1d31984106f2d0ae60b38ca901455))

### Bug Fixes

- **packages/typeorm-seeder:** add generic type to self argument ([c821126](https://github.com/joakimbugge/seeders/commit/c821126f69556d1f0772091fd57e3a6e189c92d7))

## [0.5.0](https://github.com/joakimbugge/seeders/compare/typeorm-seeder-v0.4.1...typeorm-seeder-v0.5.0) (2026-03-27)

### Features

- **packages/typeorm-seeder:** provide partial instance in @Seed ([9356d83](https://github.com/joakimbugge/seeders/commit/9356d8369bef1736b60852ac2055c267a86bd6c9))

### Bug Fixes

- **packages/typeorm-seeder:** add missing argument in decorator test ([2de864e](https://github.com/joakimbugge/seeders/commit/2de864eeceda6f86e9aae0bf8480668f5b1b7360))

## [0.4.1](https://github.com/joakimbugge/seeders/compare/typeorm-seeder-v0.4.0...typeorm-seeder-v0.4.1) (2026-03-27)

### Bug Fixes

- **packages/typeorm-seeder:** add more comments ([d806424](https://github.com/joakimbugge/seeders/commit/d806424944837444cf38260dd3f76a7db3d96dc6))

## [0.4.0](https://github.com/joakimbugge/seeders/compare/typeorm-seeder-v0.3.0...typeorm-seeder-v0.4.0) (2026-03-26)

### Features

- **packages/typeorm-seeder:** add skip option ([058f244](https://github.com/joakimbugge/seeders/commit/058f24461513142c0f45d89603ada275b3b83eaf))

## [0.3.0](https://github.com/joakimbugge/seeders/compare/typeorm-seeder-v0.2.0...typeorm-seeder-v0.3.0) (2026-03-25)

### Features

- **packages/typeorm-seeder:** add logging and hooks ([a8581f7](https://github.com/joakimbugge/seeders/commit/a8581f778325658a5187116c871d2db6b78c02e4))

## [0.2.0](https://github.com/joakimbugge/seeders/compare/typeorm-seeder-v0.1.0...typeorm-seeder-v0.2.0) (2026-03-25)

### Features

- initial commit ([a832c6b](https://github.com/joakimbugge/seeders/commit/a832c6bab016715169971bf19f5222f6f18d6882))
