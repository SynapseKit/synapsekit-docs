---
sidebar_position: 7
---

# Checkpointing

Checkpointing lets you **persist graph state** after each execution wave. This enables resuming interrupted runs and inspecting intermediate state.

## Quick start

```python
from synapsekit import StateGraph, InMemoryCheckpointer

async def step_a(state):
    return {"result": state["input"].upper()}

graph = (
    StateGraph()
    .add_node("a", step_a)
    .set_entry_point("a")
    .set_finish_point("a")
    .compile()
)

cp = InMemoryCheckpointer()
result = await graph.run(
    {"input": "hello"},
    checkpointer=cp,
    graph_id="run-1",
)

# Load the saved checkpoint
step, saved_state = cp.load("run-1")
print(saved_state["result"])  # "HELLO"
```

## Backends

### InMemoryCheckpointer

Dict-backed, uses `copy.deepcopy()` for isolation. Great for testing and short-lived processes.

```python
from synapsekit import InMemoryCheckpointer

cp = InMemoryCheckpointer()
```

### SQLiteCheckpointer

Persists checkpoints to a SQLite database. Uses stdlib `sqlite3` — no extra dependencies.

```python
from synapsekit import SQLiteCheckpointer

cp = SQLiteCheckpointer("checkpoints.db")

# Or in-memory for testing
cp = SQLiteCheckpointer(":memory:")
```

The table schema is:

```sql
CREATE TABLE checkpoints (
    graph_id TEXT PRIMARY KEY,
    step     INTEGER,
    state    TEXT  -- JSON-serialized
);
```

## Resuming execution

Use `resume()` to re-execute a graph from its last checkpointed state:

```python
async def double(state):
    return {"value": state["value"] * 2}

graph = (
    StateGraph()
    .add_node("double", double)
    .set_entry_point("double")
    .set_finish_point("double")
    .compile()
)

cp = InMemoryCheckpointer()

# First run: value 5 → 10
await graph.run({"value": 5}, checkpointer=cp, graph_id="job-1")

# Resume: picks up state (value=10), runs again → 20
result = await graph.resume("job-1", cp)
print(result["value"])  # 20
```

:::info
`resume()` re-runs the graph from the entry point using the saved state. This works well for deterministic or idempotent graphs. It does not resume mid-wave.
:::

## Human-in-the-Loop

A node can raise `GraphInterrupt` to **pause execution** for human review. The graph state is checkpointed automatically, and an `InterruptState` object is returned with details about the interruption.

### How it works

1. A node raises `GraphInterrupt` when human input is needed
2. The graph engine catches the exception and checkpoints the current state
3. The caller receives an `InterruptState` with the interrupt message and data
4. After human review, `resume(graph_id, checkpointer, updates=...)` applies the edits and continues

### Example

```python
from synapsekit import StateGraph, InMemoryCheckpointer, GraphInterrupt

async def draft(state):
    return {"draft": f"Generated draft for: {state['topic']}"}

async def review(state):
    # Pause for human review
    raise GraphInterrupt(
        message="Please review the draft before publishing.",
        data={"draft": state["draft"]},
    )

async def publish(state):
    return {"published": True, "final": state["draft"]}

graph = (
    StateGraph()
    .add_node("draft", draft)
    .add_node("review", review)
    .add_node("publish", publish)
    .add_edge("draft", "review")
    .add_edge("review", "publish")
    .set_entry_point("draft")
    .set_finish_point("publish")
    .compile()
)

cp = InMemoryCheckpointer()

# Run — pauses at the review node
result = await graph.run({"topic": "RAG pipelines"}, checkpointer=cp, graph_id="doc-1")
# result is an InterruptState:
#   InterruptState(graph_id='doc-1', node='review', message='Please review...')

print(result.message)  # "Please review the draft before publishing."
print(result.data)     # {"draft": "Generated draft for: RAG pipelines"}

# Human reviews and edits the draft, then resume
final = await graph.resume(
    "doc-1", cp,
    updates={"draft": "Revised draft with human edits"},
)
print(final["published"])  # True
print(final["final"])      # "Revised draft with human edits"
```

### GraphInterrupt

| Parameter | Type | Default | Description |
|---|---|---|---|
| `message` | `str` | `"Graph interrupted"` | Human-readable reason for the interruption |
| `data` | `dict \| None` | `None` | Arbitrary data to show the human reviewer |

### InterruptState

| Attribute | Type | Description |
|---|---|---|
| `graph_id` | `str` | The execution ID |
| `node` | `str` | The node that raised the interrupt |
| `state` | `dict` | The graph state at the time of interruption |
| `message` | `str` | The interrupt message |
| `data` | `dict` | The interrupt data |
| `step` | `int` | The execution step when interrupted |

## Checkpointing with streaming

`stream()` also supports checkpointing:

```python
async for event in graph.stream(
    {"input": "data"},
    checkpointer=cp,
    graph_id="stream-1",
):
    print(event["node"], event["state"])
```

## Sync usage

`run_sync()` forwards checkpointer arguments:

```python
result = graph.run_sync(
    {"input": "data"},
    checkpointer=cp,
    graph_id="sync-1",
)
```

## Writing a custom checkpointer

Extend `BaseCheckpointer` and implement three methods:

```python
from synapsekit import BaseCheckpointer

class RedisCheckpointer(BaseCheckpointer):
    def __init__(self, redis_client):
        self._r = redis_client

    def save(self, graph_id: str, step: int, state: dict) -> None:
        import json
        self._r.set(f"cp:{graph_id}", json.dumps({"step": step, "state": state}))

    def load(self, graph_id: str) -> tuple[int, dict] | None:
        import json
        data = self._r.get(f"cp:{graph_id}")
        if data is None:
            return None
        parsed = json.loads(data)
        return parsed["step"], parsed["state"]

    def delete(self, graph_id: str) -> None:
        self._r.delete(f"cp:{graph_id}")
```

## API reference

### BaseCheckpointer

| Method | Signature | Description |
|---|---|---|
| `save` | `(graph_id, step, state) → None` | Persist state at the given step |
| `load` | `(graph_id) → (step, state) \| None` | Load most recent checkpoint |
| `delete` | `(graph_id) → None` | Remove checkpoint |

### CompiledGraph checkpointing args

| Parameter | Type | Default | Description |
|---|---|---|---|
| `checkpointer` | `BaseCheckpointer \| None` | `None` | Checkpointer backend |
| `graph_id` | `str \| None` | `None` | Unique ID for this execution (required for checkpointing) |
