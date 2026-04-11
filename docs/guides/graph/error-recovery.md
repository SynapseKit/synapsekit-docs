---
sidebar_position: 8
title: "Graph Error Recovery"
description: "Handle node failures gracefully in SynapseKit StateGraph using try/except, retry edges, fallback nodes, and error state tracking."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Graph Error Recovery

<ColabBadge path="graph/error-recovery.ipynb" />

Production workflows fail: APIs return 500s, rate limits hit, LLM outputs fail to parse. A graph with no error handling crashes the entire run when any node fails. Error recovery patterns let nodes signal failure gracefully, retry automatically, route to fallback nodes, and record what went wrong — without losing the work done by nodes that already succeeded.

**What you'll build:** A data enrichment pipeline with per-node try/except blocks, configurable retry edges, a fallback node for unrecoverable failures, and an error log in the state. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit[openai,graph]
```

## What you'll learn

- Add try/except inside nodes to catch and record failures
- Use `add_retry_edge()` to automatically retry a failing node
- Route to a fallback node when retries are exhausted
- Track errors in the state for downstream reporting
- Combine error recovery with checkpointing for full resilience

## Step 1: Define state with error tracking fields

```python
# error_recovery.py

from __future__ import annotations
import asyncio
import random
from dataclasses import dataclass, field

from synapsekit.graph import StateGraph, CompiledGraph
from synapsekit.graph.checkpointing import SQLiteCheckpointer
from synapsekit.llms.openai import OpenAILLM
from synapsekit import LLMConfig

llm = OpenAILLM(model="gpt-4o-mini", config=LLMConfig(temperature=0.4))

@dataclass
class EnrichState:
    company_name: str

    # Populated by successful nodes
    description: str   = ""
    financials: str    = ""
    news_summary: str  = ""
    report: str        = ""

    # Error tracking — nodes append entries here when they fail
    errors: list[str]    = field(default_factory=list)
    failed_nodes: list[str] = field(default_factory=list)

    # Set to True when a node fails and retries are exhausted
    partial_result: bool = False
```

## Step 2: Implement nodes with try/except

```python
async def fetch_description(state: EnrichState) -> EnrichState:
    """Fetch a company description — wraps the LLM call so failures are recorded."""
    try:
        response = await llm.agenerate(
            f"Write a 2-sentence business description for: {state.company_name}"
        )
        state.description = response.text
        print(f"[fetch_description] OK")
    except Exception as exc:
        # Record the failure but don't let it crash the graph.
        # The graph will see the updated state and route accordingly.
        error_msg = f"fetch_description failed: {exc}"
        state.errors.append(error_msg)
        state.failed_nodes.append("fetch_description")
        print(f"[fetch_description] ERROR: {exc}")
    return state


async def fetch_financials(state: EnrichState) -> EnrichState:
    """Fetch financials — simulates a flaky external API."""
    try:
        # Simulate a 40% failure rate to demonstrate retry behavior
        if random.random() < 0.4:
            raise ConnectionError("External API timeout (simulated)")

        response = await llm.agenerate(
            f"Provide 3 hypothetical financial metrics for a company called: {state.company_name}"
        )
        state.financials = response.text
        print(f"[fetch_financials] OK")
    except Exception as exc:
        error_msg = f"fetch_financials failed: {exc}"
        state.errors.append(error_msg)
        state.failed_nodes.append("fetch_financials")
        state.partial_result = True
        print(f"[fetch_financials] ERROR: {exc}")
    return state


async def fetch_news(state: EnrichState) -> EnrichState:
    """Fetch recent news — may fail if the news API is down."""
    try:
        response = await llm.agenerate(
            f"Summarize 3 hypothetical recent news items about: {state.company_name}"
        )
        state.news_summary = response.text
        print(f"[fetch_news] OK")
    except Exception as exc:
        state.errors.append(f"fetch_news failed: {exc}")
        state.failed_nodes.append("fetch_news")
        state.partial_result = True
        print(f"[fetch_news] ERROR: {exc}")
    return state
