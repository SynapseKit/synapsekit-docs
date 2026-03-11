---
sidebar_position: 3
---

# FunctionCallingAgent

`FunctionCallingAgent` uses **native LLM function calling** — OpenAI `tool_calls` or Anthropic `tool_use`. More reliable tool selection than ReAct, especially with multiple tools.

## Requirements

- `OpenAILLM` or `AnthropicLLM` (both support `call_with_tools()`)
- For other providers, use `ReActAgent` instead

## Usage

```python
from synapsekit import FunctionCallingAgent, CalculatorTool, FileReadTool
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.base import LLMConfig

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

agent = FunctionCallingAgent(
    llm=llm,
    tools=[CalculatorTool(), FileReadTool()],
    max_iterations=10,
    system_prompt="You are a helpful data analyst.",
)

answer = await agent.run("Read ./data.csv and tell me the row count.")
```

## How it works

1. Tool schemas are sent to the LLM as JSON
2. LLM responds with `tool_calls` (or text if no tool is needed)
3. Each tool is called, results appended as `role: tool` messages
4. Repeat until the LLM returns text with no tool calls

## Anthropic example

```python
from synapsekit.llm.anthropic import AnthropicLLM
from synapsekit.llm.base import LLMConfig

llm = AnthropicLLM(LLMConfig(
    model="claude-sonnet-4-6",
    api_key="sk-ant-...",
))

agent = FunctionCallingAgent(llm=llm, tools=[CalculatorTool()])
answer = await agent.run("What is 144 / 12?")
```

## Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM` | required | Must implement `call_with_tools()` |
| `tools` | `list[BaseTool]` | required | Available tools |
| `max_iterations` | `int` | `10` | Max tool-call rounds |
| `memory` | `AgentMemory \| None` | auto | Custom memory instance |
| `system_prompt` | `str` | `"You are a helpful AI assistant."` | System instruction |
