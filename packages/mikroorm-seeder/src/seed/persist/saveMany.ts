import { saveBatch } from '../utils/saveBatch.js';
import type { SeedValues } from '../creators/create.js';
import type {
  EntityConstructor,
  EntityInstance,
  MapToInstanceArrays,
  SeedContext,
} from '../registry.js';
import type { EntityManager } from '@mikro-orm/core';

/** Options for {@link saveMany}. */
export interface SaveManyOptions<T extends EntityInstance = EntityInstance> extends SeedContext {
  em: EntityManager;
  count: number;
  values?: SeedValues<T>;
}

/**
 * Creates and persists `count` instances for one entity class.
 */
export async function saveMany<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  options: SaveManyOptions<T>,
): Promise<T[]>;
/**
 * Creates and persists `count` instances per class in the tuple.
 * Relation seeding is disabled by default; pass `relations: true` to override.
 */
export async function saveMany<T extends readonly EntityConstructor[]>(
  EntityClasses: [...T],
  options: SaveManyOptions,
): Promise<MapToInstanceArrays<T>>;
/**
 * Shared implementation for both overloads.
 * Array form persists each class independently via `saveBatch`.
 */
export async function saveMany<T extends EntityInstance>(
  classOrClasses: EntityConstructor<T> | readonly EntityConstructor[],
  options: SaveManyOptions<T>,
): Promise<T[] | EntityInstance[][]> {
  if (Array.isArray(classOrClasses)) {
    const effectiveOptions = { relations: false, ...options };

    return (await Promise.all(
      (classOrClasses as EntityConstructor[]).map((cls) => saveBatch(cls, effectiveOptions)),
    )) as EntityInstance[][];
  }

  return await saveBatch(classOrClasses as EntityConstructor<T>, options);
}
