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
        'llms/azure-openai',
        'llms/groq',
        'llms/deepseek',
        'llms/openrouter',
        'llms/together',
        'llms/fireworks',
        'llms/perplexity',
        'llms/cerebras',
        'llms/caching-retries',
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
        'agents/mcp',
      ],
    },
    {
      type: 'category',
      label: 'Multi-Agent',
      items: [
        'multi-agent/overview',
        'multi-agent/a2a',
      ],
    },
    {
      type: 'category',
      label: 'Evaluation',
      items: ['evaluation/overview'],
    },
    {
      type: 'category',
      label: 'Guardrails',
      items: ['guardrails/overview'],
    },
    {
      type: 'category',
      label: 'Observability',
      items: ['observability/overview'],
    },
    {
      type: 'category',
      label: 'Multimodal',
      items: ['multimodal/overview'],
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
        'graph/cycles',
        'graph/checkpointing',
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
    'faq',
    'changelog',
    'roadmap',
  ],
};

export default sidebars;
