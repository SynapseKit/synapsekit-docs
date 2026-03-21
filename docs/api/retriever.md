---
sidebar_position: 6
---

# Retriever API Reference

SynapseKit provides 16 retriever strategies. All implement `BaseRetriever`.

## `BaseRetriever` interface

```python
class BaseRetriever(ABC):
    async def get_relevant_documents(self, query: str) -> list[Document]: ...
    async def aget_relevant_documents(self, query: str) -> list[Document]: ...
```

---

## `Retriever`

Standard dense vector similarity retriever.

```python
from synapsekit.rag import Retriever

retriever = Retriever(
    vector_store: VectorStore,
    k: int = 4,
    score_threshold: float | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `vector_store` | `VectorStore` | required | Vector store to search |
| `k` | `int` | `4` | Number of documents to return |
| `score_threshold` | `float \| None` | `None` | Minimum similarity score (0.0–1.0); results below are filtered out |

```python
retriever = Retriever(vector_store=store, k=5, score_threshold=0.7)
docs = await retriever.get_relevant_documents("What is SynapseKit?")
```

---

## `HybridSearchRetriever`

Combines dense vector search with BM25 sparse keyword search using Reciprocal Rank Fusion (RRF).

```python
from synapsekit.rag import HybridSearchRetriever

retriever = HybridSearchRetriever(
    vector_store: VectorStore,
    k: int = 4,
    alpha: float = 0.5,
    bm25_weight: float = 0.5,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `vector_store` | `VectorStore` | required | Vector store for dense search |
| `k` | `int` | `4` | Number of documents to return |
| `alpha` | `float` | `0.5` | Weight for dense results (1.0 = dense only, 0.0 = sparse only) |
| `bm25_weight` | `float` | `0.5` | Weight for BM25 sparse results |

**When to use:** Queries that mix keyword terms with semantic intent (e.g., product names + conceptual questions).

```python
retriever = HybridSearchRetriever(vector_store=store, alpha=0.6)
docs = await retriever.get_relevant_documents("gpt-4o token limits")
```

---

## `MMRRetriever`

Maximal Marginal Relevance — balances relevance with diversity to avoid redundant results.

```python
from synapsekit.rag import MMRRetriever

retriever = MMRRetriever(
    vector_store: VectorStore,
    k: int = 4,
    fetch_k: int = 20,
    lambda_mult: float = 0.5,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `vector_store` | `VectorStore` | required | Vector store to search |
| `k` | `int` | `4` | Number of documents to return |
| `fetch_k` | `int` | `20` | Candidate pool size before MMR re-ranking |
| `lambda_mult` | `float` | `0.5` | Diversity weight: `0.0` = max diversity, `1.0` = max relevance |

**When to use:** Long-form summarization tasks where you want broad coverage without repeated information.

```python
retriever = MMRRetriever(vector_store=store, k=6, lambda_mult=0.3)
docs = await retriever.get_relevant_documents("overview of SynapseKit features")
```

---

## `ContextualCompressionRetriever`

Wraps another retriever and compresses each retrieved document to only the sentences relevant to the query.

```python
from synapsekit.rag import ContextualCompressionRetriever

retriever = ContextualCompressionRetriever(
    base_retriever: BaseRetriever,
    llm: BaseLLM,
    k: int = 4,
    compression_prompt: str | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `base_retriever` | `BaseRetriever` | required | Retriever to wrap |
| `llm` | `BaseLLM` | required | LLM used to compress documents |
| `k` | `int` | `4` | Number of compressed documents to return |
| `compression_prompt` | `str \| None` | `None` | Custom compression prompt |

**When to use:** Documents are large and noisy; you want to pass only the relevant excerpt to the LLM.

```python
retriever = ContextualCompressionRetriever(
    base_retriever=Retriever(store, k=10),
    llm=llm,
)
docs = await retriever.get_relevant_documents("What are the memory backends?")
```

---

## `SelfQueryRetriever`

Uses an LLM to parse natural-language filters from the query and passes structured metadata filters to the vector store.

```python
from synapsekit.rag import SelfQueryRetriever

retriever = SelfQueryRetriever(
    vector_store: VectorStore,
    llm: BaseLLM,
    document_description: str,
    metadata_field_info: list[dict],
    k: int = 4,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `vector_store` | `VectorStore` | required | Vector store that supports metadata filtering |
| `llm` | `BaseLLM` | required | LLM for query parsing |
| `document_description` | `str` | required | Plain-English description of the document collection |
| `metadata_field_info` | `list[dict]` | required | Schema for filterable metadata fields |
| `k` | `int` | `4` | Number of documents to return |

**When to use:** Documents have structured metadata (author, date, category) and users ask filter-style questions.

```python
retriever = SelfQueryRetriever(
    vector_store=store,
    llm=llm,
    document_description="Technical documentation pages",
    metadata_field_info=[
        {"name": "version", "type": "string", "description": "Library version"},
        {"name": "category", "type": "string", "description": "Doc category"},
    ],
)
docs = await retriever.get_relevant_documents("v1.2.0 changelog entries")
```

---

## `ParentDocumentRetriever`

Stores small child chunks for precise retrieval but returns their full parent documents for richer context.

```python
from synapsekit.rag import ParentDocumentRetriever

retriever = ParentDocumentRetriever(
    vector_store: VectorStore,
    docstore: BaseDocStore,
    child_splitter: BaseSplitter,
    parent_splitter: BaseSplitter | None = None,
    k: int = 4,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `vector_store` | `VectorStore` | required | Stores child chunk embeddings |
| `docstore` | `BaseDocStore` | required | Stores full parent documents |
| `child_splitter` | `BaseSplitter` | required | Splits documents into small child chunks |
| `parent_splitter` | `BaseSplitter \| None` | `None` | Splits into parent chunks; `None` = use full document |
| `k` | `int` | `4` | Number of parent documents to return |

**When to use:** Documents are long; small chunks improve retrieval precision but strip useful context.

---

## `MultiQueryRetriever`

Generates multiple query variations with an LLM, retrieves documents for each, and deduplicates results.

```python
from synapsekit.rag import MultiQueryRetriever

retriever = MultiQueryRetriever(
    base_retriever: BaseRetriever,
    llm: BaseLLM,
    num_queries: int = 3,
    k: int = 4,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `base_retriever` | `BaseRetriever` | required | Retriever to call for each query |
| `llm` | `BaseLLM` | required | LLM for generating query variations |
| `num_queries` | `int` | `3` | Number of query reformulations to generate |
| `k` | `int` | `4` | Number of documents to return after deduplication |

**When to use:** The original query is ambiguous or could benefit from paraphrasing to improve recall.

```python
retriever = MultiQueryRetriever(
    base_retriever=Retriever(store, k=4),
    llm=llm,
    num_queries=5,
)
docs = await retriever.get_relevant_documents("how does it handle memory")
```

---

## `EnsembleRetriever`

Fuses results from multiple retrievers using Reciprocal Rank Fusion.

```python
from synapsekit.rag import EnsembleRetriever

retriever = EnsembleRetriever(
    retrievers: list[BaseRetriever],
    weights: list[float] | None = None,
    k: int = 4,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `retrievers` | `list[BaseRetriever]` | required | Retrievers to combine |
| `weights` | `list[float] \| None` | `None` | Per-retriever weights; `None` = equal weights |
| `k` | `int` | `4` | Number of documents to return after fusion |

```python
retriever = EnsembleRetriever(
    retrievers=[dense_retriever, bm25_retriever, mmr_retriever],
    weights=[0.5, 0.3, 0.2],
)
docs = await retriever.get_relevant_documents("async graph execution")
```

---

## `BM25Retriever`

Pure sparse keyword retrieval using the BM25 ranking function. No embedding required.

```python
from synapsekit.rag import BM25Retriever

retriever = BM25Retriever(
    documents: list[Document],
    k: int = 4,
    b: float = 0.75,
    k1: float = 1.5,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `documents` | `list[Document]` | required | Corpus to index |
| `k` | `int` | `4` | Number of documents to return |
| `b` | `float` | `0.75` | BM25 length normalization parameter |
| `k1` | `float` | `1.5` | BM25 term frequency saturation parameter |

**Extra dependency:** `pip install synapsekit[bm25]`

**When to use:** Exact keyword matching is important (product codes, error messages, named entities).

---

## `TimeWeightedRetriever`

Boosts recently added documents in the ranking. Useful for news, logs, or versioned content.

```python
from synapsekit.rag import TimeWeightedRetriever

retriever = TimeWeightedRetriever(
    vector_store: VectorStore,
    decay_rate: float = 0.01,
    k: int = 4,
    other_score_keys: list[str] | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `vector_store` | `VectorStore` | required | Vector store with `last_accessed_at` metadata |
| `decay_rate` | `float` | `0.01` | Exponential decay rate per hour |
| `k` | `int` | `4` | Number of documents to return |
| `other_score_keys` | `list[str] \| None` | `None` | Additional metadata keys to incorporate into score |

**When to use:** Knowledge base has time-sensitive content and recent documents should rank higher.

---

## `MetadataRetriever`

Filters documents by metadata before running vector similarity search.

```python
from synapsekit.rag import MetadataRetriever

retriever = MetadataRetriever(
    vector_store: VectorStore,
    filter: dict,
    k: int = 4,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `vector_store` | `VectorStore` | required | Vector store that supports metadata filtering |
| `filter` | `dict` | required | Metadata filter expression |
| `k` | `int` | `4` | Number of documents to return |

```python
retriever = MetadataRetriever(
    vector_store=store,
    filter={"category": "api", "version": "1.2"},
)
docs = await retriever.get_relevant_documents("authentication parameters")
```

---

## `LongContextReorderRetriever`

Reorders results so the most relevant documents appear at the beginning and end of the context window, addressing the "lost in the middle" problem.

```python
from synapsekit.rag import LongContextReorderRetriever

retriever = LongContextReorderRetriever(
    base_retriever: BaseRetriever,
    k: int = 4,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `base_retriever` | `BaseRetriever` | required | Retriever to wrap |
| `k` | `int` | `4` | Number of documents to return |

**When to use:** You are passing many retrieved chunks to the LLM and accuracy on middle context matters.

---

## `StepBackRetriever`

Uses an LLM to generate a more abstract "step-back" question before retrieval to improve coverage on specific, narrow queries.

```python
from synapsekit.rag import StepBackRetriever

retriever = StepBackRetriever(
    base_retriever: BaseRetriever,
    llm: BaseLLM,
    k: int = 4,
    include_original: bool = True,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `base_retriever` | `BaseRetriever` | required | Retriever to call with the abstracted query |
| `llm` | `BaseLLM` | required | LLM for generating the step-back question |
| `k` | `int` | `4` | Number of documents to return |
| `include_original` | `bool` | `True` | Also retrieve using the original query and merge results |

**When to use:** Queries are very specific (e.g., a particular function name) and benefit from broader background context.

---

## `GraphRAGRetriever`

Traverses a knowledge graph to retrieve multi-hop relationships before returning documents.

```python
from synapsekit.rag import GraphRAGRetriever

retriever = GraphRAGRetriever(
    vector_store: VectorStore,
    graph_store: BaseGraphStore,
    k: int = 4,
    max_hops: int = 2,
    include_neighbors: bool = True,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `vector_store` | `VectorStore` | required | Vector store for initial retrieval |
| `graph_store` | `BaseGraphStore` | required | Graph store for relationship traversal |
| `k` | `int` | `4` | Number of documents to return |
| `max_hops` | `int` | `2` | Maximum graph traversal depth |
| `include_neighbors` | `bool` | `True` | Include neighbor node documents in results |

**Extra dependency:** `pip install synapsekit[graphrag]`

**When to use:** Documents have rich relational structure (legal documents, scientific literature, ontologies).

---

## `HyDERetriever`

Hypothetical Document Embeddings — generates a hypothetical answer with an LLM, embeds it, then retrieves real documents most similar to that hypothetical.

```python
from synapsekit.rag import HyDERetriever

retriever = HyDERetriever(
    vector_store: VectorStore,
    llm: BaseLLM,
    k: int = 4,
    hyde_prompt: str | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `vector_store` | `VectorStore` | required | Vector store to search |
| `llm` | `BaseLLM` | required | LLM for generating the hypothetical document |
| `k` | `int` | `4` | Number of documents to return |
| `hyde_prompt` | `str \| None` | `None` | Custom prompt for hypothetical generation |

**When to use:** The query is a question and the document corpus contains factual passages (good embedding alignment between hypothetical answer and real answer).

```python
retriever = HyDERetriever(vector_store=store, llm=llm, k=5)
docs = await retriever.get_relevant_documents("How does SynapseKit handle retries?")
```

---

## `CachingRetriever`

Wraps any retriever and caches results in memory or Redis to avoid redundant embedding lookups.

```python
from synapsekit.rag import CachingRetriever

retriever = CachingRetriever(
    base_retriever: BaseRetriever,
    ttl_seconds: int = 300,
    backend: str = "memory",
    redis_url: str | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `base_retriever` | `BaseRetriever` | required | Retriever to cache results for |
| `ttl_seconds` | `int` | `300` | Cache entry TTL in seconds |
| `backend` | `str` | `"memory"` | Cache backend: `"memory"` or `"redis"` |
| `redis_url` | `str \| None` | `None` | Redis URL (required when `backend="redis"`) |

```python
retriever = CachingRetriever(
    base_retriever=HyDERetriever(store, llm),
    ttl_seconds=600,
    backend="redis",
    redis_url="redis://localhost:6379",
)
```

---

## Retriever selection guide

| Use case | Recommended retriever |
|---|---|
| Standard RAG | `Retriever` |
| Keyword-heavy queries | `BM25Retriever` or `HybridSearchRetriever` |
| Diverse, broad coverage | `MMRRetriever` |
| Long, noisy documents | `ContextualCompressionRetriever` |
| Metadata-filtered search | `MetadataRetriever` or `SelfQueryRetriever` |
| Ambiguous or vague queries | `MultiQueryRetriever` or `StepBackRetriever` |
| Question to factual passage | `HyDERetriever` |
| Time-sensitive content | `TimeWeightedRetriever` |
| Relational / multi-hop | `GraphRAGRetriever` |
| High-traffic, repeated queries | `CachingRetriever` |
| Large documents, need full context | `ParentDocumentRetriever` |
| Many chunks passed to LLM | `LongContextReorderRetriever` |

---

## See also

- [RAG pipeline guide](../rag/pipeline)
- [Vector stores](../rag/vector-stores)
- [RAG pipeline API reference](../api/rag-pipeline)
