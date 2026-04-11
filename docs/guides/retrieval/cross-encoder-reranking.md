---
sidebar_position: 7
title: "Cross-Encoder Reranking"
description: "Boost retrieval precision by retrieving a large candidate set with fast bi-encoder search, then reranking the candidates using a cross-encoder that scores each document against the full query."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Cross-Encoder Reranking

<ColabBadge path="retrieval/cross-encoder-reranking.ipynb" />

Bi-encoder (dense retrieval) models embed the query and each document independently, then compare them by cosine similarity. This is fast — similarity is a single dot product — but it approximates relevance, because the query and document never interact during encoding. Cross-encoders take a different approach: they score a (query, document) pair jointly, allowing the model to capture token-level interactions between the question and the passage. This produces far more precise relevance scores, but at a cost: cross-encoders cannot be pre-computed, so they must be run at query time for every candidate document. The standard pattern is to retrieve a large candidate set cheaply with a bi-encoder (k=20 or more) and then rerank to the final top-k using a cross-encoder.

**What you'll build:** A two-stage retrieval pipeline that retrieves 20 candidate documents using dense vector search and reranks them to the top 5 using a cross-encoder, then passes those 5 to the LLM. **Time:** ~15 min. **Difficulty:** Intermediate

## Prerequisites

- Completed the [Basic RAG](../rag/) guide
- `pip install synapsekit`
- `pip install sentence-transformers` (for the local cross-encoder model)
- `OPENAI_API_KEY` set in your environment

## What you'll learn

- Why two-stage retrieval (retrieve wide, rerank narrow) outperforms single-stage retrieval
- How `CrossEncoderReranker` scores query-document pairs
- How to configure the candidate pool size and final top-k independently
- How to swap in an API-based reranker (Cohere, Jina) instead of a local model

## Step 1: Install and configure

```python
import asyncio
import os

from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.rerankers import CrossEncoderReranker
from synapsekit.retrievers import VectorRetriever

llm = OpenAILLM(model="gpt-4o-mini")
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = InMemoryVectorStore(embeddings=embeddings)
```

## Step 2: Load documents

```python
docs = [
    "Python's asyncio library provides event loop-based concurrency for I/O-bound tasks.",
    "The Global Interpreter Lock (GIL) in CPython prevents true parallelism for CPU-bound code.",
    "Threading in Python is suitable for I/O-bound tasks but not CPU-bound tasks due to the GIL.",
    "Multiprocessing bypasses the GIL by running each process in a separate Python interpreter.",
    "async/await syntax in Python 3.5+ enables cooperative multitasking without threads.",
    "Celery is a distributed task queue for Python that supports asynchronous job execution.",
    "Ray is a framework for distributed computing in Python, optimised for ML workloads.",
    "concurrent.futures provides a high-level interface for both thread and process pools.",
    "The asyncio.gather() function runs multiple coroutines concurrently in the same event loop.",
    "Gevent uses greenlets to provide lightweight concurrency in Python without native threads.",
    "WSGI is a synchronous interface for Python web servers and does not support async handlers.",
    "ASGI extends WSGI to support asynchronous Python web frameworks like FastAPI and Starlette.",
    "uvloop is a fast asyncio event loop implementation built on top of libuv.",
    "trio is an alternative async library for Python with a structured concurrency model.",
    "Python's queue.Queue is thread-safe and suitable for producer-consumer patterns with threads.",
    "asyncio.Queue provides a thread-unsafe but coroutine-safe queue for async workflows.",
    "Process pools in Python use pickle to serialise arguments, which can be a bottleneck.",
    "Dask provides parallel computing for Python with lazy evaluation and task graph scheduling.",
    "Numba compiles Python functions to native machine code using LLVM, bypassing the GIL.",
    "The multiprocessing.Manager class enables shared state between processes via a proxy server.",
]

await vectorstore.aadd(docs)
```

## Step 3: Set up the two-stage retrieval pipeline

The key numbers here are `candidates` (how many documents the bi-encoder retrieves) and `top_k` (how many the cross-encoder keeps). A candidate pool of 20 gives the cross-encoder enough to work with. Final `top_k=5` keeps the LLM's context tight and reduces generation cost.

```python
# Stage 1: retrieve a large candidate pool using fast bi-encoder similarity
base_retriever = VectorRetriever(
    vectorstore=vectorstore,
    top_k=20,  # retrieve wide — precision does not matter here, recall does
)

# Stage 2: score each candidate against the query jointly using a cross-encoder
reranker = CrossEncoderReranker(
    model="cross-encoder/ms-marco-MiniLM-L-6-v2",  # local model, no API key required
    top_k=5,  # keep only the 5 most precisely relevant documents
)
```

