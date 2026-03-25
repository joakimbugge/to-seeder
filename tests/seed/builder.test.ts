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
import { Seed, seed } from '../../src';

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

@Entity()
class Studio {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.company.name())
  @Column({ type: 'text' })
  name!: string;
}

@Entity()
class Director {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Column({ type: 'text' })
  name!: string;

  @Seed({ count: 2 })
  @OneToMany(() => Film, (f) => f.director)
  films!: Relation<Film[]>;
}

@Entity()
class Film {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.words(3))
  @Column({ type: 'text' })
  title!: string;

  @Seed()
  @ManyToOne(() => Director, (d) => d.films)
  director!: Relation<Director>;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('seed() builder', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Studio, Director, Film],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('single entity', () => {
    it('create() returns an instance in memory', async () => {
      const director = await seed(Director).create();

      expect(director).toBeInstanceOf(Director);
      expect(typeof director.name).toBe('string');
      expect(director.id).toBeUndefined();
    });

    it('create() seeds relations by default', async () => {
      const director = await seed(Director).create();

      expect(director.films).toHaveLength(2);
      director.films.forEach((f) => expect(f).toBeInstanceOf(Film));
    });

    it('create() skips relations when relations: false', async () => {
      const director = await seed(Director).create({ relations: false });

      expect(director.films).toBeUndefined();
    });

    it('save() persists and assigns an id', async () => {
      const director = await seed(Director).save({ dataSource });

      expect(director).toBeInstanceOf(Director);
      expect(director.id).toBeGreaterThan(0);
    });

    it('createMany() returns the requested number of instances', async () => {
      const directors = await seed(Director).createMany(3);

      expect(directors).toHaveLength(3);
      directors.forEach((d) => expect(d).toBeInstanceOf(Director));
    });

    it('saveMany() persists all instances', async () => {
      const directors = await seed(Director).saveMany(3, { dataSource });

      expect(directors).toHaveLength(3);
      directors.forEach((d) => expect(d.id).toBeGreaterThan(0));
    });
  });

  describe('array form', () => {
    it('create() returns a tuple of instances', async () => {
      const [director, studio] = await seed([Director, Studio]).create();

      expect(director).toBeInstanceOf(Director);
      expect(studio).toBeInstanceOf(Studio);
    });

    it('create() skips relations by default', async () => {
      const [director] = await seed([Director, Studio]).create();

      expect(director.films).toBeUndefined();
    });

    it('create() seeds relations when relations: true', async () => {
      const [director] = await seed([Director, Studio]).create({ relations: true });

      expect(director.films).toHaveLength(2);
    });

    it('save() persists each entity independently', async () => {
      const [director, studio] = await seed([Director, Studio]).save({ dataSource });

      expect(director.id).toBeGreaterThan(0);
      expect(studio.id).toBeGreaterThan(0);
    });

    it('createMany() returns arrays of instances per class', async () => {
      const [directors, studios] = await seed([Director, Studio]).createMany(3);

      expect(directors).toHaveLength(3);
      expect(studios).toHaveLength(3);
      directors.forEach((d) => expect(d).toBeInstanceOf(Director));
      studios.forEach((s) => expect(s).toBeInstanceOf(Studio));
    });

    it('saveMany() persists all instances per class', async () => {
      const [directors, studios] = await seed([Director, Studio]).saveMany(3, { dataSource });

      expect(directors).toHaveLength(3);
      expect(studios).toHaveLength(3);
      directors.forEach((d) => expect(d.id).toBeGreaterThan(0));
      studios.forEach((s) => expect(s.id).toBeGreaterThan(0));
    });
  });
});
