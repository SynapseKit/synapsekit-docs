---
sidebar_position: 3
---

# Retriever API Reference

## `Retriever`

```python
from synapsekit import Retriever
from synapsekit.retrieval.base import VectorStore

Retriever(
    vectorstore: VectorStore,
    rerank: bool = False,
)
```

Accepts any `VectorStore` subclass — `InMemoryVectorStore`, `ChromaVectorStore`, `FAISSVectorStore`, etc.

### Methods

| Method | Signature | Description |
|---|---|---|
| `add` | `async add(texts: list[str], metadata: list[dict] \| None = None)` | Add texts to the vector store |
| `retrieve` | `async retrieve(query: str, top_k: int = 5) -> list[str]` | Return top-k relevant text chunks |
| `retrieve_with_scores` | `async retrieve_with_scores(query: str, top_k: int = 5) -> list[dict]` | Return top-k with scores and metadata |

### BM25 reranking

When `rerank=True`, the retriever fetches `top_k × 3` candidates from the vector store and re-ranks them using BM25 (keyword match). The `rank-bm25` package is a hard dependency, so no extra install is needed.

```python
retriever = Retriever(store, rerank=True)
chunks = await retriever.retrieve("async Python", top_k=5)
```

### Example

```python
from synapsekit import InMemoryVectorStore, SynapsekitEmbeddings, Retriever

embeddings = SynapsekitEmbeddings()
store = InMemoryVectorStore(embeddings)
retriever = Retriever(store, rerank=True)

await retriever.add(
    ["SynapseKit is async-first.", "It supports streaming."],
    metadata=[{"src": "intro"}, {"src": "intro"}],
)

chunks = await retriever.retrieve("what is SynapseKit?", top_k=2)
# → ["SynapseKit is async-first.", "It supports streaming."]

results = await retriever.retrieve_with_scores("streaming", top_k=1)
# → [{"text": "It supports streaming.", "score": 0.98, "metadata": {"src": "intro"}}]
```
