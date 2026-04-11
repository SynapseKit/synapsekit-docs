---
sidebar_position: 6
title: "Parallel Agent Execution"
description: "Run multiple SynapseKit agents concurrently using asyncio.gather() to implement fan-out / fan-in patterns and dramatically reduce latency."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Parallel Agent Execution

<ColabBadge path="multi-agent/parallel-agent-execution.ipynb" />

When tasks are independent of one another, running agents sequentially wastes time. The fan-out / fan-in pattern fires all independent agents simultaneously with `asyncio.gather()`, waits for every result, then merges them in a single aggregator. Total latency equals the slowest agent, not the sum of all agents.

**What you'll build:** A market research system that fans out to four specialist agents (trends, competitors, sentiment, pricing) simultaneously, then aggregates all four reports into a single executive summary. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit[openai]
```

## What you'll learn

- Fan out to multiple agents with `asyncio.gather()`
- Collect and label individual results
- Merge parallel outputs in a fan-in aggregator agent
- Measure latency savings over sequential execution

## Step 1: Define specialist agents

```python
# parallel_agent_execution.py

from __future__ import annotations
import asyncio
import time
from dataclasses import dataclass, field

from synapsekit.agents import Agent
from synapsekit.llms.openai import OpenAILLM
from synapsekit import LLMConfig

llm = OpenAILLM(model="gpt-4o-mini", config=LLMConfig(temperature=0.5))

trends_agent = Agent(
    name="trends",
    instructions=(
        "You analyze market trends. Given a company/industry, identify the top 3 "
        "macro trends shaping it in 2025. Be specific and data-driven. 3 bullets max."
    ),
    llm=llm,
)

competitor_agent = Agent(
    name="competitors",
    instructions=(
        "You research competitive landscapes. Given a company/industry, name the "
        "top 3 competitors and their primary differentiators. 3 bullets max."
    ),
    llm=llm,
)

sentiment_agent = Agent(
    name="sentiment",
    instructions=(
        "You assess public and investor sentiment. Given a company/industry, "
        "summarize the current sentiment (positive/neutral/negative) with 2 "
        "supporting reasons. 3 sentences max."
    ),
    llm=llm,
)

pricing_agent = Agent(
    name="pricing",
    instructions=(
        "You analyze pricing dynamics. Given a company/industry, describe the "
        "current pricing environment: is it competitive, premium, or commoditized? "
        "Give 2 specific observations. 3 sentences max."
    ),
    llm=llm,
)

aggregator_agent = Agent(
    name="aggregator",
    instructions=(
        "You synthesize multiple research reports into a concise executive summary. "
        "Highlight the most important insight from each section. "
        "Output 4–6 sentences in clear business prose."
    ),
    llm=llm,
)
```

## Step 2: Implement the fan-out

```python
@dataclass
class ResearchResult:
    company: str
    trends: str = ""
    competitors: str = ""
    sentiment: str = ""
    pricing: str = ""
    summary: str = ""
    elapsed_parallel: float = 0.0
    elapsed_sequential_estimate: float = 0.0


async def fan_out(company: str) -> tuple[str, str, str, str]:
    """Run all four specialist agents concurrently."""
    query = f"Company / industry: {company}"

    t0 = time.perf_counter()

    # asyncio.gather() launches all coroutines at the same time.
    # Results are returned in the same order as the input coroutines.
    trends, competitors, sentiment, pricing = await asyncio.gather(
        trends_agent.arun(query),
        competitor_agent.arun(query),
        sentiment_agent.arun(query),
        pricing_agent.arun(query),
    )

    elapsed = time.perf_counter() - t0
    print(f"[fan-out] All 4 agents completed in {elapsed:.2f}s")

    return trends.text, competitors.text, sentiment.text, pricing.text
```

## Step 3: Implement the fan-in aggregator

```python
async def fan_in(
    company: str,
    trends: str,
    competitors: str,
    sentiment: str,
    pricing: str,
) -> str:
    """Merge the four reports into a single executive summary."""
    prompt = f"""You have received four research reports on '{company}'.

MARKET TRENDS:
{trends}

COMPETITIVE LANDSCAPE:
{competitors}

SENTIMENT ANALYSIS:
{sentiment}

PRICING DYNAMICS:
{pricing}

Write an executive summary that integrates all four reports."""

    result = await aggregator_agent.arun(prompt)
    return result.text
