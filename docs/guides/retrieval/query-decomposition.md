---
sidebar_position: 6
title: "Query Decomposition"
description: "Improve retrieval accuracy for complex, multi-part questions by breaking them into focused sub-queries, retrieving for each independently, and synthesizing the results with SynapseKit."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Query Decomposition

<ColabBadge path="retrieval/query-decomposition.ipynb" />

A question like "Compare the climate policies of Germany and Japan and explain how each affects their automotive industry" is too compound for a single vector search. The query touches climate policy, Germany, Japan, and the automotive sector across at least four distinct information needs. Embedding the full question and searching once produces a result set that partially satisfies each need but fully satisfies none. Query decomposition solves this by using the LLM to break the compound question into independent, focused sub-queries, retrieving for each separately, and then synthesizing a single answer from all the retrieved context.

**What you'll build:** A retrieval pipeline that decomposes complex questions into sub-queries, retrieves documents for each in parallel, deduplicates the combined result set, and synthesizes a coherent answer. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

- Completed the [Basic RAG](../rag/) guide
- `pip install synapsekit`
- `OPENAI_API_KEY` set in your environment

## What you'll learn

- How `QueryDecomposer` generates and structures sub-queries
- Why parallel retrieval per sub-query outperforms a single compound-query search
- How to configure the synthesis step to produce coherent multi-part answers
- How to inspect and override the generated sub-queries

## Step 1: Install and configure

```python
import asyncio
import os

from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.retrievers import DecompositionRetriever

llm = OpenAILLM(model="gpt-4o-mini")
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = InMemoryVectorStore(embeddings=embeddings)
```

## Step 2: Load a document corpus covering multiple topics

```python
docs = [
    # Climate policy — Germany
    "Germany's Energiewende policy targets 80% renewable electricity by 2030 and carbon neutrality by 2045.",
    "Germany's carbon pricing system covers industry and transport under the national emissions trading scheme.",
    "Germany has invested over €50 billion in offshore wind capacity since 2010.",

    # Climate policy — Japan
    "Japan's Green Growth Strategy targets carbon neutrality by 2050, focusing on hydrogen and ammonia power.",
    "Japan introduced a carbon tax in 2012 at a rate of ¥289 per tonne of CO2.",
    "Japan's feed-in tariff scheme accelerated solar deployment, adding 70GW of capacity by 2023.",

    # Automotive industry — Germany
    "Volkswagen, BMW, and Mercedes-Benz are investing over €300 billion in EV transition through 2030.",
    "Germany's automotive sector employs 800,000 workers directly and faces significant transition risk.",
    "The EU's 2035 combustion engine ban directly affects German OEMs, accelerating their EV roadmaps.",

    # Automotive industry — Japan
    "Toyota leads Japan's automotive sector with the world's best-selling hybrid lineup.",
    "Japan's automotive industry accounts for 10% of GDP and 20% of total exports.",
    "Honda and Nissan announced a merger in 2024 to pool EV development resources.",
]

await vectorstore.aadd(docs)
```

## Step 3: Configure the DecompositionRetriever

`max_subqueries` caps the number of sub-queries generated. For most compound questions, 3–5 sub-queries cover the independent information needs without over-fragmenting.

```python
retriever = DecompositionRetriever(
    vectorstore=vectorstore,
    llm=llm,
    max_subqueries=5,      # upper bound on decomposition depth
    top_k_per_query=3,     # documents retrieved per sub-query before deduplication
    deduplicate=True,      # remove duplicate documents across sub-query result sets
)
```

## Step 4: Inspect the decomposition

Before running a full pipeline, inspect the sub-queries the LLM generates to verify they are independent and cover the question's information needs.

```python
async def inspect_decomposition():
    question = "Compare the climate policies of Germany and Japan and explain how each affects their automotive industry."
    subqueries = await retriever.adecompose(question)
    print(f"Decomposed '{question[:50]}...' into {len(subqueries)} sub-queries:\n")
    for i, sq in enumerate(subqueries, 1):
        print(f"  {i}. {sq}")

asyncio.run(inspect_decomposition())
```

