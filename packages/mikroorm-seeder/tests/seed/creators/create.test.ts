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
import { Seed, create } from '../../../src';

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

  @Seed(() => faker.number.int({ min: 18, max: 80 }))
  @Property()
  age!: number;
}

@Entity()
class Post {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.lorem.sentence())
  @Property()
  title!: string;

  @Seed(() => faker.lorem.paragraphs(2))
  @Property()
  body!: string;

  @Seed(() => faker.datatype.boolean())
  @Property()
  published!: boolean;
}

describe('scalar seeding', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [User, Post],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('seeds and persists a User', async () => {
    const em = orm.em.fork();
    const user = await create(User);
    em.persist(user);
    await em.flush();

    expect(user.id).toBeGreaterThan(0);
    expect(typeof user.name).toBe('string');
    expect(user.name.length).toBeGreaterThan(0);
    expect(user.email).toContain('@');
    expect(user.age).toBeGreaterThanOrEqual(18);
    expect(user.age).toBeLessThanOrEqual(80);
  });

  it('seeds and persists a Post', async () => {
    const em = orm.em.fork();
    const post = await create(Post);
    em.persist(post);
    await em.flush();

    expect(post.id).toBeGreaterThan(0);
    expect(typeof post.title).toBe('string');
    expect(typeof post.body).toBe('string');
    expect(typeof post.published).toBe('boolean');
  });

  it('persisted values survive a fresh query', async () => {
    const em = orm.em.fork();
    const user = await create(User);
    em.persist(user);
    await em.flush();

    const fetched = await orm.em.fork().findOneOrFail(User, { id: user.id });

    expect(fetched.name).toBe(user.name);
    expect(fetched.email).toBe(user.email);
    expect(fetched.age).toBe(user.age);
  });

  it('passes EntityManager to factories via context', async () => {
    let receivedEm: MikroORM['em'] | undefined;

    class Probe {
      @Seed(({ em: e }) => {
        receivedEm = e as MikroORM['em'];
        return faker.lorem.word();
      })
      @Property()
      value!: string;
    }

    const em = orm.em.fork();
    await create(Probe, { em });

    expect(receivedEm).toBe(em);
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

  // No @Seed here — the seeder detects this via MikroORM embedded metadata.
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

  it('auto-seeds an embedded class without @Seed on the parent property', async () => {
    const customer = await create(Customer);

    expect(customer.address).toBeDefined();
    expect(typeof customer.address.street).toBe('string');
    expect(typeof customer.address.city).toBe('string');
    expect(typeof customer.address.country).toBe('string');
  });

  it('persists the embedded columns to the database', async () => {
    const em = orm.em.fork();
    const customer = await create(Customer);
    em.persist(customer);
    await em.flush();

    const fetched = await orm.em.fork().findOneOrFail(Customer, { id: customer.id });

    expect(fetched.address.street).toBe(customer.address.street);
    expect(fetched.address.city).toBe(customer.address.city);
    expect(fetched.address.country).toBe(customer.address.country);
  });
});

// ---------------------------------------------------------------------------
// Inheritance
// ---------------------------------------------------------------------------

@Entity({
  discriminatorColumn: 'type',
  discriminatorMap: { car: 'Car', truck: 'Truck' },
})
class Vehicle {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.vehicle.manufacturer())
  @Property()
  make!: string;

  @Seed(() => faker.vehicle.model())
  @Property()
  model!: string;
}

@Entity({ discriminatorValue: 'car' })
class Car extends Vehicle {
  @Seed(() => faker.number.int({ min: 2, max: 6 }))
  @Property({ nullable: true })
  doors!: number;
}

@Entity({ discriminatorValue: 'truck' })
class Truck extends Vehicle {
  @Seed(() => faker.number.float({ min: 0.5, max: 5.0, fractionDigits: 1 }))
  @Property({ nullable: true })
  payloadTons!: number;
}

