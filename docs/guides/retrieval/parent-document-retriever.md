---
sidebar_position: 5
title: "Parent Document Retriever"
description: "Improve answer quality by retrieving small, precise chunks but passing their larger parent chunks to the LLM using SynapseKit's ParentDocumentRetriever."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Parent Document Retriever

<ColabBadge path="retrieval/parent-document-retriever.ipynb" />

Chunking documents for retrieval involves a fundamental trade-off: small chunks produce precise retrieval scores but strip away surrounding context that the LLM needs to generate a coherent answer. Large chunks preserve context but produce noisy embeddings that hurt retrieval precision. The Parent Document Retriever resolves this by maintaining two separate chunk sizes — small child chunks for retrieval and large parent chunks for generation. The retriever finds the most relevant child chunks, then returns their parent chunks to the LLM.

**What you'll build:** A retrieval pipeline where documents are split into both fine-grained child chunks and large parent chunks, retrieval operates on child chunks, and the LLM receives the corresponding parent chunks. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

- Completed the [Basic RAG](../rag/) guide
- Familiarity with text splitters in SynapseKit
- `pip install synapsekit`
- `OPENAI_API_KEY` set in your environment

## What you'll learn

- How `ParentDocumentRetriever` maintains the child-to-parent mapping
- How to configure `child_splitter` and `parent_splitter` independently
- Why this pattern improves both retrieval precision and answer quality
- How to handle documents that are too short to split into child/parent levels

## Step 1: Install and configure

```python
import asyncio
import os

from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.retrievers import ParentDocumentRetriever
from synapsekit.splitters import RecursiveCharacterTextSplitter
```

## Step 2: Configure child and parent splitters

The child chunk size should be small enough that a single chunk contains a focused, topically coherent idea — typically 100–300 characters. The parent chunk size should be large enough to give the LLM sufficient surrounding context — typically 1,000–2,000 characters. The key constraint is that parent chunks must not overlap with each other; the child-to-parent mapping assumes each child belongs to exactly one parent.

```python
# Small chunks produce precise vector similarity scores
child_splitter = RecursiveCharacterTextSplitter(
    chunk_size=200,
    chunk_overlap=20,
)

# Large chunks give the LLM the context it needs to reason about the child match
parent_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=0,  # no overlap — each parent must be a disjoint segment
)
```

## Step 3: Initialize the ParentDocumentRetriever

```python
llm = OpenAILLM(model="gpt-4o-mini")
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# Only child chunks are stored in the vector store
child_vectorstore = InMemoryVectorStore(embeddings=embeddings)

retriever = ParentDocumentRetriever(
    vectorstore=child_vectorstore,
    child_splitter=child_splitter,
    parent_splitter=parent_splitter,
    top_k=3,  # number of parent chunks to return (not child chunks)
)
```

## Step 4: Ingest documents

During ingestion, each document is split at both levels. Child chunks are embedded and stored in the vector store; parent chunks are stored in a separate in-memory docstore, keyed by parent ID. Each child chunk carries a `parent_id` metadata field that links it to its parent.

```python
# A long document where child chunks alone would lose important surrounding context
long_doc = """
Machine learning is a subset of artificial intelligence that enables systems to learn
from data and improve their performance without being explicitly programmed.
Supervised learning involves training a model on labelled examples, where each input
has a corresponding output label. Common supervised learning algorithms include linear
regression, decision trees, and neural networks.

Unsupervised learning, by contrast, works on unlabelled data and discovers hidden
patterns or groupings. Clustering algorithms like k-means assign data points to groups
based on similarity. Dimensionality reduction techniques like PCA compress high-dimensional
data into fewer dimensions while preserving variance.

Reinforcement learning trains an agent to make decisions by rewarding desirable actions
and penalising undesirable ones. The agent interacts with an environment, observes state,
takes actions, and receives rewards. Deep reinforcement learning combines this framework
with neural networks, enabling agents to learn in complex, high-dimensional state spaces.

Transfer learning leverages knowledge gained from training on one task to improve
performance on a different but related task. Pre-trained models like BERT and GPT have
learned rich representations from large text corpora and can be fine-tuned on domain-specific
datasets with relatively little data and compute.
"""

await retriever.aadd([long_doc])
```

