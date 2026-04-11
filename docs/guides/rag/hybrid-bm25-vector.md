---
sidebar_position: 9
title: "Hybrid BM25 + Vector Search"
description: "Combine keyword BM25 and semantic vector search in SynapseKit using HybridRetriever with a tunable alpha parameter."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Hybrid BM25 + Vector Search

<ColabBadge path="rag/hybrid-bm25-vector.ipynb" />

Pure vector search excels at semantic similarity but struggles with exact keywords, product codes, and proper nouns. Pure keyword search (BM25) handles exact matches well but misses paraphrases and synonyms. Hybrid search combines both: BM25 handles the keywords, vectors handle the meaning, and a single `alpha` parameter controls how much weight each signal gets. **What you'll build:** A hybrid retriever that outperforms either approach alone on a mixed-query benchmark. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit rank-bm25 chromadb
export OPENAI_API_KEY="sk-..."
```

## What you'll learn

- When vector search alone fails (exact product codes, acronyms, rare terms)
- When BM25 alone fails (paraphrases, synonyms, questions vs. statements)
- How `BM25Retriever`, `VectorRetriever`, and `HybridRetriever` compose
- How the `alpha` parameter shifts the blend from keyword-heavy to semantic-heavy
- How to tune `alpha` empirically for your data

## Step 1: Understand the failure modes

```python
# These documents illustrate where each retriever struggles.
docs = [
    # Exact product code — BM25 finds this easily; vectors may not.
    "Order SKU-7829-XL ships within 3 business days from our Chicago warehouse.",
    # Paraphrase — vectors handle this; BM25 misses keyword mismatches.
    "We dispatch all large-format items from our Illinois distribution centre.",
    # Acronym — BM25 matches the exact string; vectors may not cluster it correctly.
    "GDPR compliance reports are available in the admin portal under Settings > Legal.",
    # Synonym — vectors handle this; BM25 requires the exact word 'privacy'.
    "All data protection documentation can be found in the administration dashboard.",
    "Standard shipping takes 5-7 business days for domestic orders.",
    "Express delivery is available for an additional $12.99 fee.",
]
```

## Step 2: BM25Retriever — keyword-based retrieval

```python
from synapsekit.retrievers import BM25Retriever

# BM25 scores documents by term frequency and inverse document frequency.
# It is the same algorithm used in Elasticsearch and Solr.
# It does not require an embedding API call, so it has zero latency overhead.
bm25 = BM25Retriever.from_texts(docs, k=3)

# BM25 finds the exact product code because "SKU-7829-XL" is a rare term.
results = await bm25.aretrieve("SKU-7829-XL shipping time")
print("BM25 results:")
for r in results:
    print(f"  - {r.page_content[:80]}")
```

## Step 3: VectorRetriever — semantic retrieval

```python
from synapsekit.retrievers import VectorRetriever
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = InMemoryVectorStore()
await vectorstore.aadd_texts(docs)

# VectorRetriever finds semantically similar documents even when the exact
# words differ. "How do I find privacy docs?" matches "data protection
# documentation" because they are semantically close.
vector = VectorRetriever(vectorstore=vectorstore, embeddings=embeddings, k=3)

results = await vector.aretrieve("How do I find privacy documentation?")
print("\nVector results:")
for r in results:
    print(f"  - {r.page_content[:80]}")
```

## Step 4: HybridRetriever — combine both

```python
from synapsekit.retrievers import HybridRetriever

# alpha=0.5 weights BM25 and vector scores equally using Reciprocal Rank Fusion.
# alpha=0.0 is pure BM25 (keyword only).
# alpha=1.0 is pure vector (semantic only).
# Start at 0.5 and tune toward 0.0 for technical/exact-match corpora,
# or toward 1.0 for conversational/paraphrase-heavy corpora.
hybrid = HybridRetriever(
    bm25_retriever=bm25,
    vector_retriever=vector,
    alpha=0.5,
)

