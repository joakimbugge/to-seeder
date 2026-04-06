import type { MetadataAdapter } from '../adapter.js';
import type {
  EntityConstructor,
  EntityInstance,
  MapToInstances,
  SeedContext,
} from '../registry.js';
import { applyValues, createOne } from '../utils/createOne.js';
import type { SeedValues } from '../utils/createOne.js';

/** Base options for the single-class `create` overload. */
export interface CreateOptions<T extends EntityInstance> extends SeedContext {
  values?: SeedValues<T>;
}

/**
 * Creates one entity instance in memory for a single class.
 * Applies `values` overrides after factory/decorator seeding.
 *
 * @internal The `adapter` parameter is supplied by ORM packages and is not part of the user-facing API.
 */
export async function create<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  options: CreateOptions<T> | undefined,
  adapter: MetadataAdapter,
): Promise<T>;
/**
 * Creates one in-memory instance per class in the provided tuple.
 * Relation seeding defaults to `false` for this overload.
 *
 * @internal The `adapter` parameter is supplied by ORM packages and is not part of the user-facing API.
 */
export async function create<T extends readonly EntityConstructor[]>(
  EntityClasses: [...T],
  context: SeedContext | undefined,
  adapter: MetadataAdapter,
): Promise<MapToInstances<T>>;
export async function create<T extends EntityInstance>(
  classOrClasses: EntityConstructor<T> | readonly EntityConstructor[],
  options: CreateOptions<T> | undefined,
  adapter: MetadataAdapter,
): Promise<T | EntityInstance[]> {
  if (Array.isArray(classOrClasses)) {
    const effectiveContext: SeedContext = { relations: false, ...options };

    return (await Promise.all(
      (classOrClasses as EntityConstructor[]).map((cls) =>
        createOne(cls, effectiveContext, 0, adapter),
      ),
    )) as EntityInstance[];
  }

  const { values, ...context } = (options ?? {}) as CreateOptions<T>;
  const instance = await createOne(classOrClasses as EntityConstructor<T>, context, 0, adapter);

  if (values) {
    await applyValues(instance, values, context, 0);
  }

  return instance;
}

export type { SeedValues } from '../utils/createOne.js';
