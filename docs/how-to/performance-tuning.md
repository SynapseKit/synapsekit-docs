---
sidebar_position: 10
---

# Performance Tuning

This is the long-form performance playbook for SynapseKit. It focuses on the four levers that actually move the needle:

1. **Concurrency knobs** — reduce wall-clock latency by running independent work in parallel.
2. **Caching strategies** — avoid redundant LLM calls and re-embedding.
3. **Batch APIs** — amortize overhead across many inputs.
4. **Profiling cookbook** — measure, don’t guess.

If you want only one takeaway: **framework overhead is tiny; network/LLM time dominates.** The biggest gains come from *fewer calls*, *parallel calls*, and *cache hits*.

---

## Prerequisites

```bash
pip install synapsekit[openai]
# Optional (for caching + tracing examples below)
pip install synapsekit[cache,redis,otel]
```

---

## Performance model (where time goes)

A typical SynapseKit request spends time in four buckets:

```
Total latency = retrieval + generation + tool calls + framework overhead
```

SynapseKit’s own overhead is usually sub-millisecond. The [Benchmarks](../benchmarks) page shows representative numbers:

| Area | Metric | Baseline (overhead only) |
|---|---|---|
| LLM | `generate()` (OpenAI) | +0.3 ms |
| LLM | `stream()` first token | +0.4 ms |
| RAG | `RAGPipeline.add()` (100 chunks, InMemory) | ~12 ms |
| RAG | `RAGPipeline.aquery()` retrieval (InMemory, k=5) | +1.2 ms |
| Graph | 5-node parallel graph overhead | +1.1 ms |
| Memory | In-memory read/write | <0.1 ms |
| Memory | Redis read/write | ~1.0–1.5 ms |

**Implication:** Don’t obsess over micro-optimizing the framework. **Optimize LLM calls, retrieval, and parallelization.**

---

# 1) Concurrency knobs

## 1.1 Use async end-to-end

If you’re calling multiple independent LLMs or pipelines, run them concurrently. Use `asyncio.gather()` and cap concurrency with a semaphore.

```python
import asyncio
from synapsekit import LLMConfig
from synapsekit.llm.openai import OpenAILLM

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

sem = asyncio.Semaphore(8)  # cap concurrency to avoid rate limits

async def guarded_generate(prompt: str) -> str:
    async with sem:
        return await llm.generate(prompt)

async def main():
    prompts = [f"Question {i}" for i in range(20)]
    results = await asyncio.gather(*[guarded_generate(p) for p in prompts])
    print(results[:2])

asyncio.run(main())
```

**Benchmark note:** For parallelizable work, wall time approaches the slowest task, not the sum. Use this to reduce P99 latency for fan-out workflows.

---

## 1.2 Parallel graph nodes (fan-out / fan-in)

Use graph parallelism when multiple steps don’t depend on each other. SynapseKit supports this directly via `add_parallel_edges()` and `add_join_edge()`.

```python
from dataclasses import dataclass
from synapsekit.graph import StateGraph
from synapsekit.llm.openai import OpenAILLM
from synapsekit import LLMConfig

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

@dataclass
class State:
    text: str
    summary: str = ""
    sentiment: str = ""
    keywords: str = ""

async def summarize(state: State) -> State:
    state.summary = await llm.generate(f"Summarize: {state.text}")
    return state

async def sentiment(state: State) -> State:
    state.sentiment = await llm.generate(f"Sentiment: {state.text}")
    return state

async def keywords(state: State) -> State:
    state.keywords = await llm.generate(f"Keywords: {state.text}")
    return state

async def merge(state: State) -> State:
    # Merge happens after all parallel branches finish
    return state

graph = StateGraph(State)
graph.add_node("summarize", summarize)
graph.add_node("sentiment", sentiment)
graph.add_node("keywords", keywords)
graph.add_node("merge", merge)
graph.set_entry_point("summarize")
graph.add_parallel_edges("summarize", ["sentiment", "keywords"])
graph.add_join_edge(["summarize", "sentiment", "keywords"], "merge")
compiled = graph.compile()
```

**Benchmark note:** The [Benchmarks](../benchmarks) page shows a **5-node parallel graph adds ~1.1 ms overhead** — essentially free compared to LLM latency.

---

## 1.3 Parallel agent execution

