import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Module } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { seed, type SeedContext, Seeder, type SeederInterface } from '@joakimbugge/mikroorm-seeder';
import { SeederModule } from '../src';
import { User, UserSeeder } from './fixtures/user.js';
import { compileModule } from './utils/compileModule.js';
import { createOrm } from './utils/createOrm.js';

describe('SeederFeatureService', () => {
  describe('forFeature', () => {
    it('runs seeders using bare SeederModule with MikroORM from the module graph', async () => {
      const orm = await createOrm();

      @Module({
        providers: [{ provide: MikroORM, useValue: orm }],
        exports: [MikroORM],
      })
      class DatabaseModule {}

      @Module({ imports: [SeederModule.forFeature([UserSeeder])] })
      class UserModule {}

      const moduleRef = await compileModule({
        imports: [DatabaseModule, SeederModule, UserModule],
      });

      await moduleRef.init();

      expect(await orm.em.fork().count(User)).toBe(1);

      await moduleRef.close();
      await orm.close();
    });

    it('runs seeders registered in a feature module', async () => {
      const orm = await createOrm();

      @Module({ imports: [SeederModule.forFeature([UserSeeder])] })
      class UserModule {}

      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ em: orm.em.fork() }), UserModule],
      });

      await moduleRef.init();

      expect(await orm.em.fork().count(User)).toBe(1);

      await moduleRef.close();
      await orm.close();
    });

    it('runs seeders from root and feature modules together', async () => {
      const orm = await createOrm();

      @Seeder()
      class ExtraUserSeeder implements SeederInterface {
        async run({ em }: SeedContext): Promise<void> {
          await seed(User).save({ em: em! });
        }
      }

      @Module({ imports: [SeederModule.forFeature([ExtraUserSeeder])] })
      class ExtraModule {}

      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ seeders: [UserSeeder], em: orm.em.fork() }), ExtraModule],
      });

      await moduleRef.init();

      expect(await orm.em.fork().count(User)).toBe(2);

      await moduleRef.close();
      await orm.close();
    });

    it('resolves cross-module dependencies in the correct order', async () => {
      const orm = await createOrm();
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
        imports: [
          SeederModule.forRoot({ seeders: [FirstSeeder], em: orm.em.fork() }),
          FeatureModule,
        ],
      });

      await moduleRef.init();

      expect(order).toEqual(['first', 'second']);

      await moduleRef.close();
      await orm.close();
    });
  });
});