## Step 4: Retrieve candidates and rerank

```python
async def reranked_retrieve():
    query = "What is the best way to run CPU-bound Python code in parallel?"

    # Stage 1: broad retrieval
    candidates = await base_retriever.aretrieve(query)
    print(f"Stage 1 candidates: {len(candidates)}")
    for doc, score in candidates[:3]:
        print(f"  [{score:.3f}] {doc[:70]}")

    print()

    # Stage 2: cross-encoder reranking
    reranked = await reranker.arerank(query, candidates)
    print(f"Stage 2 top-{reranker.top_k} after reranking:")
    for doc, score in reranked:
        print(f"  [{score:.4f}] {doc[:70]}")

asyncio.run(reranked_retrieve())
```

## Step 5: Wire both stages into the RAG pipeline

`CrossEncoderReranker` can be passed directly to `RAG` as a `reranker` parameter. The pipeline handles the two-stage flow internally.

```python
rag = RAG(
    llm=llm,
    retriever=base_retriever,
    reranker=reranker,
)
```

## Step 6: Ask a question and compare with and without reranking

```python
async def compare_pipelines():
    query = "What is the best way to run CPU-bound Python code in parallel?"

    # Without reranking
    rag_plain = RAG(llm=llm, retriever=VectorRetriever(vectorstore=vectorstore, top_k=5))
    result_plain = await rag_plain.aquery(query)

    # With reranking
    result_reranked = await rag.aquery(query)

    print("Without reranking:")
    print(result_plain.answer[:300])
    print("\nWith reranking:")
    print(result_reranked.answer[:300])

asyncio.run(compare_pipelines())
```

## Step 7: Use an API-based reranker

For production deployments, an API-based reranker like Cohere or Jina avoids loading a local model and can be more accurate.

```python
from synapsekit.rerankers import CohereReranker

reranker = CohereReranker(
    api_key=os.environ["COHERE_API_KEY"],
    model="rerank-english-v3.0",
    top_k=5,
)

rag = RAG(llm=llm, retriever=base_retriever, reranker=reranker)
```

## Complete working example

```python
import asyncio
import os

from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.rerankers import CrossEncoderReranker
from synapsekit.retrievers import VectorRetriever

DOCS = [
    "Python's asyncio library provides event loop-based concurrency for I/O-bound tasks.",
    "The Global Interpreter Lock (GIL) in CPython prevents true parallelism for CPU-bound code.",
    "Threading in Python is suitable for I/O-bound tasks but not CPU-bound tasks due to the GIL.",
    "Multiprocessing bypasses the GIL by running each process in a separate Python interpreter.",
    "async/await syntax in Python 3.5+ enables cooperative multitasking without threads.",
    "Celery is a distributed task queue for Python that supports asynchronous job execution.",
    "Ray is a framework for distributed computing in Python, optimised for ML workloads.",
    "concurrent.futures provides a high-level interface for both thread and process pools.",
    "The asyncio.gather() function runs multiple coroutines concurrently in the same event loop.",
    "Gevent uses greenlets to provide lightweight concurrency in Python without native threads.",
    "WSGI is a synchronous interface for Python web servers and does not support async handlers.",
    "ASGI extends WSGI to support asynchronous Python web frameworks like FastAPI and Starlette.",
    "uvloop is a fast asyncio event loop implementation built on top of libuv.",
    "trio is an alternative async library for Python with a structured concurrency model.",
    "Python's queue.Queue is thread-safe and suitable for producer-consumer patterns with threads.",
    "asyncio.Queue provides a thread-unsafe but coroutine-safe queue for async workflows.",
    "Process pools in Python use pickle to serialise arguments, which can be a bottleneck.",
    "Dask provides parallel computing for Python with lazy evaluation and task graph scheduling.",
    "Numba compiles Python functions to native machine code using LLVM, bypassing the GIL.",
    "The multiprocessing.Manager class enables shared state between processes via a proxy server.",
]


async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = InMemoryVectorStore(embeddings=embeddings)

    await vectorstore.aadd(DOCS)

    base_retriever = VectorRetriever(vectorstore=vectorstore, top_k=20)
    reranker = CrossEncoderReranker(
        model="cross-encoder/ms-marco-MiniLM-L-6-v2",
        top_k=5,
    )

    rag = RAG(llm=llm, retriever=base_retriever, reranker=reranker)

    questions = [
        "What is the best way to run CPU-bound Python code in parallel?",
        "How does asyncio handle concurrency without threads?",
        "What is the difference between asyncio.Queue and queue.Queue?",
    ]

    for question in questions:
        print(f"Q: {question}")
        result = await rag.aquery(question)
        print(f"A: {result.answer}\n")


asyncio.run(main())
```