```

## Step 4: Combine into a full research pipeline

```python
async def run_research(company: str) -> ResearchResult:
    result = ResearchResult(company=company)

    # --- Fan-out: run all four agents in parallel ---
    t_parallel_start = time.perf_counter()
    result.trends, result.competitors, result.sentiment, result.pricing = (
        await fan_out(company)
    )
    result.elapsed_parallel = time.perf_counter() - t_parallel_start

    # --- Fan-in: aggregate into a single summary ---
    result.summary = await fan_in(
        company,
        result.trends,
        result.competitors,
        result.sentiment,
        result.pricing,
    )

    # The sequential estimate assumes each agent takes the same average time
    # (elapsed_parallel / 4 per agent * 4 agents)
    result.elapsed_sequential_estimate = result.elapsed_parallel * 4

    return result
```

## Complete working example

```python
async def main():
    company = "electric vehicle charging infrastructure"
    print(f"Researching: {company}\n{'='*70}\n")

    result = await run_research(company)

    print("\n--- MARKET TRENDS ---")
    print(result.trends)

    print("\n--- COMPETITIVE LANDSCAPE ---")
    print(result.competitors)

    print("\n--- SENTIMENT ---")
    print(result.sentiment)

    print("\n--- PRICING ---")
    print(result.pricing)

    print("\n--- EXECUTIVE SUMMARY ---")
    print(result.summary)

    print(f"\n--- PERFORMANCE ---")
    print(f"  Parallel wall time:          {result.elapsed_parallel:.2f}s")
    print(f"  Sequential estimate:         {result.elapsed_sequential_estimate:.2f}s")
    print(f"  Speedup factor:              ~{result.elapsed_sequential_estimate / result.elapsed_parallel:.1f}x")

asyncio.run(main())
```

## Expected output

```
Researching: electric vehicle charging infrastructure
======================================================================

[fan-out] All 4 agents completed in 3.41s

--- MARKET TRENDS ---
• Government mandates are accelerating charging network buildouts globally...
...

--- EXECUTIVE SUMMARY ---
The EV charging sector is at an inflection point, driven by regulatory mandates
and surging EV adoption. Competition is intensifying between hardware-focused
players and software platform providers...

--- PERFORMANCE ---
  Parallel wall time:          3.41s
  Sequential estimate:         13.64s
  Speedup factor:              ~4.0x
```

## How it works

`asyncio.gather(*coroutines)` schedules all coroutines on the current event loop simultaneously. Because SynapseKit's `arun()` methods are non-blocking async calls to the OpenAI API, the event loop can switch between them while each waits for its HTTP response. The total time is bounded by the slowest single agent, not the sum.

The fan-in step runs after `gather()` completes, so the aggregator always has the full set of results. There is no race condition because `gather()` only returns when every coroutine has resolved.

## Variations

**Dynamic fan-out based on query type**

```python
agents_to_run = [trends_agent, competitor_agent]
if needs_sentiment_analysis(query):
    agents_to_run.append(sentiment_agent)

results = await asyncio.gather(*[a.arun(query) for a in agents_to_run])
```

**Timeout individual agents**

```python
import asyncio

async def with_timeout(coro, timeout: float, fallback: str = ""):
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except asyncio.TimeoutError:
        return type("R", (), {"text": fallback})()

# Each agent gets at most 10 seconds; slow agents return an empty string
results = await asyncio.gather(
    with_timeout(trends_agent.arun(query), 10.0, "Trends: data unavailable"),
    with_timeout(competitor_agent.arun(query), 10.0, "Competitors: data unavailable"),
)
```

**Fan out to the same agent with different prompts**

```python
perspectives = ["optimistic investor", "skeptical analyst", "end consumer"]
results = await asyncio.gather(*[
    sentiment_agent.arun(f"Perspective: {p}. Company: {company}")
    for p in perspectives
])
```

## Troubleshooting

**Rate limit errors when fanning out to many agents**
Add a semaphore to cap concurrency:

```python
sem = asyncio.Semaphore(3)

async def rate_limited(agent, query):
    async with sem:
        return await agent.arun(query)

results = await asyncio.gather(*[rate_limited(a, query) for a in agents])
```

**One agent's failure cancels all others**
By default, `gather()` propagates the first exception and cancels remaining tasks. Use `return_exceptions=True` to collect all results, including errors:

```python
results = await asyncio.gather(*coroutines, return_exceptions=True)
successful = [r for r in results if not isinstance(r, Exception)]
```

**The aggregator produces a generic summary**
Structure the prompt explicitly with labeled sections (as shown in Step 3). The aggregator needs clear signal about which content came from which specialist.

## Next steps

- [Crew Content Pipeline](./crew-content-pipeline) — sequential coordination with shared task context
- [Fan-Out / Fan-In in Graphs](../graph/fan-out-fan-in) — the same pattern modeled as a `StateGraph`
- [Agent-to-Agent Communication](./a2a-communication) — agents that respond to each other's output
