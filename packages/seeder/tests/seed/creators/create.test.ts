import { faker } from '@faker-js/faker';
import { Seed, create } from '../../../src';
import type { MetadataAdapter } from '../../../src';

/** Adapter that reports no embeddeds or relations — suitable for pure scalar tests. */
const noOpAdapter: MetadataAdapter = {
  getEmbeddeds: () => [],
  getRelations: () => [],
};

// ---------------------------------------------------------------------------
// Scalar seeding
// ---------------------------------------------------------------------------

class User {
  @Seed(() => faker.person.fullName())
  name!: string;

  @Seed(() => faker.internet.email())
  email!: string;

  @Seed(() => faker.number.int({ min: 18, max: 80 }))
  age!: number;
}

describe('create — scalar seeding', () => {
  it('seeds all @Seed-decorated properties', async () => {
    const user = await create(User, undefined, noOpAdapter);

    expect(typeof user.name).toBe('string');
    expect(user.name.length).toBeGreaterThan(0);
    expect(user.email).toContain('@');
    expect(user.age).toBeGreaterThanOrEqual(18);
    expect(user.age).toBeLessThanOrEqual(80);
  });

  it('returns an instance of the entity class', async () => {
    const user = await create(User, undefined, noOpAdapter);
    expect(user).toBeInstanceOf(User);
  });

  it('applies values overrides after factory seeding', async () => {
    const user = await create(User, { values: { name: 'Fixed Name' } }, noOpAdapter);
    expect(user.name).toBe('Fixed Name');
  });

  it('applies factory values overrides, passing context and index', async () => {
    const user = await create(User, { values: { name: (_, __, i) => `user-${i}` } }, noOpAdapter);
    expect(user.name).toBe('user-0');
  });
});

// ---------------------------------------------------------------------------
// Sequence index
// ---------------------------------------------------------------------------

describe('create — sequence index', () => {
  it('factory receives index 0 for a single create()', async () => {
    class Item {
      @Seed((_, __, i) => `item-${i}`)
      value!: string;
    }

    const item = await create(Item, undefined, noOpAdapter);
    expect(item.value).toBe('item-0');
  });
});

// ---------------------------------------------------------------------------
// Context pass-through
// ---------------------------------------------------------------------------

describe('create — context pass-through', () => {
  it('passes the full options object as context to factories', async () => {
    let received: unknown;

    class Probe {
      @Seed((ctx) => {
        received = ctx;
        return 'value';
      })
      field!: string;
    }

    const customCtx = { relations: true, customField: 42 };
    await create(Probe, customCtx as never, noOpAdapter);
    expect((received as typeof customCtx).customField).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// Array (multi-class) form
// ---------------------------------------------------------------------------

class Post {
  @Seed(() => faker.lorem.sentence())
  title!: string;
}

describe('create — array (multi-class) form', () => {
  it('creates one instance per class', async () => {
    const [user, post] = await create([User, Post], undefined, noOpAdapter);

    expect(user).toBeInstanceOf(User);
    expect(post).toBeInstanceOf(Post);
  });

  it('defaults to relations: false for the array form', async () => {
    let receivedRelations: boolean | undefined;

    class Probe {
      @Seed((ctx) => {
        receivedRelations = ctx.relations as boolean | undefined;
        return 'v';
      })
      f!: string;
    }

    await create([Probe], undefined, noOpAdapter);
    expect(receivedRelations).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Embedded entity seeding (via adapter)
// ---------------------------------------------------------------------------

class Address {
  @Seed(() => faker.location.streetAddress())
  street!: string;

  @Seed(() => faker.location.city())
  city!: string;
}

class Customer {
  @Seed(() => faker.company.name())
  name!: string;

  address!: Address;
}

/** Adapter that only returns embedded for Customer, not for Address itself — prevents infinite recursion. */
const embeddedAdapter: MetadataAdapter = {
  getEmbeddeds: (hierarchy) => {
    if (hierarchy.some((c) => c === Customer)) {
      return [{ propertyName: 'address', getClass: () => Address }];
    }
    return [];
  },
  getRelations: () => [],
};

describe('create — embedded entity seeding', () => {
  it('auto-seeds an embedded class detected by the adapter', async () => {
    const customer = await create(Customer, undefined, embeddedAdapter);

    expect(customer.address).toBeInstanceOf(Address);
    expect(typeof customer.address.street).toBe('string');
    expect(typeof customer.address.city).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Cycle protection (via adapter)
// ---------------------------------------------------------------------------

class Author {
  @Seed(() => faker.person.fullName())
  name!: string;

  @Seed({ count: 1 })
  books!: Book[];
}

class Book {
  @Seed(() => faker.lorem.words(4))
  title!: string;

  @Seed()
  author!: Author;
}

const cycleAdapter: MetadataAdapter = {
  getEmbeddeds: () => [],
  getRelations: (hierarchy) => {
    if (hierarchy.some((c) => c === Author)) {
      return [{ propertyName: 'books', getClass: () => Book, isArray: true }];
    }
    if (hierarchy.some((c) => c === Book)) {
      return [{ propertyName: 'author', getClass: () => Author, isArray: false }];
    }
    return [];
  },
};

describe('create — cycle protection', () => {
  it('cuts the cycle at the ancestor boundary', async () => {
    const author = await create(Author, undefined, cycleAdapter);

    expect(Array.isArray(author.books)).toBe(true);
    expect(author.books[0]).toBeInstanceOf(Book);
    expect(author.books[0]!.author).toBeUndefined();
  });

  it('standalone creation does not cut non-cyclic paths', async () => {
    const book = await create(Book, undefined, cycleAdapter);

    expect(book.author).toBeInstanceOf(Author);
    expect(typeof book.author.name).toBe('string');
    expect(book.author.books).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// relations: false
// ---------------------------------------------------------------------------

describe('create — relations: false', () => {
  it('skips relation properties when relations is false', async () => {
    const author = await create(Author, { relations: false }, cycleAdapter);
    expect(author.books).toBeUndefined();
  });

  it('still seeds scalar properties when relations is false', async () => {
    const author = await create(Author, { relations: false }, cycleAdapter);
    expect(typeof author.name).toBe('string');
  });
});
