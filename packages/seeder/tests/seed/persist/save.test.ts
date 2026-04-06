import { faker } from '@faker-js/faker';
import { Seed, save } from '../../../src';
import type { MetadataAdapter, PersistenceAdapter, SeedContext } from '../../../src';

const noOpAdapter: MetadataAdapter = {
  getEmbeddeds: () => [],
  getRelations: () => [],
};

interface TestContext extends SeedContext {
  connection: string;
}

/** Persistence adapter that captures what it receives and returns entities unchanged. */
function makeMockAdapter(): PersistenceAdapter<TestContext> & {
  calls: Array<{ EntityClass: Function; entities: object[]; context: TestContext }>;
} {
  const calls: Array<{ EntityClass: Function; entities: object[]; context: TestContext }> = [];

  return {
    calls,
    async save(EntityClass, entities, context) {
      calls.push({ EntityClass, entities: [...entities], context });
      return entities;
    },
  };
}

const ctx: TestContext = { connection: 'test-db' };

// ---------------------------------------------------------------------------
// Single-class form
// ---------------------------------------------------------------------------

class Article {
  @Seed(() => faker.lorem.words(3))
  title!: string;

  @Seed(() => faker.number.int({ min: 1, max: 100 }))
  views!: number;
}

describe('save — single-class form', () => {
  it('returns a single instance', async () => {
    const mock = makeMockAdapter();
    const article = await save(Article, ctx, noOpAdapter, mock);

    expect(article).toBeInstanceOf(Article);
  });

  it('seeds properties via @Seed decorators', async () => {
    const mock = makeMockAdapter();
    const article = await save(Article, ctx, noOpAdapter, mock);

    expect(typeof article.title).toBe('string');
    expect(article.title.length).toBeGreaterThan(0);
  });

  it('delegates exactly one entity to the persistence adapter', async () => {
    const mock = makeMockAdapter();
    await save(Article, ctx, noOpAdapter, mock);

    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]!.entities).toHaveLength(1);
  });

  it('passes the correct EntityClass to the persistence adapter', async () => {
    const mock = makeMockAdapter();
    await save(Article, ctx, noOpAdapter, mock);

    expect(mock.calls[0]!.EntityClass).toBe(Article);
  });

  it('passes the full context to the persistence adapter', async () => {
    const mock = makeMockAdapter();
    await save(Article, ctx, noOpAdapter, mock);

    expect(mock.calls[0]!.context.connection).toBe('test-db');
  });

  it('applies values overrides before persisting', async () => {
    const mock = makeMockAdapter();
    const article = await save(Article, { ...ctx, values: { title: 'Fixed' } }, noOpAdapter, mock);

    expect(article.title).toBe('Fixed');
    expect((mock.calls[0]!.entities[0] as Article).title).toBe('Fixed');
  });
});

// ---------------------------------------------------------------------------
// Array (multi-class) form
// ---------------------------------------------------------------------------

class Tag {
  @Seed(() => faker.lorem.word())
  label!: string;
}

describe('save — array (multi-class) form', () => {
  it('returns one instance per class', async () => {
    const mock = makeMockAdapter();
    const [article, tag] = await save([Article, Tag], ctx, noOpAdapter, mock);

    expect(article).toBeInstanceOf(Article);
    expect(tag).toBeInstanceOf(Tag);
  });

  it('calls the persistence adapter once per class', async () => {
    const mock = makeMockAdapter();
    await save([Article, Tag], ctx, noOpAdapter, mock);

    expect(mock.calls).toHaveLength(2);
  });

  it('defaults to relations: false for the array form', async () => {
    const mock = makeMockAdapter();
    await save([Article], ctx, noOpAdapter, mock);

    expect(mock.calls[0]!.context.relations).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Context pass-through
// ---------------------------------------------------------------------------

describe('save — context pass-through', () => {
  it('passes custom context fields to factory callbacks', async () => {
    let received: unknown;

    class Probe {
      @Seed((ctx) => {
        received = ctx;
        return 'value';
      })
      field!: string;
    }

    const mock = makeMockAdapter();
    const customCtx: TestContext = { connection: 'special', relations: true };
    await save(Probe, customCtx, noOpAdapter, mock);

    expect((received as TestContext).connection).toBe('special');
  });
});
