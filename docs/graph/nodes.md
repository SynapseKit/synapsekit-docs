---
sidebar_position: 3
---

# Nodes

A **node** is any callable that takes the current graph state and returns a partial state to be merged in.

## NodeFn type

```python
NodeFn = Callable[[dict], dict | Awaitable[dict]]
```

Both sync and async functions are accepted. The returned dict is shallow-merged into the shared state via `state.update(partial)`.

## Writing a node

```python
# Async (preferred)
async def my_node(state: dict) -> dict:
    result = await some_api_call(state["input"])
    return {"output": result}

# Sync also works
def my_sync_node(state: dict) -> dict:
    return {"doubled": state["x"] * 2}
```

Return only the keys you want to add or update — untouched keys are preserved.

## Built-in helpers

### `agent_node(executor, input_key, output_key)`

Wrap an `AgentExecutor` as a node.

```python
from synapsekit import StateGraph, AgentExecutor, AgentConfig, CalculatorTool, agent_node
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.base import LLMConfig

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))
executor = AgentExecutor(AgentConfig(llm=llm, tools=[CalculatorTool()]))

node_fn = agent_node(executor, input_key="question", output_key="answer")

graph = (
    StateGraph()
    .add_node("agent", node_fn)
    .set_entry_point("agent")
    .set_finish_point("agent")
    .compile()
)

result = await graph.run({"question": "What is 12 factorial?"})
print(result["answer"])
```

### `rag_node(pipeline, input_key, output_key)`

Wrap a `RAGPipeline` as a node.

```python
from synapsekit import StateGraph, RAGPipeline, RAGConfig, rag_node

pipeline = RAGPipeline(RAGConfig(llm=llm, retriever=retriever))
node_fn = rag_node(pipeline, input_key="query", output_key="answer")

graph = (
    StateGraph()
    .add_node("rag", node_fn)
    .set_entry_point("rag")
    .set_finish_point("rag")
    .compile()
)
```

## Parameters

| Helper | Parameter | Default | Description |
|---|---|---|---|
| `agent_node` | `input_key` | `"input"` | State key to read the question from |
| `agent_node` | `output_key` | `"output"` | State key to write the answer to |
| `rag_node` | `input_key` | `"input"` | State key to read the query from |
| `rag_node` | `output_key` | `"output"` | State key to write the answer to |

### `llm_node(llm, input_key, output_key, stream)`

Wrap a `BaseLLM` as a node, with optional token-level streaming support.

```python
from synapsekit import StateGraph, llm_node
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.base import LLMConfig

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

graph = (
    StateGraph()
    .add_node("llm", llm_node(llm, input_key="prompt", output_key="response"))
    .set_entry_point("llm")
    .set_finish_point("llm")
    .compile()
)

result = await graph.run({"prompt": "Explain RAG in one sentence"})
print(result["response"])
```

