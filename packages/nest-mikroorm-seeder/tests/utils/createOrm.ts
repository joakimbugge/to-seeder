import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { MikroORM } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { User } from '../fixtures/user.js';

export async function createOrm(): Promise<MikroORM> {
  const orm = await MikroORM.init({
    metadataProvider: ReflectMetadataProvider,
    entities: [User],
    dbName: ':memory:',
    driver: SqliteDriver,
  });
  await orm.schema.create();
  return orm;
}
