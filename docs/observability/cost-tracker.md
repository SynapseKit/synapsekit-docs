---
sidebar_position: 2
---

# Cost Intelligence

SynapseKit provides built-in cost tracking and budget enforcement so you can monitor, attribute, and control LLM spending across your pipelines.

## CostTracker

Hierarchical cost attribution with scope context manager. Tracks every LLM call and attributes costs to named scopes.

```python
from synapsekit import CostTracker

tracker = CostTracker()

with tracker.scope("pipeline"):
    with tracker.scope("retrieval"):
        tracker.record("gpt-4o-mini", input_tokens=500, output_tokens=200, latency_ms=120)

    with tracker.scope("generation"):
        tracker.record("gpt-4o", input_tokens=1000, output_tokens=500, latency_ms=350)

print(f"Total cost: ${tracker.total_cost_usd:.4f}")
```

### Scope nesting

Scopes can be nested to any depth. Each record is attributed to its full scope path:

```python
tracker = CostTracker()

with tracker.scope("agent"):
    with tracker.scope("tool_calls"):
        with tracker.scope("web_search"):
            tracker.record("gpt-4o-mini", 200, 100, 50)

summary = tracker.summary()
# {"agent/tool_calls/web_search": {"total_cost_usd": ..., "calls": 1, ...}}
```

### Summary

`summary()` returns a dict grouped by scope path:

```python
summary = tracker.summary()
for scope, data in summary.items():
    print(f"{scope}: ${data['total_cost_usd']:.4f} ({data['calls']} calls)")
```

Each scope entry contains:

| Key | Type | Description |
|---|---|---|
| `total_cost_usd` | `float` | Sum of costs in this scope |
| `total_input_tokens` | `int` | Sum of input tokens |
| `total_output_tokens` | `int` | Sum of output tokens |
| `calls` | `int` | Number of LLM calls |
| `total_latency_ms` | `float` | Sum of latencies |

### Methods

| Method | Returns | Description |
|---|---|---|
| `scope(name)` | context manager | Push/pop a named scope |
| `record(model, input_tokens, output_tokens, latency_ms)` | `CostRecord` | Record an LLM call |
| `summary()` | `dict` | Nested dict grouped by scope path |
| `reset()` | `None` | Clear all recorded data |

### Properties

| Property | Type | Description |
|---|---|---|
| `total_cost_usd` | `float` | Total cost across all records |
| `records` | `list[CostRecord]` | All recorded cost records |

Cost is auto-calculated from the built-in `COST_TABLE` which covers OpenAI, Anthropic, Google, DeepSeek, and Groq models.

---

## BudgetGuard

Per-request, per-user, and daily spending limits with a circuit breaker pattern.

```python
from synapsekit import BudgetGuard, BudgetLimit, BudgetExceeded

guard = BudgetGuard(BudgetLimit(per_request=0.10, per_user=1.00, daily=50.00))

# Before each LLM call
try:
    guard.check_before(estimated_cost=0.05, user_id="alice")
except BudgetExceeded as e:
    print(f"Budget exceeded: {e}")

# After each LLM call
guard.record_spend(0.05, user_id="alice")
```

### BudgetLimit

All limits are optional floats in USD:

| Parameter | Default | Description |
|---|---|---|
| `per_request` | `None` | Max cost for a single request |
| `per_user` | `None` | Max daily cost per user |
| `daily` | `None` | Max total daily cost |

### Circuit breaker

BudgetGuard includes a circuit breaker that transitions through three states:

| State | Description |
|---|---|
| `CLOSED` | Normal operation — all requests allowed |
| `OPEN` | Budget exceeded — all requests blocked until cooldown |
| `HALF_OPEN` | After cooldown — allows requests; closes if spend stays under limit |

```python
from synapsekit import BudgetGuard, BudgetLimit, CircuitState

guard = BudgetGuard(
    BudgetLimit(daily=10.00),
    cooldown_seconds=60,  # Wait 60s before transitioning OPEN → HALF_OPEN
)

print(guard.circuit_state)  # CircuitState.CLOSED
```

Daily counters automatically reset on calendar day change.

### Methods

| Method | Description |
|---|---|
| `check_before(estimated_cost, user_id=)` | Raises `BudgetExceeded` if any limit would be exceeded |
| `record_spend(cost, user_id=)` | Track actual spend after a call |
| `reset()` | Reset all state |

### Properties

| Property | Type | Description |
|---|---|---|
| `circuit_state` | `CircuitState` | Current circuit breaker state |
| `daily_spend` | `float` | Current daily spend |

### BudgetExceeded

The exception includes details about which limit was hit:

```python
try:
    guard.check_before(0.50)
except BudgetExceeded as e:
    print(e.limit_type)   # "per_request", "daily", "per_user", or "circuit_breaker"
    print(e.limit_value)  # The limit that was exceeded
    print(e.current)      # Current spend value
```

---

## Integration example

Combine CostTracker and BudgetGuard for full cost control:

```python
from synapsekit import CostTracker, BudgetGuard, BudgetLimit

tracker = CostTracker()
guard = BudgetGuard(BudgetLimit(daily=5.00, per_request=0.50))

with tracker.scope("qa_pipeline"):
    # Estimate cost before calling
    guard.check_before(estimated_cost=0.05)

    # Make the LLM call...
    rec = tracker.record("gpt-4o", 1000, 500, 200)

    # Record actual spend
    guard.record_spend(rec.cost_usd)

print(f"Pipeline cost: ${tracker.total_cost_usd:.4f}")
print(f"Daily spend: ${guard.daily_spend:.4f}")
```

## See also

- [LLM Overview](../llms/overview) — token tracking on individual LLM instances
- [Evaluation](../evaluation/overview) — track cost per eval case with `max_cost_usd`
- [RAG Pipeline](../rag/pipeline) — `TokenTracer` for per-query cost attribution
- [CLI: serve](../cli/serve) — cost headers in HTTP responses from served pipelines
- [PromptHub](../rag/prompt-hub) — versioning prompts to control and compare costs
