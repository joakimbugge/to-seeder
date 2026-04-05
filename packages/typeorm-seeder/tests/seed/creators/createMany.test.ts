import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ChildEntity,
  Column,
  DataSource,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  TableInheritance,
  type Relation,
} from 'typeorm';
import { Seed, createMany } from '../../../src';

// ---------------------------------------------------------------------------
// Scalar seeding
// ---------------------------------------------------------------------------

@Entity()
class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Column({ type: 'text' })
  name!: string;

  @Seed(() => faker.internet.email())
  @Column({ type: 'text' })
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

class Address {
  @Seed(() => faker.location.streetAddress())
  @Column({ type: 'text' })
  street!: string;

  @Seed(() => faker.location.city())
  @Column({ type: 'text' })
  city!: string;

  @Seed(() => faker.location.countryCode())
  @Column({ type: 'text' })
  country!: string;
}

@Entity()
class Customer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.company.name())
  @Column({ type: 'text' })
  name!: string;

  @Column(() => Address)
  address!: Address;
}

describe('embedded types', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Customer],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('each seeded instance gets an independently generated address', async () => {
    const repo = dataSource.getRepository(Customer);
    const [a, b] = await repo.save(await createMany(Customer, { count: 2 }));

    expect(a.id).not.toBe(b.id);
    expect(a.address).not.toBe(b.address);
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

describe('inheritance', () => {
  it('createMany produces the correct number of child instances with inherited and own properties', async () => {
    const cars = await createMany(Car, { count: 3 });

    expect(cars).toHaveLength(3);
    cars.forEach((car) => {
      expect(typeof car.make).toBe('string');
      expect(typeof car.doors).toBe('number');
    });
  });
});

// ---------------------------------------------------------------------------
// Array form
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
