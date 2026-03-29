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

# Async context manager — connection is closed automatically on exit
async with SQLiteCheckpointer("checkpoints.db") as cp:
    graph = compiled.compile(checkpointer=cp)
    result = await graph.run(state)
# connection closed here
```

The table schema is:

```sql
CREATE TABLE checkpoints (
    graph_id TEXT PRIMARY KEY,
    step     INTEGER,
    state    TEXT  -- JSON-serialized
);
```

### JSONFileCheckpointer

Persists checkpoints as JSON files on disk. Each graph gets its own `{graph_id}.json` file. No external dependencies.

```python
from synapsekit import JSONFileCheckpointer

cp = JSONFileCheckpointer("./checkpoints")
```

Each file stores `{"step": N, "state": {...}}`. Good for simple file-based persistence without a database.

### RedisCheckpointer

Persists checkpoints in Redis. Supports optional TTL for auto-expiry.

```bash
pip install synapsekit[redis]
```

```python
import redis
from synapsekit import RedisCheckpointer

r = redis.Redis()
cp = RedisCheckpointer(r, ttl=3600)  # optional TTL in seconds
```

Keys are stored as `synapsekit:checkpoint:{graph_id}` with JSON-serialized `{"step": N, "state": {...}}`.

| Parameter | Default | Description |
|---|---|---|
| `client` | (required) | A `redis.Redis` instance |
| `ttl` | `None` | Optional TTL in seconds for auto-expiry |

### PostgresCheckpointer

Persists checkpoints in PostgreSQL using UPSERT. Auto-creates the table on first use.

```bash
pip install synapsekit[postgres]
```

```python
import psycopg
from synapsekit import PostgresCheckpointer

conn = psycopg.connect("postgresql://localhost/mydb")
cp = PostgresCheckpointer(conn)
```

The table schema is:

```sql
CREATE TABLE IF NOT EXISTS synapsekit_checkpoints (
    graph_id TEXT PRIMARY KEY,
    step INTEGER NOT NULL,
    state JSONB NOT NULL
);
```

| Parameter | Default | Description |
|---|---|---|
| `connection` | (required) | A `psycopg.Connection` instance |
| `autocommit` | `True` | Whether to commit after each operation |

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

class MyCheckpointer(BaseCheckpointer):
    def save(self, graph_id: str, step: int, state: dict) -> None:
        # Persist state
        ...

    def load(self, graph_id: str) -> tuple[int, dict] | None:
        # Load most recent checkpoint, return (step, state) or None
        ...

    def delete(self, graph_id: str) -> None:
        # Remove checkpoint
        ...
```

:::info
SynapseKit ships with 5 built-in checkpointers: InMemory, SQLite, JSON file, Redis, and PostgreSQL. You only need a custom checkpointer for unsupported backends.
:::

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

## Graph Versioning & Migration

When your graph's state schema evolves, use the `version` and `migrations` parameters to upgrade checkpointed state automatically.

### Declaring a version

```python
graph = (
    StateGraph(version=2)
    .add_node("process", process_node)
    .set_entry_point("process")
    .set_finish_point("process")
    .compile()
)
```

### Defining migration functions

Migrations are keyed by `(from_version, to_version)` tuples. Each function receives the old state dict and returns the updated state dict:

```python
def migrate_1_to_2(state: dict) -> dict:
    # Rename "text" → "content" added in v2
    state["content"] = state.pop("text", "")
    return state

graph = (
    StateGraph(
        version=2,
        migrations={
            (1, 2): migrate_1_to_2,
        },
    )
    .add_node("process", process_node)
    .set_entry_point("process")
    .set_finish_point("process")
    .compile()
)
```

### Resuming with migration

When `resume()` loads a checkpoint whose version is lower than the current graph version, it automatically applies the migration chain before re-running:

```python
cp = SQLiteCheckpointer("checkpoints.db")

# Checkpoint was saved with v1 state (has "text" key)
# Graph is now v2 (expects "content" key)
# migrate_1_to_2 is applied automatically before execution resumes
result = await graph.resume("job-42", cp)
```

If a required migration path is missing, `GraphRuntimeError` is raised with a descriptive message.

### Migration chaining

Migrations are applied as a chain. To migrate from v1 to v3, define both `(1, 2)` and `(2, 3)` migrations:

```python
graph = StateGraph(
    version=3,
    migrations={
        (1, 2): migrate_1_to_2,
        (2, 3): migrate_2_to_3,
    },
)
```

A checkpoint at v1 will have both migrations applied in order.

### StateGraph versioning parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `version` | `int \| None` | `None` | Schema version for this graph |
| `migrations` | `dict \| None` | `None` | Mapping of `(from, to)` tuples to migration callables |
