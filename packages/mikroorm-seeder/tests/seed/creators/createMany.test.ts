import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Embeddable,
  Embedded,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { MikroORM } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { Seed, createMany } from '../../../src';

// ---------------------------------------------------------------------------
// Scalar seeding
// ---------------------------------------------------------------------------

@Entity()
class User {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Property()
  name!: string;

  @Seed(() => faker.internet.email())
  @Property()
  email!: string;
}

describe('scalar seeding', () => {
  it('createMany returns the requested number of instances', async () => {
    const users = await createMany(User, { count: 3 });

    expect(users).toHaveLength(3);
    users.forEach((u) => {
      expect(typeof u.name).toBe('string');
      expect(typeof u.email).toBe('string');
    });
  });

  it('each instance receives independently generated values', async () => {
    const [a, b] = await createMany(User, { count: 2 });

    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Embedded types
// ---------------------------------------------------------------------------

@Embeddable()
class Address {
  @Seed(() => faker.location.streetAddress())
  @Property()
  street!: string;

  @Seed(() => faker.location.city())
  @Property()
  city!: string;

  @Seed(() => faker.location.countryCode())
  @Property()
  country!: string;
}

@Entity()
class Customer {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.company.name())
  @Property()
  name!: string;

  @Embedded(() => Address)
  address!: Address;
}

describe('embedded types', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [Customer],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('each seeded instance gets an independently generated address', async () => {
    const em = orm.em.fork();
    const [a, b] = await createMany(Customer, { count: 2 });
    em.persist([a, b]);
    await em.flush();

    expect(a.id).not.toBe(b.id);
    expect(a.address).not.toBe(b.address);
  });
});

// ---------------------------------------------------------------------------
// Array form
// ---------------------------------------------------------------------------

@Entity()
class Publisher {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.company.name())
  @Property()
  name!: string;
}

@Entity()
class Writer {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Property()
  name!: string;

  @Seed({ count: 2 })
  @OneToMany(() => Novel, (n) => n.writer)
  novels!: Novel[];
}

@Entity()
class Novel {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.lorem.words(3))
  @Property()
  title!: string;

  @Seed()
  @ManyToOne(() => Writer)
  writer!: Writer;
}

describe('array form', () => {
  it('returns arrays of instances per class', async () => {
    const [writers, publishers] = await createMany([Writer, Publisher], { count: 3 });

    expect(writers).toHaveLength(3);
    expect(publishers).toHaveLength(3);
    writers.forEach((w) => expect(w).toBeInstanceOf(Writer));
    publishers.forEach((p) => expect(p).toBeInstanceOf(Publisher));
  });

  it('skips relations by default', async () => {
    const [writers] = await createMany([Writer, Publisher], { count: 2 });

    writers.forEach((w) => expect(w.novels).toBeUndefined());
  });

  it('seeds relations when relations: true is passed', async () => {
    const [writers] = await createMany([Writer, Publisher], { count: 2, relations: true });

    writers.forEach((w) => expect(w.novels).toHaveLength(2));
  });
});

// ---------------------------------------------------------------------------
// Sequence index
// ---------------------------------------------------------------------------

describe('sequence index', () => {
  it('factory receives sequential indices across a createMany() batch', async () => {
    class Item {
      @Seed((_, __, i) => `item-${i}`)
      value!: string;
    }

    const items = await createMany(Item, { count: 4 });
    expect(items.map((item) => item.value)).toEqual(['item-0', 'item-1', 'item-2', 'item-3']);
  });

  it('values factory receives sequential indices across a createMany() batch', async () => {
    class Item {
      value!: string;
    }

    const items = await createMany(Item, {
      count: 4,
      values: { value: (_, __, i) => `item-${i}` },
    });
    expect(items.map((item) => item.value)).toEqual(['item-0', 'item-1', 'item-2', 'item-3']);
  });

  it('each class in a multi-class createMany() gets its own 0-based sequence', async () => {
    class ItemA {
      @Seed((_, __, i) => `a-${i}`)
      value!: string;
    }

    class ItemB {
      @Seed((_, __, i) => `b-${i}`)
      value!: string;
    }

    const [itemsA, itemsB] = await createMany([ItemA, ItemB], { count: 3 });
    expect(itemsA.map((item) => item.value)).toEqual(['a-0', 'a-1', 'a-2']);
    expect(itemsB.map((item) => item.value)).toEqual(['b-0', 'b-1', 'b-2']);
  });
});
