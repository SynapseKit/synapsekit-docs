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
    // Google Search Console verification — docs property
    {
      tagName: 'meta',
      attributes: { name: 'google-site-verification', content: 'HVS4Mx40XNoVDW9HMBUFlnZHlosMQD5ypP3TfLDpNtw' },
    },
    // Google Search Console verification — synapse-kit.com property
    {
      tagName: 'meta',
      attributes: { name: 'google-site-verification', content: 'rfOuzYkjAnTjrKutZc_XBacKwHSuCUBAvymUdcvtdwc' },
    },
    // Canonical base
    { tagName: 'link', attributes: { rel: 'canonical', href: 'https://synapsekit.github.io/synapsekit-docs/' } },
    // Description
    {
      tagName: 'meta',
      attributes: {
        name: 'description',
        content: 'Official documentation for SynapseKit — async-native Python LLM framework. RAG pipelines, ReAct agents, graph workflows, 33 LLM providers, 53 loaders, 11 vector stores. Apache 2.0.',
      },
    },
    // Keywords
    {
      tagName: 'meta',
      attributes: {
        name: 'keywords',
        content: 'synapsekit docs, python llm framework, rag pipeline python, llm agents python, langchain alternative, async llm python, graph workflow llm, vector store python, llm orchestration, retrieval augmented generation, open source llm framework, llm evaluation python',
      },
    },
    // Author
    { tagName: 'meta', attributes: { name: 'author', content: 'SynapseKit Contributors' } },
    // OpenGraph
    { tagName: 'meta', attributes: { property: 'og:type', content: 'website' } },
    { tagName: 'meta', attributes: { property: 'og:site_name', content: 'SynapseKit Docs' } },
    { tagName: 'meta', attributes: { property: 'og:title', content: 'SynapseKit — Python LLM Framework Documentation' } },
    {
      tagName: 'meta',
      attributes: {
        property: 'og:description',
        content: 'Official docs for SynapseKit. RAG pipelines, agents, graph workflows. 33 providers. 2 dependencies. Open source.',
      },
    },
    { tagName: 'meta', attributes: { property: 'og:url', content: 'https://synapsekit.github.io/synapsekit-docs/' } },
    { tagName: 'meta', attributes: { property: 'og:image', content: 'https://synapsekit.github.io/synapsekit-docs/img/banner.svg' } },
    { tagName: 'meta', attributes: { property: 'og:image:width', content: '1200' } },
    { tagName: 'meta', attributes: { property: 'og:image:height', content: '630' } },
    { tagName: 'meta', attributes: { property: 'og:locale', content: 'en_US' } },
    // Twitter
    { tagName: 'meta', attributes: { name: 'twitter:card', content: 'summary_large_image' } },
    { tagName: 'meta', attributes: { name: 'twitter:site', content: '@synapsekitai' } },
    { tagName: 'meta', attributes: { name: 'twitter:creator', content: '@synapsekitai' } },
    { tagName: 'meta', attributes: { name: 'twitter:title', content: 'SynapseKit — Python LLM Framework Documentation' } },
    {
      tagName: 'meta',
      attributes: {
        name: 'twitter:description',
        content: 'Official docs for SynapseKit. RAG pipelines, agents, graph workflows. 33 providers. 2 dependencies. Open source.',
      },
    },
    { tagName: 'meta', attributes: { name: 'twitter:image', content: 'https://synapsekit.github.io/synapsekit-docs/img/banner.svg' } },
    // Robots
    { tagName: 'meta', attributes: { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' } },
    // JSON-LD: TechArticle/Documentation site
    {
      tagName: 'script',
      attributes: { type: 'application/ld+json' },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'SynapseKit Documentation',
        url: 'https://synapsekit.github.io/synapsekit-docs/',
        description: 'Official documentation for SynapseKit — async-native Python LLM framework.',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://synapsekit.github.io/synapsekit-docs/search?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      }),
    },
    {
      tagName: 'script',
      attributes: { type: 'application/ld+json' },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'SynapseKit',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Linux, macOS, Windows',
        programmingLanguage: 'Python',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        license: 'https://opensource.org/licenses/Apache-2.0',
        url: 'https://synapse-kit.com',
        downloadUrl: 'https://pypi.org/project/synapsekit/',
        softwareVersion: '1.9.1',
        description: 'Async-native Python framework for RAG pipelines, ReAct agents, and graph workflows. 2 dependencies. 33 LLM providers. No lock-in.',
        featureList: ['RAG Pipelines', 'ReAct Agents', 'Graph Workflows', 'AgentFederation', '53 Document Loaders', '33 LLM Providers', '11 Vector Stores', '47+ Built-in Tools', 'Async-native', 'EvalCI GitHub Action'],
        releaseNotes: 'https://github.com/SynapseKit/SynapseKit/blob/main/CHANGELOG.md',
        author: { '@type': 'Organization', name: 'SynapseKit Contributors', url: 'https://github.com/SynapseKit' },
        sameAs: ['https://github.com/SynapseKit/SynapseKit', 'https://pypi.org/project/synapsekit/'],
      }),
    },
    {
      tagName: 'script',
      attributes: { type: 'application/ld+json' },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'SynapseKit',
        url: 'https://synapse-kit.com',
        logo: 'https://synapse-kit.com/logo.svg',
        sameAs: [
          'https://github.com/SynapseKit/SynapseKit',
          'https://pypi.org/project/synapsekit/',
          'https://discord.gg/PSuAXHRywJ',
          'https://www.linkedin.com/company/synapsekitai/',
        ],
      }),
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
        sitemap: {
          changefreq: 'weekly',
          priority: 0.8,
          ignorePatterns: ['/tags/**'],
        },
        gtag: {
          trackingID: 'G-NYPGFHGHKN',
          anonymizeIP: false,
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
      id: 'v200',
      content: '🚀 <strong>v2.0.0 released</strong> — Verifiable Agents, Living Memory, property graph RAG, personal knowledge mesh, plus 42 audited security, reliability, and performance fixes. <a href="/synapsekit-docs/docs/changelog">Changelog →</a>',
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
          value: '<span class="navbar__version">v2.0.0</span>',
        },
        {
          href: 'https://discord.gg/PSuAXHRywJ',
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
