---
sidebar_position: 1
title: "Graph Workflows"
description: "Build stateful, resumable graph workflows with SynapseKit's StateGraph — from simple linear pipelines to complex human-in-the-loop systems."
---

# Graph Workflows

SynapseKit's `StateGraph` lets you model any multi-step LLM workflow as a directed graph. Nodes hold your logic; edges define execution order; a checkpointer saves state after every node so workflows can pause, resume, and survive process restarts.

## Guides in this section

| Guide | What you'll build | Difficulty |
|-------|------------------|------------|
| [Linear Workflow](./linear-workflow) | The simplest possible `StateGraph` — three nodes connected in sequence | Beginner |
| [Conditional Routing](./conditional-routing) | A graph that inspects state and chooses which node to visit next | Beginner |
| [Fan-Out / Fan-In](./fan-out-fan-in) | Parallel nodes that run simultaneously and merge results | Intermediate |
| [Subgraph Composition](./subgraph-composition) | Reusable compiled subgraphs embedded as nodes in a parent graph | Intermediate |
| [Checkpointing and Resumable Workflows](./checkpointing-resumable) | `SQLiteCheckpointer` for crash recovery and mid-run state inspection | Intermediate |
| [Human-in-the-Loop](./human-in-the-loop) | `GraphInterrupt` pauses execution; `resume()` continues with human input | Intermediate |
| [Graph Error Recovery](./error-recovery) | try/except in nodes, retry edges, fallback nodes, error state tracking | Intermediate |
| [Visualizing Graphs with Mermaid](./mermaid-visualization) | `get_mermaid()`, `GraphVisualizer`, and PNG export | Beginner |

## The graph execution model

Every `StateGraph` is parameterized on a **state type** — a plain dataclass whose fields accumulate results as execution moves through nodes.

```
initial_state
     │
     ▼
 [node A] ──── edge ────▶ [node B] ──── edge ────▶ [node C]
                                                        │
                                                     END
```

Each node is a sync or async callable with the signature `(state: S) -> S`. Nodes receive the current state, do their work, mutate it, and return it. The graph calls nodes in the order determined by edges and routing functions.

## Key primitives

| API | Purpose |
|-----|---------|
| `StateGraph(StateType)` | Create a new graph |
| `graph.add_node(name, fn)` | Register a node |
| `graph.add_edge(a, b)` | Unconditional edge from node `a` to node `b` |
| `graph.add_conditional_edges(a, router, map)` | Edge that calls `router(state)` to pick the next node |
| `graph.add_parallel_edges(a, [b, c])` | Fan-out: run `b` and `c` concurrently after `a` |
| `graph.add_join_edge([b, c], d)` | Fan-in: continue to `d` after both `b` and `c` finish |
| `graph.set_entry_point(name)` | First node to execute |
| `graph.compile()` | Validate the graph and return a `CompiledGraph` |
| `compiled.arun(state)` | Execute asynchronously |
| `compiled.resume(run_id, updates)` | Resume a paused graph |
| `compiled.get_mermaid()` | Return a Mermaid diagram string |

## Installation

```bash
pip install synapsekit[openai,graph]
```

The `graph` extra adds the graph engine and optional SQLite checkpointing support.
