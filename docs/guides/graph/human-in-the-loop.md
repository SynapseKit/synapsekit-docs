---
sidebar_position: 7
title: "Human-in-the-Loop Workflows"
description: "Pause a SynapseKit StateGraph mid-execution using GraphInterrupt, surface state to a human reviewer, and resume with updated values."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Human-in-the-Loop Workflows

<ColabBadge path="graph/human-in-the-loop.ipynb" />

Some decisions require human judgment. `GraphInterrupt` pauses the graph at any node, serializes the current state to the checkpointer, and surfaces that state to a reviewer. When the reviewer responds, `resume()` restarts execution from the exact interrupt point with their input merged into the state.

**What you'll build:** A content moderation pipeline that auto-approves safe content, auto-rejects clearly harmful content, and pauses for human review on borderline cases — surviving process restarts between the pause and the resume. **Time:** ~25 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit[openai,graph]
```

## What you'll learn

- Design a graph with conditional routing to three decision paths
- Raise `GraphInterrupt` inside a node to pause execution
- Handle `GraphInterruptEvent` in the caller and display state to a reviewer
- Resume a paused graph with `resume(updates={...})`
- Use the `approval_node()` shortcut for common approve/reject patterns
- Visualize the graph with `get_mermaid()`

## Step 1: Define the graph state

```python
# human_in_the_loop.py

from __future__ import annotations
import asyncio
from dataclasses import dataclass, field
from typing import Optional

from synapsekit.graph import StateGraph, GraphInterrupt, CompiledGraph
from synapsekit.graph.checkpointing import SQLiteCheckpointer
from synapsekit.graph.visualizer import GraphVisualizer
from synapsekit.llms.openai import OpenAILLM
from synapsekit import LLMConfig

# Every field is serializable so it can be checkpointed.
@dataclass
class ModerationState:
    # Input
    content: str                        = ""
    content_id: str                     = ""

    # Set by the classify_content node
    score: float                        = 0.0   # 0.0 (harmful) to 1.0 (safe)
    classification: str                 = ""     # "safe" | "borderline" | "unsafe"
    classification_reason: str          = ""

    # Set by a human reviewer via resume(updates={...})
    human_approved: Optional[bool]      = None
    reviewer_id: str                    = ""
    reviewer_notes: str                 = ""

    # Set by the audit node
    final_decision: str                 = ""    # "approved" | "rejected" | "escalated"
    audit_log: list[str]                = field(default_factory=list)
```

## Step 2: Implement the nodes

```python
llm = OpenAILLM(
    model="gpt-4o-mini",
    config=LLMConfig(temperature=0.0),  # Deterministic scoring
)

async def classify_content(state: ModerationState) -> ModerationState:
    """Ask the LLM to score content on a 0–1 safety scale."""
    prompt = f"""Rate the following content on a safety scale from 0.0 to 1.0.
0.0 = clearly harmful (violence, hate speech, explicit content, PII exposure)
0.5 = borderline (ambiguous, context-dependent)
1.0 = clearly safe (constructive, informative, on-topic)

Respond in JSON: {{"score": <float>, "classification": "<safe|borderline|unsafe>", "reason": "<brief>"}}

Content: {state.content}"""

    response = await llm.agenerate(prompt)

    import json
    data = json.loads(response.text)
    state.score                   = float(data["score"])
    state.classification          = data["classification"]
    state.classification_reason   = data["reason"]

    print(f"[classify_content] score={state.score:.2f}  class={state.classification}")
    print(f"                   reason: {state.classification_reason}")
    return state


def auto_approve(state: ModerationState) -> ModerationState:
    """Automatically approve high-confidence safe content."""
    state.final_decision = "approved"
    state.audit_log.append(f"Auto-approved (score={state.score:.2f})")
    print(f"[auto_approve] Content {state.content_id!r} approved automatically.")
    return state


def auto_reject(state: ModerationState) -> ModerationState:
    """Automatically reject high-confidence unsafe content."""
    state.final_decision = "rejected"
    state.audit_log.append(
        f"Auto-rejected (score={state.score:.2f}, reason={state.classification_reason})"
    )
    print(f"[auto_reject] Content {state.content_id!r} rejected automatically.")
    return state


