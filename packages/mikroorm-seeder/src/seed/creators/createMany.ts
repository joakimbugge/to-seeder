import type {
  EntityConstructor,
  EntityInstance,
  MapToInstanceArrays,
  SeedContext,
} from '../registry.js';
import { applyValues, createManyInstances } from '../utils/createOne.js';
import type { SeedValues } from './create.js';

/** Options for {@link createMany} on the single-class and array forms. */
export interface CreateManyOptions<T extends EntityInstance = EntityInstance> extends SeedContext {
  count: number;
  values?: SeedValues<T>;
}

/**
 * Creates `count` in-memory instances for one entity class.
 * Applies optional `values` overrides per created instance.
 */
export async function createMany<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  options: CreateManyOptions<T>,
): Promise<T[]>;
/**
 * Creates `count` instances for each class in the tuple.
 * Relation seeding defaults to `false` for this overload.
 */
export async function createMany<T extends readonly EntityConstructor[]>(
  EntityClasses: [...T],
  options: CreateManyOptions,
): Promise<MapToInstanceArrays<T>>;
/**
 * Shared implementation for both overloads.
 * Branches between single-class and tuple semantics and applies `values` when provided.
 */
export async function createMany<T extends EntityInstance>(
  classOrClasses: EntityConstructor<T> | readonly EntityConstructor[],
  { count, values, ...context }: CreateManyOptions<T>,
): Promise<T[] | EntityInstance[][]> {
  if (Array.isArray(classOrClasses)) {
    const effectiveContext: SeedContext = { relations: false, ...context };

    return (await Promise.all(
      (classOrClasses as EntityConstructor[]).map((cls) =>
        createManyInstances(cls, count, effectiveContext),
      ),
    )) as EntityInstance[][];
  }

  const instances = await createManyInstances(
    classOrClasses as EntityConstructor<T>,
    count,
    context,
  );

  if (values) {
    await Promise.all(instances.map((instance, i) => applyValues(instance, values, context, i)));
  }

  return instances;
}
