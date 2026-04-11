---
sidebar_position: 2
title: "Building a Linear Graph Workflow"
description: "Learn SynapseKit's StateGraph from scratch by building the simplest possible three-node linear workflow."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Building a Linear Graph Workflow

<ColabBadge path="graph/linear-workflow.ipynb" />

The best way to understand `StateGraph` is to build the simplest thing that works: a straight line of nodes with no branching, no parallelism, and no interrupts. Once this pattern is clear, every other graph feature is a variation on it.

**What you'll build:** A three-node pipeline that takes a raw topic, expands it into talking points, then formats those points as a structured report. **Time:** ~10 min. **Difficulty:** Beginner

## Prerequisites

```bash
pip install synapsekit[openai,graph]
```

## What you'll learn

- Define a state dataclass for your graph
- Register nodes with `add_node()`
- Connect nodes with `add_edge()`
- Set an entry point and compile the graph
- Run the graph with `arun()` and read the final state

## Step 1: Define the state

```python
# linear_workflow.py

from __future__ import annotations
import asyncio
from dataclasses import dataclass

from synapsekit.graph import StateGraph
from synapsekit.llms.openai import OpenAILLM
from synapsekit import LLMConfig

# Every field in the state dataclass is visible to all nodes.
# Nodes read the fields they need and write the fields they produce.
@dataclass
class ReportState:
    topic: str              # Input — set by the caller before running the graph
    talking_points: str = ""  # Set by node 1
    report: str = ""          # Set by node 2
```

## Step 2: Implement the nodes

```python
llm = OpenAILLM(model="gpt-4o-mini", config=LLMConfig(temperature=0.5))

async def expand_topic(state: ReportState) -> ReportState:
    """Turn a topic into 4–5 concise talking points."""
    response = await llm.agenerate(
        f"Generate 4–5 concise bullet-point talking points about: {state.topic}"
    )
    state.talking_points = response.text
    print(f"[expand_topic] Generated talking points.")
    return state


async def format_report(state: ReportState) -> ReportState:
    """Format talking points into a short structured report."""
    response = await llm.agenerate(
        f"Format the following talking points into a short report with a title, "
        f"introduction, and one paragraph per point:\n\n{state.talking_points}"
    )
    state.report = response.text
    print(f"[format_report] Report formatted.")
    return state
```

## Step 3: Build the graph

```python
def build_graph():
    graph = StateGraph(ReportState)

    # Register each node — the string name is used to reference it in edges
    graph.add_node("expand_topic",  expand_topic)
    graph.add_node("format_report", format_report)

    # The entry point is the first node executed when the graph runs
    graph.set_entry_point("expand_topic")

    # Unconditional edge: after expand_topic finishes, always go to format_report
    graph.add_edge("expand_topic", "format_report")

    # compile() validates the graph (checks for disconnected nodes, missing entry
    # point, etc.) and returns a CompiledGraph ready to run
    return graph.compile()
```

## Complete working example

```python
async def main():
    compiled = build_graph()

    initial_state = ReportState(topic="the future of quantum computing")
    final_state = await compiled.arun(initial_state)

    print("\n--- TALKING POINTS ---")
    print(final_state.talking_points)

    print("\n--- REPORT ---")
    print(final_state.report)

asyncio.run(main())
```

## Expected output

```
[expand_topic] Generated talking points.
[format_report] Report formatted.

--- TALKING POINTS ---
• Quantum computers exploit superposition to evaluate multiple states simultaneously...
• Error correction remains the central engineering challenge...
...

--- REPORT ---
The Future of Quantum Computing
================================
Quantum computing stands at the threshold of a transformative decade...
```

## How it works

When `arun()` is called:

1. The graph sets `current_node` to the entry point (`expand_topic`).
2. It calls `expand_topic(state)`, awaits the result, and updates the state.
3. It looks up the edge from `expand_topic` and finds `format_report`.
4. It calls `format_report(state)`, awaits the result, and updates the state.
5. It looks up the edge from `format_report` and finds no outgoing edge, so execution ends.
6. The final state is returned to the caller.

The state object is the single source of truth. It flows through every node, accumulating results until the graph terminates.

## Variations

**Add a third node for email formatting**

```python
async def format_email(state: ReportState) -> ReportState:
    response = await llm.agenerate(
        f"Rewrite this report as a professional email:\n\n{state.report}"
    )
    state.email_draft = response.text  # Add this field to ReportState
    return state

graph.add_node("format_email", format_email)
graph.add_edge("format_report", "format_email")
```

**Use a sync node**

Nodes do not need to be async. A sync function works as-is:

```python
def log_state(state: ReportState) -> ReportState:
    print(f"[log] topic={state.topic!r}  talking_points_length={len(state.talking_points)}")
    return state

graph.add_node("log_state", log_state)
graph.add_edge("expand_topic", "log_state")
graph.add_edge("log_state", "format_report")
```

**Inspect state mid-graph with a callback**

```python
compiled = graph.compile(
    on_node_complete=lambda node_name, state: print(f"Completed: {node_name}")
)
```

## Troubleshooting

**`compile()` raises "no entry point set"**
Call `graph.set_entry_point("node_name")` before `graph.compile()`.

**`compile()` raises "node X is unreachable"**
Every registered node must have an incoming edge (or be the entry point). Check that you called `add_edge()` for every node pair.

**State field is empty after the graph runs**
The node must return the modified state. If you forget to `return state`, the graph receives `None` and the field will be empty on the next node.

## Next steps

- [Conditional Routing](./conditional-routing) — branch to different nodes based on state
- [Fan-Out / Fan-In](./fan-out-fan-in) — run multiple nodes in parallel
- [Checkpointing](./checkpointing-resumable) — persist state so the graph can resume after a crash
