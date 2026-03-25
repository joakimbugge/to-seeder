# nestjs-typeorm-seeder

## File naming

NestJS constructs (modules, services, guards, interceptors, etc.) use PascalCase matching the class name (e.g. `SeederModule.ts`, `SeederRunnerService.ts`), not the traditional NestJS dot-separated convention (e.g. `seeder.module.ts`).

Generic files (types, utilities, helpers) use camelCase matching the primary export (e.g. `types.ts`, `isNull.ts`).
