---
sidebar_position: 6
---

# Tutorial: Cost-Aware Pipeline

Build a multi-provider pipeline that routes queries to cheap models for simple tasks and expensive models for complex ones, enforces hard budget limits, and uses a circuit breaker to handle provider outages gracefully.

**What you'll build:** A pipeline that classifies query complexity, routes cheap queries to Groq (sub-cent) and complex queries to GPT-4o, tracks costs in nested scopes, and automatically trips open when a provider fails.

**Time:** ~20 minutes
**Prerequisites:** `pip install synapsekit[openai,groq,evaluation]`

## What you'll learn

- Set up `CostTracker` with nested scopes (pipeline → step → llm_call)
- Configure `BudgetGuard` with per-request and daily limits
- Build a complexity router that selects the cheapest appropriate model
- Observe the circuit breaker tripping OPEN, recovering through HALF_OPEN, closing
- Write an `@eval_case` with a `max_cost_usd` threshold
- Run `synapsekit test` and interpret the cost breakdown

## Pricing reference (March 2026)

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Best for |
|---|---|---|---|
| Groq / llama-3.1-8b-instant | $0.05 | $0.08 | Simple lookups, classification |
| Groq / llama-3.3-70b-versatile | $0.59 | $0.79 | Medium reasoning |
| GPT-4o-mini | $0.15 | $0.60 | General Q&A |
| GPT-4o | $2.50 | $10.00 | Complex analysis, code |

## Step 1: Set up providers and cost tracking

```bash
pip install synapsekit[openai,groq,evaluation]
export OPENAI_API_KEY=sk-...
export GROQ_API_KEY=gsk_...
```

```python
# cost_aware_pipeline.py

import asyncio
from synapsekit import CostTracker, BudgetGuard, BudgetLimit, LLMConfig
from synapsekit.llms.openai import OpenAILLM
from synapsekit.llms.groq import GroqLLM

# CostTracker is the central accumulator.
# It records every LLM call and converts token counts to USD.
tracker = CostTracker()

# BudgetGuard wraps CostTracker and raises BudgetExceededError on limit breach.
# per_request=$0.10 prevents a single complex query from burning through budget.
# daily=$50.00 caps total daily spend across all requests.
guard = BudgetGuard(
    BudgetLimit(per_request=0.10, daily=50.00),
    tracker=tracker    # Attach so guard can check the running daily total
)

# --- LLM clients ---

# Groq: ultra-fast inference, open-source models, very cheap.
# Use for simple queries where speed matters more than reasoning depth.
groq_cheap = GroqLLM(
    model="llama-3.1-8b-instant",      # ~$0.00001 per typical query
    config=LLMConfig(temperature=0.1, max_tokens=512)
)

groq_medium = GroqLLM(
    model="llama-3.3-70b-versatile",   # ~$0.0003 per typical query
    config=LLMConfig(temperature=0.2, max_tokens=1024)
)

# OpenAI GPT-4o: best reasoning quality, highest cost.
# Reserve for queries that genuinely need it.
gpt4o = OpenAILLM(
    model="gpt-4o",
    config=LLMConfig(temperature=0.2, max_tokens=2048)
)

gpt4o_mini = OpenAILLM(
    model="gpt-4o-mini",
    config=LLMConfig(temperature=0.1, max_tokens=1024)
)
```

## Step 2: Build the complexity classifier

```python
from enum import Enum

class Complexity(Enum):
    SIMPLE   = "simple"    # factual lookup, single-step, no reasoning required
    MEDIUM   = "medium"    # multi-step reasoning, some domain knowledge
    COMPLEX  = "complex"   # code generation, deep analysis, long-form synthesis

# Routing table: complexity → (llm, model_name_for_tracking)
ROUTING_TABLE = {
    Complexity.SIMPLE:  (groq_cheap,  "groq/llama-3.1-8b-instant"),
    Complexity.MEDIUM:  (groq_medium, "groq/llama-3.3-70b-versatile"),
    Complexity.COMPLEX: (gpt4o,       "gpt-4o"),
}

async def classify_complexity(query: str) -> Complexity:
    """Use the cheapest model to classify query complexity.

    This meta-call costs ~$0.000001 — negligible compared to the savings from
    routing simple queries away from GPT-4o.
    """
    prompt = f"""Classify the complexity of the following query as simple, medium, or complex.

simple  = factual lookup, single answer, no reasoning (e.g. "What year was Python created?")
medium  = multi-step, some reasoning (e.g. "Explain the difference between TCP and UDP")
complex = deep analysis, code generation, or long synthesis (e.g. "Write a B-tree implementation")

Reply with exactly one word: simple, medium, or complex.

Query: {query}"""

    with tracker.scope("classify"):
        response = await groq_cheap.agenerate(prompt)
        rec = tracker.record("groq/llama-3.1-8b-instant", input_tokens=80, output_tokens=1)
        # Classification costs are tracked separately from the main query

    label = response.text.strip().lower()
    mapping = {"simple": Complexity.SIMPLE, "medium": Complexity.MEDIUM, "complex": Complexity.COMPLEX}
    complexity = mapping.get(label, Complexity.MEDIUM)   # Default to medium on unexpected output
    print(f"  Classified as: {complexity.value}  (classifier cost: ${rec.cost_usd:.7f})")
    return complexity
```

