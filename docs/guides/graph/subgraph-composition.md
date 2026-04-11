---
sidebar_position: 5
title: "Subgraph Composition"
description: "Build reusable compiled subgraphs and embed them as nodes inside a parent StateGraph to keep complex workflows modular and testable."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Subgraph Composition

<ColabBadge path="graph/subgraph-composition.ipynb" />

As graphs grow, they become hard to reason about as a single flat structure. Subgraph composition lets you compile a self-contained graph, then drop it into a parent graph as a single node. The subgraph handles its own state internally; the parent graph sees only inputs and outputs.

**What you'll build:** A content review pipeline where a `quality_check` subgraph (readability + fact-check) is embedded as a single node inside a larger publish-or-revise workflow. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit[openai,graph]
```

## What you'll learn

- Compile a subgraph with its own state type
- Wrap a compiled subgraph in an adapter so the parent graph can call it
- Compose multiple subgraphs as nodes in a parent graph
- Test subgraphs independently before integrating them

## Step 1: Define state types

```python
# subgraph_composition.py

from __future__ import annotations
import asyncio
from dataclasses import dataclass

from synapsekit.graph import StateGraph, CompiledGraph
from synapsekit.llms.openai import OpenAILLM
from synapsekit import LLMConfig

llm = OpenAILLM(model="gpt-4o-mini", config=LLMConfig(temperature=0.2))

# The subgraph has its own focused state — it only knows about quality checking
@dataclass
class QualityState:
    text: str
    readability_score: float = 0.0   # 0.0 (poor) to 1.0 (excellent)
    fact_check_passed: bool  = False
    quality_notes: str       = ""

# The parent graph's state contains both the article and the quality results
@dataclass
class PublishState:
    topic: str
    draft: str          = ""
    readability_score: float = 0.0
    fact_check_passed: bool  = False
    quality_notes: str       = ""
    decision: str       = ""   # "publish" | "revise"
    final_content: str  = ""
```

## Step 2: Build the quality-check subgraph

```python
async def check_readability(state: QualityState) -> QualityState:
    """Score the text's readability on a 0–1 scale."""
    response = await llm.agenerate(
        f"Rate the readability of the following text on a scale from 0.0 to 1.0. "
        f"Consider sentence length, vocabulary complexity, and logical flow. "
        f"Respond with only a float.\n\nText: {state.text}"
    )
    try:
        state.readability_score = float(response.text.strip())
    except ValueError:
        state.readability_score = 0.5   # Default when the LLM response is unparseable
    print(f"[readability] Score: {state.readability_score:.2f}")
    return state


async def check_facts(state: QualityState) -> QualityState:
    """Verify that the text contains no obvious factual errors."""
    response = await llm.agenerate(
        f"Does the following text contain any clear factual errors or unsupported claims? "
        f"Reply with 'PASS' if no obvious errors are found, or 'FAIL: <reason>' if errors exist.\n\n"
        f"Text: {state.text}"
    )
    result = response.text.strip()
    state.fact_check_passed = result.upper().startswith("PASS")
    state.quality_notes = result
    print(f"[fact_check] {'PASS' if state.fact_check_passed else 'FAIL'}")
    return state


def build_quality_subgraph() -> CompiledGraph:
    """Return a compiled subgraph that checks readability and facts in parallel."""
    graph = StateGraph(QualityState)

    graph.add_node("check_readability", check_readability)
    graph.add_node("check_facts",       check_facts)

    graph.set_entry_point("check_readability")

    # Run both checks concurrently — neither depends on the other
    graph.add_parallel_edges("check_readability", ["check_facts"])
    graph.add_join_edge(["check_readability", "check_facts"], "__end__")

    return graph.compile()
```

## Step 3: Wrap the subgraph as a parent-graph node

```python
# The subgraph speaks QualityState; the parent graph speaks PublishState.
# An adapter function bridges the two: it extracts the relevant fields from
# PublishState, runs the subgraph, then writes the results back.

quality_subgraph = build_quality_subgraph()

async def run_quality_check(parent_state: PublishState) -> PublishState:
    """Adapter: run the quality_check subgraph inside the parent graph."""
    # Build the subgraph's input from the parent state
    sub_input = QualityState(text=parent_state.draft)

    # arun() returns the subgraph's final QualityState
    sub_output = await quality_subgraph.arun(sub_input)

    # Write subgraph results back into the parent state
    parent_state.readability_score = sub_output.readability_score
    parent_state.fact_check_passed = sub_output.fact_check_passed
    parent_state.quality_notes     = sub_output.quality_notes

    return parent_state
