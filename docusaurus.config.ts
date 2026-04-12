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
        content: 'HVS4Mx40XNoVDW9HMBUFlnZHlosMQD5ypP3TfLDpNtw',
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
          editUrl: 'https://github.com/SynapseKit/synapsekit-docs/edit/main/',
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
      id: 'v153',
      content: '🎉 <strong>v1.5.3 released</strong> — TeamsLoader, CodeInterpreterTool, Windows ShellTool fix. <a href="/synapsekit-docs/docs/changelog">Changelog →</a> &nbsp;|&nbsp; 🚀 <strong>EvalCI</strong> — LLM quality gates on every PR, zero infra. <a href="/synapsekit-docs/docs/evalci/overview">Get started →</a>',
      backgroundColor: '#0d1117',
      textColor: '#e6edf3',
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
        { to: '/docs/guides', label: 'Guides', position: 'left' },
        { to: '/blog', label: 'Blog', position: 'left' },
        {
          to: '/docs/evalci/overview',
          label: 'EvalCI',
          position: 'left',
        },
        {
          type: 'html',
          position: 'left',
          value: '<span class="navbar__version">v1.5.3</span>',
        },
        {
          href: 'https://discord.gg/unn4cXXH',
          position: 'right',
          className: 'navbar__discord',
          'aria-label': 'Discord',
          label: 'Discord',
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
            {label: 'Guides', to: '/docs/guides'},
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
            {label: 'Changelog', href: 'https://github.com/SynapseKit/SynapseKit/blob/main/CHANGELOG.md'},
          ],
        },
        {
          title: 'EvalCI',
          items: [
            {label: 'Overview', to: '/docs/evalci/overview'},
            {label: 'Quickstart', to: '/docs/evalci/quickstart'},
            {label: 'Action Reference', to: '/docs/evalci/action-reference'},
            {label: 'Examples', to: '/docs/evalci/examples'},
            {label: 'GitHub', href: 'https://github.com/SynapseKit/evalci'},
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
      copyright: `Copyright © ${new Date().getFullYear()} SynapseKit. Released under the Apache 2.0 License.`,
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
