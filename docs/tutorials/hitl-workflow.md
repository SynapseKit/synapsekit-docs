---
sidebar_position: 5
---

# Tutorial: Human-in-the-Loop Workflow

Build a content moderation pipeline where low-confidence decisions are escalated to a human reviewer, state is checkpointed to SQLite so work survives process restarts, and the graph can be visualised as a Mermaid diagram.

**What you'll build:** A `StateGraph` that classifies content, auto-approves or auto-rejects clear cases, and pauses for human review on borderline content — resuming exactly where it left off after the human responds.

**Time:** ~25 minutes
**Prerequisites:** `pip install synapsekit[openai,graph]`

## What you'll learn

- Design a graph with conditional routing
- Implement `GraphInterrupt` to pause for human input
- Checkpoint state to SQLite so restarts are seamless
- Resume a paused graph with `resume(updates={...})`
- Use the `approval_node()` shortcut for common patterns
- Visualise the graph with `get_mermaid()` and `GraphVisualizer`
- Inspect state before and after each node

## Graph design

```
                    ┌─────────────────────┐
                    │   classify_content   │
                    │  (LLM-based scoring) │
                    └────────┬────────────┘
                             │
              ┌──────────────┼──────────────┐
       score >= 0.9    0.4 <= score < 0.9   score < 0.4
              │               │                  │
    ┌─────────▼──────┐  ┌─────▼──────────┐  ┌───▼──────────┐
    │  auto_approve  │  │  flag_for_review│  │  auto_reject │
    │  (skip human)  │  │ (GraphInterrupt)│  │  (skip human)│
    └─────────┬──────┘  └─────┬──────────┘  └───┬──────────┘
              │               │                  │
              └───────────────▼──────────────────┘
                         ┌────▼────┐
                         │  audit  │
                         └─────────┘
```

## Step 1: Define the graph state

```python
# content_moderation.py

from __future__ import annotations
import asyncio
from dataclasses import dataclass, field
from typing import Optional

from synapsekit.graph import StateGraph, GraphInterrupt, CompiledGraph
from synapsekit.graph.checkpointing import SQLiteCheckpointer
from synapsekit.graph.visualizer import GraphVisualizer
from synapsekit.llms.openai import OpenAILLM
from synapsekit import LLMConfig

# State is a plain dataclass — every field is serialisable so it can be checkpointed.
@dataclass
class ModerationState:
    # Input
    content: str                        = ""
    content_id: str                     = ""

    # Set by classify_content node
    score: float                        = 0.0   # 0.0 (definitely bad) to 1.0 (definitely fine)
    classification: str                 = ""     # "safe" | "borderline" | "unsafe"
    classification_reason: str          = ""

    # Set by human reviewer (populated when graph resumes)
    human_approved: Optional[bool]      = None
    reviewer_id: str                    = ""
    reviewer_notes: str                 = ""

    # Set by audit node
    final_decision: str                 = ""    # "approved" | "rejected" | "escalated"
    audit_log: list[str]                = field(default_factory=list)
```

## Step 2: Implement the nodes

```python
llm = OpenAILLM(
    model="gpt-4o-mini",
    config=LLMConfig(temperature=0.0)   # Deterministic scoring
)

# ---- classify_content ----
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
    state.score               = float(data["score"])
    state.classification      = data["classification"]
    state.classification_reason = data["reason"]

    print(f"[classify_content] score={state.score:.2f}  class={state.classification}")
    print(f"                   reason: {state.classification_reason}")
    # Expected output:
    # [classify_content] score=0.62  class=borderline
    #                    reason: Discusses sensitive topic without clear harmful intent.
    return state

# ---- auto_approve ----
def auto_approve(state: ModerationState) -> ModerationState:
    """Automatically approve high-confidence safe content."""
    state.final_decision = "approved"
    state.audit_log.append(f"Auto-approved (score={state.score:.2f})")
    print(f"[auto_approve] Content {state.content_id!r} approved automatically.")
    return state

# ---- auto_reject ----
def auto_reject(state: ModerationState) -> ModerationState:
    """Automatically reject high-confidence unsafe content."""
    state.final_decision = "rejected"
    state.audit_log.append(f"Auto-rejected (score={state.score:.2f}, reason={state.classification_reason})")
    print(f"[auto_reject] Content {state.content_id!r} rejected automatically.")
    return state

# ---- flag_for_review ----
def flag_for_review(state: ModerationState) -> ModerationState:
    """Pause the graph and wait for a human reviewer.

    GraphInterrupt is raised here — the graph serialises the current state to the
    checkpointer and suspends. When a human calls graph.resume(), execution
    continues from this exact point with the updated state.
    """
    print(f"[flag_for_review] Flagging {state.content_id!r} for human review.")
    print(f"  Score: {state.score:.2f}  Reason: {state.classification_reason}")
    print("  Graph pausing — waiting for reviewer input...")

    # GraphInterrupt pauses execution. The caller receives a GraphInterruptEvent
    # with the current state so they can display it to the reviewer.
    raise GraphInterrupt(
        state=state,
        message=f"Content requires human review. Score: {state.score:.2f}. Reason: {state.classification_reason}",
        interrupt_type="human_review"
    )

# ---- audit ----
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
    # Expected output:
    # [audit] Final decision for 'post-42' : approved
    #         decision=approved  score=0.62  reviewer=mod-007  notes=Context is educational.
    return state
```

