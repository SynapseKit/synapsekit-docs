import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import styles from './index.module.css';

const FEATURES = [
  {
    icon: '⚡',
    title: 'Async-native',
    desc: 'Every API is async/await first. No sync-first retrofit. Sync wrappers included for scripts and notebooks.',
  },
  {
    icon: '🌊',
    title: 'Streaming-first',
    desc: 'Token-level streaming is the default, not an afterthought. Works identically across all 16 LLM providers.',
  },
  {
    icon: '🪶',
    title: '2 hard dependencies',
    desc: 'numpy and rank-bm25 only. Every other capability is behind an optional extra. Install what you need.',
  },
  {
    icon: '🔌',
    title: 'One interface',
    desc: '16 LLM providers and 5 vector stores behind the same API. Swap providers without rewriting a single line.',
  },
  {
    icon: '💰',
    title: 'Cost intelligence',
    desc: 'CostTracker and BudgetGuard give you full cost visibility and circuit-breaker budget limits — no SaaS required.',
  },
  {
    icon: '🚀',
    title: 'One-command deploy',
    desc: '`synapsekit serve my_app:rag` wraps any RAG pipeline, agent, or graph in a production FastAPI app instantly.',
  },
  {
    icon: '🧩',
    title: 'Fully composable',
    desc: 'RAG pipelines, agents, and graph nodes are interchangeable. Wrap anything as anything.',
  },
  {
    icon: '🔍',
    title: 'No magic',
    desc: 'No hidden chains, no callbacks, no global state. Every step is plain Python you can read and override.',
  },
];

const NAV_CARDS = [
  {
    icon: '🗂',
    title: 'RAG Pipelines',
    desc: 'Retrieval-augmented generation with streaming, BM25 reranking, conversation memory, and token tracing.',
    href: '/docs/rag/pipeline',
  },
  {
    icon: '🤖',
    title: 'Agents',
    desc: 'ReAct loop for any LLM. Native function calling for OpenAI, Anthropic, Gemini, and Mistral. 32 built-in tools, fully extensible.',
    href: '/docs/agents/overview',
  },
  {
    icon: '🔀',
    title: 'Graph Workflows',
    desc: 'DAG-based async pipelines. Parallel execution, conditional routing, typed state, fan-out/fan-in, SSE streaming, event callbacks, human-in-the-loop.',
    href: '/docs/graph/overview',
  },
  {
    icon: '🧠',
    title: 'LLM Providers',
    desc: 'OpenAI, Anthropic, Ollama, Gemini, Cohere, Mistral, Bedrock, Azure, Groq, DeepSeek, OpenRouter, Together, Fireworks and more — all behind one interface.',
    href: '/docs/llms/overview',
  },
  {
    icon: '🚀',
    title: 'CLI & Deployment',
    desc: '`synapsekit serve` deploys any pipeline in one command. `synapsekit test` runs eval cases with scoring thresholds in CI.',
    href: '/docs/getting-started/quickstart',
  },
  {
    icon: '📊',
    title: 'Observability',
    desc: 'CostTracker, BudgetGuard, TokenTracer, OpenTelemetry export, and DistributedTracer — full visibility without a SaaS subscription.',
    href: '/docs/observability/overview',
  },
  {
    icon: '🗄',
    title: 'Vector Stores',
    desc: 'InMemory, ChromaDB, FAISS, Qdrant, Pinecone. One interface for all backends. Swap without rewriting.',
    href: '/docs/rag/vector-stores',
  },
  {
    icon: '📖',
    title: 'API Reference',
    desc: 'Complete reference for every public class and method in SynapseKit.',
    href: '/docs/api/llm',
  },
];

const STATS = [
  '16 LLM Providers',
  '32 Built-in Tools',
  '20 Retrieval Strategies',
  '1,133 Tests Passing',
  'Apache 2.0',
];

export default function Home(): ReactNode {
  const bannerUrl = useBaseUrl('img/banner.svg');

  return (
    <Layout
      title="SynapseKit — Async-first Python framework for LLM applications"
      description="Build RAG pipelines, agents, and graph workflows in Python. Async-native, streaming-first, 2 core dependencies."
    >
      <div className={styles.page}>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="sk-hero">
          <div className="container">
            <img className="banner" src={bannerUrl} alt="SynapseKit" />
            <p className="tagline">
              Build RAG pipelines, agents, and graph workflows in Python.<br />
              Async-native · Streaming-first · 2 core dependencies.
            </p>
            <div className="ctas">
              <Link className="btn-primary" to="/docs/getting-started/quickstart">
                Get started →
              </Link>
              <Link className="btn-secondary" to="/docs/intro">
                What is SynapseKit?
              </Link>
              <a className="btn-secondary" href="https://github.com/SynapseKit/SynapseKit" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </div>
            <div>
              <div className="sk-install">
                <span className="prompt">$</span>
                <span>pip install synapsekit[openai]</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────── */}
        <section className="sk-features">
          <div className="container">
            <p className="sk-section-label">Why SynapseKit</p>
            <h2 className="sk-section-title">Built for production Python</h2>
            <p className="sk-section-subtitle">
              Designed for engineers who want full control without writing everything from scratch.
            </p>
            <div className="sk-features-grid">
              {FEATURES.map(f => (
                <div key={f.title} className="sk-feature-card">
                  <span className="sk-feature-icon">{f.icon}</span>
                  <div className="sk-feature-title">{f.title}</div>
                  <p className="sk-feature-desc">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats bar ─────────────────────────────────────────────────── */}
        <section className="sk-stats-bar">
          <div className="container">
            <div className="sk-stats-list">
              {STATS.map((stat, i) => (
                <span key={stat} className="sk-stat-item">
                  {stat}
                  {i < STATS.length - 1 && <span className="sk-stat-sep"> · </span>}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Navigation cards ─────────────────────────────────────────── */}
        <section className="sk-nav-cards">
          <div className="container">
            <p className="sk-section-label">Explore the docs</p>
            <h2 className="sk-section-title">Everything you need</h2>
            <p className="sk-section-subtitle">
              From a 3-line quickstart to production graph workflows.
            </p>
            <div className="sk-nav-grid">
              {NAV_CARDS.map(c => (
                <Link key={c.title} className="sk-nav-card" to={c.href}>
                  <div className="sk-nav-card-header">
                    <span className="sk-nav-card-icon">{c.icon}</span>
                    <span className="sk-nav-card-title">{c.title}</span>
                  </div>
                  <p className="sk-nav-card-desc">{c.desc}</p>
                  <span className="sk-nav-card-arrow">Read docs →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

      </div>
    </Layout>
  );
}
