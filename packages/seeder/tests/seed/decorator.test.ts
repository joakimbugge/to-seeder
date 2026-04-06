import { faker } from '@faker-js/faker';
import { Seed } from '../../src';
import { getSeeds } from '../../src/seed/registry.js';

describe('@Seed', () => {
  it('registers the factory against the correct property', () => {
    const factory = () => 'value';

    class User {
      @Seed(factory)
      name!: string;
    }

    const entries = getSeeds(User);
    expect(entries).toHaveLength(1);
    expect(entries[0].propertyKey).toBe('name');
    expect(entries[0].factory).toBe(factory);
  });

  it('stores options alongside the factory', () => {
    class Post {
      @Seed(() => faker.lorem.sentence(), { count: 3 })
      title!: string;
    }

    const [entry] = getSeeds(Post);
    expect(entry.options).toEqual({ count: 3 });
  });

  it('tracks multiple seeded properties on one class in declaration order', () => {
    class Article {
      @Seed(() => faker.person.fullName())
      author!: string;

      @Seed(() => faker.lorem.words(5))
      title!: string;

      @Seed(() => faker.number.int({ min: 0, max: 1000 }))
      views!: number;
    }

    const entries = getSeeds(Article);
    expect(entries.map((e) => e.propertyKey)).toEqual(['author', 'title', 'views']);
  });

  it('registers a bare @Seed() (no factory) for relation auto-seeding', () => {
    class Book {
      @Seed()
      author!: unknown;
    }

    const [entry] = getSeeds(Book);
    expect(entry.factory).toBeUndefined();
    expect(entry.options).toEqual({});
  });

  it('factory return value is awaitable', async () => {
    class Product {
      @Seed(() => faker.commerce.productName())
      name!: string;
    }

    const [entry] = getSeeds(Product);
    const value = await entry.factory!({}, {}, 0);
    expect(typeof value).toBe('string');
    expect((value as string).length).toBeGreaterThan(0);
  });

  it('inherits @Seed entries from parent classes, parent entries first', () => {
    class Base {
      @Seed(() => 'base-value')
      baseField!: string;
    }

    class Child extends Base {
      @Seed(() => 'child-value')
      childField!: string;
    }

    const entries = getSeeds(Child);
    expect(entries.map((e) => e.propertyKey)).toEqual(['baseField', 'childField']);
  });
});