## Step 3: Define routing logic

```python
def route_by_score(state: ModerationState) -> str:
    """Return the name of the next node based on the classification score."""
    if state.score >= 0.9:
        return "auto_approve"     # Very safe — skip human review
    elif state.score < 0.4:
        return "auto_reject"      # Very unsafe — skip human review
    else:
        return "flag_for_review"  # Borderline — escalate to human
```

## Step 4: Build the graph with checkpointing

```python
def build_graph() -> CompiledGraph:
    # SQLiteCheckpointer persists state after every node.
    # If the process crashes mid-run, the graph can resume from the last checkpoint.
    checkpointer = SQLiteCheckpointer(db_path="./moderation_checkpoints.db")

    graph = StateGraph(ModerationState, checkpointer=checkpointer)

    # Register nodes — each node is an async or sync callable that receives
    # and returns a ModerationState.
    graph.add_node("classify_content", classify_content)
    graph.add_node("auto_approve",     auto_approve)
    graph.add_node("auto_reject",      auto_reject)
    graph.add_node("flag_for_review",  flag_for_review)
    graph.add_node("audit",            audit)

    # Entry point — the first node to execute
    graph.set_entry_point("classify_content")

    # Conditional edge: after classify_content, call route_by_score to pick the next node.
    graph.add_conditional_edges(
        "classify_content",
        route_by_score,
        {
            "auto_approve":    "auto_approve",
            "auto_reject":     "auto_reject",
            "flag_for_review": "flag_for_review",
        }
    )

    # All decision branches converge on audit before the graph ends.
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

    initial_state = ModerationState(
        content=content,
        content_id=content_id
    )

    try:
        # arun() executes the graph to completion or until a GraphInterrupt.
        final_state = await graph.arun(initial_state, run_id=content_id)
        print(f"\nCompleted without human review. Decision: {final_state.final_decision}")
        return final_state

    except GraphInterruptEvent as evt:
        # The graph is paused — show the reviewer the flagged content.
        print(f"\nGraph interrupted for human review.")
        print(f"  Content:  {evt.state.content[:100]}")
        print(f"  Score:    {evt.state.score:.2f}")
        print(f"  Reason:   {evt.state.classification_reason}")
        print(f"  Run ID:   {content_id}  (use this to resume)")

        # In a real app, send this to a review dashboard and return.
        # Here we simulate an immediate human decision.
        return await simulate_human_review(graph, evt, content_id)

async def simulate_human_review(
    graph: CompiledGraph,
    evt: GraphInterruptEvent,
    run_id: str,
) -> ModerationState:
    """Simulate a reviewer approving the flagged content."""
    print("\n[Simulating reviewer decision: APPROVED]")

    # resume() restarts the graph from the interrupt point.
    # updates= merges new values into the state before continuing.
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

For simple approve/reject workflows, SynapseKit provides a convenience node builder.

```python
from synapsekit.graph import approval_node

# approval_node() creates a pre-built GraphInterrupt node.
# It surfaces the state to a reviewer and waits for {"approved": True/False}.
review_node = approval_node(
    prompt_field="classification_reason",  # Display this field to the reviewer
    approved_field="human_approved",       # Write the decision here in the state
    on_approve="audit",                    # Next node if approved
    on_reject="auto_reject",               # Next node if rejected
)