## Step 3: Nested cost scopes

```python
async def run_pipeline(query: str, pipeline_id: str = "default") -> dict:
    """Route a query through the cost-aware pipeline with nested scope tracking."""

    # Scope hierarchy: pipeline:{id} > step:classify > llm:{model}
    # tracker.scope_cost() can report cost at any level of the hierarchy.
    with tracker.scope(f"pipeline:{pipeline_id}"):

        # --- Pre-flight budget check ---
        # Raises BudgetExceededError if today's spend already hit the daily limit.
        guard.check_before(estimated_cost=0)

        # --- Classify ---
        print(f"\nQuery: {query!r}")
        with tracker.scope("step:classify"):
            complexity = await classify_complexity(query)

        # --- Route to the appropriate LLM ---
        llm, model_name = ROUTING_TABLE[complexity]
        print(f"  Routing to: {model_name}")

        # --- Generate answer ---
        with tracker.scope(f"step:answer"), tracker.scope(f"llm:{model_name}"):
            response = await llm.agenerate(query)

            # Record actual token usage — CostTracker looks up per-token price automatically.
            rec = tracker.record(
                model_name,
                input_tokens=len(query.split()) * 2,      # Approximate; use tiktoken for precision
                output_tokens=len(response.text.split())
            )

        # --- Post-flight budget check ---
        # Raises BudgetExceededError if this single request exceeded per_request limit.
        guard.check_after(rec.cost_usd)

    pipeline_cost = tracker.scope_cost(f"pipeline:{pipeline_id}")
    print(f"  Answer cost: ${rec.cost_usd:.7f}  |  Pipeline total: ${pipeline_cost:.7f}")
    return {
        "query":      query,
        "complexity": complexity.value,
        "model":      model_name,
        "answer":     response.text,
        "cost_usd":   rec.cost_usd,
    }
```

## Step 4: Circuit breaker

The circuit breaker prevents cascading failures when a provider is down. It has three states:

```
CLOSED ──(N failures in window)──> OPEN ──(timeout)──> HALF_OPEN ──(success)──> CLOSED
                                                                 └──(failure)──> OPEN
```

```python
from synapsekit.resilience import CircuitBreaker, CircuitBreakerOpen

# CircuitBreaker trips OPEN after 3 failures within 30 seconds.
# It stays OPEN for 60 seconds, then enters HALF_OPEN (allows one probe request).
# If the probe succeeds, it closes. If it fails, it re-opens for another 60 s.
gpt4o_breaker = CircuitBreaker(
    name="gpt-4o",
    failure_threshold=3,     # Trip after this many failures in the window
    window_seconds=30,       # Failure counting window
    recovery_timeout=60,     # Stay OPEN for this many seconds before trying again
)

groq_breaker = CircuitBreaker(
    name="groq",
    failure_threshold=5,
    window_seconds=60,
    recovery_timeout=30,
)

async def resilient_generate(query: str, complexity: Complexity) -> tuple[str, str]:
    """Generate an answer, falling back across providers if a circuit is open."""
    primary_llm, primary_model = ROUTING_TABLE[complexity]

    # Try the primary provider first
    if complexity == Complexity.COMPLEX:
        try:
            async with gpt4o_breaker:
                # If the breaker is OPEN, this raises CircuitBreakerOpen immediately
                # without making any network call — saves latency and cost.
                response = await primary_llm.agenerate(query)
                return response.text, primary_model
        except CircuitBreakerOpen:
            # GPT-4o circuit is open — fall back to GPT-4o-mini
            print("  [circuit] gpt-4o OPEN — falling back to gpt-4o-mini")
            async with groq_breaker:
                response = await gpt4o_mini.agenerate(query)
                return response.text, "gpt-4o-mini"

    else:
        try:
            async with groq_breaker:
                response = await primary_llm.agenerate(query)
                return response.text, primary_model
        except CircuitBreakerOpen:
            print(f"  [circuit] groq OPEN — falling back to gpt-4o-mini")
            response = await gpt4o_mini.agenerate(query)
            return response.text, "gpt-4o-mini"

async def demo_circuit_breaker():
    """Simulate circuit breaker tripping and recovering."""
    from unittest.mock import AsyncMock, patch

    print("\n=== Circuit Breaker Demo ===\n")
    print("Simulating 3 consecutive GPT-4o failures to trip the breaker...\n")

    # Patch agenerate to raise an exception for the first 3 calls
    call_count = 0
    original = gpt4o.agenerate

    async def flaky_generate(prompt):
        nonlocal call_count
        call_count += 1
        if call_count <= 3:
            raise ConnectionError("Simulated GPT-4o outage")
        return await original(prompt)

    gpt4o.agenerate = flaky_generate

    for i in range(5):
        try:
            async with gpt4o_breaker:
                await gpt4o.agenerate("test query")
                print(f"  Call {i+1}: SUCCESS  State: {gpt4o_breaker.state}")
        except ConnectionError:
            print(f"  Call {i+1}: FAILURE  State: {gpt4o_breaker.state}")
            # Expected output:
            # Call 1: FAILURE  State: CLOSED
            # Call 2: FAILURE  State: CLOSED
            # Call 3: FAILURE  State: OPEN    <-- tripped
        except CircuitBreakerOpen:
            print(f"  Call {i+1}: BLOCKED (circuit open)  State: {gpt4o_breaker.state}")
            # Expected output:
            # Call 4: BLOCKED (circuit open)  State: OPEN
            # Call 5: BLOCKED (circuit open)  State: OPEN

    gpt4o.agenerate = original   # Restore original
```

