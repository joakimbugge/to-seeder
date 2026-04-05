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
} from 'typeorm';
import { Seed, create } from '../../../src';

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

  @Seed(() => faker.number.int({ min: 18, max: 80 }))
  @Column({ type: 'integer' })
  age!: number;
}

@Entity()
class Post {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.sentence())
  @Column({ type: 'text' })
  title!: string;

  @Seed(() => faker.lorem.paragraphs(2))
  @Column({ type: 'text' })
  body!: string;

  @Seed(() => faker.datatype.boolean())
  @Column({ type: 'boolean' })
  published!: boolean;
}

describe('scalar seeding', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [User, Post],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('seeds and persists a User', async () => {
    const saved = await dataSource.getRepository(User).save(await create(User));

    expect(saved.id).toBeGreaterThan(0);
    expect(typeof saved.name).toBe('string');
    expect(saved.name.length).toBeGreaterThan(0);
    expect(saved.email).toContain('@');
    expect(saved.age).toBeGreaterThanOrEqual(18);
    expect(saved.age).toBeLessThanOrEqual(80);
  });

  it('seeds and persists a Post', async () => {
    const saved = await dataSource.getRepository(Post).save(await create(Post));

    expect(saved.id).toBeGreaterThan(0);
    expect(typeof saved.title).toBe('string');
    expect(typeof saved.body).toBe('string');
    expect(typeof saved.published).toBe('boolean');
  });

  it('persisted values survive a fresh repository query', async () => {
    const repo = dataSource.getRepository(User);
    const saved = await repo.save(await create(User));
    const fetched = await repo.findOneByOrFail({ id: saved.id });

    expect(fetched.name).toBe(saved.name);
    expect(fetched.email).toBe(saved.email);
    expect(fetched.age).toBe(saved.age);
  });

  it('passes DataSource to factories via context', async () => {
    let receivedDataSource: DataSource | undefined;

    class Probe {
      @Seed(({ dataSource: ds }) => {
        receivedDataSource = ds;
        return faker.lorem.word();
      })
      @Column({ type: 'text' })
      value!: string;
    }

    await create(Probe, { dataSource });

    expect(receivedDataSource).toBe(dataSource);
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

  // No @Seed here — the seeder detects this via TypeORM's embedded metadata.
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

  it('auto-seeds an embedded class without @Seed on the parent property', async () => {
    const customer = await create(Customer);

    expect(customer.address).toBeDefined();
    expect(typeof customer.address.street).toBe('string');
    expect(typeof customer.address.city).toBe('string');
    expect(typeof customer.address.country).toBe('string');
  });

  it('persists the embedded columns to the database', async () => {
    const repo = dataSource.getRepository(Customer);
    const saved = await repo.save(await create(Customer));
    const fetched = await repo.findOneByOrFail({ id: saved.id });

    expect(fetched.address.street).toBe(saved.address.street);
    expect(fetched.address.city).toBe(saved.address.city);
    expect(fetched.address.country).toBe(saved.address.country);
  });
}); // ---------------------------------------------------------------------------
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

  @Seed(() => faker.vehicle.model())
  @Column({ type: 'text' })
  model!: string;
}

@ChildEntity()
class Car extends Vehicle {
  @Seed(() => faker.number.int({ min: 2, max: 6 }))
  @Column({ type: 'integer' })
  doors!: number;
}

@ChildEntity()
class Truck extends Vehicle {
  @Seed(() => faker.number.float({ min: 0.5, max: 5.0, fractionDigits: 1 }))
  @Column({ type: 'real' })
  payloadTons!: number;
}

describe('inheritance', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Vehicle, Car, Truck],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('seeds inherited parent properties alongside child properties', async () => {
    const car = await create(Car);

    expect(typeof car.make).toBe('string');
    expect(typeof car.model).toBe('string');
    expect(typeof car.doors).toBe('number');
    expect(car.doors).toBeGreaterThanOrEqual(2);
  });

  it('persists a child entity including inherited columns', async () => {
    const car = await dataSource.getRepository(Vehicle).save(await create(Car));

    expect(car.id).toBeGreaterThan(0);
    expect(typeof car.make).toBe('string');
    expect(typeof (car as Car).doors).toBe('number');
  });

  it('different child types share the same table but seed independently', async () => {
    const repo = dataSource.getRepository(Vehicle);
    const car = await repo.save(await create(Car));
    const truck = await repo.save(await create(Truck));

    const all = await repo.find();
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
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.commerce.productName())
  @Column({ type: 'text' })
  name!: string;

  @Seed({ count: 3 })
  @OneToMany(() => ProjectTask, (t) => t.project)
  tasks!: ProjectTask[];
}

@Entity()
class ProjectTask {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.words(3))
  @Column({ type: 'text' })
  title!: string;

  // Undecorated back-reference — intentionally no @Seed
  @ManyToOne(() => Project, (p) => p.tasks)
  project!: Project;
}

@Entity()
class Author {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Column({ type: 'text' })
  name!: string;

  @Seed({ count: 2 })
  @OneToMany(() => Book, (b) => b.author)
  books!: Book[];
}

@Entity()
class Book {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.words(4))
  @Column({ type: 'text' })
  title!: string;

  // Decorated with @Seed() — would be circular when seeding from Author
  @Seed()
  @ManyToOne(() => Author, (a) => a.books)
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
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.commerce.department())
  @Column({ type: 'text' })
  name!: string;

  @Seed()
  @ManyToOne(() => Department, (d) => d.reports, { nullable: true })
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

// ---------------------------------------------------------------------------
// Multiple databases — skipped (better-sqlite3 does not support @Entity({ database }))
// ---------------------------------------------------------------------------

@Entity({ database: 'secondary' })
class MultiDbUser {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Column({ type: 'text' })
  name!: string;
}

describe('multiple databases (@Entity({ database }))', () => {
  // better-sqlite3 does not support @Entity({ database: '...' }) — TypeORM
  // tries to resolve a file path for the secondary database, which fails with
  // `:memory:` and has no ATTACH DATABASE support via the DataSource API.
  // See: TODO.md — multiple databases
  it.skip('creates an entity decorated with a secondary database', async () => {
    const user = await create(MultiDbUser);

    expect(user.name).toBeTruthy();
  });
});
