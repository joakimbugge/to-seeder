import type { DataSource } from 'typeorm';
import { saveBatch } from '../utils/saveBatch.js';
import type { SeedValues } from '../creators/create.js';
import type {
  EntityConstructor,
  EntityInstance,
  MapToInstances,
  SeedContext,
} from '../registry.js';

/** Options for {@link save}. Extends {@link SeedContext} with a required DataSource. */
export interface SaveOptions<T extends EntityInstance = EntityInstance> extends SeedContext {
  dataSource: DataSource;
  values?: SeedValues<T>;
}

/**
 * Creates and persists one entity instance for a single class.
 * Uses the provided `dataSource` and supports `values` overrides.
 */
export async function save<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  options: SaveOptions<T>,
): Promise<T>;
/**
 * Creates and persists one instance per class in the provided tuple.
 * Relation seeding defaults to `false` for this overload.
 */
export async function save<T extends readonly EntityConstructor[]>(
  EntityClasses: [...T],
  options: SaveOptions,
): Promise<MapToInstances<T>>;
/**
 * Shared implementation for both overloads.
 * Array form delegates through `saveBatch(..., { count: 1 })` for each class.
 */
export async function save<T extends EntityInstance>(
  classOrClasses: EntityConstructor<T> | readonly EntityConstructor[],
  options: SaveOptions<T>,
): Promise<T | EntityInstance[]> {
  if (Array.isArray(classOrClasses)) {
    const effectiveOptions = { relations: false, ...options, count: 1 };

    return (await Promise.all(
      (classOrClasses as EntityConstructor[]).map((cls) =>
        saveBatch(cls, effectiveOptions).then(([entity]) => entity!),
      ),
    )) as EntityInstance[];
  }

  const [entity] = await saveBatch(classOrClasses as EntityConstructor<T>, {
    ...options,
    count: 1,
  });

  return entity!;
}
