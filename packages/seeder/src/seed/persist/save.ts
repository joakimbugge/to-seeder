import type { MetadataAdapter, PersistenceAdapter } from '../adapter.js';
import type { SeedValues } from '../creators/create.js';
import type {
  EntityConstructor,
  EntityInstance,
  MapToInstances,
  SeedContext,
} from '../registry.js';
import { saveBatch } from './saveBatch.js';

/**
 * Creates and persists one entity instance for a single class.
 *
 * @internal The `metadataAdapter` and `persistenceAdapter` parameters are supplied by ORM packages
 * and are not part of the user-facing API.
 */
export async function save<T extends EntityInstance, TContext extends SeedContext>(
  EntityClass: EntityConstructor<T>,
  options: TContext & { values?: SeedValues<T> },
  metadataAdapter: MetadataAdapter,
  persistenceAdapter: PersistenceAdapter<TContext>,
): Promise<T>;
/**
 * Creates and persists one instance per class in the provided tuple.
 * Relation seeding defaults to `false` for this overload.
 *
 * @internal The `metadataAdapter` and `persistenceAdapter` parameters are supplied by ORM packages
 * and are not part of the user-facing API.
 */
export async function save<T extends readonly EntityConstructor[], TContext extends SeedContext>(
  EntityClasses: [...T],
  options: TContext,
  metadataAdapter: MetadataAdapter,
  persistenceAdapter: PersistenceAdapter<TContext>,
): Promise<MapToInstances<T>>;
export async function save<T extends EntityInstance, TContext extends SeedContext>(
  classOrClasses: EntityConstructor<T> | readonly EntityConstructor[],
  options: TContext & { values?: SeedValues<T> },
  metadataAdapter: MetadataAdapter,
  persistenceAdapter: PersistenceAdapter<TContext>,
): Promise<T | EntityInstance[]> {
  if (Array.isArray(classOrClasses)) {
    const effectiveOptions = { relations: false, ...options, count: 1 } as TContext & {
      count: number;
    };

    return (await Promise.all(
      (classOrClasses as EntityConstructor[]).map((cls) =>
        saveBatch(cls, effectiveOptions, metadataAdapter, persistenceAdapter).then(
          ([entity]) => entity!,
        ),
      ),
    )) as EntityInstance[];
  }

  const [entity] = await saveBatch(
    classOrClasses as EntityConstructor<T>,
    { ...options, count: 1 },
    metadataAdapter,
    persistenceAdapter,
  );

  return entity!;
}
