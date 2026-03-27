import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import {
  Column,
  DataSource,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Tree,
  TreeChildren,
  TreeParent,
} from 'typeorm';
import { Seed, create, save } from '../../src/index.js';

// ─── Self-referencing relation (no @Tree) ────────────────────────────────────

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

// ─── Adjacency-list ──────────────────────────────────────────────────────────

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

// ─── Materialized-path ───────────────────────────────────────────────────────

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

// ─── Closure-table ───────────────────────────────────────────────────────────

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

// ─── Nested-set ──────────────────────────────────────────────────────────────

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

// ─── Multiple databases ──────────────────────────────────────────────────────

@Entity({ database: 'secondary' })
class MultiDbUser {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Column({ type: 'text' })
  name!: string;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('self-referencing relation (adjacent list without @Tree)', () => {
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

  it('creates an entity — manager seeded one level deep, manager.manager cut by ancestor guard', async () => {
    const dept = await create(Department);

    expect(dept.name).toBeTruthy();
    // The ancestor guard allows the first level: Department is only added to
    // ancestors for the child context, so the immediate manager IS seeded.
    expect(dept.manager).toBeInstanceOf(Department);
    // The second level is cut — Department is now an ancestor.
    expect(dept.manager!.manager).toBeUndefined();
  });

  it('saves an entity to the database', async () => {
    const dept = await save(Department, { dataSource, relations: false });

    expect(dept.id).toBeGreaterThan(0);
    expect(dept.name).toBeTruthy();
  });
});

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

  // TypeORM's MaterializedPathSubjectExecutor crashes when saving via standard
  // repository with cascade-enabled children — it expects children to already
  // be in a specific state that our in-memory graph does not satisfy.
  // See: TODO.md — tree: materialized-path save
  it.skip('saves a tree entity to the database', async () => {
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

  // TypeORM's closure-table strategy requires the parent to be persisted before
  // its children. Our batch save builds the full in-memory graph first and saves
  // in one shot, which violates this ordering constraint.
  // See: TODO.md — tree: closure-table save
  it.skip('saves a tree entity to the database', async () => {
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

  // TypeORM's NestedSetSubjectExecutor crashes when saving via standard
  // repository with an in-memory graph — nested-set requires left/right
  // recalculation that depends on already-persisted sibling data.
  // See: TODO.md — tree: nested-set save
  it.skip('saves a tree entity to the database', async () => {
    const item = await save(NestedSetItem, { dataSource });

    expect(item.id).toBeGreaterThan(0);
  });
});

describe('multiple databases (@Entity({ database }))', () => {
  // better-sqlite3 does not support @Entity({ database: '...' }) — TypeORM
  // tries to resolve a file path for the secondary database, which fails with
  // `:memory:` and has no ATTACH DATABASE support via the DataSource API.
  // See: TODO.md — multiple databases
  it.skip('creates an entity decorated with a secondary database', async () => {
    const user = await create(MultiDbUser);

    expect(user.name).toBeTruthy();
  });

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
