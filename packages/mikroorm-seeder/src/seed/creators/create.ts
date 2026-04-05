import type {
  EntityConstructor,
  EntityInstance,
  MapToInstances,
  SeedContext,
} from '../registry.js';
import { applyValues, createOne } from '../utils/createOne.js';
import type { SeedValues } from '../utils/createOne.js';

/** Options for {@link create} on the single-class form. */
export interface CreateOptions<T extends EntityInstance> extends SeedContext {
  values?: SeedValues<T>;
}

/**
 * Creates one entity instance in memory for a single class.
 * Applies `values` overrides after factory/decorator seeding.
 */
export async function create<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  options?: CreateOptions<T>,
): Promise<T>;
/**
 * Creates one in-memory instance per class in the provided tuple.
 * Relation seeding defaults to `false` for this overload.
 */
export async function create<T extends readonly EntityConstructor[]>(
  EntityClasses: [...T],
  context?: SeedContext,
): Promise<MapToInstances<T>>;
/**
 * Shared implementation for both overloads.
 * Dispatches on `Array.isArray(classOrClasses)` and normalizes options.
 */
export async function create<T extends EntityInstance>(
  classOrClasses: EntityConstructor<T> | readonly EntityConstructor[],
  options: CreateOptions<T> = {},
): Promise<T | EntityInstance[]> {
  if (Array.isArray(classOrClasses)) {
    const effectiveContext: SeedContext = { relations: false, ...options };

    return (await Promise.all(
      (classOrClasses as EntityConstructor[]).map((cls) => createOne(cls, effectiveContext)),
    )) as EntityInstance[];
  }

  const { values, ...context } = options as CreateOptions<T>;
  const instance = await createOne(classOrClasses as EntityConstructor<T>, context, 0);

  if (values) {
    await applyValues(instance, values, context, 0);
  }

  return instance;
}

export type { SeedValues } from '../utils/createOne.js';
