import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Seeder, type SeederInterface } from '@joakimbugge/mikroorm-seeder';
import { SeederModule } from '../src';
import { User, UserSeeder } from './fixtures/user.js';
import { compileModule } from './utils/compileModule.js';
import { createOrm } from './utils/createOrm.js';

describe('SeederRunnerService', () => {
  describe('logging', () => {
    it('still runs seeders when logging is false', async () => {
      const orm = await createOrm();

      const moduleRef = await compileModule({
        imports: [
          SeederModule.forRoot({ seeders: [UserSeeder], em: orm.em.fork(), logging: false }),
        ],
      });

      await moduleRef.init();

      expect(await orm.em.fork().count(User)).toBe(1);

      await moduleRef.close();
      await orm.close();
    });
  });

  describe('enabled', () => {
    it('skips seeding when enabled is false', async () => {
      const orm = await createOrm();

      const moduleRef = await compileModule({
        imports: [
          SeederModule.forRoot({ seeders: [UserSeeder], em: orm.em.fork(), enabled: false }),
        ],
      });

      await moduleRef.init();

      expect(await orm.em.fork().count(User)).toBe(0);

      await moduleRef.close();
      await orm.close();
    });
  });

  describe('runOnce', () => {
    async function bootstrap(
      orm: import('@mikro-orm/core').MikroORM,
      options?: object,
    ): Promise<void> {
      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ seeders: [UserSeeder], em: orm.em.fork(), ...options })],
      });
      await moduleRef.init();
      await moduleRef.close();
    }

    it('does not re-run seeders on a second bootstrap by default', async () => {
      const orm = await createOrm();

      await bootstrap(orm);
      await bootstrap(orm);

      expect(await orm.em.fork().count(User)).toBe(1);

      await orm.close();
    });

    it('re-runs seeders on each bootstrap when runOnce is false', async () => {
      const orm = await createOrm();

      await bootstrap(orm, { runOnce: false });
      await bootstrap(orm, { runOnce: false });

      expect(await orm.em.fork().count(User)).toBe(2);

      await orm.close();
    });

    it('records each seeder in the history table after it runs', async () => {
      const orm = await createOrm();

      await bootstrap(orm);

      const rows = (await orm.em
        .fork()
        .getConnection()
        .execute('SELECT name FROM "seeders"', [], 'all')) as { name: string }[];

      expect(rows.map((r) => r.name)).toContain('UserSeeder');

      await orm.close();
    });

    it('uses a custom history table name', async () => {
      const orm = await createOrm();

      await bootstrap(orm, { historyTableName: 'custom_seed_history' });

      const rows = (await orm.em
        .fork()
        .getConnection()
        .execute('SELECT name FROM "custom_seed_history"', [], 'all')) as { name: string }[];

      expect(rows.map((r) => r.name)).toContain('UserSeeder');

      await orm.close();
    });
  });

  // onError is not tested here. When a seeder throws after several awaits inside onApplicationBootstrap,
  // NestJS v11 emits the error as an unhandled rejection on a separate internal Promise in addition to
  // rejecting the init() promise — making it impossible to suppress in a test without fighting the
  // framework. onError is covered thoroughly in @joakimbugge/mikroorm-seeder's own test suite.
  describe('hooks', () => {
    it('calls onBefore once before any seeder runs', async () => {
      const orm = await createOrm();
      const onBefore = vi.fn();

      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ seeders: [UserSeeder], em: orm.em.fork(), onBefore })],
      });

      await moduleRef.init();

      expect(onBefore).toHaveBeenCalledTimes(1);
      expect(onBefore).toHaveBeenCalledWith();

      await moduleRef.close();
      await orm.close();
    });

    it('calls onSuccess with the ran seeders and total duration after all complete', async () => {
      const orm = await createOrm();
      const onSuccess = vi.fn();

      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ seeders: [UserSeeder], em: orm.em.fork(), onSuccess })],
      });

      await moduleRef.init();

      expect(onSuccess).toHaveBeenCalledWith([UserSeeder], expect.any(Number));

      await moduleRef.close();
      await orm.close();
    });
  });

  describe('run', () => {
    it('executes the callback with the em', async () => {
      const orm = await createOrm();
      const run = vi.fn();

      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ run, em: orm.em.fork() })],
      });

      await moduleRef.init();

      expect(run).toHaveBeenCalledWith({ em: expect.anything() });

      await moduleRef.close();
      await orm.close();
    });

    it('always executes on every boot', async () => {
      const orm = await createOrm();
      const run = vi.fn();

      async function bootstrap(): Promise<void> {
        const moduleRef = await compileModule({
          imports: [SeederModule.forRoot({ run, em: orm.em.fork() })],
        });
        await moduleRef.init();
        await moduleRef.close();
      }

      await bootstrap();
      await bootstrap();

      expect(run).toHaveBeenCalledTimes(2);

      await orm.close();
    });

    it('executes after seeders when both are provided', async () => {
      const orm = await createOrm();
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
            em: orm.em.fork(),
          }),
        ],
      });

      await moduleRef.init();

      expect(order).toEqual(['seeder', 'run']);

      await moduleRef.close();
      await orm.close();
    });
  });
});
