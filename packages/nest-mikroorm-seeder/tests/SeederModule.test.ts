import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Injectable, Module } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { SeederModule } from '../src';
import { User, UserSeeder } from './fixtures/user.js';
import { compileModule } from './utils/compileModule.js';
import { createOrm } from './utils/createOrm.js';

describe('SeederModule', () => {
  describe('forRoot', () => {
    it('runs seeders with an explicit em', async () => {
      const orm = await createOrm();

      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ seeders: [UserSeeder], em: orm.em.fork() })],
      });

      await moduleRef.init();

      expect(await orm.em.fork().count(User)).toBe(1);

      await moduleRef.close();
      await orm.close();
    });

    it('auto-detects MikroORM from the module graph', async () => {
      const orm = await createOrm();

      @Module({
        providers: [{ provide: MikroORM, useValue: orm }],
        exports: [MikroORM],
      })
      class DatabaseModule {}

      const moduleRef = await compileModule({
        imports: [DatabaseModule, SeederModule.forRoot({ seeders: [UserSeeder] })],
      });

      await moduleRef.init();

      expect(await orm.em.fork().count(User)).toBe(1);

      await moduleRef.close();
      await orm.close();
    });

    it('throws when no MikroORM is available', async () => {
      const moduleRef = await compileModule({
        imports: [SeederModule.forRoot({ seeders: [UserSeeder] })],
      });

      await expect(moduleRef.init()).rejects.toThrow(
        'SeederModule could not resolve a MikroORM instance',
      );
    });
  });

  describe('forRootAsync', () => {
    it('runs seeders using an em resolved from a factory', async () => {
      const orm = await createOrm();

      @Injectable()
      class DatabaseService {
        readonly orm = orm;
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
              em: db.orm.em.fork(),
            }),
          }),
        ],
      });

      await moduleRef.init();

      expect(await orm.em.fork().count(User)).toBe(1);

      await moduleRef.close();
      await orm.close();
    });
  });
});
