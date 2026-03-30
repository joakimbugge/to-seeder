import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Injectable, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SeederModule } from '../src';
import { User, UserSeeder } from './fixtures/user.js';
import { compileModule } from './utils/compileModule.js';
import { createDataSource } from './utils/createDataSource.js';

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

    it('runs seeders when forRootAsync is called without imports or inject', async () => {
      const dataSource = await createDataSource().initialize();

      const moduleRef = await compileModule({
        imports: [
          SeederModule.forRootAsync({
            useFactory: () => ({ seeders: [UserSeeder], dataSource }),
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
