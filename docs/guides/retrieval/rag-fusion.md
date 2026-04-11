---
sidebar_position: 2
title: "RAG Fusion: Multi-Query Retrieval"
description: "Improve retrieval consistency by generating multiple query variants and merging their ranked results with Reciprocal Rank Fusion using SynapseKit's RAGFusionRetriever."
---

import ColabBadge from '@site/src/components/ColabBadge';

# RAG Fusion: Multi-Query Retrieval

<ColabBadge path="retrieval/rag-fusion.ipynb" />

A single query rarely expresses the full intent behind a question. RAG Fusion addresses this by generating several semantically diverse rewrites of the original query, retrieving documents for each, and merging the ranked result lists using Reciprocal Rank Fusion (RRF) — a rank aggregation method that rewards documents that appear highly across multiple lists without requiring score normalization.

**What you'll build:** A retrieval pipeline that turns one user query into N query variants, retrieves candidates for each, fuses the ranked lists, and returns a deduplicated, re-scored top-k to the LLM. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

- Completed the [Basic RAG](../rag/) guide or equivalent experience
- `pip install synapsekit`
- `OPENAI_API_KEY` set in your environment

## What you'll learn

- How Reciprocal Rank Fusion works and why it beats score-based merging
- How `RAGFusionRetriever` generates and manages query variants
- How to tune the number of query variants and the RRF constant `k`
- How to inspect which documents were promoted or demoted by the fusion step

## Step 1: Install and configure

```python
import asyncio
import os

from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.retrievers import RAGFusionRetriever

llm = OpenAILLM(model="gpt-4o-mini")
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = InMemoryVectorStore(embeddings=embeddings)
```

## Step 2: Load your documents

```python
docs = [
    "Transformer models use self-attention to weigh token relationships across the full sequence.",
    "BERT pre-trains a bidirectional encoder using masked language modelling on large text corpora.",
    "GPT models generate text autoregressively, predicting each token from all preceding tokens.",
    "Retrieval-Augmented Generation combines a dense retriever with a generative language model.",
    "Attention mechanisms allow models to focus on the most relevant parts of the input dynamically.",
    "Fine-tuning adapts a pre-trained model to a downstream task using a smaller labelled dataset.",
    "Embeddings are dense vector representations that encode semantic meaning into a fixed-size space.",
    "Vector databases store embeddings and support approximate nearest-neighbour search at scale.",
]
await vectorstore.aadd(docs)
```

## Step 3: Create the RAGFusionRetriever

The `num_queries` parameter controls how many variant queries are generated. More variants improve recall but increase LLM calls during query expansion.

```python
retriever = RAGFusionRetriever(
    vectorstore=vectorstore,
    llm=llm,
    num_queries=4,      # original + 3 rewrites
    top_k=5,            # documents returned after fusion
    rrf_k=60,           # RRF constant; higher values reduce the impact of rank differences
)
```

## Step 4: Inspect generated query variants

Before running a full pipeline, it helps to see the variants the LLM is generating. Poorly diverse variants are a sign the prompt needs tuning.

```python
async def inspect_variants():
    query = "How do language models process context?"
    variants = await retriever.agenerate_queries(query)
    for i, v in enumerate(variants):
        print(f"[{i}] {v}")

asyncio.run(inspect_variants())
# [0] How do language models process context?
# [1] What mechanisms do LLMs use to understand surrounding text?
# [2] How is context window handled in transformer architectures?
# [3] In what ways do neural language models capture long-range dependencies?
```

## Step 5: Retrieve with fusion

```python
async def fused_retrieve():
    query = "How do language models process context?"
    results = await retriever.aretrieve(query)
    for doc, score in results:
        print(f"[{score:.4f}] {doc[:80]}")

asyncio.run(fused_retrieve())
```

## Step 6: Wire fusion retrieval into a full RAG pipeline

```python
rag = RAG(
    llm=llm,
    retriever=retriever,
)
```

## Step 7: Ask questions and stream the answer

```python
async def ask(question: str):
    print(f"Q: {question}\n")
    async for chunk in rag.astream(question):
        print(chunk, end="", flush=True)
    print()
```

## Step 8: Verify fusion improved recall on an ambiguous query

Run the same query through a plain vector retriever and the fusion retriever side by side to see which documents change rank.

```python
from synapsekit.retrievers import VectorRetriever

plain = VectorRetriever(vectorstore=vectorstore, top_k=5)

async def compare(query: str):
    plain_results = await plain.aretrieve(query)
    fused_results = await retriever.aretrieve(query)

    plain_ids = {doc for doc, _ in plain_results}
    fused_ids = {doc for doc, _ in fused_results}

    print("Only in fused:", fused_ids - plain_ids)
    print("Only in plain:", plain_ids - fused_ids)
```

## Complete working example

