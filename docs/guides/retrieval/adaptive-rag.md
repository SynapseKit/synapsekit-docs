---
sidebar_position: 8
title: "Adaptive RAG"
description: "Reduce cost and latency by routing queries to a fast LLM or a strong LLM based on complexity scoring, using SynapseKit's AdaptiveRAGPipeline."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Adaptive RAG

<ColabBadge path="retrieval/adaptive-rag.ipynb" />

Not every query needs your best model. "What year was the Eiffel Tower built?" and "Analyse the trade-offs between Germany's emissions trading scheme and Japan's carbon tax given the structure of each country's industrial sector" are both valid user queries, but they differ enormously in the reasoning depth required. Routing them to the same model wastes money on simple queries and under-serves complex ones. Adaptive RAG uses a lightweight complexity classifier to route each query: simple queries go to a fast, cheap model; complex queries go to a stronger, slower model. The result is lower median cost without sacrificing quality on the queries that need it.

**What you'll build:** A RAG pipeline that scores each query for complexity, routes it to `fast_llm` or `strong_llm` accordingly, and logs routing decisions so you can tune the threshold over time. **Time:** ~20 min. **Difficulty:** Advanced

## Prerequisites

- Completed the [Basic RAG](../rag/) guide
- Familiarity with prompt routing patterns
- `pip install synapsekit`
- `OPENAI_API_KEY` set in your environment

## What you'll learn

- How `AdaptiveRAGPipeline` classifies query complexity
- How to configure routing thresholds and model assignments
- How to inspect routing decisions and tune the threshold against your query log
- When complexity routing is worth the overhead and when it is not

## Step 1: Install and configure

```python
import asyncio
import os

from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.pipelines import AdaptiveRAGPipeline

# Two models at different capability/cost trade-offs
fast_llm = OpenAILLM(model="gpt-4o-mini")   # cheap and fast for simple queries
strong_llm = OpenAILLM(model="gpt-4o")       # more capable for complex reasoning

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = InMemoryVectorStore(embeddings=embeddings)
```

## Step 2: Load documents

```python
docs = [
    "The Eiffel Tower was completed in 1889 and stands 330 metres tall.",
    "Paris is the capital of France with a population of approximately 2.1 million.",
    "Germany's Energiewende policy targets 80% renewable electricity by 2030.",
    "Germany's carbon pricing scheme covers industry and transport under an emissions trading system.",
    "Japan's Green Growth Strategy targets carbon neutrality by 2050 via hydrogen and ammonia.",
    "Japan introduced a carbon tax in 2012 at a rate of ¥289 per tonne of CO2.",
    "The EU Emissions Trading System (ETS) is a cap-and-trade scheme covering heavy industry.",
    "Carbon taxes set a fixed price per tonne; emissions trading caps total volume and lets the market set the price.",
    "Japan's automotive industry accounts for 10% of GDP and relies heavily on exports.",
    "Germany's automotive sector employs 800,000 workers and faces transition risk from the 2035 ICE ban.",
]

await vectorstore.aadd(docs)
```

## Step 3: Configure AdaptiveRAGPipeline

The `complexity_threshold` is the single most important tuning parameter. Queries scoring above the threshold are routed to `strong_llm`. Start at 0.5 and adjust after reviewing routing logs on your actual query distribution.

```python
pipeline = AdaptiveRAGPipeline(
    fast_llm=fast_llm,
    strong_llm=strong_llm,
    vectorstore=vectorstore,
    embeddings=embeddings,
    complexity_threshold=0.5,   # queries above this go to strong_llm
    top_k=5,
)
```

## Step 4: Inspect complexity scoring before running full queries

```python
async def score_queries():
    queries = [
        "What year was the Eiffel Tower completed?",                          # simple lookup
        "What is the population of Paris?",                                    # simple lookup
        "How does Germany's emissions trading scheme work?",                   # moderate
        "Analyse the trade-offs between Germany's ETS and Japan's carbon tax "
        "and explain how each policy affects industrial competitiveness.",      # complex
    ]

    for query in queries:
        score = await pipeline.aclassify_complexity(query)
        route = "strong_llm" if score >= 0.5 else "fast_llm"
        print(f"[{score:.2f} -> {route}] {query[:70]}")

asyncio.run(score_queries())
```

Expected output:
```
[0.08 -> fast_llm]   What year was the Eiffel Tower completed?
[0.11 -> fast_llm]   What is the population of Paris?
[0.41 -> fast_llm]   How does Germany's emissions trading scheme work?
[0.83 -> strong_llm] Analyse the trade-offs between Germany's ETS and Japan's carbo...
```

## Step 5: Run queries through the adaptive pipeline