## Step 5: Write an eval case with cost threshold

```python
# tests/test_cost_pipeline.py
from synapsekit.evaluation import eval_case, EvalSuite
from synapsekit.evaluation.metrics import MaxCostUSD, ContainsKeywords

@eval_case(description="Simple query routes to Groq and costs under $0.001")
async def test_simple_query_cheap():
    result = await run_pipeline("What year was Python first released?", "eval-simple")
    return {
        "output":     result["answer"],
        "cost_usd":   result["cost_usd"],
        "complexity": result["complexity"],
    }

@eval_case(description="Complex query routes to GPT-4o and stays under $0.10")
async def test_complex_query_quality():
    result = await run_pipeline(
        "Explain the time and space complexity of merge sort with a worked example.",
        "eval-complex"
    )
    return {
        "output":   result["answer"],
        "cost_usd": result["cost_usd"],
    }

@eval_case(description="Daily budget guard blocks requests after limit is hit")
async def test_budget_guard_blocks():
    from synapsekit import BudgetExceededError
    tight_guard = BudgetGuard(BudgetLimit(per_request=0.000001))   # 1 micro-dollar — will always trip
    try:
        tight_guard.check_before(estimated_cost=0.10)
        return {"blocked": False}
    except BudgetExceededError:
        return {"blocked": True}

suite = EvalSuite(
    cases=[test_simple_query_cheap, test_complex_query_quality, test_budget_guard_blocks],
    metrics=[
        MaxCostUSD(threshold=0.001, apply_to=["test_simple_query_cheap"]),
        MaxCostUSD(threshold=0.10,  apply_to=["test_complex_query_quality"]),
    ]
)
```

```bash
# Run the eval suite
synapsekit test tests/test_cost_pipeline.py

# Expected output:
# Running 3 eval case(s)...
#
# test_simple_query_cheap ✓
#   MaxCostUSD ... PASS ($0.0000023 < $0.001)
#
# test_complex_query_quality ✓
#   MaxCostUSD ... PASS ($0.0312 < $0.10)
#
# test_budget_guard_blocks ✓
#   (no cost metrics — structural test)
#
# 3 passed, 0 failed  |  total cost: $0.0312
```

## Step 6: Full cost summary output

```python
async def print_cost_summary():
    """Show tracker.summary() output after a batch of queries."""
    test_queries = [
        "What is 2 + 2?",                                              # simple
        "Explain the difference between REST and GraphQL.",            # medium
        "Write a Python function to find all prime numbers up to N.",  # complex
        "What is the capital of France?",                              # simple
        "Summarise the CAP theorem with examples.",                    # medium
    ]

    for i, q in enumerate(test_queries):
        await run_pipeline(q, pipeline_id=f"batch-{i}")

    summary = tracker.summary()
    print("\n=== Cost Summary ===")
    print(summary)
    # Expected output:
    # === Cost Summary ===
    # {
    #   "total_usd": 0.034217,
    #   "by_scope": {
    #     "pipeline:batch-0": 0.000002,
    #     "pipeline:batch-1": 0.000310,
    #     "pipeline:batch-2": 0.031200,
    #     "pipeline:batch-3": 0.000002,
    #     "pipeline:batch-4": 0.002703,
    #     "step:classify":    0.000050,
    #     "step:answer":      0.034167,
    #     "llm:groq/llama-3.1-8b-instant":   0.000054,
    #     "llm:groq/llama-3.3-70b-versatile":0.003013,
    #     "llm:gpt-4o":                       0.031100
    #   },
    #   "by_model": {
    #     "groq/llama-3.1-8b-instant":    0.000054,
    #     "groq/llama-3.3-70b-versatile": 0.003013,
    #     "gpt-4o":                        0.031150
    #   }
    # }
```

