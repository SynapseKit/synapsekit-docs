---
sidebar_position: 12
title: "CostQualityRouter API Reference"
description: "CostQualityRouter is a learning-based LLM router that explores candidate models, then exploits the cheapest one meeting a learned quality threshold."
---

# CostQualityRouter API Reference

`CostQualityRouter` is a `BaseLLM` that wraps multiple candidate LLMs and learns, from real traffic, which one is cheapest while still meeting a quality bar. It runs in two phases:

1. **Explore** — round-robins across all candidates for the first `explore_n` calls, collecting real cost (from `COST_TABLE` pricing) and quality (from an optional eval suite) measurements.
2. **Exploit** — routes each subsequent call to the cheapest candidate whose observed `avg_quality` meets `quality_threshold` and stays within `budget_per_call_usd`. Falls back to the highest-quality candidate if none qualify.

Because it subclasses `BaseLLM`, a `CostQualityRouter` instance is a drop-in replacement anywhere a single LLM is expected — `RAG`, agents, `StructuredOutput`, etc.

**Import:**
```python
from synapsekit import CostQualityRouter
```

---

## `CostQualityRouter`

```python
from synapsekit import CostQualityRouter

router = CostQualityRouter(
    candidates: list[BaseLLM],
    eval_suite: str | None = None,
    quality_threshold: float = 0.8,
    budget_per_call_usd: float | None = None,
    explore_n: int = 50,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `candidates` | `list[BaseLLM]` | required | Candidate LLM instances to route between |
| `eval_suite` | `str \| None` | `None` | Dotted path to an eval suite object, e.g. `"myapp.evals:quality_suite"` or `"myapp.evals.quality_suite"`. The object must expose an `async evaluate(question=..., answer=...)` returning a score (float, `{"score": ...}`, or an object with `.mean_score`). If omitted, quality is never measured and only cost drives exploitation |
| `quality_threshold` | `float` | `0.8` | Minimum observed `avg_quality` (0–1) for a candidate to be eligible during exploitation |
| `budget_per_call_usd` | `float \| None` | `None` | Preferred max USD cost per call; candidates over budget are used only as a fallback |
| `explore_n` | `int` | `50` | Number of calls spent round-robin exploring before switching to exploitation |

### Methods

- `async call(prompt: str) -> str` — alias for `generate()`
- `async generate(prompt: str, **kwargs) -> str` — select a candidate, call it, measure cost/quality, update stats, and return the response. On failure, falls through to the next candidate in priority order and re-raises the last exception if all fail
- `async stream(prompt: str, **kwargs) -> AsyncIterator[str]` — stream from the selected candidate; stats are updated once the stream completes
- `stats() -> dict` — per-model stats and the Pareto frontier (see below)

### `stats()` return shape

```python
{
    "models": {
        "gpt-4o-mini": {"avg_cost": 0.0021, "avg_quality": 0.91, "calls": 34},
        "gpt-4o":      {"avg_cost": 0.0187, "avg_quality": 0.97, "calls": 16},
    },
    "frontier": [
        {"model": "gpt-4o-mini", "cost": 0.0021, "quality": 0.91},
        {"model": "gpt-4o", "cost": 0.0187, "quality": 0.97},
    ],
}
```

A model is on the Pareto `frontier` if no other candidate is both cheaper *and* higher quality — these are the only candidates worth considering at any quality/cost tradeoff point.

---

## Example — route between a cheap and an expensive model

```python
import asyncio
from synapsekit import OpenAILLM, AnthropicLLM, LLMConfig, CostQualityRouter

async def main():
    cheap = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))
    expensive = AnthropicLLM(LLMConfig(model="claude-opus-4", api_key="sk-ant-..."))

    router = CostQualityRouter(
        candidates=[cheap, expensive],
        eval_suite="myapp.evals:summary_quality",
        quality_threshold=0.85,
        budget_per_call_usd=0.01,
        explore_n=50,
    )

    for prompt in prompts:
        answer = await router.call(prompt)
        print(answer)

    print(router.stats())
    # {"models": {...}, "frontier": [...]}

asyncio.run(main())
```

Without an `eval_suite`, the router still learns cost per candidate but treats every candidate as meeting the quality bar — useful when you trust all candidates equally and only want cost-aware load balancing.

---

## See also

- [LLM API reference](llm)
- [Evaluation API reference](evaluation)
- [Observability API reference](observability)
