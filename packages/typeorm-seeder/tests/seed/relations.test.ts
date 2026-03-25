import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Column,
  DataSource,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Seed, createSeed, saveSeed } from '../../src';

// ---------------------------------------------------------------------------
// One-to-one: User owns one Profile
// ---------------------------------------------------------------------------

@Entity()
class Profile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.sentence())
  @Column({ type: 'text' })
  bio!: string;
}

@Entity()
class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Column({ type: 'text' })
  name!: string;

  @Seed()
  @OneToOne(() => Profile)
  @JoinColumn()
  profile!: Profile;
}

// ---------------------------------------------------------------------------
// Many-to-one / one-to-many: Project owns many Tasks
// ---------------------------------------------------------------------------

@Entity()
class Project {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.commerce.productName())
  @Column({ type: 'text' })
  name!: string;

  @Seed({ count: 3 })
  @OneToMany(() => Task, (t) => t.project)
  tasks!: Task[];
}

@Entity()
class Task {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.words(3))
  @Column({ type: 'text' })
  title!: string;

  // No @Seed — back-reference left undecorated intentionally
  @ManyToOne(() => Project, (p) => p.tasks)
  project!: Project;
}

// ---------------------------------------------------------------------------
// Many-to-many: Article has many Tags
// ---------------------------------------------------------------------------

@Entity()
class Tag {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.word())
  @Column({ type: 'text' })
  name!: string;
}

@Entity()
class Article {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.sentence())
  @Column({ type: 'text' })
  title!: string;

  @Seed({ count: 2 })
  @ManyToMany(() => Tag)
  @JoinTable()
  tags!: Tag[];
}

// ---------------------------------------------------------------------------
// Circular: Author has many Books, Book points back to Author
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

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('relation seeding', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Profile, User, Task, Project, Tag, Article, Book, Author],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('one-to-one', () => {
    it('seeds and persists both sides without cascade on the entity', async () => {
      const saved = await saveSeed(User, { dataSource });
      const fetched = await dataSource
        .getRepository(User)
        .findOneOrFail({ where: { id: saved.id }, relations: { profile: true } });

      expect(fetched.profile.id).toBeGreaterThan(0);
      expect(fetched.profile.bio).toBe(saved.profile.bio);
    });
  });

  describe('one-to-many', () => {
    it('seeds and persists all related entities without cascade on the entity', async () => {
      const saved = await saveSeed(Project, { dataSource });
      const fetched = await dataSource
        .getRepository(Project)
        .findOneOrFail({ where: { id: saved.id }, relations: { tasks: true } });

      expect(fetched.tasks).toHaveLength(3);
      fetched.tasks.forEach((t) => expect(t.id).toBeGreaterThan(0));
    });

    it('undecorated back-reference on Task is not seeded', async () => {
      const project = await createSeed(Project);

      project.tasks.forEach((t) => expect(t.project).toBeUndefined());
    });
  });

  describe('many-to-many', () => {
    it('seeds and persists the join table without cascade on the entity', async () => {
      const saved = await saveSeed(Article, { dataSource });
      const fetched = await dataSource
        .getRepository(Article)
        .findOneOrFail({ where: { id: saved.id }, relations: { tags: true } });

      expect(fetched.tags).toHaveLength(2);
    });
  });

  describe('relations: false', () => {
    it('skips relation properties and leaves them undefined', async () => {
      const author = await createSeed(Author, { relations: false });

      expect(author.books).toBeUndefined();
    });

    it('still seeds scalar properties', async () => {
      const author = await createSeed(Author, { relations: false });

      expect(typeof author.name).toBe('string');
    });

    it('saves and skips relation properties', async () => {
      const saved = await saveSeed(User, { dataSource, relations: false });
      const fetched = await dataSource
        .getRepository(User)
        .findOneOrFail({ where: { id: saved.id }, relations: { profile: true } });

      expect(fetched.profile).toBeNull();
    });
  });

  describe('circular relations', () => {
    it('cuts the cycle at the ancestor boundary — books are created, their author is not', async () => {
      const author = await createSeed(Author);

      expect(author.books).toHaveLength(2);
      author.books.forEach((book) => {
        expect(typeof book.title).toBe('string');
        // author back-reference was skipped because Author is an ancestor in this chain
        expect(book.author).toBeUndefined();
      });
    });

    it('standalone Book seeding (no cycle) does create its author', async () => {
      const book = await createSeed(Book);

      expect(book.author).toBeDefined();
      expect(typeof book.author.name).toBe('string');
      // Author's books would form a cycle — left undefined
      expect(book.author.books).toBeUndefined();
    });
  });
});
