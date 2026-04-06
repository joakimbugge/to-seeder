import type { EntityConstructor, EntityInstance, SeedContext } from './registry.js';

/** Describes an embedded entity property as seen by `createOne`. */
export interface EmbeddedEntry {
  propertyName: string;
  getClass: () => EntityConstructor;
}

/** Describes a relation property as seen by `createOne`. */
export interface RelationEntry {
  propertyName: string;
  getClass: () => EntityConstructor;
  /** `true` for one-to-many and many-to-many; `false` for one-to-one and many-to-one. */
  isArray: boolean;
}

/**
 * ORM-specific metadata provider injected into the creation pipeline.
 * Each ORM package implements this interface to expose its embedded and relation
 * metadata in a shape that `createOne` understands without importing any ORM package.
 */
export interface MetadataAdapter {
  /**
   * Returns embedded entity entries for the given class hierarchy.
   * The hierarchy is ordered from most-derived to base class.
   */
  getEmbeddeds(hierarchy: EntityConstructor[]): EmbeddedEntry[];
  /**
   * Returns relation entries for the given class hierarchy.
   * Only properties that have a resolvable entity constructor should be included.
   */
  getRelations(hierarchy: EntityConstructor[]): RelationEntry[];
}

/**
 * ORM-specific persistence provider injected into the save pipeline.
 * Each ORM package implements this interface to persist entities using its own
 * connection and flush mechanism without coupling the base package to any ORM.
 *
 * `TContext` is the ORM-specific context type that carries the connection
 * (e.g. `{ dataSource: DataSource }` for TypeORM, `{ em: EntityManager }` for MikroORM).
 */
export interface PersistenceAdapter<TContext extends SeedContext = SeedContext> {
  /**
   * Persists the given pre-created entities and returns the saved instances.
   * The `context` contains the ORM connection and any other seed context fields.
   */
  save<T extends EntityInstance>(
    EntityClass: EntityConstructor<T>,
    entities: T[],
    context: TContext,
  ): Promise<T[]>;
}
