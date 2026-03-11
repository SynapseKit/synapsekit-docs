---
sidebar_position: 2
---

# StateGraph

`StateGraph` is the fluent builder used to define your graph before compiling it.

## API

```python
from synapsekit import StateGraph

graph = StateGraph()
```

All methods return `self` so they can be chained.

### `add_node(name, fn)`

Register a node with a unique name and a `NodeFn`.

```python
async def my_node(state: dict) -> dict:
    return {"result": state["input"].upper()}

graph.add_node("upper", my_node)
```

`NodeFn` signature: `(state: dict) → dict | Awaitable[dict]`. Both sync and async functions are accepted.

### `add_edge(src, dst)`

Add a static edge from `src` to `dst`.

```python
graph.add_edge("upper", "next_node")
```

Use `END` as `dst` to terminate the graph after that node.

```python
from synapsekit import END

graph.add_edge("last_node", END)
```

### `add_conditional_edge(src, condition_fn, mapping)`

Route to different nodes based on the current state.

```python
def route(state: dict) -> str:
    return "good" if state["score"] > 0.5 else "bad"

graph.add_conditional_edge(
    "score_node",
    route,
    {"good": "approve_node", "bad": "reject_node"},
)
```

`condition_fn` can be sync or async. It receives the current state and returns a string key that is looked up in `mapping`.

### `set_entry_point(name)`

Set the first node to execute.

```python
graph.set_entry_point("fetch")
```

### `set_finish_point(name)`

Shorthand for `add_edge(name, END)`.

```python
graph.set_finish_point("summarize")
```

### `compile()`

Validate the graph and return a `CompiledGraph`.

```python
compiled = graph.compile()
```

Raises `GraphConfigError` if:
- No entry point is set
- An unknown node is referenced in an edge
- A cycle exists in static edges

## Full example

```python
import asyncio
from synapsekit import StateGraph, END

async def ingest(state):
    return {"tokens": state["text"].split()}

async def count(state):
    return {"token_count": len(state["tokens"])}

async def flag_long(state):
    return {"flag": "long"}

async def flag_short(state):
    return {"flag": "short"}

def route(state):
    return "long" if state["token_count"] > 100 else "short"

graph = (
    StateGraph()
    .add_node("ingest", ingest)
    .add_node("count", count)
    .add_node("flag_long", flag_long)
    .add_node("flag_short", flag_short)
    .add_edge("ingest", "count")
    .add_conditional_edge("count", route, {"long": "flag_long", "short": "flag_short"})
    .add_edge("flag_long", END)
    .add_edge("flag_short", END)
    .set_entry_point("ingest")
    .compile()
)

result = asyncio.run(graph.run({"text": "hello world"}))
print(result["flag"])  # "short"
```