Expected decomposition output:
```
Decomposed 'Compare the climate policies of Germany and Japan...' into 4 sub-queries:

  1. What is Germany's climate policy and emissions reduction targets?
  2. What is Japan's climate policy and carbon neutrality strategy?
  3. How does Germany's climate policy affect its automotive industry?
  4. How does Japan's climate policy affect its automotive industry?
```

## Step 5: Retrieve across sub-queries

```python
async def decomposed_retrieve():
    question = "Compare the climate policies of Germany and Japan and explain how each affects their automotive industry."
    results = await retriever.aretrieve(question)
    print(f"Total documents after deduplication: {len(results)}\n")
    for doc, score in results:
        print(f"[{score:.3f}] {doc[:80]}")

asyncio.run(decomposed_retrieve())
```

## Step 6: Wire into a RAG pipeline and ask the full question

```python
rag = RAG(llm=llm, retriever=retriever)
```

## Step 7: Stream a structured answer

```python
async def ask(question: str):
    print(f"Q: {question}\n")
    async for chunk in rag.astream(question):
        print(chunk, end="", flush=True)
    print()

asyncio.run(ask(
    "Compare the climate policies of Germany and Japan and explain how each affects their automotive industry."
))
```

## Step 8: Handle a sequential decomposition (step-by-step reasoning)

Some questions have dependencies between sub-queries — the answer to sub-query 2 depends on the answer to sub-query 1. Use `mode="sequential"` to answer sub-queries in order, passing each answer as context for the next.

```python
retriever_seq = DecompositionRetriever(
    vectorstore=vectorstore,
    llm=llm,
    max_subqueries=4,
    top_k_per_query=3,
    mode="sequential",  # answer each sub-query in order; prior answers inform later retrievals
)

rag_seq = RAG(llm=llm, retriever=retriever_seq)
```

## Complete working example

```python
import asyncio
import os

from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.retrievers import DecompositionRetriever

DOCS = [
    "Germany's Energiewende policy targets 80% renewable electricity by 2030 and carbon neutrality by 2045.",
    "Germany's carbon pricing system covers industry and transport under the national emissions trading scheme.",
    "Germany has invested over €50 billion in offshore wind capacity since 2010.",
    "Japan's Green Growth Strategy targets carbon neutrality by 2050, focusing on hydrogen and ammonia power.",
    "Japan introduced a carbon tax in 2012 at a rate of ¥289 per tonne of CO2.",
    "Japan's feed-in tariff scheme accelerated solar deployment, adding 70GW of capacity by 2023.",
    "Volkswagen, BMW, and Mercedes-Benz are investing over €300 billion in EV transition through 2030.",
    "Germany's automotive sector employs 800,000 workers directly and faces significant transition risk.",
    "The EU's 2035 combustion engine ban directly affects German OEMs, accelerating their EV roadmaps.",
    "Toyota leads Japan's automotive sector with the world's best-selling hybrid lineup.",
    "Japan's automotive industry accounts for 10% of GDP and 20% of total exports.",
    "Honda and Nissan announced a merger in 2024 to pool EV development resources.",
]


async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = InMemoryVectorStore(embeddings=embeddings)

    await vectorstore.aadd(DOCS)

    retriever = DecompositionRetriever(
        vectorstore=vectorstore,
        llm=llm,
        max_subqueries=5,
        top_k_per_query=3,
        deduplicate=True,
    )

    rag = RAG(llm=llm, retriever=retriever)

    question = (
        "Compare the climate policies of Germany and Japan and explain "
        "how each affects their automotive industry."
    )

    # Show what sub-queries were generated
    subqueries = await retriever.adecompose(question)
    print("Sub-queries generated:")
    for i, sq in enumerate(subqueries, 1):
        print(f"  {i}. {sq}")
    print()

    # Run the full pipeline
    print(f"Q: {question}\n")
    result = await rag.aquery(question)
    print(f"A: {result.answer}")


asyncio.run(main())
```

## Expected output

