import { faker } from '@faker-js/faker';
import { Seed, createMany } from '../../../src';
import type { MetadataAdapter } from '../../../src';

const noOpAdapter: MetadataAdapter = {
  getEmbeddeds: () => [],
  getRelations: () => [],
};

class Widget {
  @Seed(() => faker.commerce.productName())
  name!: string;

  @Seed((_, __, i) => i)
  index!: number;
}

describe('createMany', () => {
  it('returns the requested number of instances', async () => {
    const widgets = await createMany(Widget, { count: 5 }, noOpAdapter);
    expect(widgets).toHaveLength(5);
  });

  it('each instance is of the correct class', async () => {
    const widgets = await createMany(Widget, { count: 3 }, noOpAdapter);
    widgets.forEach((w) => expect(w).toBeInstanceOf(Widget));
  });

  it('passes a zero-based index to factories', async () => {
    const widgets = await createMany(Widget, { count: 3 }, noOpAdapter);
    expect(widgets.map((w) => w.index)).toEqual([0, 1, 2]);
  });

  it('applies values overrides to every instance', async () => {
    const widgets = await createMany(Widget, { count: 3, values: { name: 'Fixed' } }, noOpAdapter);
    widgets.forEach((w) => expect(w.name).toBe('Fixed'));
  });

  it('applies factory values overrides with correct per-instance index', async () => {
    const widgets = await createMany(
      Widget,
      { count: 3, values: { name: (_, __, i) => `widget-${i}` } },
      noOpAdapter,
    );
    expect(widgets.map((w) => w.name)).toEqual(['widget-0', 'widget-1', 'widget-2']);
  });

  it('array (multi-class) form creates count instances per class', async () => {
    class Tag {
      @Seed(() => faker.lorem.word())
      label!: string;
    }

    const [widgets, tags] = await createMany([Widget, Tag], { count: 2 }, noOpAdapter);
    expect(widgets).toHaveLength(2);
    expect(tags).toHaveLength(2);
  });
});
