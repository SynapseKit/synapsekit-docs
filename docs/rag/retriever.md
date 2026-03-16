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

## CRAG (Corrective RAG)

The `CRAGRetriever` implements self-correcting retrieval: it retrieves candidates, grades each for relevance using an LLM, and rewrites the query to retry if too few documents pass the relevance check.

```python
from synapsekit import CRAGRetriever

crag = CRAGRetriever(
    retriever=retriever,
    llm=llm,
    relevance_threshold=0.5,  # Fraction of docs that must be relevant
    max_retries=1,            # Max query rewrites before giving up
)

results = await crag.retrieve("What is quantum computing?", top_k=5)
```

The process:
1. Retrieve `top_k` candidates using the base retriever
2. LLM grades each document as "relevant" or "irrelevant" to the query
3. If fewer than `relevance_threshold` fraction pass, the LLM rewrites the query
4. Retry retrieval with the rewritten query (up to `max_retries` times)
5. Return only the documents that passed relevance grading

### Inspecting grades

Use `retrieve_with_grades()` to see grading details:

```python
results, info = await crag.retrieve_with_grades("query", top_k=5)
print(info["relevant_count"])   # Number of relevant docs
print(info["total_count"])      # Total docs retrieved
print(info["query_rewritten"])  # Whether the query was rewritten
print(info["final_query"])      # The (possibly rewritten) query used
```

## Query Decomposition

The `QueryDecompositionRetriever` uses an LLM to break complex queries into simpler sub-queries, retrieves for each, and deduplicates results:

```python
from synapsekit import QueryDecompositionRetriever

qdr = QueryDecompositionRetriever(
    retriever=retriever,
    llm=llm,
    num_sub_queries=3,  # Number of sub-queries to generate
)

results = await qdr.retrieve("Compare quantum and classical computing for ML", top_k=5)
```

The process:
1. LLM decomposes the query into `num_sub_queries` simpler sub-queries
2. Each sub-query is used to retrieve results independently
3. Results are deduplicated and returned

### Inspecting sub-queries

```python
results, sub_queries = await qdr.retrieve_with_sub_queries("query", top_k=5)
print(sub_queries)  # ["What is quantum computing?", "What is classical computing?", ...]
```

## Contextual Compression

The `ContextualCompressionRetriever` retrieves documents then uses an LLM to compress each to only the content relevant to the query:

```python
from synapsekit import ContextualCompressionRetriever

ccr = ContextualCompressionRetriever(
    retriever=retriever,
    llm=llm,
    fetch_k=10,  # Retrieve this many, then compress
)

results = await ccr.retrieve("What is RAG?", top_k=5)
```

The process:
1. Retrieve `fetch_k` candidates using the base retriever
2. LLM compresses each document, extracting only content relevant to the query
3. Documents the LLM marks as "NOT_RELEVANT" are filtered out
4. Top `top_k` compressed results are returned

## Ensemble Retrieval

The `EnsembleRetriever` fuses results from multiple retrievers using weighted Reciprocal Rank Fusion (RRF):

```python
from synapsekit import EnsembleRetriever

ensemble = EnsembleRetriever(
    retrievers=[retriever_a, retriever_b],
    weights=[0.7, 0.3],  # Optional, defaults to equal weights
    rrf_k=60,            # RRF constant
)

results = await ensemble.retrieve("What is RAG?", top_k=5)
```

The process:
1. Each retriever independently retrieves candidates
2. Results are scored using weighted RRF: `score = weight / (rrf_k + rank + 1)`
3. Scores are summed across retrievers for documents appearing in multiple result sets
4. Final results are sorted by fused score

## Cohere Reranking

The `CohereReranker` uses Cohere's rerank models to rerank retrieval results for higher precision. Unlike `CrossEncoderReranker` (local model), this uses the Cohere Rerank API.

```python
from synapsekit import CohereReranker

reranker = CohereReranker(
    retriever=retriever,
    model="rerank-v3.5",
    fetch_k=20,  # Initial candidates to retrieve before reranking
)

results = await reranker.retrieve("What is RAG?", top_k=5)
```

