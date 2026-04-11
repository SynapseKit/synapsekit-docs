---
sidebar_position: 5
title: "Semantic Response Caching"
description: "Cache LLM responses by semantic similarity using SQLite or Redis so repeated or paraphrased questions skip the API entirely."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Semantic Response Caching

<ColabBadge path="llms/semantic-caching.ipynb" />

Exact-match caching only helps when users ask the identical question twice. Semantic caching goes further: if a new query is semantically similar to a cached one (e.g. "What is Python?" vs "Tell me about Python"), the cache returns the existing answer without calling the LLM. This cuts costs and latency dramatically for applications with overlapping question patterns.

**What you'll build:** An LLM pipeline with semantic caching backed by SQLite (local) and Redis (production), with cache hit/miss rate logging and a configurable similarity threshold. **Time:** ~15 min. **Difficulty:** Beginner

## Prerequisites

```bash
pip install synapsekit[openai,cache]
# For Redis backend (optional):
pip install synapsekit[openai,cache,redis]
export OPENAI_API_KEY=sk-...
```

## What you'll learn

- Configure `cache_backend` in `LLMConfig` to enable semantic caching
- Use the built-in `SQLiteCache` for development and local testing
- Switch to `RedisCache` for production without changing application code
- Tune the `similarity_threshold` to control how aggressively the cache matches
- Inspect `CacheStats` to measure hit rates and cost savings

## Step 1: Set up a SQLite cache backend

```python
import asyncio
from synapsekit import LLMConfig
from synapsekit.llms.openai import OpenAILLM
from synapsekit.cache import SQLiteCache, CacheStats

# SQLiteCache stores embeddings and cached responses in a local .db file.
# It computes a semantic embedding for each query and returns the cached
# response if the cosine similarity exceeds the threshold.
cache = SQLiteCache(
    path="./llm_cache.db",
    similarity_threshold=0.92,   # 0 = cache everything, 1 = only exact matches
    max_entries=10_000,           # Evict oldest entries beyond this limit (LRU)
    ttl_seconds=86_400,           # Expire entries after 24 hours
)

# Pass the cache backend through LLMConfig — the LLM client checks it on every call.
config = LLMConfig(
    temperature=0.2,
    max_tokens=512,
    cache_backend=cache,
)

llm = OpenAILLM(model="gpt-4o-mini", config=config)
```

## Step 2: Make cached calls and observe hits

```python
async def demo_cache():
    stats = CacheStats()

    # First call — no cache entry yet, calls the API
    q1 = "What is Python?"
    print(f"Query 1: {q1!r}")
    r1 = await llm.agenerate(q1)
    stats.record_miss()
    print(f"  Answer: {r1.text[:80]}...")
    print(f"  Source: API call (cache miss)\n")

    # Semantically similar — should hit the cache
    q2 = "Tell me about the Python programming language."
    print(f"Query 2: {q2!r}")
    r2 = await llm.agenerate(q2)
    # The LLM client sets r2.cache_hit = True when served from cache
    if r2.cache_hit:
        stats.record_hit()
        print(f"  Answer: {r2.text[:80]}...")
        print(f"  Source: CACHE HIT (saved ~$0.0001)\n")
    else:
        stats.record_miss()
        print(f"  Answer: {r2.text[:80]}...")
        print(f"  Source: API call (similarity below threshold)\n")

    # Clearly unrelated — should miss
    q3 = "What is the boiling point of water?"
    print(f"Query 3: {q3!r}")
    r3 = await llm.agenerate(q3)
    stats.record_miss()
    print(f"  Answer: {r3.text[:80]}...")
    print(f"  Source: API call (cache miss)\n")

    print(f"Cache stats: {stats.hit_rate:.0%} hit rate  "
          f"({stats.hits} hits / {stats.total} total)")
```

## Step 3: Switch to Redis for production

```python
from synapsekit.cache import RedisCache

# RedisCache is a drop-in replacement for SQLiteCache.
# It stores embeddings in Redis with native TTL support.
redis_cache = RedisCache(
    url="redis://localhost:6379/0",
    similarity_threshold=0.92,
    ttl_seconds=3600,            # 1 hour TTL — shorter than SQLite for volatile content
    key_prefix="synapsekit:",    # Namespace keys to avoid collisions with other apps
)

# Swap the backend — nothing else changes
prod_config = LLMConfig(
    temperature=0.2,
    max_tokens=512,
    cache_backend=redis_cache,
)

prod_llm = OpenAILLM(model="gpt-4o-mini", config=prod_config)
```

## Step 4: Pre-populate the cache (warm-up)