results = await hybrid.aretrieve("SKU-7829-XL shipping time")
print("\nHybrid results (alpha=0.5):")
for r in results:
    print(f"  - {r.page_content[:80]}")
```

## Step 5: Wire HybridRetriever into RAGPipeline

```python
from synapsekit import RAGPipeline
from synapsekit.llms.openai import OpenAILLM

# Passing retriever= overrides the default vector-only retrieval.
# The pipeline uses it for both aquery() and astream() transparently.
rag = RAGPipeline(
    llm=OpenAILLM(model="gpt-4o-mini"),
    embeddings=embeddings,
    vectorstore=vectorstore,
    retriever=hybrid,
)

answer = await rag.aquery("When does SKU-7829-XL ship?")
print("\nRAG answer:", answer)
```

## Step 6: Tune alpha empirically

```python
# Run the same question through three alpha settings to find the sweet spot.
# alpha=0.2 is keyword-heavy — useful for product catalogues, code docs.
# alpha=0.5 is balanced — good default for most knowledge bases.
# alpha=0.8 is semantic-heavy — useful for conversational or FAQ content.

test_questions = [
    ("SKU-7829-XL shipping time", "exact keyword query"),
    ("How long does standard delivery take?", "paraphrase query"),
    ("Where can I find GDPR reports?", "acronym + paraphrase query"),
]

for alpha in [0.2, 0.5, 0.8]:
    print(f"\n--- alpha={alpha} ---")
    h = HybridRetriever(bm25_retriever=bm25, vector_retriever=vector, alpha=alpha)
    for question, label in test_questions:
        results = await h.aretrieve(question)
        top_result = results[0].page_content[:70] if results else "no results"
        print(f"  [{label}] -> {top_result}")
```

## Step 7: Adjust k independently per retriever

```python
# Retrieve more BM25 candidates than vector candidates when your corpus has
# many exact-match queries (e.g., a product support knowledge base).
# HybridRetriever de-duplicates and re-ranks the combined candidate pool.
bm25_wide = BM25Retriever.from_texts(docs, k=10)
vector_narrow = VectorRetriever(vectorstore=vectorstore, embeddings=embeddings, k=4)

hybrid_asymmetric = HybridRetriever(
    bm25_retriever=bm25_wide,
    vector_retriever=vector_narrow,
    alpha=0.3,  # lean toward BM25 since we gave it more candidates
)
```

## Complete working example

```python
import asyncio
from synapsekit import RAGPipeline
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.retrievers import BM25Retriever, VectorRetriever, HybridRetriever

DOCS = [
    "Order SKU-7829-XL ships within 3 business days from our Chicago warehouse.",
    "We dispatch all large-format items from our Illinois distribution centre.",
    "GDPR compliance reports are available in the admin portal under Settings > Legal.",
    "All data protection documentation can be found in the administration dashboard.",
    "Standard shipping takes 5-7 business days for domestic orders.",
    "Express delivery is available for an additional $12.99 fee.",
]

async def benchmark(retriever, label, questions):
    print(f"\n{'='*50}")
    print(f"Retriever: {label}")
    for question in questions:
        results = await retriever.aretrieve(question)
        top = results[0].page_content[:70] if results else "no results"
        print(f"  Q: {question[:50]}")
        print(f"  A: {top}")

async def main():
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = InMemoryVectorStore()
    await vectorstore.aadd_texts(DOCS)

    bm25 = BM25Retriever.from_texts(DOCS, k=3)
    vector = VectorRetriever(vectorstore=vectorstore, embeddings=embeddings, k=3)
    hybrid = HybridRetriever(bm25_retriever=bm25, vector_retriever=vector, alpha=0.5)

    questions = [
        "SKU-7829-XL shipping time",
        "How do I find privacy documentation?",
        "How long does delivery take?",
    ]

    await benchmark(bm25, "BM25 only", questions)
    await benchmark(vector, "Vector only", questions)
    await benchmark(hybrid, "Hybrid (alpha=0.5)", questions)

    # Full RAG pipeline using the hybrid retriever
    rag = RAGPipeline(
        llm=OpenAILLM(model="gpt-4o-mini"),
        embeddings=embeddings,
        vectorstore=vectorstore,
        retriever=hybrid,
    )
    answer = await rag.aquery("When does SKU-7829-XL ship and how much does express cost?")
    print(f"\nRAG answer: {answer}")

