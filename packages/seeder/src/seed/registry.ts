/** An entity instance — any class-based object. */
export type EntityInstance = object;

/** A constructor that produces an entity instance. */
export type EntityConstructor<T extends EntityInstance = EntityInstance> = new () => T;

/** Base context passed through a seed operation. Available inside factory callbacks. */
export interface SeedContext {
  /**
   * Set to `false` to skip automatic relation seeding. Scalar and embedded
   * properties are still seeded; only relation properties decorated with a
   * bare `@Seed()` are skipped.
   *
   * @default true
   */
  relations?: boolean;
}

/**
 * Factory callback passed to `@Seed`. Receives the seed context, the partially built entity,
 * and a zero-based index that counts up across a `createMany`/`saveMany` batch.
 *
 * Properties are seeded sequentially in declaration order, so any property declared above the
 * current one is already set on `self` and can be read to derive the current value.
 *
 * The optional `TContext` parameter lets ORM packages expose a narrowed factory type whose
 * context includes connection-specific fields (e.g. `dataSource`, `em`) without needing
 * duplicate implementations. Defaults to the base {@link SeedContext}.
 *
 * @example
 * @Seed((_, __, i) => `user-${i}@example.com`)
 * email!: string
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SeedFactory<T = unknown, TEntity = any, TContext extends SeedContext = SeedContext> = (
  context: TContext,
  self: TEntity,
  index: number,
) => T | Promise<T>;

/** Options for the `@Seed` decorator. */
export interface SeedOptions {
  /**
   * Number of related entities to create. Only meaningful on one-to-many and
   * many-to-many relation properties. Ignored on scalar and single-entity relations.
   */
  count?: number;
}

export interface SeedEntry {
  propertyKey: string | symbol;
  /** Undefined when `@Seed` is used without a factory (i.e. bare relation seed). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  factory: SeedFactory<unknown, any, any> | undefined;
  options: SeedOptions;
}

export type MapToInstances<T extends readonly EntityConstructor[]> = {
  [K in keyof T]: T[K] extends EntityConstructor<infer I> ? I : never;
};

export type MapToInstanceArrays<T extends readonly EntityConstructor[]> = {
  [K in keyof T]: T[K] extends EntityConstructor<infer I> ? I[] : never;
};

// Keyed by the entity class constructor.
const registry = new Map<Function, SeedEntry[]>();

/** Registers a seed entry for the given class constructor. Called internally by the `@Seed` decorator. */
export function registerSeed(target: Function, entry: SeedEntry): void {
  const entries = registry.get(target) ?? [];

  entries.push(entry);
  registry.set(target, entries);
}

/**
 * Returns all seed entries for the given class, including those inherited from
 * parent classes. Parent entries come first, preserving declaration order.
 */
export function getSeeds(target: Function): SeedEntry[] {
  const entries: SeedEntry[] = [];
  let current: Function = target;

  while (current && current !== Function.prototype) {
    const own = registry.get(current);

    if (own) {
      entries.unshift(...own);
    }

    current = Object.getPrototypeOf(current) as Function;
  }

  return entries;
}
