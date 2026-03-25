import type { DataSource } from 'typeorm';

/** An entity instance — any class-based object managed by TypeORM. */
export type EntityInstance = object;

/** A constructor that produces an entity instance. */
export type EntityConstructor<T extends EntityInstance = EntityInstance> = new () => T;

export interface SeedContext {
  dataSource?: DataSource;
  /**
   * Set to `false` to skip automatic relation seeding. Scalar and embedded
   * properties are still seeded; only relation properties decorated with a
   * bare `@Seed()` are skipped. Useful when you want to create flat entities
   * and wire relations yourself.
   *
   * @default true
   */
  relations?: boolean;
}

/** Factory callback passed to @Seed. Receives the seeder context, which may include a DataSource. */
export type SeedFactory<T = unknown> = (context: SeedContext) => T | Promise<T>;

/** Options passed to @Seed. */
export interface SeedOptions {
  /**
   * Number of related entities to create. Only meaningful on one-to-many and
   * many-to-many relation properties. Ignored on scalar and single-entity relations.
   */
  count?: number;
}

export interface SeedEntry {
  propertyKey: string | symbol;
  /** Undefined when @Seed is used without a factory (i.e. bare relation seed). */
  factory: SeedFactory | undefined;
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
