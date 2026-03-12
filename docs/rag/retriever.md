---
sidebar_position: 4
---

# Retriever

The `Retriever` finds the most relevant chunks for a query using vector similarity and optional BM25 reranking.

## Basic usage

```python
from synapsekit.retriever import Retriever
from synapsekit.vectorstore import InMemoryVectorStore
from synapsekit.embeddings import SynapsekitEmbeddings

embeddings = SynapsekitEmbeddings()
store = InMemoryVectorStore(embeddings)
store.add(["Chunk one...", "Chunk two...", "Chunk three..."])

retriever = Retriever(store)
results = await retriever.retrieve("Your query here", top_k=3)

for doc in results:
    print(doc.text, doc.score)
```

## BM25 reranking

Enable hybrid retrieval (vector + BM25) for better precision:

```python
retriever = Retriever(store, use_bm25=True, bm25_weight=0.3)
results = await retriever.retrieve("Your query", top_k=5)
```

Requires `rank-bm25` (included as a hard dependency).

## Metadata filtering

Filter results by metadata before ranking:

```python
results = await retriever.retrieve(
    "Your query",
    top_k=5,
    metadata_filter={"source": "report.pdf"},
)
```

Only documents whose metadata contains all specified key-value pairs are considered.

## MMR retrieval (diversity)

Maximal Marginal Relevance balances relevance with diversity to reduce redundant results:

```python
results = await retriever.retrieve_mmr(
    "Your query",
    top_k=5,
    lambda_mult=0.5,  # 0 = max diversity, 1 = max relevance
    fetch_k=20,       # Initial candidate pool size
)
```

MMR greedily selects documents that maximize:
`lambda * relevance(query, doc) - (1-lambda) * max_similarity(doc, selected_docs)`

## RAG Fusion

Generate multiple query variations with an LLM and fuse results using Reciprocal Rank Fusion for better recall:

```python
from synapsekit import RAGFusionRetriever

fusion = RAGFusionRetriever(
    retriever=retriever,
    llm=llm,
    num_queries=3,   # Number of query variations to generate
    rrf_k=60,        # RRF constant (higher = less aggressive reranking)
)

results = await fusion.retrieve("What is quantum computing?", top_k=5)
```

The process:
1. LLM generates `num_queries` variations of your query
2. Each variation (plus the original) is used to retrieve results
3. Results are fused using Reciprocal Rank Fusion scoring
4. Documents appearing in multiple result sets rank higher

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `top_k` | `4` | Number of chunks to return |
| `use_bm25` | `False` | Enable BM25 reranking |
| `bm25_weight` | `0.3` | Weight for BM25 score in hybrid ranking |
| `metadata_filter` | `None` | Filter by metadata key-value pairs |