## Expected output

```
Q: What is the best way to run CPU-bound Python code in parallel?
A: For CPU-bound Python code, multiprocessing is the recommended approach because it bypasses the Global Interpreter Lock (GIL) by running each process in a separate Python interpreter. The concurrent.futures module provides a convenient ProcessPoolExecutor interface. For ML workloads specifically, Ray offers distributed computing with better resource scheduling. Numba is another option for numeric code — it compiles Python functions to native machine code via LLVM, eliminating the GIL entirely.

Q: How does asyncio handle concurrency without threads?
A: asyncio uses cooperative multitasking via an event loop. Coroutines — defined with async/await — yield control back to the event loop at each await point, allowing other coroutines to run. This avoids the overhead and synchronisation complexity of threads. asyncio.gather() runs multiple coroutines concurrently in the same event loop. For a faster event loop, uvloop can replace the default implementation.

Q: What is the difference between asyncio.Queue and queue.Queue?
A: queue.Queue is thread-safe and designed for producer-consumer patterns with Python threads. asyncio.Queue is coroutine-safe but not thread-safe — it is designed for async workflows where producers and consumers are coroutines running in the same event loop.
```

## How it works

**Stage 1 — Bi-encoder retrieval.** The query and each document are independently embedded into dense vectors. Retrieval is a nearest-neighbour search over pre-computed document embeddings, which can be done in sub-millisecond time. The result is a large candidate set (k=20) optimised for recall — you want the correct document to be in this set, even if it is ranked 15th.

**Stage 2 — Cross-encoder reranking.** The cross-encoder takes each (query, document) pair as a single input and scores it in one forward pass. Because the query and document tokens interact via attention layers, the model can capture fine-grained relevance signals that bi-encoder embeddings miss. This is significantly slower per document, which is why the candidate pool must be pre-filtered before this step.

**Why the combination works.** Bi-encoders have high recall at low precision — they find most of the relevant documents but include many irrelevant ones. Cross-encoders have high precision but cannot scale to full corpora. Two-stage retrieval gets the benefits of both: exhaustive recall from the bi-encoder, precise ranking from the cross-encoder.

## Variations

**Batch reranking for throughput.** When processing multiple queries simultaneously, batch the reranking calls to maximise GPU utilisation:

```python
reranker = CrossEncoderReranker(
    model="cross-encoder/ms-marco-MiniLM-L-6-v2",
    top_k=5,
    batch_size=32,  # score 32 (query, doc) pairs per forward pass
)
```

**Cascade reranking.** For very large candidate pools, add a lightweight bi-encoder reranker as a second stage before the cross-encoder:

```python
from synapsekit.rerankers import BiEncoderReranker, CrossEncoderReranker

stage2 = BiEncoderReranker(model="sentence-transformers/msmarco-distilbert-base-v4", top_k=10)
stage3 = CrossEncoderReranker(model="cross-encoder/ms-marco-MiniLM-L-6-v2", top_k=5)
```

**Score threshold filtering.** Reject documents below a cross-encoder score threshold instead of keeping a fixed top-k:

```python
reranker = CrossEncoderReranker(
    model="cross-encoder/ms-marco-MiniLM-L-6-v2",
    top_k=5,
    score_threshold=0.3,  # drop candidates scoring below 0.3 even if fewer than top_k remain
)
```

## Troubleshooting

**Reranking is slow.** The cross-encoder runs inference on every candidate. On CPU, scoring 20 candidates takes 200–500 ms depending on document length. Use a quantised model (`cross-encoder/ms-marco-MiniLM-L-6-v2` is already small) or switch to an API-based reranker for production.

**Reranked results are worse than plain retrieval.** Check that `top_k=20` on the base retriever is large enough. If the correct document is not in the candidate pool, reranking cannot surface it. Increase the candidate pool size first.

**Cross-encoder model fails to load.** Ensure `sentence-transformers` is installed. Run `pip install sentence-transformers` if not.

**Score distribution is flat.** If all cross-encoder scores cluster around 0.5, the candidate documents are too similar to each other. Ensure your corpus has genuine topical variety, or reduce the candidate pool size.

## Next steps

- [RAG Fusion](./rag-fusion) — generate a richer candidate pool before reranking using multi-query fusion
- [Self-RAG](./self-rag) — after reranking, grade the top-k for hallucination before generation
- [Parent Document Retriever](./parent-document-retriever) — rerank parent chunks (full-context documents) rather than small child chunks