The process:
1. `fetch_k` candidates are retrieved using standard vector search
2. Candidates are sent to the Cohere Rerank API
3. Results are reranked by relevance score and the top `top_k` are returned

### Getting scores

Use `retrieve_with_scores()` to see the Cohere relevance scores:

```python
results = await reranker.retrieve_with_scores("What is RAG?", top_k=5)
for r in results:
    print(r["text"], r["relevance_score"])
```

### API key

The API key is resolved in order:
1. `api_key` parameter
2. `CO_API_KEY` environment variable

:::info
Requires `cohere`: `pip install synapsekit[cohere]`
:::

## Step-Back Retrieval

The `StepBackRetriever` generates a more abstract "step-back" question using an LLM, retrieves for both the original and step-back queries in parallel, and merges deduplicated results. This improves retrieval for specific or narrow questions by also searching with a broader perspective.

```python
from synapsekit import StepBackRetriever

step_back = StepBackRetriever(
    retriever=retriever,
    llm=llm,
)

results = await step_back.retrieve("What is the melting point of gold?", top_k=5)
```

The process:
1. The LLM generates a step-back (more abstract) question from the original query
2. Both the original and step-back queries are used to retrieve results in parallel
3. Results are merged and deduplicated, preserving order

### Custom prompt template

Override the default prompt to control how step-back questions are generated:

```python
step_back = StepBackRetriever(
    retriever=retriever,
    llm=llm,
    prompt_template="Given this question, ask a more general version:\n{query}",
)
```

The template must include `{query}` as a placeholder for the user's question.

## FLARE (Forward-Looking Active REtrieval)

The `FLARERetriever` implements an iterative retrieve-generate-retrieve loop. It generates an answer, identifies parts that need more information (marked with `[SEARCH: ...]`), retrieves for those sub-queries, and regenerates — repeating until no more search markers appear or `max_iterations` is reached.

```python
from synapsekit import FLARERetriever

flare = FLARERetriever(
    retriever=retriever,
    llm=llm,
    max_iterations=3,
)

results = await flare.retrieve("Explain the history of quantum computing", top_k=5)
```

The process:
1. Initial retrieval for the original query
2. LLM generates an answer, inserting `[SEARCH: sub-query]` markers where it needs more information
3. Sub-queries are extracted from the markers
4. If no markers are found, return current documents
5. New retrieval is performed for each sub-query
6. Results are merged, deduplicated, and the process repeats (up to `max_iterations`)

### Parameters

| Parameter | Default | Description |
|---|---|---|
| `retriever` | — | Base `Retriever` instance |
| `llm` | — | LLM for answer generation |
| `max_iterations` | `3` | Maximum generate-retrieve cycles |
| `generate_prompt` | built-in | Prompt for initial answer generation |
| `regenerate_prompt` | built-in | Prompt for regeneration with new context |

## HyDE (Hypothetical Document Embeddings)

The `HyDERetriever` generates a hypothetical answer to the query using an LLM, then uses that hypothetical answer as the search query. This often improves retrieval for complex or abstract questions because the hypothetical answer is closer in embedding space to relevant documents than the original question.

```python
from synapsekit import HyDERetriever

hyde = HyDERetriever(
    retriever=retriever,
    llm=llm,
)

results = await hyde.retrieve("What is quantum entanglement?", top_k=5)
```

The process:
1. The LLM generates a hypothetical passage that would answer the query
2. The hypothetical passage is used as the search query (instead of the original question)
3. Results are retrieved using the hypothetical passage, which is often closer to relevant documents in embedding space

### Custom prompt template

Override the default prompt to control how hypothetical answers are generated:

```python
hyde = HyDERetriever(
    retriever=retriever,
    llm=llm,
    prompt_template="Write a short paragraph answering: {query}",
)
```

The template must include `{query}` as a placeholder for the user's question.

## Hybrid Search Retrieval

The `HybridSearchRetriever` combines BM25 keyword matching with vector similarity using Reciprocal Rank Fusion (RRF). This gives you the best of both sparse (keyword) and dense (vector) retrieval.

