---
sidebar_position: 5
---

# CompiledGraph

`CompiledGraph` is the runnable object returned by `StateGraph.compile()`. It exposes three execution modes and a Mermaid diagram helper.

## `run(state, checkpointer=None, graph_id=None)` — async

Run the graph to completion and return the final state dict.

```python
result = await graph.run({"input": "hello"})
print(result["output"])
```

The `state` dict you pass is **not** mutated — the graph works on an internal copy.

With checkpointing:

```python
from synapsekit import InMemoryCheckpointer

cp = InMemoryCheckpointer()
result = await graph.run({"input": "hello"}, checkpointer=cp, graph_id="run-1")
```

## `stream(state)` — async generator

Yield an event after each node completes. Useful for progress reporting and debugging.

```python
async for event in graph.stream({"input": "hello"}):
    print(event["node"], event["state"])
```

Each event is a dict:

| Key | Type | Description |
|---|---|---|
| `"node"` | `str` | Name of the node that just completed |
| `"state"` | `dict` | Snapshot of the full state after that node |

State accumulates across events — each snapshot contains all keys written so far.

```python
async for event in graph.stream({"x": 3}):
    node = event["node"]
    keys = list(event["state"].keys())
    print(f"{node}: {keys}")
```

## `run_sync(state)` — sync

Blocking wrapper around `run()`. Works inside and outside a running event loop (uses a thread pool when inside one, e.g., Jupyter).

```python
result = graph.run_sync({"input": "hello"})
```

## `get_mermaid()` — diagram

Returns a Mermaid flowchart string for the graph structure.

```python
print(graph.get_mermaid())
```

See the [Mermaid export](./mermaid) page for details and rendering options.

## Error handling

| Exception | When |
|---|---|
| `GraphRuntimeError` | A node returns a non-dict, an unknown node is referenced at runtime, or `_MAX_STEPS` is exceeded |
| `GraphConfigError` | Raised at `compile()` for invalid structure |

```python
from synapsekit import GraphRuntimeError, GraphConfigError

try:
    result = await graph.run(state)
except GraphRuntimeError as e:
    print(f"Runtime failure: {e}")
```

## `resume(graph_id, checkpointer, updates=None)` — async

Resume execution from a previously checkpointed state. Optionally apply human edits before resuming:

```python
# Simple resume
result = await graph.resume("run-1", cp)

# Resume with human edits (Human-in-the-Loop)
result = await graph.resume("run-1", cp, updates={"approved": True, "feedback": "Looks good"})
```

The `updates` dict is merged into the checkpointed state before re-execution begins. This is the key mechanism for [Human-in-the-Loop](/docs/graph/checkpointing#human-in-the-loop) workflows.

Raises `GraphRuntimeError` if no checkpoint exists for the given `graph_id`. See [Checkpointing](/docs/graph/checkpointing) for details.

## `stream_tokens(state)` — async generator

Yield token-level events from LLM nodes that have `stream=True`. Non-streaming nodes emit a `node_complete` event instead.

```python
async for event in graph.stream_tokens({"input": "Explain RAG"}):
    if event["type"] == "token":
        print(event["token"], end="", flush=True)
    elif event["type"] == "node_complete":
        print(f"\n[{event['node']} finished]")
```

| Event key | Type | Description |
|---|---|---|
| `"type"` | `str` | `"token"` or `"node_complete"` |
| `"node"` | `str` | Name of the node |
| `"token"` | `str` | Token text (only for `"token"` events) |
| `"state"` | `dict` | State snapshot (only for `"node_complete"` events) |

See [Nodes — Token streaming](/docs/graph/nodes#token-streaming) for how to create streaming LLM nodes.

## _MAX_STEPS guard

The engine tracks the number of execution waves. The default limit is `_MAX_STEPS = 100`. Override it at compile time:

```python
compiled = graph.compile(max_steps=500)
```

If the limit is exceeded, a `GraphRuntimeError` is raised. This guards against infinite loops created by conditional edges that always route back to a previous node. See [Cycles](/docs/graph/cycles) for more.
