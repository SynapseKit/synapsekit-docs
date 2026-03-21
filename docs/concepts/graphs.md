---
sidebar_position: 3
---

# How Graph Workflows Work

SynapseKit's `StateGraph` lets you build reliable, stateful pipelines as directed acyclic graphs (DAGs). Nodes are Python functions. Edges define execution order. State flows through the graph as a shared dictionary that every node can read and write.

## The DAG execution model

A `StateGraph` executes nodes in **waves**. Each wave contains all nodes whose dependencies have been satisfied. Nodes in the same wave run in parallel:

```
Wave 1: [ingest]
             |
Wave 2: [chunk, classify]    <- parallel
             |
Wave 3: [embed, route]       <- parallel
             |
Wave 4: [retrieve]
             |
Wave 5: [generate]
```

Parallelism is automatic — the graph engine tracks which nodes are ready and dispatches them concurrently using `asyncio.gather`.

### Nodes

A node is any `async` function:

```python
async def my_node(state: dict) -> dict:
    question = state["question"]
    answer = await call_llm(question)
    return {"answer": answer}  # partial update, not the full state
```

### Edges

```python
graph = StateGraph()
graph.add_node("ingest", ingest_node)
graph.add_node("embed", embed_node)
graph.add_edge("ingest", "embed")   # embed runs after ingest
```

## State: the shared dict

All nodes share a single state dictionary:

```
Initial state:     {"question": "What is SynapseKit?"}
After ingest:      {"question": "...", "documents": [...]}
After embed:       {"question": "...", "documents": [...], "embeddings": [...]}
After retrieve:    {"question": "...", ..., "context": [...]}
After generate:    {"question": "...", ..., "answer": "SynapseKit is..."}
```

### TypedState vs plain dict

Plain dicts work, but `TypedState` provides type safety and IDE completion:

```python
from synapsekit.graph import TypedState, StateField

class RAGState(TypedState):
    question: str
    documents: list[str] = StateField(default_factory=list)
    context: list[str] = StateField(default_factory=list)
    answer: str = StateField(default="")
```

### Reducers and parallel merges

When two nodes in the same wave both write to the same state key, the engine needs a reducer to merge them:

```python
class RAGState(TypedState):
    answer: str = StateField(default="")                        # last-write-wins
    chunks: list[str] = StateField(default_factory=list, reducer="extend")  # concatenate
    best_score: float = StateField(default=0.0, reducer=max)    # take maximum
```

Built-in reducers: `"extend"` (list concatenation), `"update"` (dict merge), `"add"` (numeric sum), `"max"`, `"min"`.

## Conditional routing

```python
def route_by_intent(state: dict) -> str:
    intent = state.get("intent")
    if intent == "factual":
        return "rag_node"
    elif intent == "creative":
        return "creative_node"
    else:
        return "fallback_node"

graph.add_conditional_edge(
    source="classify_intent",
    condition=route_by_intent,
    destinations=["rag_node", "creative_node", "fallback_node"],
)
```

The condition function receives the current state and returns the name of the next node. The `destinations` list is validated at compile time.

### Branching diagram

```
           [classify_intent]
                  |
      +-----------+-----------+
      v           v           v
  [rag_node]  [creative]  [fallback]
      |           |           |
      +-----------+-----------+
                  v
             [format_output]
```

## Cycles

By default, `StateGraph` is a DAG (no cycles). Enable cycles explicitly at compile time:

```python
compiled = graph.compile(allow_cycles=True, max_steps=20)
```

Cycles enable agentic loops — a node can route back to an earlier node. `max_steps` is a hard limit that prevents infinite loops; exceeding it raises `MaxStepsExceeded`.

## Checkpointing

Checkpoints save the full graph state to persistent storage. They enable:

- **Resume after failure** — restart from the last checkpoint
- **Human-in-the-loop** — pause the graph, wait for a decision, then resume
- **Debugging** — inspect state at any step after the run

```python
from synapsekit.graph import RedisCheckpointer

checkpointer = RedisCheckpointer(url="redis://localhost:6379")
compiled = graph.compile(checkpointer=checkpointer)

run_id = await compiled.run(state, run_id="my-run-001")

# Resume from checkpoint
result = await compiled.resume(run_id="my-run-001", update={"approved": True})
```

A checkpoint contains: `run_id`, `step`, `state` (full dict), `completed_nodes` (set), `timestamp`.

## Human-in-the-loop (HITL)

Mark any node as a "breakpoint" and the graph pauses, saves a checkpoint, and waits:

```
[draft_email] -> [PAUSE: human_review] -> [send_email]
                        |
                  Human approves
                  or edits draft
```

```python
from synapsekit.graph import interrupt

async def human_review_node(state: dict) -> dict:
    approved, edits = await interrupt(
        message="Please review the draft email",
        payload={"draft": state["draft"]},
    )
    return {"approved": approved, "draft": edits or state["draft"]}
```

When `interrupt()` is called, the graph saves a checkpoint and raises `GraphInterrupted`. Your application code catches it, presents the payload to the user, and calls `compiled.resume()` with the user's response.

## Subgraph composition

A compiled graph can be used as a node inside a parent graph:

```python
retrieval_subgraph = build_retrieval_graph().compile()

main_graph.add_node("retrieval", retrieval_subgraph)
main_graph.add_edge("classify", "retrieval")
main_graph.add_edge("retrieval", "generate")
```

## Visualization

```python
print(compiled.get_mermaid())
# graph TD
#     ingest --> chunk
#     chunk --> embed
#     ...
```

Use `get_mermaid_with_trace(run_id)` after a run to highlight which path was actually taken.

## See also

- [StateGraph overview](../graph/overview)
- [Nodes and edges](../graph/nodes)
- [Checkpointing guide](../graph/checkpointing)
- [Cycles guide](../graph/cycles)
