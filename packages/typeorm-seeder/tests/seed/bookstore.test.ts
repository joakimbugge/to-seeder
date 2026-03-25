import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Column,
  DataSource,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Seed, saveManySeed, saveSeed } from '../../src';

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

@Entity()
class Author {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Column({ type: 'text' })
  name!: string;

  @Seed({ count: 2 })
  @OneToMany(() => Book, (b) => b.author)
  books!: Relation<Book[]>;
}

@Entity()
class Book {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.words(4))
  @Column({ type: 'text' })
  title!: string;

  // Seeded when Book is the root; skipped when seeding from Author (ancestor guard).
  @Seed()
  @ManyToOne(() => Author, (a) => a.books)
  author!: Relation<Author>;
}

@Entity()
class Customer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Column({ type: 'text' })
  name!: string;

  // Each customer gets their own favorite author, who in turn gets two books.
  @Seed()
  @ManyToOne(() => Author)
  favoriteAuthor!: Relation<Author>;

  // Each purchased book gets its own author (no cycle — Book is not an ancestor
  // when seeding from Customer → purchasedBooks → Book → author).
  @Seed({ count: 3 })
  @ManyToMany(() => Book)
  @JoinTable()
  purchasedBooks!: Relation<Book[]>;

  // Undecorated back-reference — not seeded, avoids a cycle back to Bookstore.
  @ManyToOne(() => Bookstore, (s) => s.customers)
  bookstore!: Relation<Bookstore>;
}

@Entity()
class Bookstore {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.company.name())
  @Column({ type: 'text' })
  name!: string;

  @Seed({ count: 3 })
  @OneToMany(() => Customer, (c) => c.bookstore)
  customers!: Relation<Customer[]>;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('bookstore', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Author, Book, Customer, Bookstore],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('seeds and persists an author with their books', async () => {
    const saved = await saveSeed(Author, { dataSource });

    const fetched = await dataSource
      .getRepository(Author)
      .findOneOrFail({ where: { id: saved.id }, relations: { books: true } });

    expect(typeof fetched.name).toBe('string');
    expect(fetched.books).toHaveLength(2);
    fetched.books.forEach((book) => {
      expect(book.id).toBeGreaterThan(0);
      expect(typeof book.title).toBe('string');
    });
  });

  it('seeds and persists a customer with a favorite author and purchased books', async () => {
    const saved = await saveSeed(Customer, { dataSource });

    const fetched = await dataSource.getRepository(Customer).findOneOrFail({
      where: { id: saved.id },
      relations: { favoriteAuthor: true, purchasedBooks: { author: true } },
    });

    expect(fetched.id).toBeGreaterThan(0);
    expect(typeof fetched.name).toBe('string');

    expect(fetched.favoriteAuthor.id).toBeGreaterThan(0);
    expect(typeof fetched.favoriteAuthor.name).toBe('string');

    expect(fetched.purchasedBooks).toHaveLength(3);
    fetched.purchasedBooks.forEach((book) => {
      expect(book.id).toBeGreaterThan(0);
      expect(typeof book.title).toBe('string');
      expect(book.author.id).toBeGreaterThan(0);
    });
  });

  it("the favorite author's own books are also persisted", async () => {
    const saved = await saveSeed(Customer, { dataSource });

    const fetched = await dataSource.getRepository(Customer).findOneOrFail({
      where: { id: saved.id },
      relations: { favoriteAuthor: true },
    });

    const author = await dataSource
      .getRepository(Author)
      .findOneOrFail({ where: { id: fetched.favoriteAuthor.id }, relations: { books: true } });

    expect(author.books).toHaveLength(2);
    author.books.forEach((book) => {
      expect(book.id).toBeGreaterThan(0);
    });
  });

  it('purchased books each have their own independently seeded author', async () => {
    const saved = await saveSeed(Customer, { dataSource });

    const fetched = await dataSource.getRepository(Customer).findOneOrFail({
      where: { id: saved.id },
      relations: { purchasedBooks: { author: true } },
    });

    const authorIds = fetched.purchasedBooks.map((b) => b.author.id);
    const uniqueAuthorIds = new Set(authorIds);

    // Each purchased book was seeded with its own author instance.
    expect(uniqueAuthorIds.size).toBe(3);
  });

  it('seeds the entire application graph from a single root entity', async () => {
    // Bookstore (1)
    // └── customers (3)
    //     ├── favoriteAuthor (1 Author per customer)
    //     │   └── books (2 Books, author back-ref skipped — ancestor guard)
    //     └── purchasedBooks (3 Books per customer)
    //         └── author (1 Author per book, books skipped — ancestor guard)
    const saved = await saveSeed(Bookstore, { dataSource });

    const bookstore = await dataSource.getRepository(Bookstore).findOneOrFail({
      where: { id: saved.id },
      relations: { customers: { favoriteAuthor: true, purchasedBooks: true } },
    });

    expect(bookstore.id).toBeGreaterThan(0);
    expect(typeof bookstore.name).toBe('string');
    expect(bookstore.customers).toHaveLength(3);

    for (const customer of bookstore.customers) {
      expect(customer.id).toBeGreaterThan(0);
      expect(customer.favoriteAuthor.id).toBeGreaterThan(0);
      expect(customer.purchasedBooks).toHaveLength(3);

      const favoriteAuthor = await dataSource.getRepository(Author).findOneOrFail({
        where: { id: customer.favoriteAuthor.id },
        relations: { books: true },
      });

      expect(favoriteAuthor.books).toHaveLength(2);
      favoriteAuthor.books.forEach((book) => expect(book.id).toBeGreaterThan(0));

      const purchasedBooks = await dataSource.getRepository(Customer).findOneOrFail({
        where: { id: customer.id },
        relations: { purchasedBooks: { author: true } },
      });

      purchasedBooks.purchasedBooks.forEach((book) => {
        expect(book.id).toBeGreaterThan(0);
        expect(book.author.id).toBeGreaterThan(0);
      });
    }
  });

  it('seeds and persists multiple customers independently', async () => {
    const saved = await saveManySeed(Customer, { count: 3, dataSource });

    expect(saved).toHaveLength(3);

    const ids = saved.map((c) => c.id);
    expect(new Set(ids).size).toBe(3);

    for (const customer of saved) {
      const fetched = await dataSource.getRepository(Customer).findOneOrFail({
        where: { id: customer.id },
        relations: { favoriteAuthor: true, purchasedBooks: true },
      });

      expect(fetched.favoriteAuthor.id).toBeGreaterThan(0);
      expect(fetched.purchasedBooks).toHaveLength(3);
    }
  });
});