```python
async def adaptive_query(question: str):
    result = await pipeline.aquery(question)
    print(f"Q: {question}")
    print(f"   Routed to: {result.model_used} (complexity: {result.complexity_score:.2f})")
    print(f"A: {result.answer[:200]}\n")
```

## Step 6: Stream responses with routing metadata

```python
async def stream_with_routing():
    question = "Analyse the trade-offs between Germany's ETS and Japan's carbon tax."
    print(f"Q: {question}\n")
    async for chunk in pipeline.astream(question):
        if chunk.is_metadata:
            print(f"[routed to {chunk.model_used}, complexity={chunk.complexity_score:.2f}]\n")
        else:
            print(chunk.text, end="", flush=True)
    print()

asyncio.run(stream_with_routing())
```

## Step 7: Review routing statistics across a query batch

After running the pipeline on a sample of your real queries, review the routing distribution to check whether the threshold is set appropriately. If 90% of queries are routed to `strong_llm`, the threshold is too low.

```python
async def batch_routing_stats():
    test_queries = [
        "What year was the Eiffel Tower completed?",
        "What is the population of Paris?",
        "How does Germany's carbon pricing work?",
        "Compare Germany and Japan's climate policies.",
        "What is the EU ETS?",
        "Analyse how Japan's carbon tax affects automotive export competitiveness.",
        "How tall is the Eiffel Tower?",
        "What are the trade-offs between carbon taxes and cap-and-trade systems?",
    ]

    stats = await pipeline.arun_batch(test_queries, return_stats=True)
    print(f"Total queries: {stats.total}")
    print(f"Routed to fast_llm:   {stats.fast_count} ({stats.fast_pct:.0f}%)")
    print(f"Routed to strong_llm: {stats.strong_count} ({stats.strong_pct:.0f}%)")
    print(f"Estimated cost saving vs all-strong: {stats.cost_saving_pct:.0f}%")

asyncio.run(batch_routing_stats())
```

## Step 8: Tune the threshold using routing labels

Once you have accumulated real query routing data, you can evaluate whether the threshold is calibrated correctly by comparing model-used to human-labelled query complexity.

```python
# After accumulating logs, adjust the threshold and re-run
pipeline.complexity_threshold = 0.6  # raise threshold if strong_llm is used too often
```

## Complete working example

```python
import asyncio
import os

from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.pipelines import AdaptiveRAGPipeline

DOCS = [
    "The Eiffel Tower was completed in 1889 and stands 330 metres tall.",
    "Paris is the capital of France with a population of approximately 2.1 million.",
    "Germany's Energiewende policy targets 80% renewable electricity by 2030.",
    "Germany's carbon pricing scheme covers industry and transport under an emissions trading system.",
    "Japan's Green Growth Strategy targets carbon neutrality by 2050 via hydrogen and ammonia.",
    "Japan introduced a carbon tax in 2012 at a rate of ¥289 per tonne of CO2.",
    "The EU Emissions Trading System (ETS) is a cap-and-trade scheme covering heavy industry.",
    "Carbon taxes set a fixed price per tonne; emissions trading caps total volume and lets the market set the price.",
    "Japan's automotive industry accounts for 10% of GDP and relies heavily on exports.",
    "Germany's automotive sector employs 800,000 workers and faces transition risk from the 2035 ICE ban.",
]

QUERIES = [
    ("simple", "What year was the Eiffel Tower completed?"),
    ("simple", "What is the population of Paris?"),
    ("moderate", "How does Germany's emissions trading scheme work?"),
    ("complex", "Analyse the trade-offs between Germany's ETS and Japan's carbon tax "
                "and explain how each policy affects industrial competitiveness."),
]


async def main():
    fast_llm = OpenAILLM(model="gpt-4o-mini")
    strong_llm = OpenAILLM(model="gpt-4o")
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = InMemoryVectorStore(embeddings=embeddings)

    await vectorstore.aadd(DOCS)

    pipeline = AdaptiveRAGPipeline(
        fast_llm=fast_llm,
        strong_llm=strong_llm,
        vectorstore=vectorstore,
        embeddings=embeddings,
        complexity_threshold=0.5,
        top_k=5,
    )

    for expected_complexity, question in QUERIES:
        result = await pipeline.aquery(question)
        print(f"[{expected_complexity.upper()}] Q: {question[:70]}")
        print(f"   Complexity score: {result.complexity_score:.2f} -> {result.model_used}")
        print(f"   A: {result.answer[:180]}\n")


asyncio.run(main())
```

## Expected output

