import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Column, DataSource, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Seed, createManySeed, createSeed } from '../../src';

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

describe('seeder integration', () => {
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
    const saved = await dataSource.getRepository(User).save(await createSeed(User));

    expect(saved.id).toBeGreaterThan(0);
    expect(typeof saved.name).toBe('string');
    expect(saved.name.length).toBeGreaterThan(0);
    expect(saved.email).toContain('@');
    expect(saved.age).toBeGreaterThanOrEqual(18);
    expect(saved.age).toBeLessThanOrEqual(80);
  });

  it('seeds and persists a Post', async () => {
    const saved = await dataSource.getRepository(Post).save(await createSeed(Post));

    expect(saved.id).toBeGreaterThan(0);
    expect(typeof saved.title).toBe('string');
    expect(typeof saved.body).toBe('string');
    expect(typeof saved.published).toBe('boolean');
  });

  it('seeds multiple entities via createManySeed', async () => {
    const saved = await dataSource
      .getRepository(User)
      .save(await createManySeed(User, { count: 3 }));

    expect(saved).toHaveLength(3);
    expect(new Set((saved as User[]).map((u) => u.id)).size).toBe(3);
  });

  it('persisted values survive a fresh repository query', async () => {
    const repo = dataSource.getRepository(User);
    const saved = await repo.save(await createSeed(User));
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

    await createSeed(Probe, { dataSource });

    expect(receivedDataSource).toBe(dataSource);
  });
});
