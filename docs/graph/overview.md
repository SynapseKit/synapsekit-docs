---
sidebar_position: 1
---

# Graph Workflows Overview

Graph Workflows let you define async pipelines as **directed graphs**. Nodes are async functions; edges wire them together. The engine executes nodes wave by wave — parallel nodes run concurrently via `asyncio.gather()`. Cycles are supported for iterative workflows, and state can be checkpointed for resumability.

## Core concepts

| Concept | Class | Description |
|---|---|---|
| **State** | `GraphState` | Plain `dict` passed through every node |
| **Node** | `Node` / `NodeFn` | Async function: `state → partial state` |
| **Edge** | `Edge` | Static `src → dst` connection |
| **Conditional Edge** | `ConditionalEdge` | Routes to different nodes based on state |
| **Graph** | `StateGraph` | Fluent builder — add nodes, edges, compile |
| **Compiled Graph** | `CompiledGraph` | Runnable — `run()`, `stream()`, `run_sync()` |

## Quick start

```python
import asyncio
from synapsekit import StateGraph

async def fetch(state):
    return {"data": f"fetched:{state['query']}"}

async def summarize(state):
    return {"summary": f"summary of {state['data']}"}

graph = (
    StateGraph()
    .add_node("fetch", fetch)
    .add_node("summarize", summarize)
    .add_edge("fetch", "summarize")
    .set_entry_point("fetch")
    .set_finish_point("summarize")
    .compile()
)

result = asyncio.run(graph.run({"query": "synapsekit"}))
print(result["summary"])  # "summary of fetched:synapsekit"
```

## Execution model

```
Entry node
    │
    ▼
 Wave 1: [node_a]          ← runs, merges partial state
    │
    ▼
 Wave 2: [node_b, node_c]  ← runs concurrently (asyncio.gather)
    │
    ▼
 Wave 3: [node_d]          ← converge
    │
    ▼
  END
```

Nodes in the same wave have no dependencies between them and execute in parallel. State is merged after each wave — using `dict.update` by default, or per-field reducers if a `TypedState` schema is provided.

## Routing with conditions

```python
from synapsekit import StateGraph, END

def route(state):
    return "approve" if state["score"] >= 0.8 else "reject"

graph = (
    StateGraph()
    .add_node("score", score_fn)
    .add_node("approve", approve_fn)
    .add_node("reject", reject_fn)
    .add_conditional_edge("score", route, {"approve": "approve", "reject": "reject"})
    .add_edge("approve", END)
    .add_edge("reject", END)
    .set_entry_point("score")
    .compile()
)
```

## Cycles

By default, static cycles raise `GraphConfigError`. For intentional loops, pass `allow_cycles=True`:

```python
graph = (
    StateGraph()
    .add_node("process", process_fn)
    .add_conditional_edge("process", should_continue, {"loop": "process", "done": END})
    .set_entry_point("process")
    .compile(allow_cycles=True, max_steps=50)
)
```

→ [Cycles docs](/docs/graph/cycles)

## Checkpointing

Persist graph state after each wave for resumability:

```python
from synapsekit import InMemoryCheckpointer

cp = InMemoryCheckpointer()
result = await graph.run({"input": "data"}, checkpointer=cp, graph_id="run-1")

# Resume later
result = await graph.resume("run-1", cp)
```

-> [Checkpointing docs](/docs/graph/checkpointing)

## Human-in-the-Loop

Nodes can raise `GraphInterrupt` to pause execution for human review. The state is checkpointed and `resume(updates=...)` applies edits before continuing:

```python
from synapsekit import GraphInterrupt

async def review(state):
    raise GraphInterrupt(message="Review needed", data={"draft": state["draft"]})

# After human review:
result = await graph.resume("run-1", cp, updates={"draft": "edited text"})
```