# Drop-in replacement for the custom flag_for_review node:
# graph.add_node("flag_for_review", review_node)
```

## Step 7: Visualise the graph

```python
def visualise():
    graph = build_graph()

    # get_mermaid() returns a Mermaid flowchart string you can paste into
    # mermaid.live or embed in documentation.
    mermaid_src = graph.get_mermaid()
    print("Mermaid diagram:\n")
    print(mermaid_src)
    # Expected output:
    # graph TD
    #   classify_content --> auto_approve
    #   classify_content --> auto_reject
    #   classify_content --> flag_for_review
    #   auto_approve --> audit
    #   auto_reject --> audit
    #   flag_for_review --> audit

    # GraphVisualizer renders a PNG using matplotlib (optional dependency).
    try:
        viz = GraphVisualizer(graph)
        viz.save("./moderation_graph.png")
        print("\nGraph image saved to ./moderation_graph.png")
    except ImportError:
        print("Install matplotlib for PNG output: pip install matplotlib")
```

## Complete working example

```python
# complete_hitl.py — runs the full workflow with three sample posts
import asyncio
from content_moderation import moderate_content, visualise

SAMPLES = [
    # (content, content_id, expected_path)
    (
        "How to bake sourdough bread at home — step by step guide with photos.",
        "post-safe-001",
    ),
    (
        "My experience getting help for mental health issues — sharing my story.",
        "post-borderline-042",
    ),
    (
        "Step-by-step instructions for bypassing security systems — detailed tutorial.",
        "post-unsafe-007",
    ),
]

async def main():
    for content, cid in SAMPLES:
        print(f"\n{'='*70}")
        print(f"Moderating: {cid}")
        print(f"Content:    {content[:60]}...")
        result = await moderate_content(content, cid)

        print(f"\nAudit log:")
        for entry in result.audit_log:
            print(f"  - {entry}")
        # Expected outputs:
        #
        # post-safe-001:
        #   [classify_content] score=0.97  class=safe
        #   [auto_approve] Content 'post-safe-001' approved automatically.
        #   [audit] Final decision for 'post-safe-001': approved
        #   Audit log:
        #     - Auto-approved (score=0.97)
        #     - decision=approved  score=0.97  reviewer=auto
        #
        # post-borderline-042:
        #   [classify_content] score=0.61  class=borderline
        #   [flag_for_review] Flagging 'post-borderline-042' for human review.
        #   Graph pausing — waiting for reviewer input...
        #   [Simulating reviewer decision: APPROVED]
        #   [audit] Final decision for 'post-borderline-042': approved
        #
        # post-unsafe-007:
        #   [classify_content] score=0.08  class=unsafe
        #   [auto_reject] Content 'post-unsafe-007' rejected automatically.
        #   [audit] Final decision for 'post-unsafe-007': rejected

    visualise()

asyncio.run(main())
```

## Restart resilience

The following snippet demonstrates that a paused graph survives a process restart.

```python
# restart_demo.py
import asyncio
from synapsekit.graph import GraphInterruptEvent
from content_moderation import build_graph, ModerationState

async def main():
    graph = build_graph()   # Graph loads all prior checkpoints from SQLite on init

    content = "This post discusses controversial but legal topics in a balanced way."
    run_id  = "post-resume-demo"

    # ---- First process: run until interrupt ----
    try:
        await graph.arun(ModerationState(content=content, content_id=run_id), run_id=run_id)
    except GraphInterruptEvent:
        print("Process 1: graph paused, state saved to SQLite. Exiting...")

    # Simulate a restart by re-building the graph
    graph2 = build_graph()

    # ---- Second process: resume from checkpoint ----
    # The graph reads the saved state and continues from flag_for_review.
    final = await graph2.resume(
        run_id=run_id,
        updates={"human_approved": True, "final_decision": "approved", "reviewer_id": "mod-001"}
    )
    print(f"Process 2: resumed successfully. Final decision: {final.final_decision}")
    # Expected output:
    # Process 2: resumed successfully. Final decision: approved

asyncio.run(main())
```

## Troubleshooting

**`GraphInterruptEvent` is never raised**
Ensure the `flag_for_review` node raises `GraphInterrupt` and is reachable by the routing function. Print `state.score` in `route_by_score` to verify the threshold is being hit.

**State not persisting after restart**
Confirm `db_path` points to a writable file and that the same `run_id` is used on both the original run and the resume call. The `run_id` is the key used to look up checkpoints.

**Mermaid diagram not displaying conditionals**
`get_mermaid()` shows edges without labels by default. Pass `include_conditions=True` to annotate conditional edges with the return value of the routing function.

## Next steps

- [StateGraph reference](../graph/state-graph) — nodes, edges, and compiled graph API
- [Checkpointing reference](../graph/checkpointing) — SQLite, Redis, and custom backends
- [Mermaid visualisation](../graph/mermaid) — embedding diagrams in docs
- [Graph cycles](../graph/cycles) — loops and convergence conditions
