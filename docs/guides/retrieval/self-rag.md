---
sidebar_position: 4
title: "Self-RAG: Retrieval with Quality Grading"
description: "Build a retrieval pipeline that grades its own retrieved documents for relevance, detects hallucinations in generated answers, and retries when quality is insufficient using SynapseKit's SelfRAGPipeline."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Self-RAG: Retrieval with Quality Grading

<ColabBadge path="retrieval/self-rag.ipynb" />

Standard RAG pipelines pass retrieved documents to the LLM unconditionally. When the retriever returns low-quality results, the LLM either fabricates an answer or says it cannot help — and neither outcome is visible to the caller. Self-RAG introduces an explicit quality loop: retrieved documents are graded for relevance before generation, generated answers are checked for grounding after generation, and the pipeline retries with a rewritten query if either check fails. This makes quality failures visible and recoverable rather than silent.

**What you'll build:** A self-grading RAG pipeline that evaluates document relevance, generates an answer, checks whether that answer is supported by the retrieved context, and retries up to N times when grading fails. **Time:** ~25 min. **Difficulty:** Advanced

## Prerequisites

- Completed the [Basic RAG](../rag/) guide
- Understanding of evaluation metrics and LLM-as-judge patterns
- `pip install synapsekit`
- `OPENAI_API_KEY` set in your environment

## What you'll learn

- How `SelfRAGPipeline` implements the relevance and hallucination grading loop
- How to configure retry behaviour and grading thresholds
- How to read grading decisions from the pipeline's response metadata
- When to use Self-RAG and what it cannot guard against

## Step 1: Install and configure

```python
import asyncio
import os

from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.pipelines import SelfRAGPipeline

llm = OpenAILLM(model="gpt-4o-mini")
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = InMemoryVectorStore(embeddings=embeddings)
```

## Step 2: Load documents

```python
docs = [
    "The Eiffel Tower was completed in 1889 and stands 330 metres tall including its antenna.",
    "Paris is the capital of France and has a population of approximately 2.1 million in the city proper.",
    "The Louvre is the world's most visited art museum, located on the Right Bank of the Seine in Paris.",
    "French is the official language of France and one of the six official languages of the United Nations.",
    "The French Revolution began in 1789 with the storming of the Bastille on July 14th.",
]

await vectorstore.aadd(docs)
```

## Step 3: Configure the SelfRAGPipeline

The grading thresholds are the most important configuration decision. A relevance threshold of 0.7 means a retrieved document must score 0.7 or higher on the 0–1 relevance scale to be included in the generation context. A hallucination threshold of 0.8 means the answer must be grounded in the context at 80% confidence or higher, otherwise a retry is triggered.

```python
pipeline = SelfRAGPipeline(
    llm=llm,
    vectorstore=vectorstore,
    embeddings=embeddings,
    relevance_threshold=0.7,       # documents below this score are filtered out before generation
    hallucination_threshold=0.8,   # answers below this grounding score trigger a retry
    max_retries=3,                 # maximum number of query-rewrite + regeneration cycles
    top_k=6,                       # retrieve more candidates so filtering has room to work
)
```

## Step 4: Run a query and inspect grading decisions

```python
async def graded_query():
    result = await pipeline.aquery("How tall is the Eiffel Tower?")
    print(f"Answer: {result.answer}\n")
    print(f"Retries: {result.num_retries}")
    print(f"Hallucination score: {result.hallucination_score:.2f}")
    print(f"\nDocument grades:")
    for doc, grade in result.document_grades:
        status = "INCLUDED" if grade.score >= 0.7 else "FILTERED"
        print(f"  [{status} {grade.score:.2f}] {doc[:70]}")

asyncio.run(graded_query())
```

## Step 5: Trigger a retry by asking about something not in the documents

This demonstrates the retry loop. The pipeline will attempt to retrieve relevant context, fail the relevance grade, rewrite the query, and try again. After `max_retries` attempts it returns the best answer it found along with a low confidence score.

```python
async def missing_context_query():
    result = await pipeline.aquery("What is the population of Lyon?")
    print(f"Answer: {result.answer}")
    print(f"Retries: {result.num_retries}")
    print(f"Hallucination score: {result.hallucination_score:.2f}")
    print(f"Confidence: {result.confidence}")  # 'low', 'medium', or 'high'

asyncio.run(missing_context_query())
```

## Step 6: Stream a graded answer

When streaming, grading happens before the first token is yielded. The `astream` method yields an initial metadata chunk followed by the answer tokens.

```python
async def stream_graded():
    question = "When did the French Revolution begin?"
    print(f"Q: {question}\n")
    async for chunk in pipeline.astream(question):
        if chunk.is_metadata:
            print(f"[grade: {chunk.hallucination_score:.2f}, retries: {chunk.num_retries}]")
        else:
            print(chunk.text, end="", flush=True)
    print()

asyncio.run(stream_graded())
```

## Step 7: Use a stronger grader model

The default grader uses the same LLM as generation. For higher-stakes use cases, use a more capable model specifically for grading while keeping generation on the cheaper model.

```python
from synapsekit.llms.openai import OpenAILLM

grader_llm = OpenAILLM(model="gpt-4o")

pipeline = SelfRAGPipeline(
    llm=llm,               # generation model — cost-efficient
    grader_llm=grader_llm, # grading model — higher accuracy
    vectorstore=vectorstore,
    embeddings=embeddings,
    relevance_threshold=0.7,
    hallucination_threshold=0.8,
    max_retries=3,
    top_k=6,
)
```

