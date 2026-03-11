import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: ['getting-started/installation', 'getting-started/quickstart'],
    },
    {
      type: 'category',
      label: 'RAG',
      items: [
        'rag/pipeline',
        'rag/loaders',
        'rag/splitter',
        'rag/retriever',
        'rag/vector-stores',
        'rag/parsers',
        'rag/prompts',
      ],
    },
    {
      type: 'category',
      label: 'LLMs',
      items: [
        'llms/overview',
        'llms/openai',
        'llms/anthropic',
        'llms/ollama',
        'llms/cohere',
        'llms/mistral',
        'llms/gemini',
        'llms/bedrock',
      ],
    },
    {
      type: 'category',
      label: 'Agents',
      items: [
        'agents/overview',
        'agents/react',
        'agents/function-calling',
        'agents/tools',
        'agents/executor',
      ],
    },
    {
      type: 'category',
      label: 'Graph Workflows',
      items: [
        'graph/overview',
        'graph/state-graph',
        'graph/nodes',
        'graph/edges',
        'graph/compiled-graph',
        'graph/mermaid',
      ],
    },
    {
      type: 'category',
      label: 'Memory & Tracing',
      items: ['memory/conversation', 'memory/token-tracer'],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: ['api/llm', 'api/vector-store', 'api/retriever'],
    },
    'roadmap',
  ],
};

export default sidebars;