```

## Step 4: Build the parent graph

```python
async def draft_article(state: PublishState) -> PublishState:
    """Generate a first draft based on the topic."""
    response = await llm.agenerate(
        f"Write a 200-word draft article about: {state.topic}"
    )
    state.draft = response.text
    print(f"[draft] Draft written ({len(state.draft)} chars).")
    return state


def route_publish_decision(state: PublishState) -> str:
    """Approve or flag for revision based on quality scores."""
    if state.readability_score >= 0.7 and state.fact_check_passed:
        return "publish"
    return "revise"


async def publish(state: PublishState) -> PublishState:
    state.decision = "publish"
    state.final_content = state.draft
    print("[publish] Article approved for publication.")
    return state


async def revise(state: PublishState) -> PublishState:
    """Ask the LLM to improve the draft given the quality notes."""
    state.decision = "revise"
    response = await llm.agenerate(
        f"Revise the following article to improve readability and fix any issues noted.\n\n"
        f"Quality notes: {state.quality_notes}\n\n"
        f"Article:\n{state.draft}"
    )
    state.final_content = response.text
    print("[revise] Article revised.")
    return state


def build_parent_graph() -> CompiledGraph:
    graph = StateGraph(PublishState)

    graph.add_node("draft_article",   draft_article)
    graph.add_node("quality_check",   run_quality_check)   # <-- subgraph as a node
    graph.add_node("publish",         publish)
    graph.add_node("revise",          revise)

    graph.set_entry_point("draft_article")
    graph.add_edge("draft_article", "quality_check")

    graph.add_conditional_edges(
        "quality_check",
        route_publish_decision,
        {
            "publish": "publish",
            "revise":  "revise",
        }
    )

    return graph.compile()
```

## Complete working example

```python
async def main():
    compiled = build_parent_graph()
    initial = PublishState(topic="The benefits of daily meditation for cognitive performance")
    final = await compiled.arun(initial)

    print(f"\n--- RESULT ---")
    print(f"Decision:          {final.decision}")
    print(f"Readability score: {final.readability_score:.2f}")
    print(f"Fact check:        {'PASS' if final.fact_check_passed else 'FAIL'}")
    print(f"\nFinal content:\n{final.final_content}")

asyncio.run(main())
```

## Expected output

```
[draft] Draft written (213 chars).
[readability] Score: 0.82
[fact_check] PASS
[publish] Article approved for publication.

--- RESULT ---
Decision:          publish
Readability score: 0.82
Fact check:        PASS

Final content:
Daily meditation has emerged as one of the most accessible...
```

## How it works

The parent graph treats `run_quality_check` as a plain async node. It has no idea a subgraph is running inside it. The adapter function (`run_quality_check`) is the seam: it converts between state types, delegates to the subgraph, and converts back.

This pattern has three advantages:

1. **Testability** — the quality subgraph can be tested independently with `QualityState` inputs before being integrated.
2. **Reusability** — the same compiled subgraph can be used as a node in multiple parent graphs.
3. **Encapsulation** — changes to the quality check logic (adding a new check node, changing thresholds) do not require modifying the parent graph.

## Variations

**Reuse the same subgraph multiple times**

```python
# Run quality_check after both the initial draft and the revision
graph.add_edge("draft_article", "quality_check_1")
graph.add_node("quality_check_1", run_quality_check)
graph.add_node("quality_check_2", run_quality_check)   # Same adapter, different name
graph.add_edge("revise", "quality_check_2")
```

**Share a checkpointer with the subgraph**

Pass the same `SQLiteCheckpointer` instance to both `build_quality_subgraph()` and `build_parent_graph()`. Both graphs will write their state to the same database, and you can inspect mid-subgraph checkpoints from the parent's run history.

**Compose three levels deep**

A subgraph can itself contain a sub-subgraph. The pattern is identical at each level: define an adapter, compile the inner graph, call it from within the outer adapter.

## Troubleshooting

**Subgraph output is not reflected in parent state**
Check the adapter function (`run_quality_check`). Every field you want in the parent state must be explicitly copied from `sub_output` to `parent_state` before returning.

**The subgraph's `compile()` fails with "unreachable nodes"**
Make sure you have a `add_join_edge(..., "__end__")` or at least one terminal edge in the subgraph. The `__end__` sentinel tells the graph engine where execution stops.

**Subgraph runs but takes the full parent timeout**
The subgraph's `arun()` call inside the adapter respects the adapter's timeout context. If the parent has a per-node timeout, the subgraph must finish within it. Pass `timeout=` to `arun()` explicitly if needed.

## Next steps

- [Checkpointing and Resumable Workflows](./checkpointing-resumable) — persist subgraph state across restarts
- [Fan-Out / Fan-In](./fan-out-fan-in) — parallelize the nodes inside your subgraph
- [Human-in-the-Loop](./human-in-the-loop) — interrupt the subgraph for human review before the parent continues
