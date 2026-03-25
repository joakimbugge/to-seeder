import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Column, DataSource, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { SeedContext } from '../../src';
import { runSeeders, saveManySeed, Seed, Seeder } from '../../src';
import { registerSeeder } from '../../src/seeder/registry.js';

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

@Entity()
class SeedUser {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Column({ type: 'text' })
  name!: string;
}

@Entity()
class SeedPost {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.sentence())
  @Column({ type: 'text' })
  title!: string;
}

@Entity()
class SeedComment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.words(5))
  @Column({ type: 'text' })
  body!: string;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('seeder suites', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [SeedUser, SeedPost, SeedComment],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('basic execution', () => {
    it('runs a seeder with no dependencies', async () => {
      const spy = vi.fn();

      @Seeder()
      class StandaloneSeeder {
        async run(_ctx: SeedContext) {
          spy();
        }
      }

      await runSeeders([StandaloneSeeder], { dataSource });

      expect(spy).toHaveBeenCalledOnce();
    });

    it('passes context to the seeder', async () => {
      let received: SeedContext | undefined;

      @Seeder()
      class ContextSeeder {
        async run(ctx: SeedContext) {
          received = ctx;
        }
      }

      await runSeeders([ContextSeeder], { dataSource });

      expect(received?.dataSource).toBe(dataSource);
    });

    it('actually seeds the database', async () => {
      @Seeder()
      class UserSeeder {
        async run(ctx: SeedContext) {
          await saveManySeed(SeedUser, { ...ctx, dataSource: ctx.dataSource!, count: 3 });
        }
      }

      const before = await dataSource.getRepository(SeedUser).count();
      await runSeeders([UserSeeder], { dataSource });
      const after = await dataSource.getRepository(SeedUser).count();

      expect(after - before).toBe(3);
    });
  });

  describe('dependency ordering', () => {
    it('runs a dependency before the seeder that declares it', async () => {
      const order: string[] = [];

      @Seeder()
      class DepA {
        async run(_ctx: SeedContext) {
          order.push('A');
        }
      }

      @Seeder({ dependencies: [DepA] })
      class DepB {
        async run(_ctx: SeedContext) {
          order.push('B');
        }
      }

      await runSeeders([DepB], { dataSource });

      expect(order).toEqual(['A', 'B']);
    });

    it('resolves transitive dependencies in order', async () => {
      const order: string[] = [];

      @Seeder()
      class TransA {
        async run(_ctx: SeedContext) {
          order.push('A');
        }
      }

      @Seeder({ dependencies: [TransA] })
      class TransB {
        async run(_ctx: SeedContext) {
          order.push('B');
        }
      }

      @Seeder({ dependencies: [TransB] })
      class TransC {
        async run(_ctx: SeedContext) {
          order.push('C');
        }
      }

      await runSeeders([TransC], { dataSource });

      expect(order).toEqual(['A', 'B', 'C']);
    });

    it('does not run a dependency twice when it appears in both roots and as a dep', async () => {
      const spy = vi.fn();

      @Seeder()
      class SharedDep {
        async run(_ctx: SeedContext) {
          spy();
        }
      }

      @Seeder({ dependencies: [SharedDep] })
      class DependsOnShared {
        async run(_ctx: SeedContext) {}
      }

      await runSeeders([SharedDep, DependsOnShared], { dataSource });

      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe('circular dependencies', () => {
    it('throws when a cycle is detected', async () => {
      class CycleA {
        async run(_ctx: SeedContext) {}
      }

      class CycleB {
        async run(_ctx: SeedContext) {}
      }

      registerSeeder(CycleA, { dependencies: [CycleB] });
      registerSeeder(CycleB, { dependencies: [CycleA] });

      await expect(runSeeders([CycleA], {})).rejects.toThrow('Circular dependency');
    });

    it('names the offending seeders in the error message', async () => {
      class LoopX {
        async run(_ctx: SeedContext) {}
      }

      class LoopY {
        async run(_ctx: SeedContext) {}
      }

      registerSeeder(LoopX, { dependencies: [LoopY] });
      registerSeeder(LoopY, { dependencies: [LoopX] });

      await expect(runSeeders([LoopX], {})).rejects.toThrow(/LoopX|LoopY/);
    });
  });
});
