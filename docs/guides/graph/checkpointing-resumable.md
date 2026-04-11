---
sidebar_position: 6
title: "Checkpointing and Resumable Workflows"
description: "Use SynapseKit's SQLiteCheckpointer to persist graph state after every node, enabling crash recovery and mid-run state inspection."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Checkpointing and Resumable Workflows

<ColabBadge path="graph/checkpointing-resumable.ipynb" />

Long-running workflows can fail mid-way: a network timeout, a process kill, a machine reboot. Checkpointing serializes the graph state to a database after every node. If the process dies, you restart it and call `resume()` — the graph picks up exactly where it left off without re-running completed nodes.

**What you'll build:** A multi-stage research pipeline with `SQLiteCheckpointer` that survives a simulated mid-run crash and resumes from the last successful checkpoint. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit[openai,graph]
```

## What you'll learn

- Attach a `SQLiteCheckpointer` to a `StateGraph`
- Assign a `run_id` to track a specific workflow instance
- Resume a workflow after a crash using the same `run_id`
- Inspect checkpoints to see what each node produced
- Understand the checkpoint lifecycle (create, update, finalize)

## Step 1: Define state and nodes

```python
# checkpointing_resumable.py

from __future__ import annotations
import asyncio
from dataclasses import dataclass

from synapsekit.graph import StateGraph, CompiledGraph
from synapsekit.graph.checkpointing import SQLiteCheckpointer
from synapsekit.llms.openai import OpenAILLM
from synapsekit import LLMConfig

llm = OpenAILLM(model="gpt-4o-mini", config=LLMConfig(temperature=0.5))

@dataclass
class ResearchState:
    query: str
    # Each stage sets one of these fields
    sources: str      = ""
    outline: str      = ""
    draft: str        = ""
    final_report: str = ""
```

## Step 2: Implement the pipeline nodes

```python
async def gather_sources(state: ResearchState) -> ResearchState:
    """Simulate gathering research sources (slow network call)."""
    print("[gather_sources] Gathering sources...")
    response = await llm.agenerate(
        f"List 5 hypothetical research sources (title + one-sentence description) "
        f"relevant to: {state.query}"
    )
    state.sources = response.text
    print("[gather_sources] Done.")
    return state


async def build_outline(state: ResearchState) -> ResearchState:
    """Create a structured outline from the gathered sources."""
    print("[build_outline] Building outline...")
    response = await llm.agenerate(
        f"Using these sources:\n{state.sources}\n\n"
        f"Create a 5-section outline for a research report on: {state.query}"
    )
    state.outline = response.text
    print("[build_outline] Done.")
    return state


async def write_draft(state: ResearchState) -> ResearchState:
    """Draft the full report from the outline."""
    print("[write_draft] Writing draft...")
    response = await llm.agenerate(
        f"Write a 300-word research report following this outline:\n{state.outline}"
    )
    state.draft = response.text
    print("[write_draft] Done.")
    return state


async def finalize_report(state: ResearchState) -> ResearchState:
    """Polish the draft into the final deliverable."""
    print("[finalize_report] Finalizing...")
    response = await llm.agenerate(
        f"Polish the following draft for clarity and professional tone:\n{state.draft}"
    )
    state.final_report = response.text
    print("[finalize_report] Done.")
    return state
```

## Step 3: Build the graph with a checkpointer

```python
def build_graph(db_path: str = "./research_checkpoints.db") -> CompiledGraph:
    # SQLiteCheckpointer creates the database file on first use.
    # Every node completion writes a new row with the full serialized state.
    checkpointer = SQLiteCheckpointer(db_path=db_path)

    graph = StateGraph(ResearchState, checkpointer=checkpointer)

    graph.add_node("gather_sources",  gather_sources)
    graph.add_node("build_outline",   build_outline)
    graph.add_node("write_draft",     write_draft)
    graph.add_node("finalize_report", finalize_report)

    graph.set_entry_point("gather_sources")
    graph.add_edge("gather_sources", "build_outline")
    graph.add_edge("build_outline",  "write_draft")
    graph.add_edge("write_draft",    "finalize_report")

    return graph.compile()
```

## Step 4: Run the pipeline and simulate a crash

```python
async def run_with_crash_simulation(query: str, run_id: str) -> None:
    """Run the graph until write_draft, then simulate a crash."""
    graph = build_graph()

    # The on_node_complete callback fires immediately after each checkpoint is written.
    # Use it to inject a crash after the second node.
    nodes_completed = []

    async def on_complete(node_name: str, state: ResearchState):
        nodes_completed.append(node_name)
        print(f"  [checkpoint] State saved after '{node_name}'.")
        # Simulate a crash after build_outline completes
        if node_name == "build_outline":
            raise RuntimeError("Simulated process crash!")

    try:
        await graph.arun(
            ResearchState(query=query),
            run_id=run_id,
            on_node_complete=on_complete,
        )
    except RuntimeError as e:
        print(f"\nProcess crashed: {e}")
        print(f"Completed nodes: {nodes_completed}")
        print(f"State is checkpointed. Run ID: {run_id}")
