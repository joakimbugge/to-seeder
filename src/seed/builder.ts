import { createManySeed, createSeed } from './creator.js';
import { saveManySeed, saveSeed } from './persist.js';
import type {
  EntityConstructor,
  EntityInstance,
  MapToInstanceArrays,
  MapToInstances,
  SeedContext,
} from './registry.js';
import type { SaveSeedOptions } from './persist.js';

interface SingleSeed<T extends EntityInstance> {
  /** Creates a single instance in memory without persisting. */
  create(context?: SeedContext): Promise<T>;
  /** Creates and persists a single instance. */
  save(options: SaveSeedOptions): Promise<T>;
  /** Creates multiple instances in memory without persisting. */
  createMany(count: number, context?: SeedContext): Promise<T[]>;
  /** Creates and persists multiple instances. */
  saveMany(count: number, options: SaveSeedOptions): Promise<T[]>;
}

interface MultiSeed<T extends readonly EntityConstructor[]> {
  /** Creates one instance of each class in memory without persisting. */
  create(context?: SeedContext): Promise<MapToInstances<T>>;
  /** Creates and persists one instance of each class. */
  save(options: SaveSeedOptions): Promise<MapToInstances<T>>;
  /** Creates `count` instances of each class in memory without persisting. */
  createMany(count: number, context?: SeedContext): Promise<MapToInstanceArrays<T>>;
  /** Creates and persists `count` instances of each class. */
  saveMany(count: number, options: SaveSeedOptions): Promise<MapToInstanceArrays<T>>;
}

export function seed<T extends EntityInstance>(EntityClass: EntityConstructor<T>): SingleSeed<T>;
export function seed<T extends readonly EntityConstructor[]>(EntityClasses: [...T]): MultiSeed<T>;
export function seed<T extends EntityInstance>(
  classOrClasses: EntityConstructor<T> | readonly EntityConstructor[],
): SingleSeed<T> | MultiSeed<readonly EntityConstructor[]> {
  if (Array.isArray(classOrClasses)) {
    const classes = classOrClasses as readonly EntityConstructor[];

    return {
      create: (context?: SeedContext) =>
        createSeed(classes as [...typeof classes], context) as Promise<
          MapToInstances<typeof classes>
        >,
      save: (options: SaveSeedOptions) =>
        saveSeed(classes as [...typeof classes], options) as Promise<
          MapToInstances<typeof classes>
        >,
      createMany: (count: number, context?: SeedContext) =>
        createManySeed(classes as [...typeof classes], { count, ...context }) as Promise<
          MapToInstanceArrays<typeof classes>
        >,
      saveMany: (count: number, options: SaveSeedOptions) =>
        saveManySeed(classes as [...typeof classes], { count, ...options }) as Promise<
          MapToInstanceArrays<typeof classes>
        >,
    };
  }

  const EntityClass = classOrClasses as EntityConstructor<T>;

  return {
    create: (context?: SeedContext) => createSeed(EntityClass, context),
    save: (options: SaveSeedOptions) => saveSeed(EntityClass, options),
    createMany: (count: number, context?: SeedContext) =>
      createManySeed(EntityClass, { count, ...context }),
    saveMany: (count: number, options: SaveSeedOptions) =>
      saveManySeed(EntityClass, { count, ...options }),
  };
}
