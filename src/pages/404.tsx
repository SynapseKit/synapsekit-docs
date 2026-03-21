import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

export default function NotFound(): ReactNode {
  return (
    <Layout title="Page Not Found">
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '2rem',
        gap: '1.5rem',
      }}>
        <div style={{ fontSize: '4rem' }}>🔌</div>
        <h1 style={{ fontSize: '2.5rem', margin: 0 }}>404 — Page not found</h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--ifm-color-secondary-darkest)', maxWidth: 480 }}>
          Looks like this circuit is disconnected. The page you're looking for doesn't exist or has been moved.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link className="button button--primary button--lg" to="/docs/intro">
            Back to docs
          </Link>
          <Link className="button button--secondary button--lg" to="/">
            Home
          </Link>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--ifm-color-secondary)' }}>
          Looking for something specific?{' '}
          <Link to="/docs/getting-started/quickstart">Quickstart</Link>,{' '}
          <Link to="/docs/rag/pipeline">RAG</Link>,{' '}
          <Link to="/docs/agents/overview">Agents</Link>,{' '}
          <Link to="/docs/graph/overview">Graph</Link>
        </p>
      </div>
    </Layout>
  );
}