If you have multiple specialist agents (analysis, retrieval, summarization), fan them out in parallel. See [Parallel Agent Execution](../guides/multi-agent/parallel-agent-execution) for a complete pattern.

```python
# Quick sketch
results = await asyncio.gather(
    agent_a.run("task A"),
    agent_b.run("task B"),
    agent_c.run("task C"),
)
```

---

## 1.4 Backpressure: rate limiting and retries

Concurrency without rate limits can hurt performance due to provider throttling. Use `requests_per_minute` and retries in `LLMConfig`.

```python
llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    max_retries=3,
    retry_delay=0.5,
    requests_per_minute=60,
))
```

This prevents 429 storms and smooths throughput during spikes.

---

## 1.5 Streaming = better perceived latency

Even if total latency is unchanged, streaming reduces **time-to-first-token**. This often matters more to users than absolute completion time.

```python
async for token in llm.stream("Explain RAG in one sentence"):
    print(token, end="", flush=True)
```

---

# 2) Caching strategies

## 2.1 Exact-match response caching (LLMConfig)

Enable built-in LRU caching for identical prompts. It’s the fastest win for repeated questions or deterministic pipelines.

```python
llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    cache=True,
    cache_maxsize=256,
))

# First call hits API
await llm.generate("What is SynapseKit?")

# Second call hits cache
await llm.generate("What is SynapseKit?")
```

**Benchmark note:** In-memory reads/writes are **<0.1 ms** in the benchmarks, so cache hits are effectively instant compared to network calls.

---

## 2.2 Persistent caches (SQLite / filesystem / Redis)

Use a persistent backend when you want cache hits across restarts or multiple workers.

```python
llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    cache=True,
    cache_backend="sqlite",
    cache_db_path="llm_cache.db",
))
```

| Backend | Best for | Latency (from benchmarks) |
|---|---|---|
| `memory` | single-process dev | <0.1 ms |
| `sqlite` | local persistence | ~1.2 ms read/write |
| `filesystem` | simplest disk cache | ~disk IO dependent |
| `redis` | shared cache across workers | ~1.0–1.5 ms |

---

## 2.3 Semantic caching (paraphrase hits)

Exact-match caching misses paraphrases. Semantic caching returns a cached response when similarity exceeds a threshold.

```python
from synapsekit import LLMConfig
from synapsekit.llm.openai import OpenAILLM
from synapsekit.cache import SQLiteCache

semantic_cache = SQLiteCache(
    path="./llm_cache.db",
    similarity_threshold=0.92,
    max_entries=10_000,
    ttl_seconds=86_400,
)

llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    cache_backend=semantic_cache,
))
```

**When to use:** FAQ-style apps, support bots, internal knowledge bases. **When not to use:** real-time data or questions where stale answers are unacceptable.

---

## 2.4 RAG persistence (skip re-embedding)

Embedding is often the slowest *offline* step. Save your vector store once and reload on startup.

```python
from synapsekit import RAG, RAGConfig, InMemoryVectorStore, SynapsekitEmbeddings, LLMConfig
from synapsekit.llm.openai import OpenAILLM

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))
store = InMemoryVectorStore(SynapsekitEmbeddings())
rag = RAG(RAGConfig(llm=llm, vector_store=store, k=5))

# Ingest once
await rag.aadd(["Doc 1", "Doc 2"])
rag.save("./index.npz")

# Next boot
rag.load("./index.npz")
```

---

## 2.5 Measure cache effectiveness

Track hit rates to confirm caching helps.

```python
await llm.generate("What is SynapseKit?")
await llm.generate("What is SynapseKit?")
print(llm.cache_stats)  # {"hits": 1, "misses": 1, "size": 1}
```

If hits are low, caching may be the wrong lever — improve prompt reuse or add semantic caching.

---

# 3) Batch APIs

## 3.1 Batch document ingestion

`RAG.add()` and `RAG.aadd()` accept a list of documents. This avoids per-document overhead and lets embeddings run in larger batches.

```python
await rag.aadd(
    [
        "Doc 1 text",
        "Doc 2 text",
        "Doc 3 text",
    ],
    metadata=[
        {"source": "doc1"},
        {"source": "doc2"},
        {"source": "doc3"},
    ],
)
```

