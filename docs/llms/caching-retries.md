---
sidebar_position: 9
---

# Caching & Retries

SynapseKit provides **opt-in response caching** and **exponential backoff retries** for all LLM providers. Both are configured through `LLMConfig` and are disabled by default — zero behavior change for existing code.

## Response caching

Cache LLM responses to avoid redundant API calls. The cache key is a SHA-256 hash of the model, prompt/messages, temperature, and max_tokens.

```python
from synapsekit.llm.openai import OpenAILLM
from synapsekit import LLMConfig

llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    provider="openai",
    cache=True,          # Enable caching
    cache_maxsize=128,   # LRU cache size (default)
))

# First call — hits the API
response1 = await llm.generate("What is Python?")

# Second call with same params — served from cache
response2 = await llm.generate("What is Python?")

assert response1 == response2  # Same response, no API call
```

### What gets cached

- `generate()` — cached
- `generate_with_messages()` — cached
- `stream()` — **not cached** (returns an async generator)
- `stream_with_messages()` — **not cached**

### Cache key

The cache key includes:
- Model name
- Prompt string (or full messages list)
- Temperature
- Max tokens

Different values for any of these produce different cache keys.

### LRU eviction

The cache uses an LRU (Least Recently Used) eviction policy. When `cache_maxsize` is exceeded, the oldest unused entry is evicted.

### SQLite cache (persistent)

For caching that survives process restarts, use the SQLite backend:

```python
llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    provider="openai",
    cache=True,
    cache_backend="sqlite",              # Use SQLite instead of in-memory
    cache_db_path="llm_cache.db",        # Default: "synapsekit_llm_cache.db"
))
```

The SQLite cache stores responses in a local database file. Entries persist across restarts and have no size limit (no LRU eviction).

### Filesystem cache (persistent)

For a lightweight persistent cache using JSON files (no database required):

```python
llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    provider="openai",
    cache=True,
    cache_backend="filesystem",                  # Use filesystem instead of in-memory
    cache_db_path=".synapsekit_cache",           # Directory for cache files
))
```

Each cache entry is stored as a separate `.json` file in the cache directory. Like the SQLite cache, entries persist across restarts and have no size limit.

### Redis cache (persistent, shared)

For distributed or high-throughput caching with Redis:

```python
llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    provider="openai",
    cache=True,
    cache_backend="redis",                          # Use Redis
    cache_db_path="redis://localhost:6379",          # Redis URL
))
```

The Redis cache stores responses as JSON strings with an optional TTL. It supports shared caching across multiple processes or services.

:::info
Requires `redis`: `pip install synapsekit[redis]`
:::

### Cache statistics

Monitor cache effectiveness via the `cache_stats` property:

```python
llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    provider="openai",
    cache=True,
))

await llm.generate("What is Python?")
await llm.generate("What is Python?")  # cache hit

print(llm.cache_stats)
# {"hits": 1, "misses": 1, "size": 1}
```

Returns an empty dict when caching is disabled.

## Exponential backoff retries

Retry transient failures (rate limits, network errors) with exponential backoff.

```python
llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    provider="openai",
    max_retries=3,       # Retry up to 3 times
    retry_delay=1.0,     # Initial delay in seconds
))

# If the API returns a transient error:
# Attempt 1 — fails → wait 1s
# Attempt 2 — fails → wait 2s
# Attempt 3 — fails → wait 4s
# Attempt 4 — succeeds (or raises)
response = await llm.generate("Hello!")
```

### Auth errors are never retried

Errors containing these patterns are raised immediately without retrying:

- `"authentication"`, `"api_key"`, `"unauthorized"`, `"forbidden"`, `"permission"`

This prevents wasting retries on errors that will never succeed.

## Combining cache and retries

Both features can be used together:

```python
llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    provider="openai",
    cache=True,
    cache_maxsize=256,
    max_retries=3,
    retry_delay=0.5,
))
```

The flow is: **cache check → retry-wrapped API call → cache store**.

### Retries for function calling

`call_with_tools()` also respects `max_retries`. Transient API failures are retried automatically:

```python
llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    provider="openai",
    max_retries=3,
))

# call_with_tools() now retries on transient errors
result = await llm.call_with_tools(messages=[...], tools=[...])
```

## Rate limiting

Prevent hitting provider rate limits with a token-bucket rate limiter:

```python
llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    provider="openai",
    requests_per_minute=60,  # Max 60 requests per minute
))

# All calls (generate, stream, call_with_tools) are rate-limited
response = await llm.generate("Hello!")
```

The rate limiter uses a token-bucket algorithm: tokens refill at a steady rate (`requests_per_minute / 60` per second). When no tokens are available, the call waits until one becomes available.

## Structured output

Generate structured (JSON/Pydantic) output with automatic retry on parse failure:

```python
from pydantic import BaseModel
from synapsekit import generate_structured

class Person(BaseModel):
    name: str
    age: int

result = await generate_structured(
    llm,
    "Tell me about Albert Einstein",
    schema=Person,
    max_retries=3,
)
print(result.name)  # "Albert Einstein"
print(result.age)   # 76
```

If the LLM returns invalid JSON, the function retries with feedback asking for valid output.

## LLMConfig reference

| Field | Type | Default | Description |
|---|---|---|---|
| `cache` | `bool` | `False` | Enable response caching |
| `cache_maxsize` | `int` | `128` | Maximum cached responses (memory backend) |
| `cache_backend` | `str` | `"memory"` | `"memory"` (LRU), `"sqlite"` (persistent DB), `"filesystem"` (persistent JSON files), or `"redis"` (distributed) |
| `cache_db_path` | `str` | `"synapsekit_llm_cache.db"` | SQLite file path |
| `max_retries` | `int` | `0` | Maximum retry attempts (0 = no retries) |
| `retry_delay` | `float` | `1.0` | Initial delay in seconds (doubles each attempt) |
| `requests_per_minute` | `int \| None` | `None` | Rate limit (None = unlimited) |

:::info
These fields work with all 13 LLM providers: OpenAI, Anthropic, Gemini, Mistral, Ollama, Cohere, Bedrock, Azure OpenAI, Groq, DeepSeek, OpenRouter, Together, and Fireworks. The 4 cache backends (memory, SQLite, filesystem, Redis) are interchangeable across all providers.
:::
