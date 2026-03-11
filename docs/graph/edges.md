---
sidebar_position: 4
---

# Edges

Edges connect nodes and determine the execution order.

## Static edge

A static edge always routes from `src` to `dst`.

```python
from synapsekit import StateGraph

graph = StateGraph()
graph.add_edge("node_a", "node_b")
```

### Terminating with END

Use the `END` sentinel to indicate the graph should stop after a node.

```python
from synapsekit import StateGraph, END

graph.add_edge("last_node", END)

# Shorthand:
graph.set_finish_point("last_node")
```

## Conditional edge

A conditional edge calls a function at runtime to decide the next node.

```python
from synapsekit import StateGraph, END

def route(state: dict) -> str:
    if state["confidence"] >= 0.9:
        return "publish"
    return "review"

graph = StateGraph()
graph.add_conditional_edge(
    "classify",          # source node
    route,               # condition function
    {                    # mapping: return value → next node
        "publish": "publish_node",
        "review":  "review_node",
    },
)
```

### Async condition function

```python
async def async_route(state: dict) -> str:
    score = await score_api(state["text"])
    return "high" if score > 0.8 else "low"

graph.add_conditional_edge("scorer", async_route, {"high": "fast_path", "low": "slow_path"})
```

### Routing to END from a condition

```python
graph.add_conditional_edge(
    "check",
    lambda state: "done" if state["complete"] else "retry",
    {"done": END, "retry": "process_node"},
)
```

### Unknown mapping key

If the condition function returns a key not in `mapping`, the destination defaults to `END` (the graph stops). Handle unexpected keys explicitly in your mapping to avoid silent termination.

## Multiple outgoing edges (fan-out)

A node can have multiple outgoing static edges. All destination nodes are added to the next wave and run in parallel.

```python
graph.add_edge("start", "branch_a")
graph.add_edge("start", "branch_b")
# branch_a and branch_b execute concurrently after start
```

## Cycle detection

Cycles in **static** edges are detected at `compile()` and raise `GraphConfigError`. Conditional edges are not checked for cycles — use the built-in `_MAX_STEPS = 100` guard to prevent infinite runtime loops.
