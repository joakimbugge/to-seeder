import type { MetadataAdapter, PersistenceAdapter } from '../adapter.js';
import type { SeedValues } from './createOne';
import { createMany } from '../creators/createMany.js';
import type { EntityConstructor, EntityInstance, SeedContext } from '../registry.js';

/**
 * Creates `count` instances of `EntityClass` then persists them via the `persistenceAdapter`.
 *
 * @internal Used by `save` and `saveMany`. Not part of the public API.
 */
export async function saveBatch<T extends EntityInstance, TContext extends SeedContext>(
  EntityClass: EntityConstructor<T>,
  options: TContext & { count: number; values?: SeedValues<T> },
  metadataAdapter: MetadataAdapter,
  persistenceAdapter: PersistenceAdapter<TContext>,
) {
  if (options.count === 0) {
    return [];
  }

  const entities = await createMany(EntityClass, options, metadataAdapter);

  return persistenceAdapter.save(EntityClass, entities, options);
}