```python
from synapsekit import HybridSearchRetriever

hybrid = HybridSearchRetriever(
    retriever=retriever,
    bm25_weight=0.5,
    vector_weight=0.5,
    rrf_k=60,
)

# Build the BM25 index from your documents
hybrid.add_documents(["doc one text...", "doc two text...", "doc three text..."])

# Retrieve — fuses BM25 and vector results via RRF
results = await hybrid.retrieve("search query", top_k=5)
```

The process:
1. Vector retrieval via the base retriever
2. BM25 scoring on the indexed documents
3. RRF fusion: `score = weight / (rrf_k + rank + 1)` for both result sets
4. Results are sorted by fused score and deduplicated

Uses the existing `rank-bm25` hard dependency — no extra install needed.

## Self-RAG (Self-Reflective RAG)

The `SelfRAGRetriever` implements a self-reflective retrieval loop: retrieve candidates, grade each for relevance, generate an answer, check if the documents support the answer, and retry with a rewritten query if not.

```python
from synapsekit import SelfRAGRetriever

self_rag = SelfRAGRetriever(
    retriever=retriever,
    llm=llm,
    max_iterations=2,
    relevance_threshold=0.5,
)

results = await self_rag.retrieve("What is quantum computing?", top_k=5)
```

The process:
1. Retrieve candidates using the base retriever
2. LLM grades each document as "relevant" or "irrelevant"
3. LLM generates an answer from relevant documents
4. LLM checks if the answer is "fully", "partially", or "not" supported
5. If not fully supported, the query is rewritten and the process repeats

### Inspecting reflection metadata

```python
results, meta = await self_rag.retrieve_with_reflection("query", top_k=5)
print(meta["iterations"])     # Number of iterations performed
print(meta["support_level"])  # "fully", "partially", or "not"
```

## Adaptive RAG

The `AdaptiveRAGRetriever` uses an LLM to classify query complexity (simple/moderate/complex) and routes to different retrieval strategies accordingly.

```python
from synapsekit import AdaptiveRAGRetriever

adaptive = AdaptiveRAGRetriever(
    llm=llm,
    simple_retriever=basic_retriever,
    moderate_retriever=fusion_retriever,
    complex_retriever=multi_step_retriever,
)

results = await adaptive.retrieve("What is 2+2?")  # → routed to simple
results = await adaptive.retrieve("Compare quantum and classical computing for ML")  # → routed to complex
```

The process:
1. LLM classifies the query as "simple", "moderate", or "complex"
2. The query is routed to the corresponding retriever
3. Fallback: if `moderate_retriever` is not provided, uses `simple_retriever`; if `complex_retriever` is not provided, uses `moderate_retriever`

### Inspecting classification

```python
results, classification = await adaptive.retrieve_with_classification("query")
print(classification)  # "simple", "moderate", or "complex"
```

## Multi-Step Retrieval

The `MultiStepRetriever` performs iterative retrieval-generation: retrieve documents, generate an answer, identify information gaps, retrieve for those gaps, and repeat until the answer is complete or `max_steps` is reached.

```python
from synapsekit import MultiStepRetriever

ms = MultiStepRetriever(
    retriever=retriever,
    llm=llm,
    max_steps=3,
)

results = await ms.retrieve("What is the history and future of quantum computing?", top_k=5)
```

The process:
1. Initial retrieval for the original query
2. LLM generates an answer from retrieved documents
3. LLM identifies gaps — returns search queries for missing information, or "COMPLETE" if done
4. Gap queries are used for additional retrieval
5. New documents are added (deduplicated) and the process repeats

### Inspecting the step trace

```python
results, trace = await ms.retrieve_with_steps("query")
for step in trace:
    print(step["step"], step["query"], step["new_docs"])
    # step 0: initial query, N new docs
    # step 1: ["gap query 1", "gap query 2"], M new docs
    # step 2: None, 0 new docs, complete=True
```

## Parameters

### Retriever