```python
async def warm_cache(common_questions: list[str]):
    """Pre-generate answers for your most common questions at startup.

    This ensures the first users after a deploy get cache hits rather than
    cold API calls with higher latency.
    """
    print(f"Warming cache with {len(common_questions)} questions...")

    for question in common_questions:
        response = await llm.agenerate(question)
        print(f"  Cached: {question[:60]!r}")

    print("Cache warm-up complete.\n")

COMMON_QUESTIONS = [
    "What is machine learning?",
    "How does gradient descent work?",
    "What is a neural network?",
    "Explain backpropagation.",
    "What is overfitting?",
]
```

## Complete working example

```python
import asyncio
from synapsekit import LLMConfig
from synapsekit.llms.openai import OpenAILLM
from synapsekit.cache import SQLiteCache, CacheStats

async def main():
    cache = SQLiteCache(
        path="./demo_cache.db",
        similarity_threshold=0.92,
        ttl_seconds=86_400,
    )

    llm = OpenAILLM(
        model="gpt-4o-mini",
        config=LLMConfig(temperature=0.2, max_tokens=256, cache_backend=cache),
    )

    queries = [
        # (query, expected_source)
        ("What is a hash map?",                          "miss"),
        ("Explain hash tables in computer science.",     "hit"),   # Semantically similar to above
        ("How does a dictionary work in Python?",        "hit"),   # Also similar
        ("What is the speed of light?",                  "miss"),  # Unrelated
        ("How fast does light travel?",                  "hit"),   # Similar to above
    ]

    stats = CacheStats()

    print("=== Semantic Cache Demo ===\n")
    for query, expected in queries:
        response = await llm.agenerate(query)
        source = "HIT " if response.cache_hit else "MISS"

        if response.cache_hit:
            stats.record_hit()
        else:
            stats.record_miss()

        print(f"[{source}] {query!r}")
        print(f"       {response.text[:90]}...\n")

    print(f"Hit rate: {stats.hit_rate:.0%}  "
          f"({stats.hits}/{stats.total} queries served from cache)")
    print(f"Estimated savings: ${stats.hits * 0.0001:.4f}")

asyncio.run(main())
```

## Expected output

```
=== Semantic Cache Demo ===

[MISS] 'What is a hash map?'
       A hash map (also called a hash table) is a data structure that maps keys to
       values using a hash function to compute an index...

[HIT ] 'Explain hash tables in computer science.'
       A hash map (also called a hash table) is a data structure that maps keys to
       values using a hash function to compute an index...

[HIT ] 'How does a dictionary work in Python?'
       A hash map (also called a hash table) is a data structure that maps keys to
       values using a hash function to compute an index...

[MISS] 'What is the speed of light?'
       The speed of light in a vacuum is approximately 299,792,458 metres per second...

[HIT ] 'How fast does light travel?'
       The speed of light in a vacuum is approximately 299,792,458 metres per second...

Hit rate: 60%  (3/5 queries served from cache)
Estimated savings: $0.0003
```

## How it works

When `cache_backend` is set in `LLMConfig`, the LLM client computes a dense embedding of the incoming query using a lightweight local embedding model (no API call required). It then searches the cache for stored embeddings with cosine similarity above `similarity_threshold`. On a hit, it returns the stored response immediately. On a miss, it calls the LLM API, stores the `(embedding, response)` pair, and returns the fresh response.

The embedding model used internally is `all-MiniLM-L6-v2` (22 MB), which runs in-process. It is fast enough that the embedding step adds less than 5 ms of overhead per query.

## Variations

**Disable cache for specific calls (e.g. real-time data):**
```python
# Pass cache_bypass=True to skip the cache for a single call
response = await llm.agenerate(
    "What is today's stock price for AAPL?",
    cache_bypass=True,
)
```

**Per-user cache isolation:**
```python
# Use a key_prefix that includes the user ID to prevent cross-user cache hits
user_cache = RedisCache(
    url="redis://localhost:6379/0",
    key_prefix=f"user:{user_id}:",
)
```

**Cache with custom TTL per query:**
```python
# Override TTL for individual responses — useful for time-sensitive content
response = await llm.agenerate(prompt, cache_ttl=300)  # 5 minutes only
```

## Troubleshooting

**Cache is always missing even for identical queries**
Check that `similarity_threshold` is not set too high (e.g. 0.999). Identical strings produce similarity of 1.0, but floating-point rounding can sometimes give 0.9998. Use 0.99 as the upper bound for near-exact matching.

**Redis connection refused**
Make sure Redis is running: `redis-server --daemonize yes`. Verify the URL matches your Redis instance's host and port.

**Cache entries not expiring**
SQLite TTL is enforced lazily on read, not by a background process. Call `cache.evict_expired()` on a schedule (e.g. daily) to reclaim disk space.

## Next steps

- [Cost-Aware LLM Router](./cost-router) — complement caching with model-level cost routing
- [LLM Fallback Chains](./fallback-chain) — cache sits in front of the fallback chain for maximum resilience
- [Structured Output with Pydantic](./structured-output-pydantic) — cache structured responses alongside plain text
