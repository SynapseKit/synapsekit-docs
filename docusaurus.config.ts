import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'SynapseKit',
  tagline: 'Async-first Python framework for building LLM applications.',
  favicon: 'img/favicon.svg',

  future: { v4: true },

  url: 'https://synapsekit.github.io',
  baseUrl: '/synapsekit-docs/',

  organizationName: 'SynapseKit',
  projectName: 'synapsekit-docs',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/SynapseKit/synapsekit-docs/tree/main/',
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    metadata: [
      {name: 'keywords', content: 'rag, llm, agents, python, async, streaming, openai, anthropic'},
      {name: 'twitter:card', content: 'summary_large_image'},
    ],
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    announcementBar: {
      id: 'v040',
      content: '🎉 SynapseKit v0.4.0 — Graph Workflows with parallel execution are here. <a href="/synapsekit-docs/docs/graph/overview">Read the docs →</a>',
      backgroundColor: '#161b22',
      textColor: '#8b949e',
      isCloseable: true,
    },
    navbar: {
      hideOnScroll: true,
      logo: {
        alt: 'SynapseKit',
        src: 'img/logo.svg',
      },
      title: 'SynapseKit',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/roadmap',
          label: 'Roadmap',
          position: 'left',
        },
        {
          type: 'html',
          position: 'left',
          value: '<span class="navbar__version">v0.4.0</span>',
        },
        {
          href: 'https://github.com/SynapseKit/SynapseKit',
          position: 'right',
          className: 'navbar__github',
          'aria-label': 'GitHub',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Getting Started',
          items: [
            {label: 'Installation', to: '/docs/getting-started/installation'},
            {label: 'Quickstart', to: '/docs/getting-started/quickstart'},
            {label: 'Introduction', to: '/docs/intro'},
          ],
        },
        {
          title: 'Core',
          items: [
            {label: 'RAG Pipelines', to: '/docs/rag/pipeline'},
            {label: 'Agents', to: '/docs/agents/overview'},
            {label: 'Graph Workflows', to: '/docs/graph/overview'},
            {label: 'LLM Providers', to: '/docs/llms/overview'},
          ],
        },
        {
          title: 'Reference',
          items: [
            {label: 'API Reference', to: '/docs/api/llm'},
            {label: 'Roadmap', to: '/docs/roadmap'},
            {label: 'Changelog', href: 'https://github.com/SynapseKit/SynapseKit/blob/main/CHANGELOG.md'},
          ],
        },
        {
          title: 'Community',
          items: [
            {label: 'GitHub', href: 'https://github.com/SynapseKit/SynapseKit'},
            {label: 'Discussions', href: 'https://github.com/SynapseKit/SynapseKit/discussions'},
            {label: 'Issues', href: 'https://github.com/SynapseKit/SynapseKit/issues'},
            {label: 'Contributing', href: 'https://github.com/SynapseKit/SynapseKit/blob/main/CONTRIBUTING.md'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} SynapseKit. Released under the MIT License.`,
    },
    prism: {
      theme: prismThemes.oneDark,
      darkTheme: prismThemes.oneDark,
      additionalLanguages: ['python', 'bash', 'toml'],
    },
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