```

## Step 3: Implement routing and fallback nodes

```python
def route_after_fetch(state: EnrichState) -> str:
    """Route to the report node if we have enough data; otherwise use fallback."""
    # We can still produce a useful report if we have at least the description
    if state.description:
        return "compile_report"
    # If even the description is missing, fall back to a minimal error report
    return "fallback_report"


async def compile_report(state: EnrichState) -> EnrichState:
    """Assemble whatever data was collected into a report."""
    sections = [f"# Company Profile: {state.company_name}\n"]

    if state.description:
        sections.append(f"## Description\n{state.description}\n")

    if state.financials:
        sections.append(f"## Financials\n{state.financials}\n")
    else:
        sections.append("## Financials\n_Not available (fetch failed)_\n")

    if state.news_summary:
        sections.append(f"## Recent News\n{state.news_summary}\n")
    else:
        sections.append("## Recent News\n_Not available (fetch failed)_\n")

    if state.errors:
        sections.append(
            "## Errors Encountered\n"
            + "\n".join(f"- {e}" for e in state.errors)
        )

    state.report = "\n".join(sections)
    status = "PARTIAL" if state.partial_result else "COMPLETE"
    print(f"[compile_report] Report compiled ({status}).")
    return state


async def fallback_report(state: EnrichState) -> EnrichState:
    """Generate a minimal report when critical data is unavailable."""
    state.report = (
        f"# Company Profile: {state.company_name}\n\n"
        f"Unable to retrieve company data. Errors:\n"
        + "\n".join(f"- {e}" for e in state.errors)
    )
    print(f"[fallback_report] Minimal fallback report generated.")
    return state
```

## Step 4: Build the graph with retry edges

```python
def build_graph() -> CompiledGraph:
    checkpointer = SQLiteCheckpointer(db_path="./enrichment_checkpoints.db")
    graph = StateGraph(EnrichState, checkpointer=checkpointer)

    graph.add_node("fetch_description", fetch_description)
    graph.add_node("fetch_financials",  fetch_financials)
    graph.add_node("fetch_news",        fetch_news)
    graph.add_node("compile_report",    compile_report)
    graph.add_node("fallback_report",   fallback_report)

    graph.set_entry_point("fetch_description")

    # add_retry_edge(node, max_retries, retry_on, fallback_node)
    # If fetch_financials' state has "fetch_financials" in failed_nodes,
    # the graph retries it up to 2 more times before routing to fallback.
    graph.add_retry_edge(
        "fetch_financials",
        max_retries=2,
        # retry_condition checks whether the node should be retried
        retry_condition=lambda state: "fetch_financials" in state.failed_nodes,
        # On retry, clear the failure flag so the node tries again cleanly
        on_retry=lambda state: setattr(state.failed_nodes, "remove", None) or state,
        fallback_node="compile_report",  # After retries exhausted, continue here
    )

    graph.add_edge("fetch_description", "fetch_financials")
    graph.add_edge("fetch_financials",  "fetch_news")

    # After fetch_news, inspect state to decide which report node to use
    graph.add_conditional_edges(
        "fetch_news",
        route_after_fetch,
        {
            "compile_report":  "compile_report",
            "fallback_report": "fallback_report",
        }
    )

    return graph.compile()
```

## Complete working example

```python
async def enrich(company: str, run_id: str) -> EnrichState:
    graph = build_graph()
    initial = EnrichState(company_name=company)
    return await graph.arun(initial, run_id=run_id)


async def main():
    companies = [
        ("Acme Technologies",    "acme-001"),
        ("Globex Industries",    "globex-002"),
        ("Initech Solutions",    "initech-003"),
    ]

    for company, run_id in companies:
        print(f"\n{'='*60}")
        print(f"Enriching: {company}")
        print("-" * 60)
        result = await enrich(company, run_id)

        print(f"\nStatus: {'PARTIAL' if result.partial_result else 'COMPLETE'}")
        if result.errors:
            print(f"Errors ({len(result.errors)}):")
            for e in result.errors:
                print(f"  - {e}")
        print(f"\n{result.report}")

