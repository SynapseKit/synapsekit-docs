---
sidebar_position: 1
---

# How RAG Works

Retrieval-Augmented Generation (RAG) solves a fundamental limitation of LLMs: they can only answer questions about information in their training data.

RAG connects LLMs to your own data at query time.

## The core problem

LLMs are frozen at their training cutoff. Ask GPT-4o about your company's internal docs, last week's support tickets, or a PDF you uploaded — it has no idea. You have two options:

1. **Fine-tuning** — expensive, requires thousands of examples, takes days
2. **RAG** — cheap, works immediately, no training required

## The RAG pipeline

![RAG pipeline — embed, search, assemble, generate](/img/rag-pipeline.svg)

## Step 1: Chunking

Before you can search your documents, you need to split them into chunks. The chunk size matters enormously:

| Chunk size | Problem |
|---|---|
| Too small (< 100 tokens) | No context — each chunk is meaningless in isolation |
| Too large (> 1000 tokens) | Noisy retrieval — chunks contain irrelevant content |
| 256–512 tokens | Sweet spot for most use cases |

Chunk *overlap* (typically 10–20% of chunk size) prevents losing context at boundaries. With no overlap, the text at chunk boundaries gets split in half. With 10–20% overlap, adjacent chunks share some content so the boundary context is preserved.

SynapseKit provides multiple splitting strategies:

- **`RecursiveCharacterSplitter`** — default, splits on `\n\n`, `\n`, `. `, ` ` in order
- **`MarkdownSplitter`** — splits on headings, respects document structure
- **`SentenceSplitter`** — sentence-boundary aware, best for prose
- **`TokenSplitter`** — splits by token count, ensures model context limits are respected

## Step 2: Embeddings

An embedding model converts text to a high-dimensional vector. Semantically similar text produces similar vectors — this is what makes search work.

```
"dog"    -> [0.2, -0.4, 0.8, ...]
"puppy"  -> [0.21, -0.38, 0.79, ...]   <- similar to "dog"
"table"  -> [-0.9, 0.3, -0.1, ...]    <- very different
```

**Cosine similarity** measures the angle between vectors. Score of 1.0 = identical, 0.0 = orthogonal, -1.0 = opposite.

### Choosing an embedding model

| Model | Dimensions | Speed | Quality | Cost |
|---|---|---|---|---|
| `text-embedding-3-small` | 1536 | Fast | Good | $0.00002/1K tokens |
| `text-embedding-3-large` | 3072 | Slower | Best | $0.00013/1K tokens |
| `sentence-transformers/all-MiniLM-L6-v2` | 384 | Very fast | Good | Free (local) |
| `nomic-embed-text` (Ollama) | 768 | Fast | Good | Free (local) |

For internal tooling on a budget, a local model like `all-MiniLM-L6-v2` is hard to beat. For production search over millions of documents, `text-embedding-3-large` provides measurably better recall.

## Step 3: Vector search

The vector store indexes all your chunk embeddings. At query time, it finds the top-k most similar chunks in milliseconds.

**HNSW** (Hierarchical Navigable Small World) is the algorithm most vector stores use internally. It builds a multi-layer graph where each layer is a coarser approximation of the data. At query time it navigates from coarse to fine layers, converging on the nearest neighbors in O(log n) time instead of O(n). At 1 million documents, HNSW returns results in under 10ms on a single CPU core.

### Similarity search vs keyword search vs hybrid

| | Similarity search | BM25 keyword | Hybrid (both) |
|---|---|---|---|
| Good for | Semantic meaning | Exact terms, jargon | Best of both |
| Fails on | Rare words, typos | Paraphrasing | Nothing (but slower) |
| SynapseKit | Default | `HybridSearchRetriever` | `HybridSearchRetriever` |

Hybrid search runs both a vector search and a BM25 keyword search, then merges results using Reciprocal Rank Fusion (RRF). This is the right default for most production applications.

## Step 4: Prompt assembly

Once you have the top-k chunks, they are inserted into the LLM prompt:

```
Answer the question based only on the context below.

Context:
[chunk 1 text]
[chunk 2 text]
[chunk 3 text]

Question: What is SynapseKit?

Answer:
```

This "stuffing" strategy works well for k=3–5 with typical chunk sizes. For larger k or longer chunks, you may hit the context window limit.

## Retriever types in SynapseKit

| Retriever class | Description |
|---|---|
| `Retriever` | Basic vector similarity retriever |
| `HybridSearchRetriever` | Vector + BM25, merged via RRF |
| `MMRRetriever` | Maximal Marginal Relevance — diverse results |
| `ContextualCompressionRetriever` | Compresses chunks before returning |
| `SelfQueryRetriever` | LLM generates metadata filters from query |
| `ParentDocumentRetriever` | Retrieves small chunks, returns parent doc |
| `MultiQueryRetriever` | Generates multiple queries to improve recall |
| `EnsembleRetriever` | Combines multiple retrievers |

## Why RAG fails (and how to fix it)

| Symptom | Cause | Fix |
|---|---|---|
| "I don't know" when docs exist | Chunks are too small | Increase `chunk_size` |
| Irrelevant answers | Too many retrieved chunks | Decrease `k`, add reranking |
| Hallucinations | LLM ignores context | Reduce temperature, add faithfulness check |
| Slow first query | No embedding cache | Enable caching |
| Poor results on jargon | Embedding model doesn't know your domain | Fine-tune embeddings or use hybrid search |
| Duplicate answers | Multiple chunks say the same thing | Use `MMRRetriever` for diversity |
| Cuts off mid-sentence | Chunk boundary falls badly | Increase chunk overlap |

## Evaluating RAG quality

RAG systems have three distinct failure modes that require different metrics:

- **Faithfulness** — is the answer grounded in the retrieved context? (not hallucinated)
- **Answer relevancy** — does the answer address the question?
- **Context relevancy** — are the retrieved chunks actually useful?

SynapseKit's `EvaluationPipeline` measures all three using LLM-as-judge:

```python
from synapsekit.evaluation import EvaluationPipeline, FaithfulnessMetric

pipeline = EvaluationPipeline(
    metrics=[FaithfulnessMetric(llm=judge_llm)],
)
result = await pipeline.evaluate(question, answer, contexts)
print(result.scores)  # {"faithfulness": 0.91}
```

## See also

- [RAG pipeline quickstart](../getting-started/quickstart)
- [All retrieval strategies](../rag/retriever)
- [Text splitters](../rag/splitter)
- [Vector stores](../rag/vector-stores)
- [Evaluating RAG quality](../evaluation/overview)
