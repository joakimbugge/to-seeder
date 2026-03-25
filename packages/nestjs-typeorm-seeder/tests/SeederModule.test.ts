import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
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
