---
sidebar_position: 18
---

# CostRouter & FallbackChain

SynapseKit provides two drop-in `BaseLLM` subclasses for intelligent model routing: **CostRouter** (cheapest model meeting quality constraints) and **FallbackChain** (ordered priority with cascading fallback).

## CostRouter

Route every request to the cheapest model that meets a quality threshold. If that model fails, automatically try the next cheapest.

```python
from synapsekit import CostRouter, CostRouterConfig, RouterModelSpec

router = CostRouter(CostRouterConfig(
    models=[
        RouterModelSpec(model="gpt-4o-mini", api_key="sk-...", provider="openai"),
        RouterModelSpec(model="gpt-4o", api_key="sk-...", provider="openai"),
        RouterModelSpec(model="claude-sonnet-4-20250514", api_key="sk-ant-...", provider="anthropic"),
    ],
    quality_threshold=0.7,   # Minimum quality score (0.0-1.0)
    fallback_on_error=True,  # Try next model on failure
))

# Use like any BaseLLM — streams from the cheapest qualifying model
async for token in router.stream("Explain quantum computing"):
    print(token, end="")

print(router.selected_model)  # e.g. "gpt-4o-mini"
```

### Quality table

CostRouter uses a built-in `QUALITY_TABLE` with scores for 30+ models:

```python
from synapsekit import QUALITY_TABLE

print(QUALITY_TABLE["gpt-4o"])       # 0.92
print(QUALITY_TABLE["gpt-4o-mini"])  # 0.78
print(QUALITY_TABLE["claude-sonnet-4-20250514"])  # 0.90
```

Models not in the table default to `0.5`. The router filters out models below `quality_threshold`, then sorts by price from the built-in `COST_TABLE`.

### Latency constraints

```python
from synapsekit import CostRouterConfig, RouterModelSpec

config = CostRouterConfig(
    models=[
        RouterModelSpec(model="gpt-4o-mini", api_key="sk-...", provider="openai", max_latency_ms=500),
        RouterModelSpec(model="gpt-4o", api_key="sk-...", provider="openai", max_latency_ms=2000),
    ],
    quality_threshold=0.7,
)
```

### RouterModelSpec

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | required | Model name |
| `api_key` | `str` | required | API key for this model |
| `provider` | `str` | `"openai"` | Provider name |
| `max_latency_ms` | `float \| None` | `None` | Max acceptable latency |

### CostRouterConfig

| Parameter | Type | Default | Description |
|---|---|---|---|
| `models` | `list[RouterModelSpec]` | required | Candidate models |
| `quality_threshold` | `float` | `0.0` | Minimum quality score |
| `strategy` | `str` | `"cheapest"` | Routing strategy |
| `fallback_on_error` | `bool` | `True` | Try next model on failure |

---

## FallbackChain

Try models in a fixed priority order. If a model errors or returns a response shorter than `min_response_length`, escalate to the next.

```python
from synapsekit import FallbackChain, FallbackChainConfig
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.anthropic import AnthropicLLM
from synapsekit.llm.base import LLMConfig

fast = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))
strong = AnthropicLLM(LLMConfig(model="claude-sonnet-4-20250514", api_key="sk-ant-...", provider="anthropic"))

chain = FallbackChain(FallbackChainConfig(
    models=[fast, strong],
    min_response_length=10,  # Escalate if response < 10 chars
))

result = await chain.generate("Summarize this document...")
print(chain.used_model)  # Which model actually answered
```

### FallbackChainConfig

| Parameter | Type | Default | Description |
|---|---|---|---|
| `models` | `list[BaseLLM]` | required | Models in priority order |
| `min_response_length` | `int` | `0` | Minimum response length before escalating |

### Drop-in compatibility

Both `CostRouter` and `FallbackChain` extend `BaseLLM`, so they work anywhere a regular LLM is expected:

```python
from synapsekit import RAGPipeline, CostRouter

pipeline = RAGPipeline(llm=router, retriever=retriever)
answer = await pipeline.query("What is the revenue?")
```

## See also

- [LLM Overview](./overview) — all providers and the `BaseLLM` interface
- [Cost Tracker](../observability/cost-tracker) — track spending across routed calls
- [Caching & Retries](./caching-retries) — per-model caching and retry configuration