describe('inheritance', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [Vehicle, Car, Truck],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('seeds inherited parent properties alongside child properties', async () => {
    const car = await create(Car);

    expect(typeof car.make).toBe('string');
    expect(typeof car.model).toBe('string');
    expect(typeof car.doors).toBe('number');
    expect(car.doors).toBeGreaterThanOrEqual(2);
  });

  it('persists a child entity including inherited columns', async () => {
    const em = orm.em.fork();
    const car = await create(Car);
    em.persist(car);
    await em.flush();

    expect(car.id).toBeGreaterThan(0);
    expect(typeof car.make).toBe('string');
    expect(typeof car.doors).toBe('number');
  });

  it('different child types share the same table but seed independently', async () => {
    const em = orm.em.fork();
    const car = await create(Car);
    const truck = await create(Truck);
    em.persist([car, truck]);
    await em.flush();

    const all = await orm.em.fork().find(Vehicle, {});
    const ids = all.map((v) => v.id);

    expect(ids).toContain(car.id);
    expect(ids).toContain(truck.id);
  });

  it('child-only properties are not present on sibling child instances', async () => {
    const car = await create(Car);
    const truck = await create(Truck);

    expect((car as unknown as Truck).payloadTons).toBeUndefined();
    expect((truck as unknown as Car).doors).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Relation seeding — cycle detection, back-references, relations: false
// ---------------------------------------------------------------------------

@Entity()
class Project {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.commerce.productName())
  @Property()
  name!: string;

  @Seed({ count: 3 })
  @OneToMany(() => ProjectTask, (t) => t.project)
  tasks!: ProjectTask[];
}

@Entity()
class ProjectTask {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.lorem.words(3))
  @Property()
  title!: string;

  // Undecorated back-reference — intentionally no @Seed
  @ManyToOne(() => Project)
  project!: Project;
}

@Entity()
class Author {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Property()
  name!: string;

  @Seed({ count: 2 })
  @OneToMany(() => Book, (b) => b.author)
  books!: Book[];
}

@Entity()
class Book {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.lorem.words(4))
  @Property()
  title!: string;

  // Decorated with @Seed() — would be circular when seeding from Author
  @Seed()
  @ManyToOne(() => Author)
  author!: Author;
}

describe('relation seeding', () => {
  describe('undecorated back-reference', () => {
    it('is not seeded on the child entity', async () => {
      const project = await create(Project);

      project.tasks.forEach((t) => expect(t.project).toBeUndefined());
    });
  });

  describe('relations: false', () => {
    it('skips relation properties and leaves them undefined', async () => {
      const author = await create(Author, { relations: false });

      expect(author.books).toBeUndefined();
    });

    it('still seeds scalar properties', async () => {
      const author = await create(Author, { relations: false });

      expect(typeof author.name).toBe('string');
    });
  });

  describe('circular relations', () => {
    it('cuts the cycle at the ancestor boundary — books are created, their author is not', async () => {
      const author = await create(Author);

      expect(author.books).toHaveLength(2);
      author.books.forEach((book) => {
        expect(typeof book.title).toBe('string');
        expect(book.author).toBeUndefined();
      });
    });

    it('standalone Book seeding (no cycle) does create its author', async () => {
      const book = await create(Book);

      expect(book.author).toBeDefined();
      expect(typeof book.author.name).toBe('string');
      expect(book.author.books).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Self-referencing relations
// ---------------------------------------------------------------------------

@Entity()
class Department {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.commerce.department())
  @Property()
  name!: string;

  @Seed()
  @ManyToOne(() => Department, { nullable: true })
  manager?: Department;

  @OneToMany(() => Department, (d) => d.manager)
  reports!: Department[];
}

describe('self-referencing relations', () => {
  it('creates an entity — manager seeded one level deep, manager.manager cut by ancestor guard', async () => {
    const dept = await create(Department);

    expect(dept.name).toBeTruthy();
    expect(dept.manager).toBeInstanceOf(Department);
    expect(dept.manager!.manager).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Sequence index — create
// ---------------------------------------------------------------------------

describe('sequence index', () => {
  it('factory receives index 0 for a single create()', async () => {
    class Item {
      @Seed((_, __, i) => `item-${i}`)
      value!: string;
    }

    const item = await create(Item);
    expect(item.value).toBe('item-0');
  });

  it('values factory receives index 0 for a single create()', async () => {
    class Item {
      value!: string;
    }

    const item = await create(Item, { values: { value: (_, __, i) => `item-${i}` } });
    expect(item.value).toBe('item-0');
  });
});