## Step 5: Verify the child-to-parent structure

```python
async def inspect_chunks():
    stats = await retriever.aget_stats()
    print(f"Child chunks in vector store: {stats.num_children}")
    print(f"Parent chunks in docstore:    {stats.num_parents}")
    print(f"Average children per parent:  {stats.avg_children_per_parent:.1f}")

asyncio.run(inspect_chunks())
```

## Step 6: Retrieve and confirm parent chunks are returned

```python
async def show_retrieval():
    query = "How does reinforcement learning work?"
    results = await retriever.aretrieve(query)
    for i, (doc, score) in enumerate(results):
        print(f"--- Result {i+1} (score: {score:.3f}) ---")
        # The returned text is the parent chunk — much longer than the child that matched
        print(doc[:300])
        print()

asyncio.run(show_retrieval())
```

## Step 7: Wire into a RAG pipeline

```python
rag = RAG(llm=llm, retriever=retriever)
```

## Step 8: Ask a question that requires context beyond a single child chunk

```python
async def ask(question: str):
    print(f"Q: {question}\n")
    async for chunk in rag.astream(question):
        print(chunk, end="", flush=True)
    print()

asyncio.run(ask("What is the difference between supervised and unsupervised learning?"))
```

## Complete working example

```python
import asyncio
import os

from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.retrievers import ParentDocumentRetriever
from synapsekit.splitters import RecursiveCharacterTextSplitter

DOCUMENT = """
Machine learning is a subset of artificial intelligence that enables systems to learn
from data and improve their performance without being explicitly programmed.
Supervised learning involves training a model on labelled examples, where each input
has a corresponding output label. Common supervised learning algorithms include linear
regression, decision trees, and neural networks.

Unsupervised learning, by contrast, works on unlabelled data and discovers hidden
patterns or groupings. Clustering algorithms like k-means assign data points to groups
based on similarity. Dimensionality reduction techniques like PCA compress high-dimensional
data into fewer dimensions while preserving variance.

Reinforcement learning trains an agent to make decisions by rewarding desirable actions
and penalising undesirable ones. The agent interacts with an environment, observes state,
takes actions, and receives rewards. Deep reinforcement learning combines this framework
with neural networks, enabling agents to learn in complex, high-dimensional state spaces.

Transfer learning leverages knowledge gained from training on one task to improve
performance on a different but related task. Pre-trained models like BERT and GPT have
learned rich representations from large text corpora and can be fine-tuned on domain-specific
datasets with relatively little data and compute.
"""


async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    child_vectorstore = InMemoryVectorStore(embeddings=embeddings)

    child_splitter = RecursiveCharacterTextSplitter(chunk_size=200, chunk_overlap=20)
    parent_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=0)

    retriever = ParentDocumentRetriever(
        vectorstore=child_vectorstore,
        child_splitter=child_splitter,
        parent_splitter=parent_splitter,
        top_k=3,
    )

    await retriever.aadd([DOCUMENT])

    stats = await retriever.aget_stats()
    print(f"Indexed {stats.num_children} child chunks across {stats.num_parents} parent chunks.\n")

    rag = RAG(llm=llm, retriever=retriever)

    questions = [
        "How does reinforcement learning work?",
        "What is the difference between supervised and unsupervised learning?",
        "How is transfer learning used with pre-trained models?",
    ]

    for question in questions:
        print(f"Q: {question}")
        result = await rag.aquery(question)
        print(f"A: {result.answer}\n")


asyncio.run(main())
```

## Expected output

