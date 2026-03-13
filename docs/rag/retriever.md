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

## Contextual Retrieval

Inspired by Anthropic's Contextual Retrieval approach. Before embedding, each chunk is enriched with a short LLM-generated context sentence, improving accuracy for ambiguous chunks:

```python
from synapsekit import ContextualRetriever

cr = ContextualRetriever(
    retriever=retriever,
    llm=llm,
)

# Add chunks — each gets a context sentence prepended before embedding
await cr.add_with_context(["chunk one...", "chunk two..."])

# Retrieve as normal
results = await cr.retrieve("What is quantum computing?", top_k=5)
```

The process:
1. For each chunk, the LLM generates a 1-2 sentence context
2. The context is prepended to the chunk before embedding
3. At retrieval time, the enriched embeddings improve search accuracy

You can customize the context generation prompt:

```python
cr = ContextualRetriever(
    retriever=retriever,
    llm=llm,
    context_prompt="Summarize this chunk in one sentence:\n{chunk}",
)
```

## Sentence Window Retrieval

Embeds individual sentences for fine-grained search, but returns a window of surrounding sentences for richer context:

```python
from synapsekit import SentenceWindowRetriever

swr = SentenceWindowRetriever(
    retriever=retriever,
    window_size=2,  # Include 2 sentences before and after the match
)

# Add full documents — they're split into sentences automatically
await swr.add_documents(["Full document text here. With multiple sentences. And more."])

# Retrieve — matched sentences are expanded with surrounding context
results = await swr.retrieve("query", top_k=3)
```

The process:
1. Documents are split into individual sentences
2. Each sentence is embedded independently for fine-grained matching
3. At retrieval time, matched sentences are expanded with `window_size` surrounding sentences

## Self-Query Retrieval

The `SelfQueryRetriever` uses an LLM to decompose a natural-language question into a semantic search query and structured metadata filters. This automates the process of extracting filters from user questions.

```python
from synapsekit import SelfQueryRetriever

sqr = SelfQueryRetriever(
    retriever=retriever,
    llm=llm,
    metadata_fields=["source", "author", "year", "category"],
)

# The LLM extracts filters automatically
results = await sqr.retrieve("Papers by John about ML from 2024", top_k=5)
```

The process:
1. The LLM analyzes the question and extracts a semantic query (`"ML papers"`) and metadata filters (`{"author": "John", "year": "2024"}`)
2. The semantic query is used for vector search
3. The metadata filters are applied to narrow results

### Inspecting extracted filters

Use `retrieve_with_filters()` to see what the LLM extracted:

```python
results, info = await sqr.retrieve_with_filters(
    "Papers by John about ML from 2024", top_k=5
)
print(info["query"])    # "ML papers"
print(info["filters"])  # {"author": "John", "year": "2024"}
```

### Custom prompt

Override the default decomposition prompt:

```python
sqr = SelfQueryRetriever(
    retriever=retriever,
    llm=llm,
    metadata_fields=["source", "year"],
    prompt="Custom prompt with {fields} and {question} placeholders...",
)
```

## Parent Document Retrieval

The `ParentDocumentRetriever` embeds small chunks for precise matching but returns full parent documents for richer context:

```python
from synapsekit import ParentDocumentRetriever

pdr = ParentDocumentRetriever(
    retriever=retriever,
    chunk_size=200,
    chunk_overlap=50,
)

# Add full documents — they're chunked internally
await pdr.add_documents(["Full document one...", "Full document two..."])

# Retrieve — returns full parent documents, not small chunks
results = await pdr.retrieve("query", top_k=3)
```

The process:
1. Documents are split into small overlapping chunks (controlled by `chunk_size` and `chunk_overlap`)
2. Each chunk is embedded and stored with a reference to its parent document
3. At retrieval time, matched chunks are traced back to their parent documents
4. Duplicate parents are deduplicated — each parent appears at most once

This is ideal when you need the precision of small-chunk search but want to feed the LLM the full document for context.

### Adding documents with metadata

```python
await pdr.add_documents(
    ["Document one...", "Document two..."],
    metadata=[{"source": "report.pdf"}, {"source": "paper.pdf"}],
)
```

Metadata is propagated to all chunks of a document.

## Cross-Encoder Reranking

The `CrossEncoderReranker` uses a cross-encoder model to rerank retrieval results for higher precision. Cross-encoders score query-document pairs jointly, giving much more accurate relevance scores than bi-encoder similarity alone.

```python
from synapsekit import CrossEncoderReranker

reranker = CrossEncoderReranker(
    retriever=retriever,
    model="cross-encoder/ms-marco-MiniLM-L-6-v2",
    fetch_k=20,  # Initial candidates to retrieve before reranking
)

results = await reranker.retrieve("What is RAG?", top_k=5)
```

The process:
1. `fetch_k` candidates are retrieved using standard vector search
2. Each candidate is scored jointly with the query using the cross-encoder
3. Results are reranked by cross-encoder score and the top `top_k` are returned

### Getting scores

Use `retrieve_with_scores()` to see the cross-encoder scores:

```python
results = await reranker.retrieve_with_scores("What is RAG?", top_k=5)
for r in results:
    print(r["text"], r["cross_encoder_score"])
```

:::info
Requires `sentence-transformers`: `pip install synapsekit[semantic]`
:::

## Parameters

### Retriever

| Parameter | Default | Description |
|---|---|---|
| `top_k` | `4` | Number of chunks to return |
| `use_bm25` | `False` | Enable BM25 reranking |
| `bm25_weight` | `0.3` | Weight for BM25 score in hybrid ranking |
| `metadata_filter` | `None` | Filter by metadata key-value pairs |

### SelfQueryRetriever

| Parameter | Default | Description |
|---|---|---|
| `retriever` | — | Base `Retriever` instance |
| `llm` | — | LLM for query decomposition |
| `metadata_fields` | — | List of metadata field names the LLM can filter on |
| `prompt` | built-in | Custom decomposition prompt |

### ParentDocumentRetriever

| Parameter | Default | Description |
|---|---|---|
| `retriever` | — | Base `Retriever` instance |
| `chunk_size` | `200` | Characters per chunk |
| `chunk_overlap` | `50` | Overlap between chunks |

### CrossEncoderReranker

| Parameter | Default | Description |
|---|---|---|
| `retriever` | — | Base `Retriever` instance |
| `model` | `"cross-encoder/ms-marco-MiniLM-L-6-v2"` | Cross-encoder model name |
| `fetch_k` | `20` | Number of initial candidates to retrieve |
