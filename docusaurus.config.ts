import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'SynapseKit — Python LLM Framework',
  tagline: 'Async-first Python framework for building production-grade LLM applications with RAG, agents, and graph workflows.',
  favicon: 'img/favicon.svg',

  future: { v4: true },

  url: 'https://synapsekit.github.io',
  baseUrl: '/synapsekit-docs/',

  organizationName: 'SynapseKit',
  projectName: 'synapsekit-docs',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  headTags: [
    {
      tagName: 'meta',
      attributes: {
        name: 'google-site-verification',
        content: 'rfOuzYkjAnTjrKutZc_XBacKwHSuCUBAvymUdcvtdwc',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'description',
        content: 'SynapseKit is an async-native Python framework for building production-grade LLM applications. RAG pipelines, AI agents, graph workflows, 15 LLM providers, 29 tools. 2 dependencies. pip install synapsekit.',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        property: 'og:title',
        content: 'SynapseKit — Python LLM Framework',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        property: 'og:description',
        content: 'Async-first Python framework for building production-grade LLM apps. RAG, agents, graph workflows. pip install synapsekit.',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        property: 'og:image',
        content: 'https://synapsekit.github.io/synapsekit-docs/img/banner.svg',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'twitter:image',
        content: 'https://synapsekit.github.io/synapsekit-docs/img/banner.svg',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        property: 'og:type',
        content: 'website',
      },
    },
  ],

  plugins: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      { hashed: true, language: ['en'], docsRouteBasePath: '/docs' },
    ],
  ],

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
        blog: {
          showReadingTime: true,
          blogTitle: 'SynapseKit Blog',
          blogDescription: 'Tutorials, release notes, and AI engineering insights from the SynapseKit team.',
          postsPerPage: 10,
          feedOptions: { type: ['rss', 'atom'] },
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    metadata: [
      {name: 'keywords', content: 'synapsekit, python llm framework, rag framework, ai agents python, langchain alternative, async llm, graph workflows, openai, anthropic, pip install synapsekit'},
      {name: 'twitter:card', content: 'summary_large_image'},
    ],
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    announcementBar: {
      id: 'v110',
      content: '🎉 SynapseKit v1.1.0 — GraphRAG, Redis Memory, Vertex AI, MarkdownSplitter, Graph Visualization. <a href="/synapsekit-docs/docs/changelog">See what\'s new →</a>',
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
        { to: '/blog', label: 'Blog', position: 'left' },
        {
          type: 'html',
          position: 'left',
          value: '<span class="navbar__version">v1.1.0</span>',
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
            {label: 'FAQ', to: '/docs/faq'},
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
      theme: prismThemes.oneLight,
      darkTheme: prismThemes.oneDark,
      additionalLanguages: ['python', 'bash', 'toml', 'json', 'yaml', 'typescript', 'jsx', 'tsx', 'sql', 'docker'],
    },
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