def flag_for_review(state: ModerationState) -> ModerationState:
    """Pause the graph and wait for a human reviewer.

    Raising GraphInterrupt causes the graph engine to serialize state to the
    checkpointer and suspend. The caller receives a GraphInterruptEvent with the
    current state. When they call graph.resume(), execution continues from here.
    """
    print(f"[flag_for_review] Flagging {state.content_id!r} for human review.")
    print(f"  Score: {state.score:.2f}  Reason: {state.classification_reason}")
    print("  Graph pausing — waiting for reviewer input...")

    raise GraphInterrupt(
        state=state,
        message=(
            f"Content requires human review. "
            f"Score: {state.score:.2f}. Reason: {state.classification_reason}"
        ),
        interrupt_type="human_review",
    )


def audit(state: ModerationState) -> ModerationState:
    """Log the final decision and close the moderation record."""
    entry = (
        f"decision={state.final_decision}  "
        f"score={state.score:.2f}  "
        f"reviewer={state.reviewer_id or 'auto'}  "
        f"notes={state.reviewer_notes or 'n/a'}"
    )
    state.audit_log.append(entry)
    print(f"[audit] Final decision for {state.content_id!r}: {state.final_decision}")
    print(f"        {entry}")
    return state
```

## Step 3: Define routing logic

```python
def route_by_score(state: ModerationState) -> str:
    """Return the name of the next node based on the classification score."""
    if state.score >= 0.9:
        return "auto_approve"      # Very safe — no human review needed
    elif state.score < 0.4:
        return "auto_reject"       # Very unsafe — no human review needed
    else:
        return "flag_for_review"   # Borderline — escalate to human
```

## Step 4: Build the graph with checkpointing

```python
def build_graph() -> CompiledGraph:
    # SQLiteCheckpointer persists state after every node.
    # If the process crashes mid-run, resume() reads from this database.
    checkpointer = SQLiteCheckpointer(db_path="./moderation_checkpoints.db")

    graph = StateGraph(ModerationState, checkpointer=checkpointer)

    graph.add_node("classify_content", classify_content)
    graph.add_node("auto_approve",     auto_approve)
    graph.add_node("auto_reject",      auto_reject)
    graph.add_node("flag_for_review",  flag_for_review)
    graph.add_node("audit",            audit)

    graph.set_entry_point("classify_content")

    # After classify_content, call route_by_score to choose the next node
    graph.add_conditional_edges(
        "classify_content",
        route_by_score,
        {
            "auto_approve":    "auto_approve",
            "auto_reject":     "auto_reject",
            "flag_for_review": "flag_for_review",
        }
    )

    # All three branches converge on audit
    graph.add_edge("auto_approve",    "audit")
    graph.add_edge("auto_reject",     "audit")
    graph.add_edge("flag_for_review", "audit")  # Resumes here after GraphInterrupt

    return graph.compile()
```

## Step 5: Run the graph and handle interrupts

```python
from synapsekit.graph import GraphInterruptEvent

async def moderate_content(content: str, content_id: str) -> ModerationState:
    """Run a piece of content through the moderation graph."""
    graph = build_graph()
    initial_state = ModerationState(content=content, content_id=content_id)

    try:
        # arun() executes to completion or until a GraphInterrupt
        final_state = await graph.arun(initial_state, run_id=content_id)
        print(f"\nCompleted without human review. Decision: {final_state.final_decision}")
        return final_state

    except GraphInterruptEvent as evt:
        # The graph is paused — display state to the reviewer
        print(f"\nGraph interrupted for human review.")
        print(f"  Content:  {evt.state.content[:100]}")
        print(f"  Score:    {evt.state.score:.2f}")
        print(f"  Reason:   {evt.state.classification_reason}")
        print(f"  Run ID:   {content_id}  (use this to resume)")

        # In production, send this to a review dashboard and return.
        # Here we simulate an immediate human decision.
        return await simulate_human_review(graph, content_id)


async def simulate_human_review(graph: CompiledGraph, run_id: str) -> ModerationState:
    """Simulate a reviewer approving the flagged content."""
    print("\n[Simulating reviewer decision: APPROVED]")

    # resume() restarts the graph from the interrupt point.
    # updates= merges new values into the state before execution continues.
    final_state = await graph.resume(
        run_id=run_id,
        updates={
            "human_approved": True,
            "final_decision":  "approved",
            "reviewer_id":     "mod-007",
            "reviewer_notes":  "Context is educational; not harmful.",
        }
    )
    print(f"\nResumed. Final decision: {final_state.final_decision}")
    return final_state
```

## Step 6: Use the `approval_node()` shortcut

For simple approve/reject workflows, SynapseKit provides a convenience node builder that wraps `GraphInterrupt` for you:

```python
from synapsekit.graph import approval_node