## Complete working example

```python
# complete_cost_pipeline.py
import asyncio
from synapsekit import CostTracker, BudgetGuard, BudgetLimit, LLMConfig
from synapsekit.llms.openai import OpenAILLM
from synapsekit.llms.groq import GroqLLM
from synapsekit.resilience import CircuitBreaker, CircuitBreakerOpen

async def main():
    # --- Setup ---
    tracker     = CostTracker()
    guard       = BudgetGuard(BudgetLimit(per_request=0.10, daily=5.00), tracker=tracker)
    groq_llm    = GroqLLM(model="llama-3.1-8b-instant", config=LLMConfig(temperature=0.1))
    openai_llm  = OpenAILLM(model="gpt-4o-mini",         config=LLMConfig(temperature=0.2))
    breaker     = CircuitBreaker("openai", failure_threshold=3, recovery_timeout=30)

    # --- Queries with varying complexity ---
    queries = [
        ("simple",  "What does HTTP stand for?"),
        ("simple",  "Who wrote Romeo and Juliet?"),
        ("complex", "Explain transformer self-attention with a code example in Python."),
        ("medium",  "What are the trade-offs between microservices and monolithic architecture?"),
    ]

    print("=== Cost-Aware Pipeline Demo ===\n")
    for complexity_hint, query in queries:
        print(f"Query [{complexity_hint}]: {query[:60]}...")

        with tracker.scope(f"query:{complexity_hint}"):
            guard.check_before(0)

            # Route based on hint (in production this comes from classify_complexity())
            if complexity_hint in ("simple", "medium"):
                response = await groq_llm.agenerate(query)
                model    = "groq/llama-3.1-8b-instant"
                in_tok, out_tok = 50, 80
            else:
                try:
                    async with breaker:
                        response = await openai_llm.agenerate(query)
                        model    = "gpt-4o-mini"
                        in_tok, out_tok = 120, 400
                except CircuitBreakerOpen:
                    print("  [circuit] OpenAI OPEN — skipping complex query")
                    continue

            rec = tracker.record(model, input_tokens=in_tok, output_tokens=out_tok)
            guard.check_after(rec.cost_usd)

        print(f"  Model:  {model}")
        print(f"  Answer: {response.text[:80]}...")
        print(f"  Cost:   ${rec.cost_usd:.7f}\n")
        # Expected output (example):
        # Query [simple]: What does HTTP stand for?
        #   Model:  groq/llama-3.1-8b-instant
        #   Answer: HTTP stands for Hypertext Transfer Protocol...
        #   Cost:   $0.0000023

    print("=== Final Cost Summary ===")
    print(tracker.summary())
    # Expected output:
    # === Final Cost Summary ===
    # {'total_usd': 0.006442, 'by_scope': {...}, 'by_model': {...}}

asyncio.run(main())
```

## Troubleshooting

**`BudgetExceededError` during testing**
Temporarily raise your limits or use a separate `CostTracker` instance per test to avoid accumulation. The `BudgetGuard` can be constructed without a tracker for structural tests.

**Circuit breaker stays OPEN indefinitely**
Check that `recovery_timeout` is not too large. In development, set it to `5` seconds. In production, 60 seconds is a safe default for most APIs.

**Groq API key not found**
Ensure `GROQ_API_KEY` is exported in your shell. Groq keys start with `gsk_`. They are free for personal use at [console.groq.com](https://console.groq.com).

**Cost numbers are wrong**
`tracker.record()` uses the token counts you pass in. For precise billing, pipe your LLM response through a tiktoken counter before calling `record()`. SynapseKit's built-in LLM clients do this automatically when `track_tokens=True` is set in `LLMConfig`.

## Next steps

- [Cost tracker reference](../observability/cost-tracker) — full `CostTracker` and `BudgetGuard` API
- [Groq integration](../llms/groq) — all supported Groq models and configuration
- [OpenAI integration](../llms/openai) — GPT-4o, mini, and function calling
- [Evaluation overview](../evaluation/overview) — `@eval_case`, `EvalSuite`, running with `synapsekit test`