```
[SIMPLE] Q: What year was the Eiffel Tower completed?
   Complexity score: 0.08 -> gpt-4o-mini
   A: The Eiffel Tower was completed in 1889.

[SIMPLE] Q: What is the population of Paris?
   Complexity score: 0.11 -> gpt-4o-mini
   A: Paris has a population of approximately 2.1 million people in the city proper.

[MODERATE] Q: How does Germany's emissions trading scheme work?
   Complexity score: 0.41 -> gpt-4o-mini
   A: Germany operates under the EU Emissions Trading System, a cap-and-trade scheme. A cap is set on total emissions from covered industries; companies must hold permits for each tonne of CO2 emitted. The total cap declines over time, creating a financial incentive to reduce emissions.

[COMPLEX] Q: Analyse the trade-offs between Germany's ETS and Japan's carbon tax...
   Complexity score: 0.83 -> gpt-4o
   A: Germany's ETS and Japan's carbon tax represent two distinct approaches to carbon pricing. Germany operates under the EU cap-and-trade system: a declining emissions cap creates price discovery through the market, but the carbon price is volatile and can be low during economic downturns...
```

## How it works

**Complexity classification.** The classifier scores each query on a 0–1 scale using a prompt that instructs the LLM to evaluate factors including: number of distinct entities mentioned, depth of reasoning required, whether comparison or analysis is needed, and whether the question has a simple factual answer. The classifier LLM is always `fast_llm` to keep the overhead minimal — it adds one cheap LLM call per query regardless of routing.

**Routing.** Queries with `complexity_score >= complexity_threshold` are sent to `strong_llm`; all others go to `fast_llm`. Both paths use the same retriever and the same context.

**Why classification overhead is acceptable.** A `gpt-4o-mini` classification call typically costs ~$0.0001 — two orders of magnitude less than a `gpt-4o` generation call. Saving even one in ten queries from being routed to `gpt-4o` pays for many thousands of classification calls.

**Threshold calibration.** The default threshold of 0.5 is conservative. In production, calibrate against your actual query log: label a sample of queries as simple/complex, run the classifier, and adjust the threshold to minimise misrouting. A threshold that sends 70–80% of queries to `fast_llm` is typical for general-purpose knowledge bases.

## Variations

**Three-tier routing.** Add a medium-tier model between fast and strong:

```python
from synapsekit.pipelines import AdaptiveRAGPipeline

medium_llm = OpenAILLM(model="gpt-4o-mini")  # or another mid-tier model

pipeline = AdaptiveRAGPipeline(
    fast_llm=fast_llm,
    medium_llm=medium_llm,
    strong_llm=strong_llm,
    complexity_threshold_medium=0.4,   # fast -> medium above this
    complexity_threshold_strong=0.7,   # medium -> strong above this
    vectorstore=vectorstore,
    embeddings=embeddings,
)
```

**Route by query category, not complexity.** Use a category classifier instead of a complexity scorer when the routing logic is better expressed as topic-based:

```python
pipeline = AdaptiveRAGPipeline(
    fast_llm=fast_llm,
    strong_llm=strong_llm,
    vectorstore=vectorstore,
    embeddings=embeddings,
    routing_mode="category",
    strong_categories=["legal", "medical", "financial"],  # always use strong_llm for these
)
```

**Combine with Self-RAG.** Apply Self-RAG grading only on queries routed to `strong_llm`, where quality expectations are higher:

```python
pipeline = AdaptiveRAGPipeline(
    fast_llm=fast_llm,
    strong_llm=strong_llm,
    vectorstore=vectorstore,
    embeddings=embeddings,
    complexity_threshold=0.5,
    strong_grading=True,   # enable Self-RAG quality grading for strong_llm queries only
)
```

## Troubleshooting

**All queries route to strong_llm.** The classifier may be using too broad a definition of complexity. Raise `complexity_threshold` incrementally (0.6, 0.7) and review the routing log after each change.

**Simple factual queries route to strong_llm.** Inspect the classifier's reasoning with `await pipeline.aclassify_complexity(query, return_reasoning=True)`. If the classifier is over-scoring, provide a few-shot example in the classification prompt that demonstrates a correctly low-scored factual query.

**Answers from fast_llm are lower quality than expected.** This is the expected trade-off. If `fast_llm` quality is unacceptable for your use case, either raise the threshold so more queries go to `strong_llm`, or switch `fast_llm` to a more capable model.

**Classification adds too much latency.** Classification runs before generation, adding one round-trip. If P50 latency matters more than cost, set `complexity_threshold=0` to always use `fast_llm`, or `complexity_threshold=1` to always use `strong_llm`, and remove the classification overhead entirely.

## Next steps

- [Self-RAG](./self-rag) — add quality grading for queries routed to the strong model
- [RAG Fusion](./rag-fusion) — apply multi-query fusion only for complex-routed queries to further improve recall
- [Cross-Encoder Reranking](./cross-encoder-reranking) — use a reranker selectively on strong-routed queries to maximise precision where it matters most
