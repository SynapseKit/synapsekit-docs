---
sidebar_position: 2
title: "RAG in 3 Lines"
description: "Build a working retrieval-augmented generation pipeline in SynapseKit with the absolute minimum code."
---

import ColabBadge from '@site/src/components/ColabBadge';

# RAG in 3 Lines

<ColabBadge path="rag/quickstart-3-lines.ipynb" />

SynapseKit's `RAGPipeline` hides the embedding, storage, retrieval, and generation steps behind three async calls. This guide shows you the minimum viable pipeline and then extends it with streaming. **What you'll build:** A question-answering pipeline that embeds documents, stores them in memory, and answers natural-language questions. **Time:** ~5 min. **Difficulty:** Beginner

## Prerequisites

```bash
pip install synapsekit
export OPENAI_API_KEY="sk-..."
```

## What you'll learn

- How to create a `RAGPipeline` with one constructor call
- How to add documents with `aadd()`
- How to query with `aquery()`
- How to stream the answer token-by-token with `astream()`
- Why `InMemoryVectorStore` is ideal for prototyping

## Step 1: Create the pipeline

```python
from synapsekit import RAGPipeline
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore

# InMemoryVectorStore requires no external service, so there is nothing to
# set up or tear down — perfect for getting started quickly.
rag = RAGPipeline(
    llm=OpenAILLM(model="gpt-4o-mini"),
    embeddings=OpenAIEmbeddings(model="text-embedding-3-small"),
    vectorstore=InMemoryVectorStore(),
)
```

`RAGPipeline` is the only object you need. Every component — LLM, embeddings, vector store — is injected so you can swap any one of them later without touching the rest of your code.

## Step 2: Add documents

```python
docs = [
    "SynapseKit is an async-first Python library for building LLM applications.",
    "RAGPipeline supports PDF, DOCX, web, CSV, and plain-text sources.",
    "All SynapseKit retrieval methods are prefixed with 'a' to signal they are async.",
]

# aadd() embeds each string and persists the vectors in the store.
# Calling it once at startup means queries have zero ingestion latency.
await rag.aadd(docs)
```

`aadd()` accepts plain strings, `Document` objects, or any iterable of either. Internally it batches the embedding calls to stay within the API rate limit.

## Step 3: Query

```python
# aquery() embeds the question, retrieves the top-k most relevant chunks,
# and passes them as context to the LLM in a single round-trip.
answer = await rag.aquery("What kinds of sources does RAGPipeline support?")
print(answer)
```

`aquery()` returns a plain string. The default `k=4` retrieves the four most similar chunks; you can override this with `rag.aquery("...", k=8)`.

## Step 4: Stream the answer

```python
# Streaming lets you display partial output immediately instead of waiting
# for the full response — critical for good UX in chat interfaces.
async for token in rag.astream("What makes SynapseKit async-first?"):
    print(token, end="", flush=True)
print()  # newline after the stream finishes
```

`astream()` is an async generator that yields tokens as soon as the LLM produces them. The underlying retrieval step still happens once before generation starts.

## Step 5: Control how many chunks are retrieved

```python
# Raising k improves recall at the cost of a larger prompt.
# Lower k is faster and cheaper but may miss relevant context.
answer = await rag.aquery("What is SynapseKit?", k=2)
print(answer)
```

## Complete working example

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
    docs = [
        "SynapseKit is an async-first Python library for building LLM applications.",
        "RAGPipeline supports PDF, DOCX, web, CSV, and plain-text sources.",
        "All SynapseKit retrieval methods are prefixed with 'a' to signal they are async.",
    ]
    await rag.aadd(docs)

    answer = await rag.aquery("What kinds of sources does RAGPipeline support?")
    print("Answer:", answer)

    print("\nStreaming: ", end="")
    async for token in rag.astream("What makes SynapseKit async-first?"):
        print(token, end="", flush=True)
    print()

asyncio.run(main())
```

## Expected output

```
Answer: RAGPipeline supports PDF, DOCX, web, CSV, and plain-text sources.

Streaming: SynapseKit is designed to be async-first, which means all retrieval
and generation methods are coroutines prefixed with 'a' — for example aadd(),
aquery(), and astream() — allowing them to run without blocking the event loop.
```

## How it works

`RAGPipeline.aadd()` calls `OpenAIEmbeddings` to produce a vector for each document and stores the vector alongside the original text in `InMemoryVectorStore`. On `aquery()`, SynapseKit embeds the question with the same model, performs a cosine-similarity search to find the top-k chunks, and injects those chunks into a prompt that is sent to the LLM. `astream()` follows the same retrieval path but forwards the LLM's streaming response token-by-token via an async generator.

## Variations

| Variation | Change required |
|---|---|
| Use a different LLM | Replace `OpenAILLM` with any provider from `synapsekit.llms.*` |
| Persist vectors to disk | Swap `InMemoryVectorStore` for `ChromaVectorStore` |
| Embed locally | Replace `OpenAIEmbeddings` with `OllamaEmbeddings` |
| Retrieve more context | Pass `k=8` to `aquery()` or `astream()` |
| Add a custom system prompt | Pass `system_prompt="..."` to `RAGPipeline()` |

## Troubleshooting

**`AuthenticationError: No API key provided`**
Set `OPENAI_API_KEY` in your environment before running: `export OPENAI_API_KEY="sk-..."`. SynapseKit reads it automatically from the environment.

**`RuntimeError: no running event loop`**
Wrap your async calls in `asyncio.run(main())` as shown in the complete example. Do not call `await` at the top level of a script outside of an async function.

**Empty or unhelpful answers**
The model can only use what is in the vector store. Add more documents with `aadd()` or increase `k` so more context reaches the LLM.

## Next steps

- [Build a PDF Knowledge Base](./pdf-knowledge-base) — ingest a real PDF file
- [Streaming RAG Responses](./streaming-rag) — wire streaming into a FastAPI endpoint
- [RAGPipeline reference](../../rag/pipeline) — full API documentation
