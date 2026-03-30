import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Seeder, type SeederInterface } from '@joakimbugge/typeorm-seeder';
import { SeederModule } from '../src';
import { User, UserSeeder } from './fixtures/user.js';
import { compileModule } from './utils/compileModule.js';
import { createDataSource } from './utils/createDataSource.js';

describe('SeederRunnerService', () => {
  describe('logging', () => {
    it('still runs seeders when logging is false', async () => {
      const dataSource = await createDataSource().initialize();

      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ seeders: [UserSeeder], dataSource, logging: false })],
      });

      await moduleRef.init();

      expect(await dataSource.getRepository(User).count()).toBe(1);

      await moduleRef.close();
      await dataSource.destroy();
    });
  });

  describe('enabled', () => {
    it('skips seeding when enabled is false', async () => {
      const dataSource = await createDataSource().initialize();

      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ seeders: [UserSeeder], dataSource, enabled: false })],
      });

      await moduleRef.init();

      expect(await dataSource.getRepository(User).count()).toBe(0);

      await moduleRef.close();
      await dataSource.destroy();
    });
  });

  describe('runOnce', () => {
    async function bootstrap(
      dataSource: import('typeorm').DataSource,
      options?: object,
    ): Promise<void> {
      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ seeders: [UserSeeder], dataSource, ...options })],
      });
      await moduleRef.init();
      await moduleRef.close();
    }

    it('does not re-run seeders on a second bootstrap by default', async () => {
      const dataSource = await createDataSource().initialize();

      await bootstrap(dataSource);
      await bootstrap(dataSource);

      expect(await dataSource.getRepository(User).count()).toBe(1);

      await dataSource.destroy();
    });

    it('re-runs seeders on each bootstrap when runOnce is false', async () => {
      const dataSource = await createDataSource().initialize();

      await bootstrap(dataSource, { runOnce: false });
      await bootstrap(dataSource, { runOnce: false });

      expect(await dataSource.getRepository(User).count()).toBe(2);

      await dataSource.destroy();
    });

    it('records each seeder in the history table after it runs', async () => {
      const dataSource = await createDataSource().initialize();

      await bootstrap(dataSource);

      const rows: { name: string }[] = await dataSource.query('SELECT name FROM "seeders"');

      expect(rows.map((r) => r.name)).toContain('UserSeeder');

      await dataSource.destroy();
    });

    it('uses a custom history table name', async () => {
      const dataSource = await createDataSource().initialize();

      await bootstrap(dataSource, { historyTableName: 'custom_seed_history' });

      const rows: { name: string }[] = await dataSource.query(
        'SELECT name FROM "custom_seed_history"',
      );

      expect(rows.map((r) => r.name)).toContain('UserSeeder');

      await dataSource.destroy();
    });
  });

  // onError is not tested here. When a seeder throws after several awaits inside onApplicationBootstrap,
  // NestJS v11 emits the error as an unhandled rejection on a separate internal Promise in addition to
  // rejecting the init() promise — making it impossible to suppress in a test without fighting the
  // framework. onError is covered thoroughly in @joakimbugge/typeorm-seeder's own test suite.
  describe('hooks', () => {
    it('calls onBefore before each seeder', async () => {
      const dataSource = await createDataSource().initialize();
      const onBefore = vi.fn();

      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ seeders: [UserSeeder], dataSource, onBefore })],
      });

      await moduleRef.init();

      expect(onBefore).toHaveBeenCalledWith(UserSeeder);

      await moduleRef.close();
      await dataSource.destroy();
    });

    it('calls onAfter after each seeder', async () => {
      const dataSource = await createDataSource().initialize();
      const onAfter = vi.fn();

      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ seeders: [UserSeeder], dataSource, onAfter })],
      });

      await moduleRef.init();

      expect(onAfter).toHaveBeenCalledWith(UserSeeder, expect.any(Number));

      await moduleRef.close();
      await dataSource.destroy();
    });
  });

  describe('run', () => {
    it('executes the callback with the dataSource', async () => {
      const dataSource = await createDataSource().initialize();
      const run = vi.fn();

      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ run, dataSource })],
      });

      await moduleRef.init();

      expect(run).toHaveBeenCalledWith({ dataSource });

      await moduleRef.close();
      await dataSource.destroy();
    });

    it('always executes on every boot', async () => {
      const dataSource = await createDataSource().initialize();
      const run = vi.fn();

      async function bootstrap(): Promise<void> {
        const moduleRef = await compileModule({
          imports: [SeederModule.forRoot({ run, dataSource })],
        });
        await moduleRef.init();
        await moduleRef.close();
      }

      await bootstrap();
      await bootstrap();

      expect(run).toHaveBeenCalledTimes(2);

      await dataSource.destroy();
    });

    it('executes after seeders when both are provided', async () => {
      const dataSource = await createDataSource().initialize();
      const order: string[] = [];

      @Seeder()
      class OrderSeeder implements SeederInterface {
        async run(): Promise<void> {
          order.push('seeder');
        }
      }

      const moduleRef = await compileModule({
        imports: [
          SeederModule.forRoot({
            seeders: [OrderSeeder],
            run: async () => {
              order.push('run');
            },
            dataSource,
          }),
        ],
      });

      await moduleRef.init();

      expect(order).toEqual(['seeder', 'run']);

      await moduleRef.close();
      await dataSource.destroy();
    });
  });
});
