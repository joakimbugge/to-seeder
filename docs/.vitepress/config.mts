import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'typeorm-seeder',
  description: 'Decorator-based entity seeding for TypeORM',
  base: '/to-seeder/',

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'NestJS', link: '/nest/' },
      {
        text: 'API reference',
        items: [
          { text: 'typeorm-seeder', link: '/api/typeorm-seeder/' },
          { text: 'nest-typeorm-seeder', link: '/api/nest-typeorm-seeder/' },
        ],
      },
    ],

    sidebar: {
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
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/joakimbugge/to-seeder' }],

    search: { provider: 'local' },

    editLink: {
      pattern: 'https://github.com/joakimbugge/to-seeder/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
    },
  },
})
