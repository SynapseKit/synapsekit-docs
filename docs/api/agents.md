---
sidebar_position: 4
---

# Agents API Reference

## `AgentConfig`

```python
from synapsekit.agents import AgentConfig
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM` | required | The language model that drives the agent |
| `tools` | `list[BaseTool]` | `[]` | Tools available to the agent |
| `system_prompt` | `str \| None` | `None` | Override the default system prompt |
| `max_steps` | `int` | `10` | Maximum loop iterations before raising `MaxStepsExceeded` |
| `handle_tool_errors` | `bool` | `True` | Catch tool exceptions and feed them back as observations |
| `verbose` | `bool` | `False` | Print Thought/Action/Observation steps to stdout |
| `return_intermediate_steps` | `bool` | `False` | Include all intermediate steps in the result dict |
| `memory` | `BaseMemory \| None` | `None` | Conversation memory backend for multi-turn sessions |

```python
from synapsekit.agents import AgentConfig

config = AgentConfig(llm=llm, tools=[search_tool], max_steps=15)
```

---

## `ReActAgent`

```python
from synapsekit.agents import ReActAgent

agent = ReActAgent(config: AgentConfig)
```

Implements the ReAct (Reasoning + Acting) loop via prompt-based tool use. Compatible with any LLM.

### `async run(query, session_id=None)`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `str` | required | The user task or question |
| `session_id` | `str \| None` | `None` | Session ID for memory isolation |

Returns `{"output": str, "steps": int, "intermediate_steps": list}`.

```python
from synapsekit.agents import ReActAgent, AgentConfig, tool

@tool
def search_web(query: str) -> str:
    """Search the web for current information."""
    return f"Search results for: {query}"

agent = ReActAgent(AgentConfig(llm=llm, tools=[search_web]))
result = await agent.run("What is the capital of Australia?")
print(result["output"])
```

### `async stream(query, session_id=None)`

Yields step dicts with `type` field: `"thought"`, `"action"`, `"observation"`, or `"answer"`.

```python
async for step in agent.stream("Research the latest AI news"):
    if step["type"] == "answer":
        print(step["content"])
```

---

## `FunctionCallingAgent`

```python
from synapsekit.agents import FunctionCallingAgent

agent = FunctionCallingAgent(config: AgentConfig)
```

Uses the LLM's native function/tool calling API. More reliable than ReAct for supported models.

Supported providers: OpenAI, Anthropic, Gemini, Mistral, DeepSeek, OpenRouter, Together, Fireworks, AzureOpenAI, Groq.

### `async run(query, session_id=None)` / `async stream(query, session_id=None)`

Identical signature to `ReActAgent`.

Parallel tool calls: when the LLM requests multiple tools simultaneously, they are executed concurrently via `asyncio.gather`.

---

## `AgentExecutor`

```python
from synapsekit.agents import AgentExecutor

AgentExecutor(
    agent: ReActAgent | FunctionCallingAgent,
    tools: list[BaseTool],
    max_steps: int = 10,
    handle_tool_errors: bool = True,
    verbose: bool = False,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `agent` | `ReActAgent \| FunctionCallingAgent` | required | The underlying agent instance |
| `tools` | `list[BaseTool]` | required | Tools the agent can call |
| `max_steps` | `int` | `10` | Hard limit on iterations |
| `handle_tool_errors` | `bool` | `True` | Catch and forward tool errors as observations |
| `verbose` | `bool` | `False` | Log each step |

### `async invoke(query, session_id=None)`

Same return format as `agent.run()`.

---

## `BaseTool`

```python
from synapsekit.agents import BaseTool

class BaseTool(ABC):
    name: str
    description: str
    args_schema: dict

    @abstractmethod
    async def run(self, **kwargs) -> str: ...
```

```python
class DatabaseTool(BaseTool):
    name = "query_database"
    description = "Run a SQL query against the production database."
    args_schema = {
        "type": "object",
        "properties": {
            "sql": {"type": "string", "description": "The SQL query to execute."}
        },
        "required": ["sql"],
    }

    async def run(self, sql: str) -> str:
        result = await db.execute(sql)
        return str(result)
```

---

## `@tool` decorator

Converts a Python function into a `BaseTool` instance using type annotations and docstrings.

```python
from synapsekit.agents import tool

@tool
def my_tool(param1: str, param2: int = 0) -> str:
    """Short description shown to the LLM.

    Args:
        param1: Description of param1.
        param2: Description of param2.
    """
    return f"Result: {param1}, {param2}"
```

**Supported types for auto-schema generation:**

| Python type | JSON Schema type |
|---|---|
| `str` | `"string"` |
| `int` | `"integer"` |
| `float` | `"number"` |
| `bool` | `"boolean"` |
| `list` / `list[T]` | `"array"` |
| `dict` | `"object"` |
| `Optional[T]` | removes from `required` |
| `Literal["a", "b"]` | `"enum": ["a", "b"]` |

---

## `HandoffChain`

```python
from synapsekit.agents import HandoffChain

HandoffChain(
    supervisor: ReActAgent | FunctionCallingAgent,
    workers: dict[str, ReActAgent | FunctionCallingAgent],
    max_rounds: int = 5,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `supervisor` | agent | required | The supervisor agent that assigns tasks to workers |
| `workers` | `dict[str, agent]` | required | Named worker agents |
| `max_rounds` | `int` | `5` | Maximum supervisor-worker cycles |

### `async run(task) -> dict`

```python
chain = HandoffChain(
    supervisor=planner_agent,
    workers={"researcher": search_agent, "writer": write_agent},
)
result = await chain.run("Research and summarize recent advances in quantum computing")
```

---

## `Crew`

```python
from synapsekit.agents import Crew

Crew(
    agents: list[ReActAgent | FunctionCallingAgent],
    max_rounds: int = 5,
    finish_condition: Callable[[dict], bool] | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `agents` | `list` | required | Agents that take turns contributing |
| `max_rounds` | `int` | `5` | Maximum total rounds |
| `finish_condition` | `Callable \| None` | `None` | Return `True` to stop early |

### `async run(task) -> dict`

```python
crew = Crew(agents=[researcher, writer, critic], max_rounds=6)
result = await crew.run("Write a technical overview of SynapseKit")
```

---

## `MCPAgent`

```python
from synapsekit.agents import MCPAgent

MCPAgent(
    llm: BaseLLM,
    mcp_server_url: str,
    transport: str = "sse",
    max_steps: int = 10,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM` | required | The language model |
| `mcp_server_url` | `str` | required | MCP server endpoint |
| `transport` | `str` | `"sse"` | Transport protocol: `"sse"` or `"stdio"` |
| `max_steps` | `int` | `10` | Maximum agent steps |

Automatically discovers available tools from the MCP server on first call.

```python
agent = MCPAgent(llm=llm, mcp_server_url="http://localhost:8080/sse")
result = await agent.run("List all Python files in the /src directory")
```

---

## See also

- [Agents overview](../agents/overview)
- [ReAct agent guide](../agents/react)
- [Function calling guide](../agents/function-calling)
- [Multi-agent overview](../multi-agent/overview)
- [How agents work](../concepts/agents)
