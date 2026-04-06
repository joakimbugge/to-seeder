import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Embeddable,
  Embedded,
  Entity,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { MikroORM } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { Seed, seed } from '../../src';

@Entity()
class Studio {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.company.name())
  @Property()
  name!: string;
}

@Entity()
class Director {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Property()
  name!: string;

  @Seed({ count: 2 })
  @OneToMany(() => Film, (f) => f.director)
  films!: Film[];
}

@Entity()
class Film {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.lorem.words(3))
  @Property()
  title!: string;

  @Seed()
  @ManyToOne(() => Director)
  director!: Director;
}

describe('seed() builder', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [Studio, Director, Film],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close();
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
      const em = orm.em.fork();
      const director = await seed(Director).save({ em });

      expect(director).toBeInstanceOf(Director);
      expect(director.id).toBeGreaterThan(0);
    });

    it('createMany() returns the requested number of instances', async () => {
      const directors = await seed(Director).createMany(3);

      expect(directors).toHaveLength(3);
      directors.forEach((d) => expect(d).toBeInstanceOf(Director));
    });

    it('saveMany() persists all instances', async () => {
      const em = orm.em.fork();
      const directors = await seed(Director).saveMany(3, { em });

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
      const em = orm.em.fork();
      const saved = await seed(Director).save({ em, values: { name: 'Persisted' } });

      const fetched = await orm.em.fork().findOneOrFail(Director, { id: saved.id });

      expect(fetched.name).toBe('Persisted');
    });

    it('saveMany() applies values to all persisted instances', async () => {
      const em = orm.em.fork();
      const saved = await seed(Director).saveMany(3, { em, values: { name: 'Shared' } });

      const ids = saved.map((d) => d.id);
      const fetched = await orm.em.fork().find(Director, { id: { $in: ids } });

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
      const em = orm.em.fork();
      const saved = await seed(Director).saveMany(3, {
        em,
        values: { name: () => `Director ${++counter}` },
      });

      const ids = saved.map((d) => d.id);
      const fetched = await orm.em.fork().find(Director, { id: { $in: ids } });

      expect(fetched.map((d) => d.name).sort()).toEqual(['Director 1', 'Director 2', 'Director 3']);
    });
  });

  describe('self — partial entity in factory', () => {
    it('receives the partially-built entity so later properties can depend on earlier ones', async () => {
      class Event {
        @Seed(() => faker.date.past())
        @Property()
        beginDate!: Date;

        @Seed((_, self: Event) => faker.date.future({ refDate: self.beginDate }))
        @Property()
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
      const em = orm.em.fork();
      const [director, studio] = await seed([Director, Studio]).save({ em });

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
      const em = orm.em.fork();
      const [directors, studios] = await seed([Director, Studio]).saveMany(3, { em });

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

@Embeddable()
class EmbeddedAddress {
  @Seed(() => faker.location.streetAddress())
  @Property()
  street!: string;

  @Seed(() => faker.location.city())
  @Property()
  city!: string;
}

@Entity()
class CustomerWithAddress {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.company.name())
  @Property()
  name!: string;

  @Embedded(() => EmbeddedAddress)
  address!: EmbeddedAddress;
}

describe('embedded types', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [CustomerWithAddress],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('create() auto-seeds embedded class detected via MikroORM metadata', async () => {
    const customer = await seed(CustomerWithAddress).create();

    expect(customer.address).toBeDefined();
    expect(typeof customer.address.street).toBe('string');
    expect(typeof customer.address.city).toBe('string');
  });

  it('save() persists embedded columns to the database', async () => {
    const em = orm.em.fork();
    const saved = await seed(CustomerWithAddress).save({ em });
    const fetched = await orm.em.fork().findOneOrFail(CustomerWithAddress, { id: saved.id });

    expect(fetched.address.street).toBe(saved.address.street);
  });
});

// ---------------------------------------------------------------------------
// Inheritance
// ---------------------------------------------------------------------------

@Entity({
  discriminatorColumn: 'type',
  discriminatorMap: { car: 'InhCar' },
})
class InhVehicle {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.vehicle.manufacturer())
  @Property()
  make!: string;
}

@Entity({ discriminatorValue: 'car' })
class InhCar extends InhVehicle {
  @Seed(() => faker.number.int({ min: 2, max: 6 }))
  @Property({ nullable: true })
  doors!: number;
}

describe('inheritance', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [InhVehicle, InhCar],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('create() seeds parent and child @Seed properties', async () => {
    const car = await seed(InhCar).create({ relations: false });

    expect(typeof car.make).toBe('string');
    expect(typeof car.doors).toBe('number');
  });

  it('save() persists child entity including inherited columns', async () => {
    const em = orm.em.fork();
    const saved = await seed(InhCar).save({ em });

    expect(saved.id).toBeGreaterThan(0);
    expect(typeof saved.make).toBe('string');
    expect(typeof saved.doors).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Context pass-through — em available in factories
// ---------------------------------------------------------------------------

describe('context pass-through', () => {
  it('save() makes em available in factory callbacks', async () => {
    let receivedEm: MikroORM['em'] | undefined;

    @Entity()
    class Probe {
      @PrimaryKey()
      id!: number;

      @Seed(({ em: e }) => {
        receivedEm = e as MikroORM['em'];
        return faker.lorem.word();
      })
      @Property()
      value!: string;
    }

    const orm2 = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [Probe],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm2.schema.create();

    try {
      const em = orm2.em.fork();
      await seed(Probe).save({ em });
      expect(receivedEm).toBe(em);
    } finally {
      await orm2.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Many-to-many
// ---------------------------------------------------------------------------

@Entity()
class Label {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.lorem.word())
  @Property()
  name!: string;
}

@Entity()
class BlogPost {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.lorem.sentence())
  @Property()
  title!: string;

  @Seed({ count: 2 })
  @ManyToMany(() => Label)
  labels!: Label[];
}

describe('many-to-many', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [Label, BlogPost],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('save() persists join table', async () => {
    const em = orm.em.fork();
    const saved = await seed(BlogPost).save({ em });
    const fetched = await orm.em
      .fork()
      .findOneOrFail(BlogPost, { id: saved.id }, { populate: ['labels'] });

    expect(fetched.labels).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// saveMany — edge cases
// ---------------------------------------------------------------------------

describe('saveMany — edge cases', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [Studio],
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
    const result = await seed(Studio).saveMany(0, { em });

    expect(result).toEqual([]);
  });
});
