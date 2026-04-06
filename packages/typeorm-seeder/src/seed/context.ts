import type { DataSource } from 'typeorm';
import type { SeedContext as BaseSeedContext } from '@joakimbugge/seeder';

/** Context passed through a seed operation. Available inside factory callbacks and `SeederInterface.run`. */
export type SeedContext = BaseSeedContext & {
  /**
   * The TypeORM DataSource. Automatically set by `save`/`saveMany` calls.
   * Also available in factory callbacks — useful for looking up existing
   * entities instead of creating new ones:
   *
   * @example
   * @Seed(async ({ dataSource }) => dataSource.getRepository(Role).findOneByOrFail({ name: 'admin' }))
   * role!: Role
   */
  dataSource?: DataSource;
};
