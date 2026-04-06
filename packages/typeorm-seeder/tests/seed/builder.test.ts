import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ChildEntity,
  Column,
  DataSource,
  Entity,
  In,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  TableInheritance,
  Tree,
  TreeChildren,
  TreeParent,
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

  describe('values — post-seed overrides', () => {
    it('create() overrides a @Seed-decorated property', async () => {
      const director = await seed(Director).create({ values: { name: 'Override' } });

      expect(director.name).toBe('Override');
    });

    it('create() sets a property with no @Seed decorator', async () => {
      const director = await seed(Director).create({ values: { id: 999 } });

      expect(director.id).toBe(999);
    });

    it('createMany() applies the same values to every instance', async () => {
      const directors = await seed(Director).createMany(3, { values: { name: 'Same' } });

      expect(directors).toHaveLength(3);
      directors.forEach((d) => expect(d.name).toBe('Same'));
    });

    it('save() persists the overridden value', async () => {
      const saved = await seed(Director).save({ dataSource, values: { name: 'Persisted' } });

      const fetched = await dataSource
        .getRepository(Director)
        .findOneOrFail({ where: { id: saved.id } });

      expect(fetched.name).toBe('Persisted');
    });

    it('saveMany() applies values to all persisted instances', async () => {
      const saved = await seed(Director).saveMany(3, {
        dataSource,
        values: { name: 'Shared' },
      });

      const ids = saved.map((d) => d.id);
      const fetched = await dataSource.getRepository(Director).findBy({ id: In(ids) });

      expect(fetched).toHaveLength(3);
      fetched.forEach((d) => expect(d.name).toBe('Shared'));
    });

    it('createMany() calls a factory value once per instance', async () => {
      let counter = 0;
      const directors = await seed(Director).createMany(3, {
        values: { name: () => `Director ${++counter}` },
      });

      expect(directors.map((d) => d.name)).toEqual(['Director 1', 'Director 2', 'Director 3']);
    });

    it('saveMany() calls a factory value once per persisted instance', async () => {
      let counter = 0;
      const saved = await seed(Director).saveMany(3, {
        dataSource,
        values: { name: () => `Director ${++counter}` },
      });

      const ids = saved.map((d) => d.id);
      const fetched = await dataSource.getRepository(Director).findBy({ id: In(ids) });

      expect(fetched.map((d) => d.name).sort()).toEqual(['Director 1', 'Director 2', 'Director 3']);
    });
  });

  describe('self — partial entity in factory', () => {
    it('receives the partially-built entity so later properties can depend on earlier ones', async () => {
      class Event {
        @Seed(() => faker.date.past())
        @Column({ type: 'text' })
        beginDate!: Date;

        @Seed((_, self: Event) => faker.date.future({ refDate: self.beginDate }))
        @Column({ type: 'text' })
        endDate!: Date;
      }

      const event = await seed(Event).create({ relations: false });

      expect(event.endDate > event.beginDate).toBe(true);
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

// ---------------------------------------------------------------------------
// Embedded types
// ---------------------------------------------------------------------------

class EmbeddedAddress {
  @Seed(() => faker.location.streetAddress())
  @Column({ type: 'text' })
  street!: string;

  @Seed(() => faker.location.city())
  @Column({ type: 'text' })
  city!: string;
}

@Entity()
class CustomerWithAddress {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.company.name())
  @Column({ type: 'text' })
  name!: string;

  @Column(() => EmbeddedAddress)
  address!: EmbeddedAddress;
}

describe('embedded types', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [CustomerWithAddress],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('create() auto-seeds embedded class detected via TypeORM metadata', async () => {
    const customer = await seed(CustomerWithAddress).create();

    expect(customer.address).toBeDefined();
    expect(typeof customer.address.street).toBe('string');
    expect(typeof customer.address.city).toBe('string');
  });

  it('save() persists embedded columns to the database', async () => {
    const saved = await seed(CustomerWithAddress).save({ dataSource });
    const fetched = await dataSource
      .getRepository(CustomerWithAddress)
      .findOneByOrFail({ id: saved.id });

    expect(fetched.address.street).toBe(saved.address.street);
  });
});

// ---------------------------------------------------------------------------
// Inheritance
// ---------------------------------------------------------------------------

@Entity()
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
class Vehicle {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.vehicle.manufacturer())
  @Column({ type: 'text' })
  make!: string;
}

@ChildEntity()
class Car extends Vehicle {
  @Seed(() => faker.number.int({ min: 2, max: 6 }))
  @Column({ type: 'integer' })
  doors!: number;
}

describe('inheritance (TableInheritance)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Vehicle, Car],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('create() seeds parent and child @Seed properties', async () => {
    const car = await seed(Car).create({ relations: false });

    expect(typeof car.make).toBe('string');
    expect(typeof car.doors).toBe('number');
  });

  it('save() persists child entity including inherited columns', async () => {
    const saved = await seed(Car).save({ dataSource });

    expect(saved.id).toBeGreaterThan(0);
    expect(typeof saved.make).toBe('string');
    expect(typeof saved.doors).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Context pass-through — dataSource available in factories
// ---------------------------------------------------------------------------

describe('context pass-through', () => {
  it('save() makes dataSource available in factory callbacks', async () => {
    let receivedDataSource: DataSource | undefined;

    @Entity()
    class Probe {
      @PrimaryGeneratedColumn()
      id!: number;

      @Seed(({ dataSource: ds }) => {
        receivedDataSource = ds;
        return faker.lorem.word();
      })
      @Column({ type: 'text' })
      value!: string;
    }

    const ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Probe],
    });
    await ds.initialize();

    try {
      await seed(Probe).save({ dataSource: ds });
      expect(receivedDataSource).toBe(ds);
    } finally {
      await ds.destroy();
    }
  });
});

