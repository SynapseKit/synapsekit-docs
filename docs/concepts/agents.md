---
sidebar_position: 2
---

# How Agents Work

An agent is an LLM that can take actions. Instead of generating a single response, it decides what to do next, executes that action, observes the result, and repeats until the task is complete.

This document explains the two agent paradigms in SynapseKit — ReAct and function calling — when to use each, and how to build reliable multi-agent systems.

## The ReAct loop

ReAct (Reasoning + Acting) is a prompting strategy where the LLM interleaves thought steps with action steps. Each cycle produces three outputs:

```
+----------------------------------------------+
|                                              |
|  Thought: I need to look up the stock price  |
|                                              |
+------------------+---------------------------+
                   |
                   v
+----------------------------------------------+
|                                              |
|  Action: search_web("AAPL stock price")      |
|                                              |
+------------------+---------------------------+
                   |
                   v
+----------------------------------------------+
|                                              |
|  Observation: "AAPL is trading at $189.45"   |
|                                              |
+------------------+---------------------------+
                   |
          +--------+--------+
          |                 |
    Task done?           More steps
          |                 |
          v                 v
     Final Answer     Back to Thought
```

The loop continues until the LLM emits a `Final Answer` instead of an `Action`. A `max_steps` guard prevents infinite loops.

### ReAct in practice

ReAct works with any LLM, including those that do not support native function calling (Ollama, Cohere, Bedrock). The tool schema is embedded directly in the system prompt as text.

## Function calling

Function calling is a native LLM capability where the model returns a structured JSON object specifying which tool to call, rather than generating the action as free text.

```
User message -> LLM -> {"tool": "search_web", "args": {"query": "AAPL"}}
                         |
                    Your code executes the tool
                         |
                    Tool result -> LLM -> Final answer
```

This is more reliable than ReAct because the JSON schema is enforced by the API. Parallel tool calls are also supported.

### ReAct vs function calling: when to use each

| Criterion | ReAct | Function Calling |
|---|---|---|
| LLM support required | Any model | OpenAI, Anthropic, Gemini, etc. |
| Reliability | Lower (free-text parsing) | Higher (schema-enforced JSON) |
| Parallel tool calls | No | Yes (supported models) |
| Visible reasoning trace | Yes (Thought steps) | No |
| Complex multi-step reasoning | Better | Worse |
| Speed | Slower (more tokens) | Faster |
| Best for | Debugging, research agents | Production, simple tool use |

## How `@tool` generates JSON Schema

The `@tool` decorator converts a Python function into a tool that agents can call. It uses the function's type annotations and docstring to generate a JSON Schema automatically:

```python
from synapsekit.agents import tool

@tool
def get_weather(city: str, units: str = "celsius") -> str:
    """Get the current weather for a city.

    Args:
        city: The city name to look up.
        units: Temperature units, either "celsius" or "fahrenheit".
    """
    ...
```

Supported type annotations: `str`, `int`, `float`, `bool`, `list`, `dict`, `Optional[T]`, `Literal["a", "b"]`, `Enum` subclasses.

## The AgentExecutor pattern

`AgentExecutor` is a thin wrapper that handles the run loop, tool dispatch, and error recovery:

- When `handle_tool_errors=True`, tool exceptions are caught and fed back to the agent as an observation instead of crashing
- `max_steps` is a hard limit that prevents infinite loops — raises `MaxStepsExceeded` when exceeded

## Multi-agent patterns

### Supervisor / Worker

```
              +-----------+
              | Supervisor|
              |  (planner)|
              +-----+-----+
                    | assigns tasks
          +---------+---------+
          v         v         v
   +----------+ +----------+ +----------+
   | Worker A | | Worker B | | Worker C |
   | (search) | | (code)   | | (write)  |
   +----------+ +----------+ +----------+
          |         |         |
          +---------+---------+
                    | results
                    v
              +-----------+
              | Supervisor|
              |(synthesis)|
              +-----------+
```

```python
from synapsekit.agents import HandoffChain

chain = HandoffChain(
    supervisor=supervisor_agent,
    workers={"search": search_agent, "code": code_agent},
)
result = await chain.run("Research and implement a binary search tree")
```

### Crew

For peer-to-peer collaboration without a strict hierarchy:

```python
from synapsekit.agents import Crew

crew = Crew(agents=[researcher, writer, critic], max_rounds=5)
result = await crew.run("Write a technical blog post about HNSW")
```

## When to use MCP

Model Context Protocol (MCP) is an open standard for providing tools and context to LLMs. Use it when:

- You have existing MCP-compatible tool servers (filesystem, database, web search)
- You want tool definitions to be reused across different AI clients
- You are building a platform where multiple models need the same tools

```python
from synapsekit.agents import MCPAgent

agent = MCPAgent(llm=llm, mcp_server_url="http://localhost:8080/sse")
result = await agent.run("List all files in /tmp")
```

## Limitations

**Context window.** Each step in the ReAct loop appends to the conversation. Long-running agents hit context limits. Mitigation: summarize intermediate results or break tasks into shorter sub-tasks.

**Looping.** Always set `max_steps`. The default in `AgentExecutor` is 10.

**Cost.** Every step is an LLM call. A 10-step ReAct loop costs 10x a single query. Use `CostTracker` and `BudgetGuard` to set hard limits in production.

**Non-determinism.** Agents with the same input can take different paths. Use `@eval_case` to write regression tests for agent behavior.

## See also

- [ReAct agent guide](../agents/react)
- [Function calling guide](../agents/function-calling)
- [Tools reference](../agents/tools)
- [Agent executor guide](../agents/executor)
- [MCP guide](../agents/mcp)
- [Multi-agent overview](../multi-agent/overview)
