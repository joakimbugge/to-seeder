import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Entity, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { MikroORM } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { Seed, save, saveMany } from '../../../src';

@Entity()
class ArrayPublisher {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.company.name())
  @Property()
  name!: string;
}

@Entity()
class ArrayWriter {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Property()
  name!: string;

  @Seed({ count: 2 })
  @OneToMany(() => ArrayNovel, (n) => n.writer)
  novels!: ArrayNovel[];
}

@Entity()
class ArrayNovel {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.lorem.words(3))
  @Property()
  title!: string;

  @Seed()
  @ManyToOne(() => ArrayWriter)
  writer!: ArrayWriter;
}

describe('saveMany', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [ArrayPublisher, ArrayWriter, ArrayNovel],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('returns an empty array when count is 0', async () => {
    const em = orm.em.fork();
    const [writers] = await saveMany([ArrayWriter], { count: 0, em });

    expect(writers).toEqual([]);
  });

  it('persists arrays of instances per class', async () => {
    const em = orm.em.fork();
    const [writers, publishers] = await saveMany([ArrayWriter, ArrayPublisher], {
      count: 2,
      em,
    });

    expect(writers).toHaveLength(2);
    expect(publishers).toHaveLength(2);
    writers.forEach((w) => expect(w.id).toBeGreaterThan(0));
    publishers.forEach((p) => expect(p.id).toBeGreaterThan(0));
  });

  it('skips relation seeding by default', async () => {
    const em = orm.em.fork();
    const [writers] = await saveMany([ArrayWriter, ArrayPublisher], { count: 1, em });
    const fetched = await orm.em
      .fork()
      .findOneOrFail(ArrayWriter, { id: writers[0]!.id }, { populate: ['novels'] });

    expect(fetched.novels).toHaveLength(0);
  });
});

describe('save — array form', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [ArrayPublisher, ArrayWriter, ArrayNovel],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('persists each entity independently', async () => {
    const em = orm.em.fork();
    const [writer, publisher] = await save([ArrayWriter, ArrayPublisher], { em });

    expect(writer.id).toBeGreaterThan(0);
    expect(publisher.id).toBeGreaterThan(0);
  });

  it('skips relation seeding by default', async () => {
    const em = orm.em.fork();
    const [writer] = await save([ArrayWriter, ArrayPublisher], { em });
    const fetched = await orm.em
      .fork()
      .findOneOrFail(ArrayWriter, { id: writer.id }, { populate: ['novels'] });

    expect(fetched.novels).toHaveLength(0);
  });

  it('seeds and persists relations when relations: true is passed', async () => {
    const em = orm.em.fork();
    const [writer] = await save([ArrayWriter, ArrayPublisher], { em, relations: true });
    const fetched = await orm.em
      .fork()
      .findOneOrFail(ArrayWriter, { id: writer.id }, { populate: ['novels'] });

    expect(fetched.novels).toHaveLength(2);
  });
});
