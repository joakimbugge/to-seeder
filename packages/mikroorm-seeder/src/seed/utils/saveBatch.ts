import type { EntityManager } from '@mikro-orm/core';
import { createMany } from '../creators/createMany.js';
import type { SeedValues } from '../creators/create.js';
import type { EntityConstructor, EntityInstance, SeedContext } from '../registry.js';

export interface SaveBatchOptions<T extends EntityInstance = EntityInstance> extends SeedContext {
  em: EntityManager;
  count: number;
  values?: SeedValues<T>;
}

export async function saveBatch<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  options: SaveBatchOptions<T>,
): Promise<T[]> {
  const { count, em } = options;

  if (count === 0) {
    return [];
  }

  const entities = await createMany(EntityClass, options);

  for (const entity of entities) {
    em.persist(entity);
  }

  await em.flush();

  return entities;
}
