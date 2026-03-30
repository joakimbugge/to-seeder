import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Entity,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { MikroORM } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { Seed, save, saveMany } from '../../src';

// ---------------------------------------------------------------------------
// Relation persistence — one-to-one, one-to-many, many-to-many
// ---------------------------------------------------------------------------

@Entity()
class Profile {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.lorem.sentence())
  @Property()
  bio!: string;
}

@Entity()
class RelUser {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Property()
  name!: string;

  @Seed()
  @OneToOne(() => Profile, { owner: true, nullable: true })
  profile!: Profile;
}

@Entity()
class Project {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.commerce.productName())
  @Property()
  name!: string;

  @Seed({ count: 3 })
  @OneToMany(() => Task, (t) => t.project)
  tasks!: Task[];
}

@Entity()
class Task {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.lorem.words(3))
  @Property()
  title!: string;

  @ManyToOne(() => Project)
  project!: Project;
}

@Entity()
class Tag {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.lorem.word())
  @Property()
  name!: string;
}

@Entity()
class Article {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.lorem.sentence())
  @Property()
  title!: string;

  @Seed({ count: 2 })
  @ManyToMany(() => Tag)
  tags!: Tag[];
}

describe('one-to-one', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [Profile, RelUser],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('seeds and persists both sides', async () => {
    const em = orm.em.fork();
    const saved = await save(RelUser, { em });
    const fetched = await orm.em
      .fork()
      .findOneOrFail(RelUser, { id: saved.id }, { populate: ['profile'] });

    expect(fetched.profile.id).toBeGreaterThan(0);
    expect(fetched.profile.bio).toBe(saved.profile.bio);
  });

  it('skips relation and saves root when relations: false', async () => {
    const em = orm.em.fork();
    const saved = await save(RelUser, { em, relations: false });
    const fetched = await orm.em
      .fork()
      .findOneOrFail(RelUser, { id: saved.id }, { populate: ['profile'] });

    expect(fetched.profile).toBeNull();
  });
});

describe('one-to-many', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [Project, Task],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('seeds and persists all related entities', async () => {
    const em = orm.em.fork();
    const saved = await save(Project, { em });
    const fetched = await orm.em
      .fork()
      .findOneOrFail(Project, { id: saved.id }, { populate: ['tasks'] });

    expect(fetched.tasks).toHaveLength(3);
    for (const t of fetched.tasks) {
      expect(t.id).toBeGreaterThan(0);
    }
  });
});

describe('many-to-many', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [Tag, Article],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('seeds and persists the join table', async () => {
    const em = orm.em.fork();
    const saved = await save(Article, { em });
    const fetched = await orm.em
      .fork()
      .findOneOrFail(Article, { id: saved.id }, { populate: ['tags'] });

    expect(fetched.tags).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Array form — save / saveMany
// ---------------------------------------------------------------------------

@Entity()
class ArrayPublisher {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.company.name())
  @Property()
  name!: string;
}

@Entity()
class ArrayWriter {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Property()
  name!: string;

  @Seed({ count: 2 })
  @OneToMany(() => ArrayNovel, (n) => n.writer)
  novels!: ArrayNovel[];
}

@Entity()
class ArrayNovel {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.lorem.words(3))
  @Property()
  title!: string;

  @Seed()
  @ManyToOne(() => ArrayWriter)
  writer!: ArrayWriter;
}

describe('array form — save / saveMany', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [ArrayPublisher, ArrayWriter, ArrayNovel],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close();
  });

  describe('saveMany', () => {
    it('returns an empty array when count is 0', async () => {
      const em = orm.em.fork();
      const [writers] = await saveMany([ArrayWriter], { count: 0, em });

      expect(writers).toEqual([]);
    });

    it('persists arrays of instances per class', async () => {
      const em = orm.em.fork();
      const [writers, publishers] = await saveMany([ArrayWriter, ArrayPublisher], {
        count: 2,
        em,
      });

      expect(writers).toHaveLength(2);
      expect(publishers).toHaveLength(2);
      writers.forEach((w) => expect(w.id).toBeGreaterThan(0));
      publishers.forEach((p) => expect(p.id).toBeGreaterThan(0));
    });

    it('skips relation seeding by default', async () => {
      const em = orm.em.fork();
      const [writers] = await saveMany([ArrayWriter, ArrayPublisher], { count: 1, em });
      const fetched = await orm.em
        .fork()
        .findOneOrFail(ArrayWriter, { id: writers[0]!.id }, { populate: ['novels'] });

      expect(fetched.novels).toHaveLength(0);
    });
  });

  describe('save', () => {
    it('persists each entity independently', async () => {
      const em = orm.em.fork();
      const [writer, publisher] = await save([ArrayWriter, ArrayPublisher], { em });

      expect(writer.id).toBeGreaterThan(0);
      expect(publisher.id).toBeGreaterThan(0);
    });

    it('skips relation seeding by default', async () => {
      const em = orm.em.fork();
      const [writer] = await save([ArrayWriter, ArrayPublisher], { em });
      const fetched = await orm.em
        .fork()
        .findOneOrFail(ArrayWriter, { id: writer.id }, { populate: ['novels'] });

      expect(fetched.novels).toHaveLength(0);
    });

    it('seeds and persists relations when relations: true is passed', async () => {
      const em = orm.em.fork();
      const [writer] = await save([ArrayWriter, ArrayPublisher], { em, relations: true });
      const fetched = await orm.em
        .fork()
        .findOneOrFail(ArrayWriter, { id: writer.id }, { populate: ['novels'] });

      expect(fetched.novels).toHaveLength(2);
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
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [Department],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('saves an entity to the database', async () => {
    const em = orm.em.fork();
    const dept = await save(Department, { em, relations: false });

    expect(dept.id).toBeGreaterThan(0);
    expect(dept.name).toBeTruthy();
  });
});
