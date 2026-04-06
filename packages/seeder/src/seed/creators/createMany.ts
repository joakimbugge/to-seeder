import type { MetadataAdapter } from '../adapter.js';
import type {
  EntityConstructor,
  EntityInstance,
  MapToInstanceArrays,
  SeedContext,
} from '../registry.js';
import { applyValues, createManyInstances } from '../utils/createOne.js';
import type { SeedValues } from '../utils/createOne.js';

/** Base options for the `createMany` overload. */
export interface CreateManyOptions<T extends EntityInstance = EntityInstance> extends SeedContext {
  count: number;
  values?: SeedValues<T>;
}

/**
 * Creates `count` in-memory instances for one entity class.
 * Applies optional `values` overrides per created instance.
 *
 * @internal The `adapter` parameter is supplied by ORM packages and is not part of the user-facing API.
 */
export async function createMany<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  options: CreateManyOptions<T>,
  adapter: MetadataAdapter,
): Promise<T[]>;
/**
 * Creates `count` instances for each class in the tuple.
 * Relation seeding defaults to `false` for this overload.
 *
 * @internal The `adapter` parameter is supplied by ORM packages and is not part of the user-facing API.
 */
export async function createMany<T extends readonly EntityConstructor[]>(
  EntityClasses: [...T],
  options: CreateManyOptions,
  adapter: MetadataAdapter,
): Promise<MapToInstanceArrays<T>>;
export async function createMany<T extends EntityInstance>(
  classOrClasses: EntityConstructor<T> | readonly EntityConstructor[],
  { count, values, ...context }: CreateManyOptions<T>,
  adapter: MetadataAdapter,
): Promise<T[] | EntityInstance[][]> {
  if (Array.isArray(classOrClasses)) {
    const effectiveContext: SeedContext = { relations: false, ...context };

    return (await Promise.all(
      (classOrClasses as EntityConstructor[]).map((cls) =>
        createManyInstances(cls, count, effectiveContext, adapter),
      ),
    )) as EntityInstance[][];
  }

  const instances = await createManyInstances(
    classOrClasses as EntityConstructor<T>,
    count,
    context,
    adapter,
  );

  if (values) {
    await Promise.all(instances.map((instance, i) => applyValues(instance, values, context, i)));
  }

  return instances;
}
