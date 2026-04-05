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
  Tree,
  TreeChildren,
  TreeParent,
} from 'typeorm';
import { Seed, create, save } from '../../../src';

// ---------------------------------------------------------------------------
// Relation persistence — one-to-one, one-to-many, many-to-many
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
class RelUser {
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

  @ManyToOne(() => Project, (p) => p.tasks)
  project!: Project;
}

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

describe('one-to-one', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Profile, RelUser],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('seeds and persists both sides without cascade on the entity', async () => {
    const saved = await save(RelUser, { dataSource });
    const fetched = await dataSource
      .getRepository(RelUser)
      .findOneOrFail({ where: { id: saved.id }, relations: { profile: true } });

    expect(fetched.profile.id).toBeGreaterThan(0);
    expect(fetched.profile.bio).toBe(saved.profile.bio);
  });

  it('skips relation and saves root when relations: false', async () => {
    const saved = await save(RelUser, { dataSource, relations: false });
    const fetched = await dataSource
      .getRepository(RelUser)
      .findOneOrFail({ where: { id: saved.id }, relations: { profile: true } });

    expect(fetched.profile).toBeNull();
  });
});

describe('one-to-many', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Project, Task],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('seeds and persists all related entities without cascade on the entity', async () => {
    const saved = await save(Project, { dataSource });
    const fetched = await dataSource
      .getRepository(Project)
      .findOneOrFail({ where: { id: saved.id }, relations: { tasks: true } });

    expect(fetched.tasks).toHaveLength(3);
    fetched.tasks.forEach((t) => expect(t.id).toBeGreaterThan(0));
  });
});

describe('many-to-many', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Tag, Article],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('seeds and persists the join table without cascade on the entity', async () => {
    const saved = await save(Article, { dataSource });
    const fetched = await dataSource
      .getRepository(Article)
      .findOneOrFail({ where: { id: saved.id }, relations: { tags: true } });

    expect(fetched.tags).toHaveLength(2);
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
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Department],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('saves an entity to the database', async () => {
    const dept = await save(Department, { dataSource, relations: false });

    expect(dept.id).toBeGreaterThan(0);
    expect(dept.name).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tree entities
// ---------------------------------------------------------------------------

@Entity()
@Tree('adjacency-list')
class AdjacencyCategory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.commerce.department())
  @Column({ type: 'text' })
  name!: string;

  @Seed()
  @TreeParent({ onDelete: 'CASCADE' })
  parent?: AdjacencyCategory;

  @Seed({ count: 2 })
  @TreeChildren()
  children!: AdjacencyCategory[];
}

@Entity()
@Tree('materialized-path')
class MaterializedPathItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.word())
  @Column({ type: 'text' })
  name!: string;

  @Seed()
  @TreeParent()
  parent?: MaterializedPathItem;

  @Seed({ count: 2 })
  @TreeChildren()
  children!: MaterializedPathItem[];
}

@Entity()
@Tree('closure-table')
class ClosureTableItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.word())
  @Column({ type: 'text' })
  label!: string;

  @Seed()
  @TreeParent()
  parent?: ClosureTableItem;

  @Seed({ count: 2 })
  @TreeChildren()
  children!: ClosureTableItem[];
}

@Entity()
@Tree('nested-set')
class NestedSetItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.word())
  @Column({ type: 'text' })
  name!: string;

  @Seed()
  @TreeParent()
  parent?: NestedSetItem;

  @Seed({ count: 2 })
  @TreeChildren()
  children!: NestedSetItem[];
}

describe('tree: adjacency-list', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [AdjacencyCategory],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('creates a tree entity — children seeded, parent seeded one level deep', async () => {
    const category = await create(AdjacencyCategory);

    expect(category.name).toBeTruthy();
    expect(category.children).toHaveLength(2);
    expect(category.parent).toBeInstanceOf(AdjacencyCategory);
    expect(category.parent!.parent).toBeUndefined();
  });

  it('saves a tree entity to the database', async () => {
    const category = await save(AdjacencyCategory, { dataSource });

    expect(category.id).toBeGreaterThan(0);
  });
});

describe('tree: materialized-path', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [MaterializedPathItem],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('creates a tree entity — children seeded, parent seeded one level deep', async () => {
    const item = await create(MaterializedPathItem);

    expect(item.name).toBeTruthy();
    expect(item.children).toHaveLength(2);
    expect(item.parent).toBeInstanceOf(MaterializedPathItem);
    expect(item.parent!.parent).toBeUndefined();
  });

  it('saves a tree entity to the database', async () => {
    const item = await save(MaterializedPathItem, { dataSource });

    expect(item.id).toBeGreaterThan(0);
  });
});

describe('tree: closure-table', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [ClosureTableItem],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('creates a tree entity — children seeded, parent seeded one level deep', async () => {
    const item = await create(ClosureTableItem);

    expect(item.label).toBeTruthy();
    expect(item.children).toHaveLength(2);
    expect(item.parent).toBeInstanceOf(ClosureTableItem);
    expect(item.parent!.parent).toBeUndefined();
  });

  it('saves a tree entity to the database', async () => {
    const item = await save(ClosureTableItem, { dataSource });

    expect(item.id).toBeGreaterThan(0);
  });
});

describe('tree: nested-set', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [NestedSetItem],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('creates a tree entity — children seeded, parent seeded one level deep', async () => {
    const item = await create(NestedSetItem);

    expect(item.name).toBeTruthy();
    expect(item.children).toHaveLength(2);
    expect(item.parent).toBeInstanceOf(NestedSetItem);
    expect(item.parent!.parent).toBeUndefined();
  });

  it('saves a tree entity to the database', async () => {
    const item = await save(NestedSetItem, { dataSource });

    expect(item.id).toBeGreaterThan(0);
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
  it.skip('saves an entity decorated with a secondary database', async () => {
    const dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [MultiDbUser],
    });

    await dataSource.initialize();

    const user = await save(MultiDbUser, { dataSource });

    expect(user.id).toBeGreaterThan(0);

    await dataSource.destroy();
  });
});