```

## Step 5: Resume from the checkpoint

```python
async def resume_from_checkpoint(query: str, run_id: str) -> ResearchState:
    """Rebuild the graph and resume from the last checkpoint."""
    # The graph reloads all prior checkpoints from SQLite on init.
    # Nodes that already completed are skipped; execution resumes from
    # the first node that has no checkpoint.
    graph = build_graph()

    print(f"\n[resume] Resuming run '{run_id}' from last checkpoint...")
    final_state = await graph.resume(run_id=run_id)
    return final_state
```

## Complete working example

```python
async def main():
    query  = "The economic impact of autonomous vehicles on urban transportation"
    run_id = "research-av-001"

    # ---- First "process": runs until crash after build_outline ----
    print("=== FIRST RUN (will crash after build_outline) ===\n")
    await run_with_crash_simulation(query, run_id)

    # ---- Second "process": resumes from the build_outline checkpoint ----
    print("\n=== SECOND RUN (resuming from checkpoint) ===\n")
    final = await resume_from_checkpoint(query, run_id)

    print(f"\n--- FINAL REPORT ---")
    print(final.final_report)

asyncio.run(main())
```

## Expected output

```
=== FIRST RUN (will crash after build_outline) ===

[gather_sources] Gathering sources...
[gather_sources] Done.
  [checkpoint] State saved after 'gather_sources'.
[build_outline] Building outline...
[build_outline] Done.
  [checkpoint] State saved after 'build_outline'.

Process crashed: Simulated process crash!
Completed nodes: ['gather_sources', 'build_outline']
State is checkpointed. Run ID: research-av-001

=== SECOND RUN (resuming from checkpoint) ===

[resume] Resuming run 'research-av-001' from last checkpoint...
[write_draft] Writing draft...       <-- Skipped gather_sources and build_outline
[write_draft] Done.
[finalize_report] Finalizing...
[finalize_report] Done.

--- FINAL REPORT ---
The rise of autonomous vehicles represents a fundamental shift...
```

## How it works

After every node returns, the checkpointer serializes the entire state to the database under two keys: `(run_id, node_name)`. On `resume(run_id)`, the graph:

1. Loads all checkpoints for the `run_id`.
2. Builds a set of completed node names.
3. Starts execution from the first node in topological order that has no checkpoint.
4. Skips all nodes that already have a checkpoint.

Because the state is deserialized from the checkpoint, the resumed graph has exactly the same field values as the crashed one — no re-computation needed.

## Variations

**Inspect a specific checkpoint**

```python
checkpointer = SQLiteCheckpointer(db_path="./research_checkpoints.db")
state = checkpointer.load(run_id="research-av-001", node_name="build_outline")
print(state.outline)
```

**List all runs in a database**

```python
runs = checkpointer.list_runs()
for run in runs:
    print(f"{run.run_id}  last_node={run.last_node}  completed={run.completed}")
```

**Use a custom checkpointer backend**

Implement the `Checkpointer` protocol (two methods: `save(run_id, node_name, state)` and `load(run_id, node_name) -> state | None`) to checkpoint to Redis, PostgreSQL, or any other store.

```python
from synapsekit.graph.checkpointing import Checkpointer

class RedisCheckpointer(Checkpointer):
    def save(self, run_id, node_name, state): ...
    def load(self, run_id, node_name): ...
```

## Troubleshooting

**`resume()` re-runs all nodes from scratch**
The `run_id` passed to `resume()` must exactly match the one used in the original `arun()` call. Check for typos, trailing whitespace, or case differences.

**`SQLiteCheckpointer` raises a database lock error**
Only one process should write to the same SQLite database at a time. If running multiple workflows concurrently, use separate database files or switch to a concurrent backend (e.g., PostgreSQL via a custom checkpointer).

**Checkpointed state is missing a new field after a code change**
When you add a new field to the state dataclass, old checkpoints do not have it. Provide a default value for the new field in the dataclass so deserialization falls back gracefully.

## Next steps

- [Human-in-the-Loop](./human-in-the-loop) — pair checkpointing with `GraphInterrupt` for pause-and-resume workflows
- [Subgraph Composition](./subgraph-composition) — checkpoint subgraph state independently
- [Graph Error Recovery](./error-recovery) — combine checkpointing with retry logic for robust pipelines
