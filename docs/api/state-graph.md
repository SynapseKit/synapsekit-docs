---
sidebar_position: 3
---

# StateGraph API Reference

## `StateGraph`

```python
from synapsekit.graph import StateGraph
```

Builds a directed graph of async node functions. Call `compile()` to produce an executable `CompiledGraph`.

### `__init__(state_schema=None)`

```python
StateGraph(state_schema: type[TypedState] | None = None)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `state_schema` | `type[TypedState] \| None` | `None` | Optional typed state class for schema validation |

---

### `add_node(name, fn)`

Register a node function.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `name` | `str` | required | Unique node identifier |
| `fn` | `async (state: dict) -> dict` | required | Async function that reads state and returns partial updates |

```python
async def my_node(state: dict) -> dict:
    return {"answer": "42"}

graph.add_node("my_node", my_node)
```

---

### `add_edge(from_node, to_node)`

Add a dependency edge: `to_node` will not execute until `from_node` completes.

```python
graph.add_edge("ingest", "embed")
graph.add_edge("embed", "retrieve")
```

---

### `add_conditional_edge(source, condition, destinations)`

Add a dynamic routing edge. After `source` completes, `condition` is called with the current state and must return the name of the next node.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `source` | `str` | required | Node that triggers the routing decision |
| `condition` | `(state: dict) -> str` | required | Function that returns the name of the next node |
| `destinations` | `list[str]` | required | All possible return values; validated at compile time |

```python
def route(state: dict) -> str:
    return "rag_node" if state.get("has_docs") else "llm_node"

graph.add_conditional_edge(
    source="classify",
    condition=route,
    destinations=["rag_node", "llm_node"],
)
```

---

### `set_entry_point(node_name)` / `set_finish_point(node_name)`

Declare the first and terminal nodes. Required when the graph has multiple roots or multiple terminals.

---

### `compile(checkpointer=None, allow_cycles=False, max_steps=50)`

Validate the graph structure and return a `CompiledGraph`.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `checkpointer` | `BaseCheckpointer \| None` | `None` | Persistence backend for state checkpointing and HITL |
| `allow_cycles` | `bool` | `False` | Allow cyclic edges (required for agentic loops) |
| `max_steps` | `int` | `50` | Hard limit on total node executions per run |

```python
compiled = graph.compile(
    checkpointer=RedisCheckpointer(url="redis://localhost:6379"),
    allow_cycles=True,
    max_steps=20,
)
```

---

## `CompiledGraph`

### `async run(initial_state, run_id=None)`

Execute the graph and return the final state.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `initial_state` | `dict` | required | Starting state passed to entry point nodes |
| `run_id` | `str \| None` | `None` | Unique run identifier for checkpointing |

```python
result = await compiled.run({"question": "What is SynapseKit?"})
print(result["answer"])
```

---

### `run_sync(initial_state, run_id=None)`

Synchronous wrapper around `run()`. Blocks until the graph completes.

---

### `async stream(initial_state, run_id=None)`

Execute the graph and yield partial state updates after each node completes.

```python
async for update in compiled.stream({"question": "..."}):
    print(update)  # e.g. {"retrieved_chunks": [...]}
```

---

### `async stream_tokens(initial_state, run_id=None)`

Execute the graph and yield individual LLM tokens as they are generated.

```python
async for token in compiled.stream_tokens({"question": "..."}):
    print(token, end="", flush=True)
```

---

### `async resume(run_id, update=None)`

Resume a paused run. Applies `update` to the state at the interruption point, then continues.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `run_id` | `str` | required | The run ID of a previously paused run |
| `update` | `dict \| None` | `None` | State updates to apply before resuming |

```python
result = await compiled.resume(
    run_id="my-run-001",
    update={"approved": True},
)
```

---

### `async sse_stream(initial_state, run_id=None)`

Execute the graph and yield Server-Sent Events formatted strings. Suitable for HTTP streaming endpoints. Each yielded string has the format `data: <json>\n\n`.

```python
@app.get("/stream")
async def stream_endpoint(question: str):
    async def generator():
        async for event in compiled.sse_stream({"question": question}):
            yield event
    return StreamingResponse(generator(), media_type="text/event-stream")
```

---

### `async ws_stream(websocket, initial_state, run_id=None)`

Execute the graph and send updates over an open WebSocket connection.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `websocket` | `WebSocket` | required | An open WebSocket instance (FastAPI/Starlette compatible) |
| `initial_state` | `dict` | required | Starting state |
| `run_id` | `str \| None` | `None` | Optional run identifier |

---

### `get_mermaid()`

Return a Mermaid diagram string representing the graph topology.

```python
diagram = compiled.get_mermaid()
# graph TD
#     ingest --> chunk
#     chunk --> embed
#     embed --> retrieve
#     retrieve --> generate
```

---

### `get_mermaid_with_trace(run_id)`

Return a Mermaid diagram annotated with the actual execution path from a completed run. Requires a `checkpointer`.

```python
trace_diagram = compiled.get_mermaid_with_trace("my-run-001")
```

---

## `TypedState`

```python
from synapsekit.graph import TypedState, StateField

class PipelineState(TypedState):
    query: str
    documents: list[str] = StateField(default_factory=list)
    answer: str = StateField(default="")
    score: float = StateField(default=0.0, reducer=max)
    tags: list[str] = StateField(default_factory=list, reducer="extend")
```

---

## `StateField`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `default` | `Any` | `MISSING` | Static default value |
| `default_factory` | `Callable \| None` | `None` | Callable that produces the default |
| `reducer` | `str \| Callable \| None` | `None` | How to merge parallel writes |
| `description` | `str \| None` | `None` | Human-readable description |

Built-in reducer strings:

| Reducer | Behavior |
|---|---|
| `"extend"` | Concatenate two lists |
| `"update"` | Merge two dicts (shallow) |
| `"add"` | Sum two numeric values |
| `"max"` | Take the larger value |
| `"min"` | Take the smaller value |

---

## Checkpointer backends

| Class | Import | Storage |
|---|---|---|
| `InMemoryCheckpointer` | `synapsekit.graph.checkpointers` | In-memory (dev only) |
| `RedisCheckpointer` | `synapsekit.graph.checkpointers` | Redis |
| `SqliteCheckpointer` | `synapsekit.graph.checkpointers` | SQLite file |
| `PostgresCheckpointer` | `synapsekit.graph.checkpointers` | PostgreSQL |

```python
from synapsekit.graph.checkpointers import RedisCheckpointer

checkpointer = RedisCheckpointer(url="redis://localhost:6379", ttl_seconds=86400)
```

---

## See also

- [Graph workflows overview](../graph/overview)
- [Checkpointing guide](../graph/checkpointing)
- [How graphs work](../concepts/graphs)