**Benchmark note:** InMemory RAG adds **100 chunks in ~12 ms** (see [Benchmarks](../benchmarks)).

---

## 3.2 Batch embeddings

The embeddings backend already supports lists; take advantage of it when you control ingestion pipelines.

```python
from synapsekit import SynapsekitEmbeddings

embeddings = SynapsekitEmbeddings()
vecs = await embeddings.embed([
    "first text",
    "second text",
    "third text",
])
print(vecs.shape)  # (3, D)
```

Batching reduces Python overhead and maximizes vectorized compute.

---

## 3.3 Batch evaluation

Evaluation supports concurrent batches so offline quality checks don’t take hours.

```python
from synapsekit.evaluation import EvaluationPipeline, FaithfulnessMetric, RelevancyMetric
from synapsekit.llm.openai import OpenAILLM
from synapsekit import LLMConfig

judge_llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))
pipeline = EvaluationPipeline(
    metrics=[
        FaithfulnessMetric(llm=judge_llm),
        RelevancyMetric(llm=judge_llm),
    ]
)
results = await pipeline.evaluate_batch(samples, concurrency=8)
```

---

## 3.4 Manual batch with `asyncio.gather()`

If you’re processing multiple queries and there isn’t a dedicated batch API, treat a batch as a **concurrency window**.

```python
async def batch_generate(prompts: list[str], batch_size: int = 8):
    out = []
    for i in range(0, len(prompts), batch_size):
        chunk = prompts[i : i + batch_size]
        out.extend(await asyncio.gather(*[llm.generate(p) for p in chunk]))
    return out
```

This approach keeps memory and rate limits under control while still giving you throughput gains.

---

# 4) Profiling cookbook

## 4.1 Start with coarse timers

Measure retrieval vs generation first; don’t guess.

```python
import time

q = "What is SynapseKit?"

# Retrieval-only
start = time.perf_counter()
contexts = await rag.get_relevant_documents(q, k=5)
retrieval_ms = (time.perf_counter() - start) * 1000

# Full query
start = time.perf_counter()
answer = await rag.aquery(q)
full_ms = (time.perf_counter() - start) * 1000

print(f"retrieval_ms={retrieval_ms:.1f}  full_ms={full_ms:.1f}")
```

---

## 4.2 Trace every LLM call

Use `TracingMiddleware` to get spans with timings and metadata.

```python
from synapsekit import TracingMiddleware, TracingUI

middleware = TracingMiddleware()
traced_llm = middleware.wrap(llm)

await traced_llm.generate("Hello!")

# Save a local HTML trace viewer
TracingUI(middleware.spans).save("traces.html")
```

---

## 4.3 Token and cost tracking

Token counts correlate strongly with latency and cost.

```python
from synapsekit.observability import TokenTracer

tracer = TokenTracer(llm)
await tracer.generate("Explain vector databases")
print(tracer.tokens_used)
```

Use [CostTracker](../observability/cost-tracker) when you need dollar attribution.

---

## 4.4 Benchmark harness template

Run controlled microbenchmarks with warm-up and consistent payloads.

```python
import asyncio, time

async def bench(fn, n=20, warmup=3):
    for _ in range(warmup):
        await fn()
    start = time.perf_counter()
    for _ in range(n):
        await fn()
    return (time.perf_counter() - start) * 1000 / n

async def llm_call():
    await llm.generate("Summarize RAG in one sentence")

ms = await bench(llm_call)
print(f"avg_ms={ms:.1f}")
```

Use this harness to compare **before/after** when you change caching, parallelism, or prompt size.

---

## 4.5 Profiling checklist

- [ ] Measure **P50 / P95 / P99** latencies (not just averages)
- [ ] Split **retrieval vs generation** time
- [ ] Track **tokens in/out** for every call
- [ ] Enable **cache stats** and verify hit rate
- [ ] Cap concurrency to avoid 429s
- [ ] Use streaming when perceived latency matters

---

# Next steps

- [Benchmarks](../benchmarks) — official baseline numbers
- [Streaming](./streaming) — reduce time-to-first-token
- [Parallel Agent Execution](../guides/multi-agent/parallel-agent-execution) — fan-out patterns
- [Caching & Retries](../llms/caching-retries) — caching knobs and rate limits
- [Observability](../observability/overview) — tracing and cost tracking
