import React from 'react';

interface ColabBadgeProps {
  /** Path relative to notebooks/ root, e.g. "rag/pdf-knowledge-base.ipynb" */
  path: string;
}

const REPO = 'SynapseKit/synapsekit-docs';
const BRANCH = 'main';

export default function ColabBadge({ path }: ColabBadgeProps): JSX.Element {
  const url = `https://colab.research.google.com/github/${REPO}/blob/${BRANCH}/notebooks/${path}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginBottom: '1rem' }}>
      <img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab" />
    </a>
  );
}
