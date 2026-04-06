import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Entity, PrimaryKey, Property, ManyToOne, OneToMany } from '@mikro-orm/decorators/legacy';
import { MikroORM } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { Seed, seed } from '../../src';

@Entity()
class Author {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Property()
  name!: string;

  @Seed({ count: 2 })
  @OneToMany(() => Article, (a) => a.author)
  articles!: Article[];
}

@Entity()
class Article {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.lorem.sentence())
  @Property()
  title!: string;

  @Seed(() => faker.lorem.paragraphs(1))
  @Property()
  body!: string;

  @Seed()
  @ManyToOne(() => Author)
  author!: Author;
}

describe('TsMorphMetadataProvider', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: TsMorphMetadataProvider,
      metadataCache: { enabled: false },
      entities: [Author, Article],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('seeds scalar properties', async () => {
    const article = await seed(Article).create();

    expect(typeof article.title).toBe('string');
    expect(typeof article.body).toBe('string');
  });

  it('seeds relation properties', async () => {
    const author = await seed(Author).create();

    expect(typeof author.name).toBe('string');
    expect(author.articles).toHaveLength(2);
    expect(typeof author.articles[0].title).toBe('string');
    expect(typeof author.articles[0].body).toBe('string');
  });
});
