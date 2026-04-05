import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Column,
  DataSource,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Seed, save, saveMany } from '../../../src';

@Entity()
class ArrayPublisher {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.company.name())
  @Column({ type: 'text' })
  name!: string;
}

@Entity()
class ArrayWriter {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Column({ type: 'text' })
  name!: string;

  @Seed({ count: 2 })
  @OneToMany(() => ArrayNovel, (n) => n.writer)
  novels!: Relation<ArrayNovel[]>;
}

@Entity()
class ArrayNovel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.words(3))
  @Column({ type: 'text' })
  title!: string;

  @Seed()
  @ManyToOne(() => ArrayWriter, (w) => w.novels)
  writer!: Relation<ArrayWriter>;
}

describe('saveMany', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [ArrayPublisher, ArrayWriter, ArrayNovel],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('returns an empty array when count is 0', async () => {
    const [writers] = await saveMany([ArrayWriter], { count: 0, dataSource });

    expect(writers).toEqual([]);
  });

  it('persists arrays of instances per class', async () => {
    const [writers, publishers] = await saveMany([ArrayWriter, ArrayPublisher], {
      count: 2,
      dataSource,
    });

    expect(writers).toHaveLength(2);
    expect(publishers).toHaveLength(2);
    writers.forEach((w) => expect(w.id).toBeGreaterThan(0));
    publishers.forEach((p) => expect(p.id).toBeGreaterThan(0));
  });

  it('skips relation seeding by default', async () => {
    const [writers] = await saveMany([ArrayWriter, ArrayPublisher], { count: 1, dataSource });
    const fetched = await dataSource
      .getRepository(ArrayWriter)
      .findOneOrFail({ where: { id: writers[0]!.id }, relations: { novels: true } });

    expect(fetched.novels).toHaveLength(0);
  });
});

describe('save — array form', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [ArrayPublisher, ArrayWriter, ArrayNovel],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('persists each entity independently', async () => {
    const [writer, publisher] = await save([ArrayWriter, ArrayPublisher], { dataSource });

    expect(writer.id).toBeGreaterThan(0);
    expect(publisher.id).toBeGreaterThan(0);
  });

  it('skips relation seeding by default', async () => {
    const [writer] = await save([ArrayWriter, ArrayPublisher], { dataSource });
    const fetched = await dataSource
      .getRepository(ArrayWriter)
      .findOneOrFail({ where: { id: writer.id }, relations: { novels: true } });

    expect(fetched.novels).toHaveLength(0);
  });

  it('seeds and persists relations when relations: true is passed', async () => {
    const [writer] = await save([ArrayWriter, ArrayPublisher], { dataSource, relations: true });
    const fetched = await dataSource
      .getRepository(ArrayWriter)
      .findOneOrFail({ where: { id: writer.id }, relations: { novels: true } });

    expect(fetched.novels).toHaveLength(2);
  });
});
