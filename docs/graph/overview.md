---
sidebar_position: 1
---

# Graph Workflows Overview

Graph Workflows let you define async pipelines as **directed graphs**. Nodes are async functions; edges wire them together. The engine executes nodes wave by wave — parallel nodes run concurrently via `asyncio.gather()`. Cycles are supported for iterative workflows, and state can be checkpointed for resumability.

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

## Cycles

By default, static cycles raise `GraphConfigError`. For intentional loops, pass `allow_cycles=True`:

```python
graph = (
    StateGraph()
    .add_node("process", process_fn)
    .add_conditional_edge("process", should_continue, {"loop": "process", "done": END})
    .set_entry_point("process")
    .compile(allow_cycles=True, max_steps=50)
)
```

→ [Cycles docs](/docs/graph/cycles)

## Checkpointing

Persist graph state after each wave for resumability:

```python
from synapsekit import InMemoryCheckpointer

cp = InMemoryCheckpointer()
result = await graph.run({"input": "data"}, checkpointer=cp, graph_id="run-1")

# Resume later
result = await graph.resume("run-1", cp)
```

-> [Checkpointing docs](/docs/graph/checkpointing)

## Human-in-the-Loop

Nodes can raise `GraphInterrupt` to pause execution for human review. The state is checkpointed and `resume(updates=...)` applies edits before continuing:

```python
from synapsekit import GraphInterrupt

async def review(state):
    raise GraphInterrupt(message="Review needed", data={"draft": state["draft"]})

# After human review:
result = await graph.resume("run-1", cp, updates={"draft": "edited text"})
```

-> [Human-in-the-Loop docs](/docs/graph/checkpointing#human-in-the-loop)

## Subgraphs

Nest a compiled graph as a node in a parent graph using `subgraph_node()`:

```python
from synapsekit import subgraph_node

parent.add_node("sub", subgraph_node(
    compiled_sub,
    input_mapping={"query": "input"},
    output_mapping={"output": "sub_result"},
))
```

-> [Subgraphs docs](/docs/graph/nodes#subgraph_nodecompiled_graph-input_mapping-output_mapping)

## Token streaming

Stream tokens from LLM nodes using `llm_node(stream=True)` and `stream_tokens()`:

```python
from synapsekit import llm_node

graph.add_node("llm", llm_node(llm, stream=True))
compiled = graph.compile()

async for event in compiled.stream_tokens({"input": "Tell me about RAG"}):
    if event["type"] == "token":
        print(event["token"], end="")
```

-> [Token streaming docs](/docs/graph/nodes#token-streaming)

## What's validated at compile time

- Entry point is set and refers to a registered node
- All edge sources and destinations refer to registered nodes (or `END`)
- No cycles in static edges (unless `allow_cycles=True`)

Conditional edge destinations are validated at compile time; the routing itself is resolved at runtime.
