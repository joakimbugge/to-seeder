# Getting started

Decorator-based entity seeding for TypeORM. Annotate entity properties with `@Seed()`, then create or persist fully populated entity graphs with a single call — including relations, embedded types, and circular guards. Organize complex seeding scenarios into `@Seeder` classes with declared dependencies that are automatically ordered and executed.

## Installation

`typeorm` and `reflect-metadata` are peer dependencies.

::: code-group

```bash [npm]
npm install @joakimbugge/typeorm-seeder typeorm reflect-metadata
```

```bash [yarn]
yarn add @joakimbugge/typeorm-seeder typeorm reflect-metadata
```

```bash [pnpm]
pnpm add @joakimbugge/typeorm-seeder typeorm reflect-metadata
```

:::

Verify these compiler options are enabled in your `tsconfig.json` — TypeORM requires them and they should already be set:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```
