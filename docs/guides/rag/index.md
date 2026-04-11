---
sidebar_position: 1
title: "RAG Fundamentals"
description: "Step-by-step guides for building retrieval-augmented generation pipelines with SynapseKit."
---

# RAG Fundamentals

Retrieval-augmented generation (RAG) lets your LLM answer questions grounded in your own documents rather than relying solely on its training data. These guides walk you from a minimal working pipeline all the way to hybrid search, conversation memory, and metadata filtering.

Every guide is self-contained, includes a Google Colab notebook, and ends with a complete runnable example.

## Guides in this section

| Guide | Time | Difficulty | What you'll build |
|---|---|---|---|
| [RAG in 3 Lines](./quickstart-3-lines) | ~5 min | Beginner | A working RAG pipeline with the absolute minimum code |
| [Build a PDF Knowledge Base](./pdf-knowledge-base) | ~15 min | Beginner | Ingest a PDF, chunk it, store embeddings, and query |
| [Multi-Format Document Ingestion](./multi-format-ingestion) | ~20 min | Intermediate | Unified ingestion from PDF, DOCX, web, CSV, and directories |
| [Choosing a Chunking Strategy](./chunking-strategies) | ~15 min | Intermediate | Compare four splitters and pick the right one for your data |
| [Streaming RAG Responses](./streaming-rag) | ~10 min | Beginner | Token-by-token streaming output and a FastAPI SSE endpoint |
| [RAG with Conversation Memory](./rag-with-memory) | ~15 min | Beginner | Multi-turn Q&A that remembers previous questions in a session |
| [Metadata Filtering in Vector Search](./metadata-filtering) | ~10 min | Intermediate | Scope retrieval by source, date, or category at query time |
| [Hybrid BM25 + Vector Search](./hybrid-bm25-vector) | ~20 min | Intermediate | Combine keyword and semantic search with a tunable alpha parameter |

## How RAG works in SynapseKit

```
Documents → Loader → Splitter → Embeddings → VectorStore
                                                   ↓
User query → Embed query → Retrieve top-k chunks → LLM → Answer
```

SynapseKit's `RAGPipeline` handles all of this with a single object. You choose the loader, splitter, vector store, embeddings, and LLM independently so every component is swappable.

## Quickstart

```python
import asyncio
from synapsekit import RAGPipeline
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore

rag = RAGPipeline(
    llm=OpenAILLM(model="gpt-4o-mini"),
    embeddings=OpenAIEmbeddings(model="text-embedding-3-small"),
    vectorstore=InMemoryVectorStore(),
)

async def main():
    await rag.aadd(["SynapseKit is a Python library for building LLM applications."])
    answer = await rag.aquery("What is SynapseKit?")
    print(answer)

asyncio.run(main())
```

## Prerequisites for all guides

```bash
pip install synapsekit
export OPENAI_API_KEY="sk-..."
```

Ready to start? Begin with [RAG in 3 Lines](./quickstart-3-lines) if you are new to RAG, or jump directly to the guide that matches your use case.