-> [Human-in-the-Loop docs](/docs/graph/checkpointing#human-in-the-loop)

## Subgraphs

Nest a compiled graph as a node in a parent graph using `subgraph_node()`:

```python
from synapsekit import subgraph_node

parent.add_node("sub", subgraph_node(
    compiled_sub,
    input_mapping={"query": "input"},
    output_mapping={"output": "sub_result"},
))
```

`subgraph_node()` also supports error handling strategies via `on_error`:

```python
# Retry up to 5 times before raising
parent.add_node("sub", subgraph_node(compiled_sub, on_error="retry", max_retries=5))

# Fall back to a simpler subgraph on failure
parent.add_node("sub", subgraph_node(compiled_sub, on_error="fallback", fallback=fallback_sub))

# Continue the parent graph silently on failure
parent.add_node("sub", subgraph_node(compiled_sub, on_error="skip"))
```

-> [Subgraphs docs](/docs/graph/nodes#subgraph_node)

## Token streaming

Stream tokens from LLM nodes using `llm_node(stream=True)` and `stream_tokens()`:

```python
from synapsekit import llm_node

graph.add_node("llm", llm_node(llm, stream=True))
compiled = graph.compile()

async for event in compiled.stream_tokens({"input": "Tell me about RAG"}):
    if event["type"] == "token":
        print(event["token"], end="")
```

-> [Token streaming docs](/docs/graph/nodes#token-streaming)

## Typed State with Reducers

Use `TypedState` and `StateField` to define per-field reducers for safe parallel merge:

```python
from synapsekit import StateGraph
from synapsekit.graph.state import StateField, TypedState

schema = TypedState(fields={
    "messages": StateField(default=list, reducer=lambda cur, new: cur + new),
    "count": StateField(default=int, reducer=lambda cur, new: cur + new),
    "result": StateField(default=str),  # last-write-wins (no reducer)
})

graph = StateGraph(state_schema=schema)
```

Without a reducer, the default `dict.update()` behavior applies (last write wins). With a reducer, concurrent node outputs are safely merged.

## Fan-Out / Fan-In

Run multiple subgraphs in parallel and collect or merge their results:

```python
from synapsekit import fan_out_node

fan = fan_out_node(
    subgraphs=[compiled_a, compiled_b, compiled_c],
    input_mappings=[{"query": "input"}, {"query": "input"}, {"query": "input"}],
    output_key="results",
)
graph.add_node("parallel", fan)
```

With a custom merge function:

```python
def merge(results):
    return {"combined": " | ".join(r["output"] for r in results)}

fan = fan_out_node(subgraphs=[sub_a, sub_b], merge_fn=merge)
```

## SSE Streaming

Stream graph execution as Server-Sent Events for HTTP responses:

```python
from synapsekit import sse_stream

async for sse in sse_stream(compiled, {"input": "hello"}):
    yield sse  # "event: node_complete\ndata: {...}\n\n"
```

Works with FastAPI/Starlette `StreamingResponse`:

```python
from starlette.responses import StreamingResponse

async def endpoint(request):
    return StreamingResponse(
        sse_stream(compiled, {"input": "hello"}),
        media_type="text/event-stream",
    )
```

## Event Callbacks

Register callbacks for monitoring graph execution:

```python
from synapsekit import EventHooks

hooks = EventHooks()
hooks.on_node_start(lambda e: print(f"Starting {e.node}"))
hooks.on_node_complete(lambda e: print(f"Done {e.node}"))
hooks.on_wave_start(lambda e: print(f"Wave {e.data['step']}"))

result = await compiled.run(state, hooks=hooks)
```

Supports both sync and async callbacks. Available events: `node_start`, `node_complete`, `wave_start`, `wave_complete`, `error`.

## Execution Trace

Collect all graph events into a structured trace for debugging and observability:

```python
from synapsekit import ExecutionTrace, EventHooks

trace = ExecutionTrace()
hooks = trace.hook(EventHooks())

result = await compiled.run(state, hooks=hooks)

# Human-readable summary
print(trace.summary())
# Execution trace (4 events, 123.4ms):
#   node_start [fetch]
#   node_complete [fetch] (45.2ms)
#   node_start [summarize]
#   node_complete [summarize] (78.1ms)

# Per-node durations
print(trace.node_durations)
# {"fetch": 45.2, "summarize": 78.1}

# Total wall-clock time
print(trace.total_duration_ms)  # 123.4

# JSON-serializable for logging/storage
import json
json.dumps(trace.to_dict())
```

You can combine `ExecutionTrace` with your own `EventHooks` — just pass in an existing hooks instance:

```python
hooks = EventHooks()
hooks.on_error(lambda e: alert(e.data))  # your own callbacks

trace = ExecutionTrace()
hooks = trace.hook(hooks)  # trace hooks are added alongside yours

result = await compiled.run(state, hooks=hooks)
```

## WebSocket Streaming

Stream graph execution events over a WebSocket connection:

```python
from synapsekit import ws_stream

# Works with FastAPI, Starlette, or plain websockets
@app.websocket("/ws")
async def endpoint(websocket):
    await websocket.accept()
    result = await ws_stream(compiled, {"input": "hello"}, websocket)
```

Events are sent as JSON strings via `send_text()` (or `send()` as fallback). Each event includes `event`, `node`, and `state` fields. A final `"done"` event is sent when execution completes.

You can also pass extra hooks that run alongside the WebSocket streaming:

```python
from synapsekit import ws_stream, EventHooks

hooks = EventHooks()
hooks.on_error(lambda e: log_error(e))

result = await ws_stream(compiled, state, websocket, hooks=hooks)
```

Individual events can also be formatted for WebSocket transmission:

```python
from synapsekit import GraphEvent

event = GraphEvent(event_type="node_complete", node="fetch", state={"data": "result"})
ws_msg = event.to_ws()  # JSON string: '{"event": "node_complete", "node": "fetch", ...}'
```

## Approval Node

`approval_node()` is a factory that creates a gate node for human-in-the-loop approval. If the specified state key is truthy, execution continues; otherwise it raises `GraphInterrupt` to pause for review.

```python
from synapsekit import StateGraph, approval_node

graph = StateGraph()
graph.add_node("process", process_fn)
graph.add_node("gate", approval_node(
    approval_key="human_ok",
    message=lambda s: f"Please approve: {s.get('draft', '')[:100]}",
))
graph.add_node("publish", publish_fn)

graph.set_entry_point("process")
graph.add_edge("process", "gate")
graph.add_edge("gate", "publish")
graph.set_finish_point("publish")
```

When `state["human_ok"]` is falsy (or missing), the graph pauses with a `GraphInterrupt`. Resume with `compiled.resume(updates={"human_ok": True})` to continue.

You can also pass static `data` to include in the interrupt:

```python
gate = approval_node(approval_key="ok", data={"reason": "content review"})
```

---

## Dynamic Route Node

`dynamic_route_node()` routes to different compiled subgraphs at runtime based on a routing function. It supports sync/async routing and the same `input_mapping`/`output_mapping` as `subgraph_node()`.

```python
from synapsekit import StateGraph, dynamic_route_node

# Build subgraphs
fast_graph = build_fast_pipeline().compile()
thorough_graph = build_thorough_pipeline().compile()

# Route based on state
graph = StateGraph()
graph.add_node("router", dynamic_route_node(
    routing_fn=lambda s: "fast" if s.get("urgent") else "thorough",
    subgraphs={"fast": fast_graph, "thorough": thorough_graph},
    input_mapping={"query": "input"},
    output_mapping={"output": "result"},
))
graph.set_entry_point("router")
graph.set_finish_point("router")
```

Async routing functions are also supported:

```python
async def smart_route(state):
    complexity = await classify_query(state["input"])
    return "simple" if complexity < 0.5 else "complex"

node = dynamic_route_node(
    routing_fn=smart_route,
    subgraphs={"simple": simple_graph, "complex": complex_graph},
)
```

If the routing function returns an unknown key, a `ValueError` is raised with the available routes.

---

## What's validated at compile time

- Entry point is set and refers to a registered node
- All edge sources and destinations refer to registered nodes (or `END`)
- No cycles in static edges (unless `allow_cycles=True`)

Conditional edge destinations are validated at compile time; the routing itself is resolved at runtime.

## Next steps

- [StateGraph](./state-graph) — full builder API reference
- [Nodes](./nodes) — node types, `llm_node`, `subgraph_node`, `fan_out_node`
- [Checkpointing](./checkpointing) — persistence, resumability, and human-in-the-loop
- [Cycles](./cycles) — iterative workflows with `allow_cycles=True`
- [Mermaid Export](./mermaid) — visualize your graph as a Mermaid diagram
