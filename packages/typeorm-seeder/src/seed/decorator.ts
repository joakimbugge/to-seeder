import type { SeedFactory as BaseSeedFactory } from '@joakimbugge/seeder';
import { Seed as BaseSeed } from '@joakimbugge/seeder';
import type { SeedOptions } from '@joakimbugge/seeder';
import type { SeedContext } from './context.js';

/**
 * Factory callback passed to `@Seed`. Receives the TypeORM seed context, the partially built entity,
 * and a zero-based index that counts up across a `createMany`/`saveMany` batch.
 *
 * Properties are seeded sequentially in declaration order, so any property declared above the
 * current one is already set on `self` and can be read to derive the current value.
 *
 * Annotate `self` with the entity class to get full type inference:
 *
 * @example
 * @Seed((_, self: MyEntity) => faker.date.future({ refDate: self.beginDate }))
 * endDate!: Date
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SeedFactory<T = unknown, TEntity = any> = BaseSeedFactory<T, TEntity, SeedContext>;

/**
 * TypeORM-flavoured `@Seed` decorator. Identical API to the base `@Seed` but
 * factory callbacks receive a {@link SeedContext} that includes `dataSource`.
 *
 * Re-exported as a type-cast of the base implementation — zero runtime overhead.
 */
export const Seed = BaseSeed as {
  /**
   * Marks a relation property for auto-seeding.
   *
   * The related entity class is inferred from TypeORM metadata. One instance is created
   * and recursively seeded (including its own `@Seed` properties).
   *
   * Circular back-references are broken automatically: if the related class is already
   * being seeded higher up in the same call chain, the property is left `undefined`.
   * TypeORM treats `undefined` as "don't touch this column" rather than setting it to null.
   */
  (): PropertyDecorator;

  /**
   * Marks a relation property for auto-seeding with options.
   *
   * Use `count` on one-to-many and many-to-many properties to control how many
   * related entities are created. Ignored for one-to-one and many-to-one.
   *
   * @example
   * @Seed({ count: 3 })
   * @OneToMany(() => Book, (b) => b.author)
   * books!: Book[]
   */
  (options: SeedOptions): PropertyDecorator;

  /**
   * Marks a property with a factory callback.
   *
   * The factory receives the current {@link SeedContext} and can return any value,
   * including a `Promise`. Use this for scalar properties or when you need full
   * control over how a related entity is resolved.
   *
   * @example
   * @Seed(() => faker.internet.email())
   * email!: string
   *
   * @example
   * // Look up an existing entity instead of creating a new one
   * @Seed(async ({ dataSource }) => dataSource.getRepository(Role).findOneByOrFail({ name: 'admin' }))
   * role!: Role
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <TEntity = any>(factory: SeedFactory<unknown, TEntity>): PropertyDecorator;

  /** Marks a property with a factory callback and additional options. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <TEntity = any>(factory: SeedFactory<unknown, TEntity>, options: SeedOptions): PropertyDecorator;
};