```
Indexed 18 child chunks across 4 parent chunks.

Q: How does reinforcement learning work?
A: Reinforcement learning trains an agent to make decisions by rewarding desirable
actions and penalising undesirable ones. The agent interacts with an environment,
observes its state, takes actions, and receives rewards in return. Deep reinforcement
learning extends this by combining the framework with neural networks, which allows
agents to operate in complex, high-dimensional state spaces...

Q: What is the difference between supervised and unsupervised learning?
A: Supervised learning trains a model on labelled data where each input is paired
with an output label — common examples include decision trees and neural networks.
Unsupervised learning works on unlabelled data and discovers hidden structure, such
as clusters or compressed representations, without guidance from labels...

Q: How is transfer learning used with pre-trained models?
A: Transfer learning takes knowledge encoded in a model trained on one task and
applies it to a different but related task. Pre-trained models like BERT and GPT
learn rich text representations from large corpora; fine-tuning them on a smaller
domain-specific dataset requires far less data and compute than training from scratch...
```

## How it works

**Dual indexing.** When `aadd()` is called, each document is first split into parent chunks by `parent_splitter`. Each parent chunk is then split again by `child_splitter` into child chunks. Child chunks are embedded and stored in the vector store with a `parent_id` metadata field. Parent chunks are stored in an in-memory docstore keyed by their ID.

**Retrieval.** At query time, the vector store finds the most similar child chunks. The retriever then looks up the `parent_id` of each matched child and fetches the corresponding parent chunk from the docstore. Duplicate parent IDs (multiple matched children from the same parent) are deduplicated — each parent is returned at most once.

**Why precision and context are both served.** Child chunks are small enough that their embeddings represent a single focused concept, so similarity scores are precise. Parent chunks are large enough to give the LLM the surrounding context needed for a well-reasoned answer. Without this pattern, you must choose: either small chunks with good retrieval but poor generation context, or large chunks with rich context but noisy retrieval.

## Variations

**Use the full original document as the parent.** Instead of splitting at two levels, use `child_splitter` for retrieval and store the entire original document as the parent:

```python
retriever = ParentDocumentRetriever(
    vectorstore=child_vectorstore,
    child_splitter=child_splitter,
    parent_splitter=None,   # no parent split — the whole document is the parent
    top_k=3,
)
```

This works well when documents are short enough (1–5 pages) that passing the full document to the LLM is acceptable.

**Add metadata filtering.** Filter parent chunk retrieval by document source, date, or section tag:

```python
results = await retriever.aretrieve(
    query,
    filter={"source": "annual_report_2024.pdf"},
)
```

**Combine with cross-encoder reranking.** The parent chunks returned by this retriever can be fed directly into `CrossEncoderReranker` before passing to the LLM:

```python
from synapsekit.rerankers import CrossEncoderReranker

reranker = CrossEncoderReranker(model="cross-encoder/ms-marco-MiniLM-L-6-v2", top_k=2)
parent_docs = await retriever.aretrieve(query)
reranked = await reranker.arerank(query, parent_docs)
```

## Troubleshooting

**Child chunks contain full sentences with no meaningful content.** Reduce `chunk_size` in `child_splitter`. Child chunks should contain one or two tightly scoped sentences.

**Parent chunks are too large for the LLM's context window.** Reduce `chunk_size` in `parent_splitter` or reduce `top_k` to return fewer parent chunks.

**Short documents produce only one child chunk per parent.** This means the document is already small enough to embed without child splitting. Set `parent_splitter=None` and use the whole document as the parent.

**Retrieved parents do not contain the relevant passage.** This usually means `chunk_overlap=0` on the parent splitter cut a relevant passage at a paragraph boundary. Add a small overlap (100–200 characters) to the parent splitter to avoid hard cuts.

## Next steps

- [Cross-Encoder Reranking](./cross-encoder-reranking) — precisely rerank the parent chunks before passing them to the LLM
- [RAG Fusion](./rag-fusion) — use multi-query retrieval to improve which child chunks are matched
- [Self-RAG](./self-rag) — grade the parent chunks for relevance before generation