// ---------------------------------------------------------------------------
// Many-to-many
// ---------------------------------------------------------------------------

@Entity()
class Label {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.word())
  @Column({ type: 'text' })
  name!: string;
}

@Entity()
class BlogPost {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.sentence())
  @Column({ type: 'text' })
  title!: string;

  @Seed({ count: 2 })
  @ManyToMany(() => Label)
  @JoinTable()
  labels!: Label[];
}

describe('many-to-many', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Label, BlogPost],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('save() persists join table without explicit cascade', async () => {
    const saved = await seed(BlogPost).save({ dataSource });
    const fetched = await dataSource
      .getRepository(BlogPost)
      .findOneOrFail({ where: { id: saved.id }, relations: { labels: true } });

    expect(fetched.labels).toHaveLength(2);
    fetched.labels.forEach((l) => expect(l.id).toBeGreaterThan(0));
  });
});

// ---------------------------------------------------------------------------
// Tree entities
// ---------------------------------------------------------------------------

@Entity()
@Tree('adjacency-list')
class TreeCategory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.commerce.department())
  @Column({ type: 'text' })
  name!: string;

  @Seed()
  @TreeParent({ onDelete: 'CASCADE' })
  parent?: TreeCategory;

  @Seed({ count: 2 })
  @TreeChildren()
  children!: TreeCategory[];
}

describe('tree entity (adjacency-list)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [TreeCategory],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('create() seeds parent and children in memory', async () => {
    const category = await seed(TreeCategory).create();

    expect(category.parent).toBeInstanceOf(TreeCategory);
    expect(category.children).toHaveLength(2);
    expect(category.parent!.parent).toBeUndefined();
  });

  it('save() persists tree entity to the database', async () => {
    const saved = await seed(TreeCategory).save({ dataSource });

    expect(saved.id).toBeGreaterThan(0);
    expect(saved.name).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// saveMany — edge cases
// ---------------------------------------------------------------------------

describe('saveMany — edge cases', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Studio],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('returns an empty array when count is 0', async () => {
    const result = await seed(Studio).saveMany(0, { dataSource });

    expect(result).toEqual([]);
  });
});
