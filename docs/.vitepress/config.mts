import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'seeders',
  description: 'Decorator-based entity seeding for TypeORM and MikroORM',
  base: '/seeders/',

  themeConfig: {
    nav: [
      {
        text: 'TypeORM',
        items: [
          { text: 'Guide', link: '/guide/' },
          { text: 'NestJS', link: '/nest/' },
        ],
      },
      {
        text: 'MikroORM',
        items: [
          { text: 'Guide', link: '/mikroorm/' },
          { text: 'NestJS', link: '/nest-mikroorm/' },
        ],
      },
      {
        text: 'Core',
        items: [
          { text: 'Overview', link: '/seeder/' },
        ],
      },
      {
        text: 'API reference',
        items: [
          { text: 'seeder', link: '/api/seeder/' },
          { text: 'typeorm-seeder', link: '/api/typeorm-seeder/' },
          { text: 'nest-typeorm-seeder', link: '/api/nest-typeorm-seeder/' },
          { text: 'mikroorm-seeder', link: '/api/mikroorm-seeder/' },
          { text: 'nest-mikroorm-seeder', link: '/api/nest-mikroorm-seeder/' },
        ],
      },
    ],

    sidebar: {
      '/seeder/': [
        {
          text: 'seeder',
          items: [
            { text: 'Overview', link: '/seeder/' },
          ],
        },
      ],
      '/guide/': [
        {
          text: 'typeorm-seeder',
          items: [
            { text: 'Getting started', link: '/guide/' },
            { text: 'Decorating entities', link: '/guide/decorating-entities' },
            { text: 'Seeding entities', link: '/guide/seeding-entities' },
            { text: 'Tree entities', link: '/guide/tree-entities' },
            { text: 'Seeder suites', link: '/guide/seeder-suites' },
            { text: 'Running scripts', link: '/guide/running-scripts' },
            { text: 'Logging', link: '/guide/logging' },
            { text: 'Hooks', link: '/guide/hooks' },
            { text: 'CLI', link: '/guide/cli' },
          ],
        },
      ],
      '/nest/': [
        {
          text: 'nest-typeorm-seeder',
          items: [
            { text: 'Getting started', link: '/nest/' },
            { text: 'Feature modules', link: '/nest/feature-modules' },
            { text: 'Run once', link: '/nest/run-once' },
            { text: 'Seed scripts', link: '/nest/seed-scripts' },
          ],
        },
      ],
      '/mikroorm/': [
        {
          text: 'mikroorm-seeder',
          items: [
            { text: 'Getting started', link: '/mikroorm/' },
            { text: 'Decorating entities', link: '/mikroorm/decorating-entities' },
            { text: 'Seeding entities', link: '/mikroorm/seeding-entities' },
            { text: 'Seeder suites', link: '/mikroorm/seeder-suites' },
            { text: 'Running scripts', link: '/mikroorm/running-scripts' },
            { text: 'Logging', link: '/mikroorm/logging' },
            { text: 'Hooks', link: '/mikroorm/hooks' },
            { text: 'CLI', link: '/mikroorm/cli' },
          ],
        },
      ],
      '/nest-mikroorm/': [
        {
          text: 'nest-mikroorm-seeder',
          items: [
            { text: 'Getting started', link: '/nest-mikroorm/' },
            { text: 'Feature modules', link: '/nest-mikroorm/feature-modules' },
            { text: 'Run once', link: '/nest-mikroorm/run-once' },
            { text: 'Seed scripts', link: '/nest-mikroorm/seed-scripts' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/joakimbugge/seeders' }],

    search: { provider: 'local' },

    editLink: {
      pattern: 'https://github.com/joakimbugge/seeders/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
    },
  },
})