# approval_node() creates a pre-built GraphInterrupt node.
# It surfaces the named field to the reviewer and waits for {"approved": True/False}.
review_node = approval_node(
    prompt_field="classification_reason",  # Display this field to the reviewer
    approved_field="human_approved",       # Write the decision here in state
    on_approve="audit",                    # Next node if approved
    on_reject="auto_reject",               # Next node if rejected
)

# Drop-in replacement for the custom flag_for_review node:
# graph.add_node("flag_for_review", review_node)
```

## Complete working example

```python
SAMPLES = [
    ("How to bake sourdough bread at home — step by step guide.", "post-safe-001"),
    ("My experience getting help for mental health issues — sharing my story.", "post-borderline-042"),
    ("Step-by-step instructions for bypassing security systems.", "post-unsafe-007"),
]

async def main():
    for content, cid in SAMPLES:
        print(f"\n{'='*70}")
        print(f"Moderating: {cid}")
        result = await moderate_content(content, cid)

        print(f"\nAudit log:")
        for entry in result.audit_log:
            print(f"  - {entry}")

asyncio.run(main())
```

## Expected output

```
======================================================================
Moderating: post-safe-001
[classify_content] score=0.97  class=safe
[auto_approve] Content 'post-safe-001' approved automatically.
[audit] Final decision for 'post-safe-001': approved
Audit log:
  - Auto-approved (score=0.97)
  - decision=approved  score=0.97  reviewer=auto

======================================================================
Moderating: post-borderline-042
[classify_content] score=0.61  class=borderline
[flag_for_review] Flagging 'post-borderline-042' for human review.
  Graph pausing — waiting for reviewer input...

Graph interrupted for human review.
[Simulating reviewer decision: APPROVED]
[audit] Final decision for 'post-borderline-042': approved

======================================================================
Moderating: post-unsafe-007
[classify_content] score=0.08  class=unsafe
[auto_reject] Content 'post-unsafe-007' rejected automatically.
[audit] Final decision for 'post-unsafe-007': rejected
```

## How it works

When `flag_for_review` raises `GraphInterrupt`, the graph engine:

1. Catches the exception before it reaches the caller.
2. Saves the current state to the checkpointer under `(run_id, "flag_for_review")`.
3. Re-raises it as a `GraphInterruptEvent` so the caller's `except` block can handle it.

When `resume(run_id, updates)` is called:

1. The graph loads the checkpointed state.
2. Merges `updates` into the state (overwriting any fields listed).
3. Continues execution from `flag_for_review`'s successor node (`audit` in this case).

The `updates` dict is the mechanism by which human decisions re-enter the workflow.

## Variations

**Restart resilience — survive a full process restart**

```python
# Process 1: run until interrupt, then exit
try:
    await graph.arun(ModerationState(...), run_id="post-resume-demo")
except GraphInterruptEvent:
    print("Paused. Exiting process.")

# Process 2: pick up after restart
graph2 = build_graph()   # Reloads all checkpoints from SQLite
final = await graph2.resume(
    run_id="post-resume-demo",
    updates={"human_approved": True, "final_decision": "approved", "reviewer_id": "mod-001"}
)
```

**Multiple interrupt points in one graph**

A graph can have more than one node that raises `GraphInterrupt`. Each pause/resume cycle uses the same `run_id`; the graph advances past each interrupt point in order.

**Timeout paused reviews**

Use a scheduler (e.g., a cron job) to query `checkpointer.list_runs()` for runs that have been paused for more than N hours and auto-resolve them as escalated.

## Troubleshooting

**`GraphInterruptEvent` is never raised**
Verify that `flag_for_review` is reachable by the routing function. Print `state.score` in `route_by_score` to confirm the threshold is being triggered.

**State not persisting after restart**
Confirm `db_path` points to a writable file and that the same `run_id` is used on both the original run and the `resume()` call.

**`resume()` raises "run not found"**
The run ID must exist in the checkpointer database. If you are using a different `db_path` than the original run, the checkpoint will not be found.

**Mermaid diagram does not show conditional labels**
Pass `include_conditions=True` to `get_mermaid()` to annotate conditional edges with the routing function's return values.

## Next steps

- [Checkpointing and Resumable Workflows](./checkpointing-resumable) — deeper dive into the checkpointer API
- [Graph Error Recovery](./error-recovery) — handle node failures gracefully
- [Mermaid Visualization](./mermaid-visualization) — visualize this graph with `get_mermaid()`
