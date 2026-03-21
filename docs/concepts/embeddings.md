---
sidebar_position: 4
---

# Embeddings and Vector Search

Embeddings are the foundation of semantic search, RAG, and recommendation systems. This guide explains what they are, how vector search works under the hood, and how to choose the right embedding model.

## What embeddings are

An embedding is a fixed-length array of floating-point numbers that represents the *meaning* of a piece of text. Texts with similar meanings produce numerically similar arrays.

Think of it geometrically: every word or sentence gets a point in a high-dimensional space. Semantically related points cluster together. "Neural nets" and "deep learning" are close together. They are far from "pasta".

This geometric structure is what makes similarity search meaningful — you find "conceptually nearby" documents, not just exact keyword matches.

## How cosine similarity works

Given two embedding vectors A and B, cosine similarity measures the cosine of the angle between them:

```
cos(theta) = (A . B) / (|A| * |B|)
```

With concrete numbers (simplified 3D example):

```
"dog"    -> [0.8, 0.2, 0.1]
"puppy"  -> [0.75, 0.22, 0.12]   <- very similar angle
"table"  -> [0.1, -0.5, 0.9]     <- very different angle

cos("dog", "puppy") approx 0.997   <- nearly identical
cos("dog", "table") approx -0.08   <- nearly orthogonal
```

Score interpretation:
- **1.0** — identical vectors (same meaning)
- **0.7–0.99** — highly similar
- **0.3–0.7** — somewhat related
- **< 0.3** — unrelated
- **-1.0** — opposite meaning (rare in practice)

In practice, SynapseKit normalizes all vectors to unit length before storing. This reduces cosine similarity to a dot product, which is faster to compute.

## HNSW indexing — why it's fast

A naive similarity search checks every stored vector against the query vector. That is O(n) — unusable at scale.

**HNSW** (Hierarchical Navigable Small World) builds a multi-layer graph index:

```
Layer 2 (sparse):   [A] ------------ [E]

Layer 1 (medium):   [A] -- [C] --- [E] -- [G]

Layer 0 (full):     [A][B][C][D][E][F][G][H][I]
```

At query time:
1. Start at a random entry point in the top (sparsest) layer
2. Greedily move toward the nearest neighbor in this layer
3. Drop down one layer and continue the search from there
4. Repeat until layer 0, where the exact nearest neighbors are found

This gives O(log n) search time instead of O(n). At 1 million vectors, HNSW returns results in under 10ms. A flat scan would take several seconds.

The tradeoff is memory: HNSW stores the graph edges in addition to the raw vectors. For 1 million 768-dimensional float32 vectors, expect about 3–4 GB of memory.

## Choosing an embedding model

| Model | Dimensions | Context (tokens) | Speed | Quality | Cost |
|---|---|---|---|---|---|
| `text-embedding-3-small` | 1536 | 8191 | Fast | Good | $0.00002/1K |
| `text-embedding-3-large` | 3072 | 8191 | Medium | Excellent | $0.00013/1K |
| `all-MiniLM-L6-v2` | 384 | 256 | Very fast | Good | Free |
| `all-mpnet-base-v2` | 768 | 384 | Fast | Great | Free |
| `nomic-embed-text` (Ollama) | 768 | 2048 | Fast | Good | Free |
| `mxbai-embed-large` (Ollama) | 1024 | 512 | Medium | Great | Free |
| `voyage-3` | 1024 | 32000 | Medium | Excellent | $0.00006/1K |

**Decision guide:**

| Situation | Recommendation |
|---|---|
| Local dev / prototyping | `all-MiniLM-L6-v2` — fast, no API key |
| Production, English only | `text-embedding-3-small` — cost-effective |
| High-quality production | `text-embedding-3-large` or `voyage-3` |
| Long documents (legal, scientific) | `voyage-3` — 32K context window |
| Air-gapped / privacy-sensitive | `nomic-embed-text` via Ollama |
| Multilingual | `text-embedding-3-large` (100+ languages) |

## Embedding dimensions and memory tradeoffs

| Dimensions | Memory per 1M vectors | Relative search speed |
|---|---|---|
| 384 | ~1.5 GB | Fastest |
| 768 | ~3 GB | Fast |
| 1536 | ~6 GB | Medium |
| 3072 | ~12 GB | Slower |

`text-embedding-3-small` and `text-embedding-3-large` support **Matryoshka truncation** — you can reduce their dimensions without retraining:

```python
from synapsekit import SynapsekitEmbeddings

# Use only first 512 dimensions of a 1536-dim model
embeddings = SynapsekitEmbeddings(
    model="text-embedding-3-small",
    dimensions=512,
)
```

## Maximal Marginal Relevance (MMR)

Standard similarity search returns the top-k most similar chunks. The problem: if your document has five nearly identical paragraphs, you get five copies of the same information.

MMR balances relevance with diversity. The `lambda_mult` parameter controls this tradeoff:
- `lambda_mult=1.0` — pure relevance (same as standard search)
- `lambda_mult=0.0` — pure diversity (maximally different results)
- `lambda_mult=0.5` — balanced (default)

```python
from synapsekit.retrieval import MMRRetriever

retriever = MMRRetriever(store, lambda_mult=0.5)
```

## When vector search fails

**Out-of-domain vocabulary.** Embedding models trained on general text may not understand specialized jargon. Fix: fine-tune the embedding model or use hybrid search.

**Rare proper nouns.** Product names, person names, and IDs are not in the training data. BM25 finds them instantly. Fix: hybrid search.

**Numbers and dates.** "Revenue of $4.2M" and "Revenue of $42M" look nearly identical to an embedding model. Fix: extract numbers as structured metadata and use metadata filtering.

**Very short queries.** Single-word queries have high-variance embeddings. Fix: use `MultiQueryRetriever` to generate multiple phrasings.

**Cross-lingual mismatch.** Monolingual models fail on mixed-language corpora. Fix: use a multilingual model like `text-embedding-3-large`.

## Metadata filtering

Metadata filtering narrows the search to a subset of documents before applying vector similarity:

```python
results = await store.search(
    query="revenue targets",
    top_k=5,
    metadata_filter={"quarter": "Q4-2025", "department": "finance"},
)
```

Common metadata fields to index: `source`, `date`, `author`, `section`, `language`.

Supported by: `InMemoryVectorStore`, `ChromaVectorStore`, `QdrantVectorStore`, `PineconeVectorStore`. Not supported by `FAISSVectorStore`.

## See also

- [Choosing a vector store](../rag/vector-stores)
- [Retrieval strategies](../rag/retriever)
- [Vector Store API reference](../api/vector-store)
- [Retriever API reference](../api/retriever)
