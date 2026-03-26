import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { ConsoleLogger, Injectable, Module, type ModuleMetadata } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Column, DataSource, Entity, PrimaryGeneratedColumn } from 'typeorm';
import {
  Seed,
  Seeder,
  seed,
  type SeederInterface,
  type SeedContext,
} from '@joakimbugge/typeorm-seeder';
import { faker } from '@faker-js/faker';
import { SeederModule } from '../src/SeederModule.js';

@Entity()
class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Column()
  name!: string;
}

@Seeder()
class UserSeeder implements SeederInterface {
  async run({ dataSource }: SeedContext): Promise<void> {
    await seed(User).save({ dataSource: dataSource! });
  }
}

async function compileModule(metadata: ModuleMetadata): Promise<TestingModule> {
  const moduleRef = await Test.createTestingModule(metadata).compile();
  moduleRef.useLogger(new ConsoleLogger());
  return moduleRef;
}

function createDataSource(): DataSource {
  return new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    synchronize: true,
    logging: false,
    entities: [User],
  });
}

describe('SeederModule', () => {
  describe('forRoot', () => {
    it('runs seeders with an explicit dataSource', async () => {
      const dataSource = await createDataSource().initialize();

      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ seeders: [UserSeeder], dataSource })],
      });

      await moduleRef.init();

      expect(await dataSource.getRepository(User).count()).toBe(1);

      await moduleRef.close();
      await dataSource.destroy();
    });

    it('auto-detects DataSource from the module graph', async () => {
      const dataSource = await createDataSource().initialize();

      @Module({
        providers: [{ provide: DataSource, useValue: dataSource }],
        exports: [DataSource],
      })
      class DatabaseModule {}

      const moduleRef = await compileModule({
        imports: [DatabaseModule, SeederModule.forRoot({ seeders: [UserSeeder] })],
      });

      await moduleRef.init();

      expect(await dataSource.getRepository(User).count()).toBe(1);

      await moduleRef.close();
      await dataSource.destroy();
    });

    it('throws when no DataSource is available', async () => {
      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ seeders: [UserSeeder] })],
      });

      await expect(moduleRef.init()).rejects.toThrow('SeederModule could not resolve a DataSource');
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
    async function bootstrap(dataSource: DataSource, options?: object): Promise<void> {
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

  describe('forRootAsync', () => {
    it('runs seeders using a DataSource resolved from a factory', async () => {
      const dataSource = await createDataSource().initialize();

      @Injectable()
      class DatabaseService {
        readonly dataSource = dataSource;
      }

      @Module({ providers: [DatabaseService], exports: [DatabaseService] })
      class DatabaseModule {}

      const moduleRef = await compileModule({
        imports: [
          SeederModule.forRootAsync({
            imports: [DatabaseModule],
            inject: [DatabaseService],
            useFactory: (db: DatabaseService) => ({
              seeders: [UserSeeder],
              dataSource: db.dataSource,
            }),
          }),
        ],
      });

      await moduleRef.init();

      expect(await dataSource.getRepository(User).count()).toBe(1);

      await moduleRef.close();
      await dataSource.destroy();
    });
  });
});
