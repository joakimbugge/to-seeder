import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { FixtureAuthor } from '../entities/FixtureAuthor.js';
import { FixtureBook } from '../entities/FixtureBook.js';

// Exported as a default instance so loadOrm() can resolve it via mod.default.
export default await MikroORM.init({
  metadataProvider: ReflectMetadataProvider,
  entities: [FixtureAuthor, FixtureBook],
  dbName: ':memory:',
  driver: SqliteDriver,
});