| Parameter | Default | Description |
|---|---|---|
| `top_k` | `4` | Number of chunks to return |
| `use_bm25` | `False` | Enable BM25 reranking |
| `bm25_weight` | `0.3` | Weight for BM25 score in hybrid ranking |
| `metadata_filter` | `None` | Filter by metadata key-value pairs |

### HyDERetriever

| Parameter | Default | Description |
|---|---|---|
| `retriever` | — | Base `Retriever` instance |
| `llm` | — | LLM for generating hypothetical answers |
| `prompt_template` | built-in | Custom prompt (must include `{query}`) |

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

### CRAGRetriever

| Parameter | Default | Description |
|---|---|---|
| `retriever` | — | Base `Retriever` instance |
| `llm` | — | LLM for grading and query rewriting |
| `relevance_threshold` | `0.5` | Min fraction of docs that must be relevant |
| `max_retries` | `1` | Max query rewrites before returning what we have |

### QueryDecompositionRetriever

| Parameter | Default | Description |
|---|---|---|
| `retriever` | — | Base `Retriever` instance |
| `llm` | — | LLM for query decomposition |
| `num_sub_queries` | `3` | Number of sub-queries to generate |

### ContextualCompressionRetriever

| Parameter | Default | Description |
|---|---|---|
| `retriever` | — | Base `Retriever` instance |
| `llm` | — | LLM for document compression |
| `fetch_k` | `10` | Number of candidates to retrieve before compression |

### EnsembleRetriever

| Parameter | Default | Description |
|---|---|---|
| `retrievers` | — | List of `Retriever` instances |
| `weights` | equal | Weight for each retriever in RRF scoring |
| `rrf_k` | `60` | RRF constant (higher = less aggressive reranking) |

### CohereReranker

| Parameter | Default | Description |
|---|---|---|
| `retriever` | — | Base `Retriever` instance |
| `model` | `"rerank-v3.5"` | Cohere rerank model name |
| `api_key` | `None` | Cohere API key (falls back to `CO_API_KEY` env var) |
| `fetch_k` | `20` | Number of initial candidates to retrieve |

### StepBackRetriever

| Parameter | Default | Description |
|---|---|---|
| `retriever` | — | Base `Retriever` instance |
| `llm` | — | LLM for generating step-back questions |
| `prompt_template` | built-in | Custom prompt (must include `{query}`) |

### FLARERetriever

| Parameter | Default | Description |
|---|---|---|
| `retriever` | — | Base `Retriever` instance |
| `llm` | — | LLM for answer generation |
| `max_iterations` | `3` | Maximum generate-retrieve cycles |
| `generate_prompt` | built-in | Prompt for initial answer generation |
| `regenerate_prompt` | built-in | Prompt for regeneration with new context |

### HybridSearchRetriever

| Parameter | Default | Description |
|---|---|---|
| `retriever` | — | Base `Retriever` instance |
| `bm25_weight` | `0.5` | Weight for BM25 scores in RRF fusion |
| `vector_weight` | `0.5` | Weight for vector scores in RRF fusion |
| `rrf_k` | `60` | RRF constant (higher = less aggressive reranking) |

### SelfRAGRetriever

| Parameter | Default | Description |
|---|---|---|
| `retriever` | — | Base `Retriever` instance |
| `llm` | — | LLM for grading, generation, and support checking |
| `max_iterations` | `2` | Max retrieve-grade-generate-check cycles |
| `relevance_threshold` | `0.5` | Min fraction of docs that must be graded relevant |

### AdaptiveRAGRetriever

| Parameter | Default | Description |
|---|---|---|
| `llm` | — | LLM for query classification |
| `simple_retriever` | — | Retriever for simple queries |
| `moderate_retriever` | `None` | Retriever for moderate queries (falls back to simple) |
| `complex_retriever` | `None` | Retriever for complex queries (falls back to moderate) |
| `classify_prompt` | built-in | Custom classification prompt |

### MultiStepRetriever

| Parameter | Default | Description |
|---|---|---|
| `retriever` | — | Base `Retriever` instance |
| `llm` | — | LLM for answer generation and gap identification |
| `max_steps` | `3` | Maximum retrieval-generation iterations |