asyncio.run(main())
```

## Expected output

```
============================================================
Enriching: Acme Technologies
------------------------------------------------------------
[fetch_description] OK
[fetch_financials] ERROR: External API timeout (simulated)
[fetch_financials] ERROR: External API timeout (simulated)  <- retry 1
[fetch_financials] OK                                        <- retry 2 succeeded
[fetch_news] OK
[compile_report] Report compiled (COMPLETE).

============================================================
Enriching: Globex Industries
------------------------------------------------------------
[fetch_description] OK
[fetch_financials] ERROR: External API timeout (simulated)
[fetch_financials] ERROR: External API timeout (simulated)
[fetch_financials] ERROR: External API timeout (simulated)  <- retries exhausted
[fetch_news] OK
[compile_report] Report compiled (PARTIAL).

Errors (1):
  - fetch_financials failed: External API timeout (simulated)
```

## How it works

There are two complementary error-handling layers:

**Layer 1 — try/except inside nodes.** Nodes catch exceptions, append to `state.errors` and `state.failed_nodes`, and return the state. The graph sees a normal return, not an exception. Downstream routing logic can inspect `failed_nodes` to decide the next step.

**Layer 2 — `add_retry_edge()`.** After a node returns, the graph checks `retry_condition(state)`. If `True` and retries remain, the graph re-runs the node (clearing the failure marker via `on_retry` first). After `max_retries` exhaustions, execution continues to `fallback_node`.

Combining these layers lets you express nuanced recovery policies: some failures are retryable (transient network errors), others are not (invalid input), and the routing logic decides how to proceed in each case.

## Variations

**Exponential backoff on retries**

```python
import asyncio

async def fetch_financials_with_backoff(state: EnrichState) -> EnrichState:
    for attempt in range(3):
        try:
            response = await llm.agenerate(...)
            state.financials = response.text
            return state
        except ConnectionError as exc:
            if attempt == 2:
                state.errors.append(str(exc))
                state.failed_nodes.append("fetch_financials")
                return state
            # Wait 2^attempt seconds before retrying (1s, 2s, 4s)
            await asyncio.sleep(2 ** attempt)
    return state
```

**Distinguish retryable from fatal errors**

```python
async def fetch_financials(state: EnrichState) -> EnrichState:
    try:
        ...
    except ConnectionError as exc:
        # Transient — mark for retry
        state.errors.append(f"RETRYABLE: {exc}")
        state.failed_nodes.append("fetch_financials")
    except ValueError as exc:
        # Fatal — skip retries and go straight to fallback
        state.errors.append(f"FATAL: {exc}")
        state.failed_nodes.append("fetch_financials_fatal")
    return state
```

**Send error alerts from a node**

```python
async def notify_on_failure(state: EnrichState) -> EnrichState:
    if state.errors:
        # Send to Slack, PagerDuty, etc.
        await send_alert(f"Pipeline failed for {state.company_name}: {state.errors}")
    return state
```

## Troubleshooting

**Graph crashes instead of recording the error**
Ensure the `except` block returns `state` — if it raises, the exception escapes the node and the graph terminates.

**Retry count is not decrementing**
`add_retry_edge()` tracks the retry count internally per `(run_id, node_name)`. If you are not using a `run_id`, all retries share global state. Always pass a unique `run_id` per workflow instance.

**`fallback_node` is never reached**
The fallback only triggers after all retry attempts are exhausted. If `retry_condition` returns `False` on the first failure, execution continues via the normal edge, not the fallback. Check your `retry_condition` logic.

## Next steps

- [Checkpointing and Resumable Workflows](./checkpointing-resumable) — combine with retry so a crashed process doesn't restart from scratch
- [Human-in-the-Loop](./human-in-the-loop) — escalate unrecoverable failures to a human reviewer
- [Conditional Routing](./conditional-routing) — build more sophisticated decision trees based on error state
