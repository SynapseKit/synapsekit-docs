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