```python
import asyncio
import os

from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.retrievers import RAGFusionRetriever

DOCS = [
    "Transformer models use self-attention to weigh token relationships across the full sequence.",
    "BERT pre-trains a bidirectional encoder using masked language modelling on large text corpora.",
    "GPT models generate text autoregressively, predicting each token from all preceding tokens.",
    "Retrieval-Augmented Generation combines a dense retriever with a generative language model.",
    "Attention mechanisms allow models to focus on the most relevant parts of the input dynamically.",
    "Fine-tuning adapts a pre-trained model to a downstream task using a smaller labelled dataset.",
    "Embeddings are dense vector representations that encode semantic meaning into a fixed-size space.",
    "Vector databases store embeddings and support approximate nearest-neighbour search at scale.",
]


async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = InMemoryVectorStore(embeddings=embeddings)

    await vectorstore.aadd(DOCS)

    retriever = RAGFusionRetriever(
        vectorstore=vectorstore,
        llm=llm,
        num_queries=4,
        top_k=5,
        rrf_k=60,
    )

    rag = RAG(llm=llm, retriever=retriever)

    question = "How do language models process context?"
    print(f"Q: {question}\n")
    async for chunk in rag.astream(question):
        print(chunk, end="", flush=True)
    print()


asyncio.run(main())
```

## Expected output

```
Q: How do language models process context?

Language models process context through self-attention mechanisms that weigh
relationships between all tokens in the input sequence simultaneously. Unlike
RNNs that process tokens left-to-right, transformers can attend to any position
in the sequence, allowing them to capture both local and long-range dependencies...
```

## How it works

**Query expansion.** `RAGFusionRetriever` sends the original query to the LLM with a prompt instructing it to produce `num_queries - 1` semantically distinct reformulations. The original query is always included as the first variant to ensure its results are represented.

**Parallel retrieval.** All query variants are retrieved concurrently against the vector store. Each retrieval produces its own ranked list of `(document, score)` pairs.

**Reciprocal Rank Fusion.** For each document appearing in any result list, its RRF score is computed as the sum of `1 / (rrf_k + rank)` across all lists it appears in. A document ranked first in one list and fifth in another scores higher than a document ranked second in only one list.

The `rrf_k` constant (default 60) acts as a smoothing factor. Larger values flatten rank differences; smaller values amplify them. In practice, 60 is robust across most retrieval tasks.

**Why this beats score-based merging.** Cosine similarity scores are not comparable across queries — a score of 0.82 for query A and 0.79 for query B does not mean the first document is more relevant. RRF avoids this problem entirely by operating on ranks, which are ordinal and query-independent.

## Variations

**Fewer queries, lower cost.** Set `num_queries=2` to generate just one rewrite. You still get fusion benefits at half the LLM cost during query expansion.

**Keyword hybrid.** Combine with `HybridRetriever` to run each query variant through both dense and sparse (BM25) retrieval before fusing.

```python
from synapsekit.retrievers import RAGFusionRetriever, HybridRetriever

base_retriever = HybridRetriever(vectorstore=vectorstore, top_k=10)
retriever = RAGFusionRetriever(
    base_retriever=base_retriever,
    llm=llm,
    num_queries=4,
    top_k=5,
)
```

**Custom query expansion prompt.** If the default prompt generates variants that are too similar, override it:

```python
retriever = RAGFusionRetriever(
    vectorstore=vectorstore,
    llm=llm,
    num_queries=4,
    query_expansion_prompt=(
        "You are an expert search query writer. "
        "Generate {num_queries} diverse reformulations of the following question, "
        "each approaching the topic from a different angle:\n\n{query}"
    ),
)
```

## Troubleshooting

**All variants are nearly identical.** The LLM may be defaulting to paraphrase rather than genuine reformulation. Use a more directive prompt (see Variations above) or increase the model temperature.

**Fusion returns the same documents as plain retrieval.** This is expected when the query is very specific and unambiguous. Fusion provides the most lift on broad or multi-faceted queries.

**Latency is too high.** Query expansion adds one LLM call per query. Mitigate by caching variant lists for repeated queries, using a faster model for expansion (`gpt-4o-mini` is already a good choice), or reducing `num_queries` to 2.

**Documents from later query variants never appear in results.** Check that your vector store's per-query `top_k` is large enough before fusion. If each variant only retrieves 3 documents and you have `num_queries=4`, the fusion pool is at most 12 unique documents. Set a higher per-variant `top_k` internally and let the fusion layer reduce to the final `top_k`.

## Next steps

- [Self-RAG](./self-rag) — grade retrieved documents for relevance before sending them to the LLM
- [Cross-Encoder Reranking](./cross-encoder-reranking) — combine fusion with precise cross-encoder scoring for the highest-quality top-k
- [Query Decomposition](./query-decomposition) — instead of rephrasing, break a complex question into independent sub-queries
