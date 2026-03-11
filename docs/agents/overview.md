---
sidebar_position: 1
---

# Agents Overview

SynapseKit agents are async-first, tool-using AI systems that reason and act to complete tasks.

## Core concepts

| Concept | Class | Description |
|---|---|---|
| **Tool** | `BaseTool` | A single action the agent can take |
| **Registry** | `ToolRegistry` | Looks up tools by name, generates schemas |
| **Memory** | `AgentMemory` | Records Thought→Action→Observation steps |
| **ReAct** | `ReActAgent` | Prompt-based reasoning loop, any LLM |
| **Function Calling** | `FunctionCallingAgent` | Native OpenAI/Anthropic tool use |
| **Executor** | `AgentExecutor` | Unified runner — picks the right agent |

## Quick start

```python
import asyncio
from synapsekit import AgentExecutor, AgentConfig, CalculatorTool
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.base import LLMConfig

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

executor = AgentExecutor(AgentConfig(
    llm=llm,
    tools=[CalculatorTool()],
    agent_type="function_calling",
))

answer = asyncio.run(executor.run("What is 2 ** 10 + 24?"))
print(answer)  # "The answer is 1048."
```

## Built-in tools

| Tool | Class | Extra | Description |
|---|---|---|---|
| Calculator | `CalculatorTool` | none | Safe math eval |
| Python REPL | `PythonREPLTool` | none | Execute Python code |
| File Read | `FileReadTool` | none | Read local files |
| Web Search | `WebSearchTool` | `synapsekit[search]` | DuckDuckGo search |
| SQL Query | `SQLQueryTool` | none (SQLite) / `sqlalchemy` | SQL SELECT queries |

## Agent types

**`"react"`** — Works with any LLM. Uses a structured text prompt (Thought/Action/Observation). No native function calling required.

**`"function_calling"`** — Requires `OpenAILLM` or `AnthropicLLM`. Uses native tool_calls / tool_use for more reliable tool selection.

## Sync usage

```python
executor = AgentExecutor(AgentConfig(llm=llm, tools=[CalculatorTool()]))
answer = executor.run_sync("What is sqrt(144)?")
```