asyncio.run(main())
```

## Expected output

```
==================================================
Retriever: BM25 only
  Q: SKU-7829-XL shipping time
  A: Order SKU-7829-XL ships within 3 business days from our Chicago...
  Q: How do I find privacy documentation?
  A: Standard shipping takes 5-7 business days for domestic orders.
  Q: How long does delivery take?
  A: Standard shipping takes 5-7 business days for domestic orders.

==================================================
Retriever: Vector only
  Q: SKU-7829-XL shipping time
  A: We dispatch all large-format items from our Illinois distribution centre.
  Q: How do I find privacy documentation?
  A: All data protection documentation can be found in the administration...
  Q: How long does delivery take?
  A: Standard shipping takes 5-7 business days for domestic orders.

==================================================
Retriever: Hybrid (alpha=0.5)
  Q: SKU-7829-XL shipping time
  A: Order SKU-7829-XL ships within 3 business days from our Chicago...
  Q: How do I find privacy documentation?
  A: All data protection documentation can be found in the administration...
  Q: How long does delivery take?
  A: Standard shipping takes 5-7 business days for domestic orders.

RAG answer: SKU-7829-XL ships within 3 business days. Express delivery is
available for an additional $12.99 fee.
```

## How it works

`HybridRetriever` runs `BM25Retriever.aretrieve()` and `VectorRetriever.aretrieve()` concurrently using `asyncio.gather()`. The two ranked lists are merged using Reciprocal Rank Fusion (RRF): each document receives a score of `1 / (k + rank)` from each list, where `k=60` is a smoothing constant. The `alpha` parameter weights the RRF scores: `final_score = alpha * vector_rrf + (1 - alpha) * bm25_rrf`. The top-`k` documents from the merged ranking are returned to `RAGPipeline` as the retrieved context.

## Variations

| Variation | Change required |
|---|---|
| Pure keyword search | Set `alpha=0.0` |
| Pure semantic search | Set `alpha=1.0` |
| Custom fusion formula | Subclass `HybridRetriever` and override `_fuse()` |
| Use with metadata filtering | Pass `filter=` to `rag.aquery()` — it applies after fusion |
| Sparse + dense with Pinecone | Use `PineconeVectorStore` which supports native hybrid search |

## Troubleshooting

**`ModuleNotFoundError: No module named 'rank_bm25'`**
Run `pip install rank-bm25`. It is a required dependency for `BM25Retriever`.

**Hybrid results are worse than vector-only results**
Try increasing `alpha` toward 1.0. If your documents use consistent terminology and few exact-match queries, pure vector search may already be optimal and BM25 is adding noise.

**BM25 returns no results for some queries**
BM25 requires at least one query term to appear in the corpus. For queries composed entirely of stop words or terms absent from the corpus, BM25 returns nothing. The hybrid fusion step handles this gracefully by falling back to the vector results.

**Performance degrades on very large corpora**
`BM25Retriever` loads all documents into memory. For corpora with more than ~100k documents, use an external BM25 engine (Elasticsearch, OpenSearch) behind a custom `BaseRetriever` subclass.

## Next steps

- [Metadata Filtering in Vector Search](./metadata-filtering) — add filters to hybrid queries
- [Advanced Retrieval guides](../retrieval/) — RAG Fusion, Self-RAG, and cross-encoder reranking
- [Retrievers reference](../../rag/retriever) — full API for all retriever classes