## Complete working example

```python
import asyncio
import os

from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.pipelines import SelfRAGPipeline

DOCS = [
    "The Eiffel Tower was completed in 1889 and stands 330 metres tall including its antenna.",
    "Paris is the capital of France and has a population of approximately 2.1 million in the city proper.",
    "The Louvre is the world's most visited art museum, located on the Right Bank of the Seine in Paris.",
    "French is the official language of France and one of the six official languages of the United Nations.",
    "The French Revolution began in 1789 with the storming of the Bastille on July 14th.",
]


async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = InMemoryVectorStore(embeddings=embeddings)

    await vectorstore.aadd(DOCS)

    pipeline = SelfRAGPipeline(
        llm=llm,
        vectorstore=vectorstore,
        embeddings=embeddings,
        relevance_threshold=0.7,
        hallucination_threshold=0.8,
        max_retries=3,
        top_k=6,
    )

    questions = [
        "How tall is the Eiffel Tower?",
        "When did the French Revolution begin?",
        "What is the population of Lyon?",  # not in documents — will trigger retries
    ]

    for question in questions:
        result = await pipeline.aquery(question)
        print(f"Q: {question}")
        print(f"A: {result.answer}")
        print(f"   Confidence: {result.confidence} | Hallucination score: {result.hallucination_score:.2f} | Retries: {result.num_retries}\n")


asyncio.run(main())
```

## Expected output

```
Q: How tall is the Eiffel Tower?
A: The Eiffel Tower stands 330 metres tall including its antenna and was completed in 1889.
   Confidence: high | Hallucination score: 0.97 | Retries: 0

Q: When did the French Revolution begin?
A: The French Revolution began in 1789 with the storming of the Bastille on July 14th.
   Confidence: high | Hallucination score: 0.99 | Retries: 0

Q: What is the population of Lyon?
A: The provided documents do not contain information about the population of Lyon.
   Confidence: low | Hallucination score: 0.45 | Retries: 3
```

## How it works

**Relevance grading.** After retrieval, each candidate document is scored by the grader LLM on a 0–1 scale for relevance to the query. Documents below `relevance_threshold` are removed from the context before generation. This prevents low-quality documents from polluting the LLM's context window.

**Generation.** The LLM generates an answer using only the documents that passed the relevance grade. If no documents pass, the pipeline either returns a "cannot answer" response or begins a retry cycle, depending on configuration.

**Hallucination grading.** The generated answer is evaluated against the retrieved context by the grader LLM. The grader is prompted to determine what fraction of the answer's claims are directly supported by the context. The result is the `hallucination_score`. A score below `hallucination_threshold` means the answer contains claims not grounded in the retrieved documents.

**Retry loop.** When hallucination grading fails, the pipeline rewrites the query using the LLM to try a different angle, retrieves again, and regenerates. This cycle repeats up to `max_retries` times. The final answer is the one with the highest hallucination score across all attempts.

**Why this is not a silver bullet.** Grading is itself LLM-driven and can be wrong. A hallucination score of 0.95 means the grader believes the answer is well-supported — not that it is factually correct. Self-RAG reduces hallucinations; it does not eliminate them. The highest-confidence answers still require human review in high-stakes settings.

## Variations

**Disable retries, keep grading.** Use Self-RAG for monitoring without retrying:

```python
pipeline = SelfRAGPipeline(
    ...,
    max_retries=0,  # grade and report, but never retry
)
```

**Expose grading to the caller.** Return the raw grading decisions for downstream logging or user-facing confidence indicators:

```python
result = await pipeline.aquery(question, return_grades=True)
for doc, grade in result.document_grades:
    print(f"{grade.score:.2f} — {doc[:60]}")
```

**Use a custom grading prompt.** The default prompt is domain-agnostic. For legal or medical documents, a domain-specific grading prompt improves accuracy:

```python
pipeline = SelfRAGPipeline(
    ...,
    relevance_prompt=(
        "You are a legal document analyst. Score the following document's relevance "
        "to the query on a scale of 0.0 to 1.0, where 1.0 means the document "
        "directly answers the legal question asked.\n\nQuery: {query}\nDocument: {document}"
    ),
)
```

## Troubleshooting

**Every answer triggers retries even for simple questions.** The `hallucination_threshold` may be set too high. Try 0.7 as a starting point and raise it only after observing grading behaviour on your specific documents.

**Grading is inconsistent across runs.** LLM-based grading has stochastic variance. Set `temperature=0` on the grader LLM to make grades deterministic.

**Retries do not improve the answer.** If the required information is genuinely absent from your documents, retries will not help. Check whether the answer exists in your corpus before diagnosing the grading configuration.

**Relevance grading filters too aggressively.** Reduce `relevance_threshold` or increase `top_k` so more documents reach the grader. If the vector retriever is consistently returning irrelevant results, that is an embedding or chunking problem, not a Self-RAG problem.

## Next steps

- [RAG Fusion](./rag-fusion) — generate better candidate documents to grade in the first place
- [Cross-Encoder Reranking](./cross-encoder-reranking) — rerank before grading to reduce the grader's workload
- [Adaptive RAG](./adaptive-rag) — route queries by complexity so Self-RAG's grading loop is only used for difficult questions