```
Sub-queries generated:
  1. What is Germany's climate policy and renewable energy targets?
  2. What is Japan's climate policy and carbon neutrality plan?
  3. How does Germany's climate policy affect its automotive industry?
  4. How does Japan's climate policy affect its automotive industry?

Q: Compare the climate policies of Germany and Japan and explain how each affects their automotive industry.

A: Germany and Japan have both committed to carbon neutrality but pursue it through different mechanisms.

Germany's Energiewende targets 80% renewable electricity by 2030 and full carbon neutrality by 2045, backed by a national carbon pricing scheme and €50 billion in offshore wind investment. For Germany's automotive sector — which employs 800,000 workers — the EU's 2035 combustion engine ban is the most direct pressure point, forcing Volkswagen, BMW, and Mercedes-Benz to commit over €300 billion combined to EV transition.

Japan's Green Growth Strategy targets carbon neutrality by 2050 with a technology-agnostic approach emphasising hydrogen, ammonia, and advanced solar. Japan's automotive industry is proportionally larger (10% of GDP, 20% of exports) and has historically focused on hybrids rather than full EVs. Toyota's hybrid dominance reflects this strategy. The Honda-Nissan merger signals that EV transition pressure is now forcing consolidation.
```

## How it works

**Decomposition.** The LLM receives the original question and a prompt asking it to identify the independent information needs within it. Each need becomes a focused sub-query. The decomposition is structured output — the LLM returns a JSON array of strings, not free text, so the retriever can iterate over the sub-queries reliably.

**Parallel retrieval.** All sub-queries are sent to the vector store concurrently using `asyncio.gather`. This means a 4-sub-query decomposition takes approximately the same wall-clock time as a single retrieval.

**Deduplication.** Across N sub-query result sets, many documents will appear in multiple lists. With `deduplicate=True`, the retriever keeps each document once, using the highest score it received across all sub-query retrievals.

**Synthesis.** The RAG pipeline passes the deduplicated, combined context to the LLM with the original question. The synthesis prompt instructs the LLM to structure its answer to address all the identified sub-questions.

**Sequential mode.** In `mode="sequential"`, sub-queries are answered one at a time. The answer to each sub-query is added to the context for the next retrieval. This is slower but produces better results for questions where sub-query answers build on each other.

## Variations

**Provide sub-queries manually.** Skip LLM decomposition when you know the sub-queries upfront:

```python
results = await retriever.aretrieve(
    question,
    subqueries=[
        "Germany climate policy renewable targets",
        "Japan climate policy carbon neutrality",
        "Germany automotive EV transition",
        "Japan automotive hybrid market",
    ],
)
```

**Limit decomposition to truly compound questions.** Use a lightweight classifier to skip decomposition for simple single-intent queries:

```python
retriever = DecompositionRetriever(
    ...,
    decompose_threshold=0.6,  # only decompose if complexity score exceeds this
)
```

**Use a stronger model for decomposition only.** The decomposition step is critical but short — use a stronger model there and keep generation on the cheaper one:

```python
decomposer_llm = OpenAILLM(model="gpt-4o")
retriever = DecompositionRetriever(
    vectorstore=vectorstore,
    llm=llm,               # used for synthesis
    decomposer_llm=decomposer_llm,  # used for sub-query generation
    max_subqueries=5,
)
```

## Troubleshooting

**Decomposition generates redundant sub-queries.** The LLM is over-fragmenting the question. Reduce `max_subqueries` or add an instruction to the decomposition prompt: "Generate the minimum number of sub-queries needed — do not split unless the information needs are truly independent."

**Sub-queries return overlapping documents.** This is expected and handled by `deduplicate=True`. It is not a problem unless the deduplication is removing documents you need from later sub-queries — in that case, check that your corpus has enough document diversity.

**Sequential mode is too slow.** Sequential mode is linear in the number of sub-queries. Use it only when sub-query answers genuinely depend on each other. For independent sub-queries, `mode="parallel"` is always faster.

**The synthesized answer misses one of the sub-topics.** The LLM may have truncated context if the combined document set is too large. Reduce `top_k_per_query` to keep the total context within the model's usable context window.

## Next steps

- [RAG Fusion](./rag-fusion) — apply multi-query fusion within each sub-query for even better per-sub-query retrieval
- [GraphRAG](./graph-rag) — for multi-hop questions where sub-queries have entity dependencies
- [Cross-Encoder Reranking](./cross-encoder-reranking) — rerank the deduplicated combined result set before synthesis
