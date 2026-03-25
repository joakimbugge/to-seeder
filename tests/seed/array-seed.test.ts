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
import { Seed, createManySeed, createSeed, saveManySeed, saveSeed } from '../../src';

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

@Entity()
class Publisher {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.company.name())
  @Column({ type: 'text' })
  name!: string;
}

@Entity()
class Writer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Column({ type: 'text' })
  name!: string;

  @Seed({ count: 2 })
  @OneToMany(() => Novel, (n) => n.writer)
  novels!: Relation<Novel[]>;
}

@Entity()
class Novel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.words(3))
  @Column({ type: 'text' })
  title!: string;

  @Seed()
  @ManyToOne(() => Writer, (w) => w.novels)
  writer!: Relation<Writer>;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('array seed', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Publisher, Writer, Novel],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('createSeed', () => {
    it('returns a tuple of instances matching the input array', async () => {
      const [writer, publisher] = await createSeed([Writer, Publisher]);

      expect(writer).toBeInstanceOf(Writer);
      expect(publisher).toBeInstanceOf(Publisher);
    });

    it('seeds scalar properties on each entity', async () => {
      const [writer, publisher] = await createSeed([Writer, Publisher]);

      expect(typeof writer.name).toBe('string');
      expect(typeof publisher.name).toBe('string');
    });

    it('skips relation seeding by default', async () => {
      const [writer] = await createSeed([Writer, Publisher]);

      expect(writer.novels).toBeUndefined();
    });

    it('seeds relations when relations: true is passed', async () => {
      const [writer] = await createSeed([Writer, Publisher], { relations: true });

      expect(writer.novels).toHaveLength(2);
    });
  });

  describe('createManySeed', () => {
    it('returns arrays of instances per class', async () => {
      const [writers, publishers] = await createManySeed([Writer, Publisher], { count: 3 });

      expect(writers).toHaveLength(3);
      expect(publishers).toHaveLength(3);
      writers.forEach((w) => expect(w).toBeInstanceOf(Writer));
      publishers.forEach((p) => expect(p).toBeInstanceOf(Publisher));
    });

    it('skips relations by default', async () => {
      const [writers] = await createManySeed([Writer, Publisher], { count: 2 });

      writers.forEach((w) => expect(w.novels).toBeUndefined());
    });

    it('seeds relations when relations: true is passed', async () => {
      const [writers] = await createManySeed([Writer, Publisher], { count: 2, relations: true });

      writers.forEach((w) => expect(w.novels).toHaveLength(2));
    });
  });

  describe('saveManySeed', () => {
    it('persists arrays of instances per class', async () => {
      const [writers, publishers] = await saveManySeed([Writer, Publisher], {
        count: 2,
        dataSource,
      });

      expect(writers).toHaveLength(2);
      expect(publishers).toHaveLength(2);
      writers.forEach((w) => expect(w.id).toBeGreaterThan(0));
      publishers.forEach((p) => expect(p.id).toBeGreaterThan(0));
    });

    it('skips relation seeding by default', async () => {
      const [writers] = await saveManySeed([Writer, Publisher], { count: 1, dataSource });
      const fetched = await dataSource
        .getRepository(Writer)
        .findOneOrFail({ where: { id: writers[0]!.id }, relations: { novels: true } });

      expect(fetched.novels).toHaveLength(0);
    });
  });

  describe('saveSeed', () => {
    it('persists each entity independently', async () => {
      const [writer, publisher] = await saveSeed([Writer, Publisher], { dataSource });

      expect(writer.id).toBeGreaterThan(0);
      expect(publisher.id).toBeGreaterThan(0);
    });

    it('skips relation seeding by default', async () => {
      const [writer] = await saveSeed([Writer, Publisher], { dataSource });
      const fetched = await dataSource
        .getRepository(Writer)
        .findOneOrFail({ where: { id: writer.id }, relations: { novels: true } });

      expect(fetched.novels).toHaveLength(0);
    });

    it('seeds and persists relations when relations: true is passed', async () => {
      const [writer] = await saveSeed([Writer, Publisher], { dataSource, relations: true });
      const fetched = await dataSource
        .getRepository(Writer)
        .findOneOrFail({ where: { id: writer.id }, relations: { novels: true } });

      expect(fetched.novels).toHaveLength(2);
    });
  });
});
