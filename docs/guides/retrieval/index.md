---
sidebar_position: 1
title: "Advanced Retrieval"
description: "Seven guides covering RAG Fusion, GraphRAG, Self-RAG, parent-document retrieval, query decomposition, cross-encoder reranking, and adaptive RAG with SynapseKit."
---

# Advanced Retrieval

Standard vector search is a starting point, not a ceiling. These seven guides cover the retrieval strategies that close the gap between a proof-of-concept RAG pipeline and one that holds up in production — when queries are ambiguous, documents are large, or the cost of a wrong answer is high.

Each guide is self-contained, includes a Google Colab notebook, and assumes you already have a working RAG pipeline. If you're new to RAG, start with [RAG Fundamentals](../rag/) first.

## Guides in this section

| Guide | Strategy | Best for | Difficulty |
|---|---|---|---|
| [RAG Fusion](./rag-fusion) | Multi-query + Reciprocal Rank Fusion | Queries with ambiguous or varied phrasing | Intermediate |
| [GraphRAG](./graph-rag) | Entity extraction + relationship graph | Documents with dense entity relationships | Advanced |
| [Self-RAG](./self-rag) | Relevance grading + hallucination detection | High-stakes answers requiring verifiable grounding | Advanced |
| [Parent Document Retriever](./parent-document-retriever) | Small chunks retrieved, large chunks returned | Long documents where chunk context is lost | Intermediate |
| [Query Decomposition](./query-decomposition) | Sub-query generation + synthesis | Multi-part or multi-hop questions | Intermediate |
| [Cross-Encoder Reranking](./cross-encoder-reranking) | Retrieve wide, rerank narrow | Any pipeline where precision matters more than recall | Intermediate |
| [Adaptive RAG](./adaptive-rag) | Complexity routing to fast/strong LLM | Cost-sensitive pipelines with mixed query difficulty | Advanced |

## When to use which strategy

**Your answers are inconsistent across phrasings** — use [RAG Fusion](./rag-fusion). Generating multiple query variants and fusing their ranked results smooths out sensitivity to wording.

**Your documents are about entities and their relationships** — use [GraphRAG](./graph-rag). A relationship graph lets you answer multi-hop questions that defeat flat vector search.

**You need to cite sources and cannot tolerate hallucinations** — use [Self-RAG](./self-rag). The grading loop surfaces low-relevance retrievals and detects unsupported claims before they reach the user.

**Your chunks are too small to give the LLM enough context** — use the [Parent Document Retriever](./parent-document-retriever). Retrieve on fine-grained child chunks, but pass the full parent chunk to the model.

**Your users ask compound questions** — use [Query Decomposition](./query-decomposition). Breaking a question into focused sub-queries produces richer, more accurate retrieval than searching the compound question directly.

**Your top-k results are noisy** — use [Cross-Encoder Reranking](./cross-encoder-reranking). Retrieve a large candidate set cheaply, then score each candidate against the query precisely.

**Your query volume is high and queries vary in complexity** — use [Adaptive RAG](./adaptive-rag). Route simple queries to a fast, cheap model and reserve a stronger model for queries that need it.

## Prerequisites

- Python 3.10+
- `pip install synapsekit`
- An OpenAI API key (set as `OPENAI_API_KEY`)
- Familiarity with the [RAG Fundamentals](../rag/) guide series

## Common imports

Every guide in this section shares the same import baseline:

```python
import asyncio
import os

from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
```
