import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { seed, type SeedContext, Seeder, type SeederInterface } from '@joakimbugge/typeorm-seeder';
import { SeederModule } from '../src';
import { User, UserSeeder } from './fixtures/user.js';
import { compileModule } from './utils/compileModule.js';
import { createDataSource } from './utils/createDataSource.js';

describe('SeederFeatureService', () => {
  describe('forFeature', () => {
    it('runs seeders using bare SeederModule with DataSource from the module graph', async () => {
      const dataSource = await createDataSource().initialize();

      @Module({
        providers: [{ provide: DataSource, useValue: dataSource }],
        exports: [DataSource],
      })
      class DatabaseModule {}

      @Module({ imports: [SeederModule.forFeature([UserSeeder])] })
      class UserModule {}

      const moduleRef = await compileModule({
        imports: [DatabaseModule, SeederModule, UserModule],
      });

      await moduleRef.init();

      expect(await dataSource.getRepository(User).count()).toBe(1);

      await moduleRef.close();
      await dataSource.destroy();
    });

    it('runs seeders registered in a feature module', async () => {
      const dataSource = await createDataSource().initialize();

      @Module({ imports: [SeederModule.forFeature([UserSeeder])] })
      class UserModule {}

      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ dataSource }), UserModule],
      });

      await moduleRef.init();

      expect(await dataSource.getRepository(User).count()).toBe(1);

      await moduleRef.close();
      await dataSource.destroy();
    });

    it('runs seeders from root and feature modules together', async () => {
      const dataSource = await createDataSource().initialize();

      @Seeder()
      class ExtraUserSeeder implements SeederInterface {
        async run({ dataSource: ds }: SeedContext): Promise<void> {
          await seed(User).save({ dataSource: ds! });
        }
      }

      @Module({ imports: [SeederModule.forFeature([ExtraUserSeeder])] })
      class ExtraModule {}

      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ seeders: [UserSeeder], dataSource }), ExtraModule],
      });

      await moduleRef.init();

      expect(await dataSource.getRepository(User).count()).toBe(2);

      await moduleRef.close();
      await dataSource.destroy();
    });

    it('resolves cross-module dependencies in the correct order', async () => {
      const dataSource = await createDataSource().initialize();
      const order: string[] = [];

      @Seeder()
      class FirstSeeder implements SeederInterface {
        async run(): Promise<void> {
          order.push('first');
        }
      }

      @Seeder({ dependencies: [FirstSeeder] })
      class SecondSeeder implements SeederInterface {
        async run(): Promise<void> {
          order.push('second');
        }
      }

      @Module({ imports: [SeederModule.forFeature([SecondSeeder])] })
      class FeatureModule {}

      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ seeders: [FirstSeeder], dataSource }), FeatureModule],
      });

      await moduleRef.init();

      expect(order).toEqual(['first', 'second']);

      await moduleRef.close();
      await dataSource.destroy();
    });
  });
});