With `stream=True`, the node emits token-level streaming events. See [Token Streaming](#token-streaming) and [CompiledGraph.stream_tokens()](/docs/graph/compiled-graph#stream_tokensstate--async-generator) for details.

```python
node_fn = llm_node(llm, stream=True)
```

### `subgraph_node(compiled_graph, input_mapping, output_mapping, *, on_error, max_retries, fallback)`

Wrap a `CompiledGraph` as a node for nesting graphs. This lets you compose complex workflows from smaller, independently testable graphs.

```python
from synapsekit import StateGraph, subgraph_node

# Build a subgraph
async def process(state):
    return {"output": state["input"].upper()}

sub = (
    StateGraph()
    .add_node("process", process)
    .set_entry_point("process")
    .set_finish_point("process")
    .compile()
)

# Nest it in a parent graph
parent = (
    StateGraph()
    .add_node("sub", subgraph_node(
        sub,
        input_mapping={"query": "input"},
        output_mapping={"output": "sub_result"},
    ))
    .set_entry_point("sub")
    .set_finish_point("sub")
    .compile()
)

result = await parent.run({"query": "hello"})
print(result["sub_result"])  # "HELLO"
```

**Key points:**

- `input_mapping` maps parent state keys to subgraph state keys. If omitted, the full parent state is passed through.
- `output_mapping` maps subgraph output keys to parent state keys. If omitted, the subgraph result is returned as-is.
- The subgraph runs with its own internal state, fully isolated from the parent.

#### Error handling strategies

Use the keyword-only `on_error` parameter to control what happens when a subgraph raises an exception.

**`"raise"` (default)** — re-raise the exception immediately:

```python
parent.add_node("sub", subgraph_node(compiled_sub))
```

**`"retry"`** — re-run the subgraph up to `max_retries` times before raising:

```python
parent.add_node("sub", subgraph_node(
    compiled_sub,
    on_error="retry",
    max_retries=5,
))
```

**`"fallback"`** — run an alternative `CompiledGraph` on failure:

```python
parent.add_node("sub", subgraph_node(
    compiled_sub,
    on_error="fallback",
    fallback=fallback_sub,
))
```

**`"skip"`** — silently continue the parent graph on failure:

```python
parent.add_node("sub", subgraph_node(compiled_sub, on_error="skip"))
```

After any handled failure (`"retry"` exhausted, `"fallback"` used, or `"skip"`), the parent state will contain a `"__subgraph_error__"` key:

```python
result = await parent.run({"query": "hello"})
if err := result.get("__subgraph_error__"):
    print(err["type"])     # exception class name
    print(err["message"])  # str(exception)
    print(err["attempts"]) # number of attempts made
```

## Parameters

| Helper | Parameter | Default | Description |
|---|---|---|---|
| `agent_node` | `input_key` | `"input"` | State key to read the question from |
| `agent_node` | `output_key` | `"output"` | State key to write the answer to |
| `rag_node` | `input_key` | `"input"` | State key to read the query from |
| `rag_node` | `output_key` | `"output"` | State key to write the answer to |
| `llm_node` | `input_key` | `"input"` | State key to read the prompt from |
| `llm_node` | `output_key` | `"output"` | State key to write the response to |
| `llm_node` | `stream` | `False` | Enable token-level streaming |
| `subgraph_node` | `input_mapping` | `None` | Map parent keys to subgraph keys |
| `subgraph_node` | `output_mapping` | `None` | Map subgraph output keys to parent keys |
| `subgraph_node` | `on_error` | `"raise"` | Error strategy: `"raise"`, `"retry"`, `"fallback"`, `"skip"` |
| `subgraph_node` | `max_retries` | `3` | Max attempts when `on_error="retry"` (must be ≥ 1) |
| `subgraph_node` | `fallback` | `None` | Fallback `CompiledGraph` when `on_error="fallback"` |

## Token streaming

When an LLM node has `stream=True`, use `CompiledGraph.stream_tokens()` to receive token-by-token events:

```python
graph = (
    StateGraph()
    .add_node("llm", llm_node(llm, stream=True))
    .set_entry_point("llm")
    .set_finish_point("llm")
    .compile()
)

async for event in graph.stream_tokens({"input": "Tell me about RAG"}):
    if event["type"] == "token":
        print(event["token"], end="", flush=True)
    elif event["type"] == "node_complete":
        print(f"\n[{event['node']} finished]")
```

Each event is a dict:

| Key | Type | Description |
|---|---|---|
| `"type"` | `str` | Either `"token"` or `"node_complete"` |
| `"node"` | `str` | Name of the node emitting the event |
| `"token"` | `str` | The token text (only for `"token"` events) |
| `"state"` | `dict` | State snapshot (only for `"node_complete"` events) |

## Parallel nodes

Nodes that are reachable in the same wave (no dependency between them) run concurrently via `asyncio.gather`. No extra configuration needed — just add edges from a common predecessor to multiple nodes.

```python
async def fetch_weather(state):
    return {"weather": "sunny"}

async def fetch_news(state):
    return {"news": "all good"}

async def merge(state):
    return {"report": f"{state['weather']} / {state['news']}"}

async def start(state):
    return {}

graph = (
    StateGraph()
    .add_node("start", start)
    .add_node("weather", fetch_weather)
    .add_node("news", fetch_news)
    .add_node("merge", merge)
    .add_edge("start", "weather")
    .add_edge("start", "news")
    .add_edge("weather", "merge")
    .add_edge("news", "merge")
    .set_entry_point("start")
    .set_finish_point("merge")
    .compile()
)
```
