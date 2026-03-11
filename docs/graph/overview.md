---
sidebar_position: 1
---

# Graph Workflows Overview

Graph Workflows let you define async pipelines as **directed acyclic graphs (DAGs)**. Nodes are async functions; edges wire them together. The engine executes nodes wave by wave — parallel nodes run concurrently via `asyncio.gather()`.

## Core concepts

| Concept | Class | Description |
|---|---|---|
| **State** | `GraphState` | Plain `dict` passed through every node |
| **Node** | `Node` / `NodeFn` | Async function: `state → partial state` |
| **Edge** | `Edge` | Static `src → dst` connection |
| **Conditional Edge** | `ConditionalEdge` | Routes to different nodes based on state |
| **Graph** | `StateGraph` | Fluent builder — add nodes, edges, compile |
| **Compiled Graph** | `CompiledGraph` | Runnable — `run()`, `stream()`, `run_sync()` |

## Quick start

```python
import asyncio
from synapsekit import StateGraph

async def fetch(state):
    return {"data": f"fetched:{state['query']}"}

async def summarize(state):
    return {"summary": f"summary of {state['data']}"}

graph = (
    StateGraph()
    .add_node("fetch", fetch)
    .add_node("summarize", summarize)
    .add_edge("fetch", "summarize")
    .set_entry_point("fetch")
    .set_finish_point("summarize")
    .compile()
)

result = asyncio.run(graph.run({"query": "synapsekit"}))
print(result["summary"])  # "summary of fetched:synapsekit"
```

## Execution model

```
Entry node
    │
    ▼
 Wave 1: [node_a]          ← runs, merges partial state
    │
    ▼
 Wave 2: [node_b, node_c]  ← runs concurrently (asyncio.gather)
    │
    ▼
 Wave 3: [node_d]          ← converge
    │
    ▼
  END
```

Nodes in the same wave have no dependencies between them and execute in parallel. State is merged (via `dict.update`) after each wave.

## Routing with conditions

```python
from synapsekit import StateGraph, END

def route(state):
    return "approve" if state["score"] >= 0.8 else "reject"

graph = (
    StateGraph()
    .add_node("score", score_fn)
    .add_node("approve", approve_fn)
    .add_node("reject", reject_fn)
    .add_conditional_edge("score", route, {"approve": "approve", "reject": "reject"})
    .add_edge("approve", END)
    .add_edge("reject", END)
    .set_entry_point("score")
    .compile()
)
```

## What's validated at compile time

- Entry point is set and refers to a registered node
- All edge sources and destinations refer to registered nodes (or `END`)
- No cycles in static edges (DFS)

Conditional edge destinations are validated at compile time; the routing itself is resolved at runtime.
