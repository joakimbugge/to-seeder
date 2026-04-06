import { faker } from '@faker-js/faker';
import { Seed, saveMany } from '../../../src';
import type { MetadataAdapter, PersistenceAdapter, SeedContext } from '../../../src';

const noOpAdapter: MetadataAdapter = {
  getEmbeddeds: () => [],
  getRelations: () => [],
};

interface TestContext extends SeedContext {
  connection: string;
}

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

class Widget {
  @Seed(() => faker.commerce.productName())
  name!: string;

  @Seed((_, __, i) => i)
  index!: number;
}

describe('saveMany — single-class form', () => {
  it('returns the requested number of instances', async () => {
    const mock = makeMockAdapter();
    const widgets = await saveMany(Widget, { ...ctx, count: 5 }, noOpAdapter, mock);

    expect(widgets).toHaveLength(5);
  });

  it('each instance is of the correct class', async () => {
    const mock = makeMockAdapter();
    const widgets = await saveMany(Widget, { ...ctx, count: 3 }, noOpAdapter, mock);

    widgets.forEach((w) => expect(w).toBeInstanceOf(Widget));
  });

  it('delegates all entities in a single adapter call', async () => {
    const mock = makeMockAdapter();
    await saveMany(Widget, { ...ctx, count: 4 }, noOpAdapter, mock);

    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]!.entities).toHaveLength(4);
  });

  it('passes the correct EntityClass to the persistence adapter', async () => {
    const mock = makeMockAdapter();
    await saveMany(Widget, { ...ctx, count: 2 }, noOpAdapter, mock);

    expect(mock.calls[0]!.EntityClass).toBe(Widget);
  });

  it('returns an empty array when count is 0', async () => {
    const mock = makeMockAdapter();
    const result = await saveMany(Widget, { ...ctx, count: 0 }, noOpAdapter, mock);

    expect(result).toEqual([]);
    expect(mock.calls).toHaveLength(0);
  });

  it('passes zero-based indices to factories', async () => {
    const mock = makeMockAdapter();
    const widgets = await saveMany(Widget, { ...ctx, count: 3 }, noOpAdapter, mock);

    expect(widgets.map((w) => w.index)).toEqual([0, 1, 2]);
  });

  it('applies values overrides to every instance', async () => {
    const mock = makeMockAdapter();
    const widgets = await saveMany(
      Widget,
      { ...ctx, count: 3, values: { name: 'Fixed' } },
      noOpAdapter,
      mock,
    );

    widgets.forEach((w) => expect(w.name).toBe('Fixed'));
  });

  it('applies factory values with correct per-instance index', async () => {
    const mock = makeMockAdapter();
    const widgets = await saveMany(
      Widget,
      { ...ctx, count: 3, values: { name: (_, __, i) => `widget-${i}` } },
      noOpAdapter,
      mock,
    );

    expect(widgets.map((w) => w.name)).toEqual(['widget-0', 'widget-1', 'widget-2']);
  });

  it('passes the full context to the persistence adapter', async () => {
    const mock = makeMockAdapter();
    await saveMany(Widget, { ...ctx, count: 1 }, noOpAdapter, mock);

    expect(mock.calls[0]!.context.connection).toBe('test-db');
  });
});

// ---------------------------------------------------------------------------
// Array (multi-class) form
// ---------------------------------------------------------------------------

class Category {
  @Seed(() => faker.commerce.department())
  name!: string;
}

describe('saveMany — array (multi-class) form', () => {
  it('returns count instances per class', async () => {
    const mock = makeMockAdapter();
    const [widgets, categories] = await saveMany(
      [Widget, Category],
      { ...ctx, count: 3 },
      noOpAdapter,
      mock,
    );

    expect(widgets).toHaveLength(3);
    expect(categories).toHaveLength(3);
  });

  it('calls the persistence adapter once per class', async () => {
    const mock = makeMockAdapter();
    await saveMany([Widget, Category], { ...ctx, count: 2 }, noOpAdapter, mock);

    expect(mock.calls).toHaveLength(2);
  });

  it('defaults to relations: false for the array form', async () => {
    const mock = makeMockAdapter();
    await saveMany([Widget], { ...ctx, count: 1 }, noOpAdapter, mock);

    expect(mock.calls[0]!.context.relations).toBe(false);
  });
});
