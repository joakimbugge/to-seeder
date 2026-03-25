import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { Seed } from '../../src';
import { getSeeds } from '../../src/seed/registry.js';

describe('@Seed', () => {
  it('registers the factory against the correct property', () => {
    const factory = () => 'Joakim';

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
      @Seed(() => faker.lorem.sentence(), {})
      title!: string;
    }

    const entries = getSeeds(Post);
    expect(entries[0].options).toBeDefined();
  });

  it('tracks multiple seeded properties on one class', () => {
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

  it('factory return value is usable', async () => {
    class Product {
      @Seed(() => faker.commerce.productName())
      name!: string;
    }

    const [entry] = getSeeds(Product);
    const value = await entry.factory!({});
    expect(typeof value).toBe('string');
    expect((value as string).length).toBeGreaterThan(0);
  });
});
