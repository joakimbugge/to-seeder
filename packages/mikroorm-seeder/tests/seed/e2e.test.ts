import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
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

  @Seed()
  @ManyToOne(() => Author)
  author!: Author;
}

@Entity()
class Bookstore {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.company.name())
  @Property()
  name!: string;

  @Seed({ count: 3 })
  @OneToMany(() => Customer, (c) => c.bookstore)
  customers!: Customer[];
}

@Entity()
class Customer {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Property()
  name!: string;

  @Seed()
  @ManyToOne(() => Author)
  favoriteAuthor!: Author;

  @Seed({ count: 3 })
  @ManyToMany(() => Book)
  purchasedBooks!: Book[];

  @ManyToOne(() => Bookstore, { nullable: true })
  bookstore?: Bookstore;
}

describe('bookstore', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [Author, Book, Customer, Bookstore],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('seeds and persists an author with their books', async () => {
    const em = orm.em.fork();
    const saved = await seed(Author).save({ em });

    const fetched = await orm.em
      .fork()
      .findOneOrFail(Author, { id: saved.id }, { populate: ['books'] });

    expect(typeof fetched.name).toBe('string');
    expect(fetched.books).toHaveLength(2);
    for (const book of fetched.books) {
      expect(book.id).toBeGreaterThan(0);
      expect(typeof book.title).toBe('string');
    }
  });

  it('seeds and persists a customer with a favorite author and purchased books', async () => {
    const em = orm.em.fork();
    const saved = await seed(Customer).save({ em });

    const fetched = await orm.em.fork().findOneOrFail(
      Customer,
      { id: saved.id },
      {
        populate: ['favoriteAuthor', 'purchasedBooks.author'],
      },
    );

    expect(fetched.id).toBeGreaterThan(0);
    expect(typeof fetched.name).toBe('string');
    expect(fetched.favoriteAuthor.id).toBeGreaterThan(0);
    expect(fetched.purchasedBooks).toHaveLength(3);
    for (const book of fetched.purchasedBooks) {
      expect(book.id).toBeGreaterThan(0);
      expect(typeof book.title).toBe('string');
      expect(book.author.id).toBeGreaterThan(0);
    }
  });

  it("the favorite author's own books are also persisted", async () => {
    const em = orm.em.fork();
    const saved = await seed(Customer).save({ em });

    const fetched = await orm.em
      .fork()
      .findOneOrFail(Customer, { id: saved.id }, { populate: ['favoriteAuthor'] });
    const author = await orm.em
      .fork()
      .findOneOrFail(Author, { id: fetched.favoriteAuthor.id }, { populate: ['books'] });

    expect(author.books).toHaveLength(2);
    for (const book of author.books) {
      expect(book.id).toBeGreaterThan(0);
    }
  });

  it('purchased books each have their own independently seeded author', async () => {
    const em = orm.em.fork();
    const saved = await seed(Customer).save({ em });

    const fetched = await orm.em.fork().findOneOrFail(
      Customer,
      { id: saved.id },
      {
        populate: ['purchasedBooks.author'],
      },
    );

    const authorIds = [...fetched.purchasedBooks].map((b) => b.author.id);
    expect(new Set(authorIds).size).toBe(3);
  });

  it('seeds the entire application graph from a single root entity', async () => {
    const em = orm.em.fork();
    const saved = await seed(Bookstore).save({ em });

    const bookstore = await orm.em.fork().findOneOrFail(
      Bookstore,
      { id: saved.id },
      {
        populate: ['customers.favoriteAuthor', 'customers.purchasedBooks'],
      },
    );

    expect(bookstore.id).toBeGreaterThan(0);
    expect(typeof bookstore.name).toBe('string');
    expect(bookstore.customers).toHaveLength(3);

    for (const customer of bookstore.customers) {
      expect(customer.id).toBeGreaterThan(0);
      expect(customer.favoriteAuthor.id).toBeGreaterThan(0);
      expect(customer.purchasedBooks).toHaveLength(3);
    }
  });

  it('seeds and persists multiple customers independently', async () => {
    const em = orm.em.fork();
    const saved = await seed(Customer).saveMany(3, { em });

    expect(saved).toHaveLength(3);
    expect(new Set(saved.map((c) => c.id)).size).toBe(3);

    for (const customer of saved) {
      const fetched = await orm.em.fork().findOneOrFail(
        Customer,
        { id: customer.id },
        {
          populate: ['favoriteAuthor', 'purchasedBooks'],
        },
      );

      expect(fetched.favoriteAuthor.id).toBeGreaterThan(0);
      expect(fetched.purchasedBooks).toHaveLength(3);
    }
  });
});
