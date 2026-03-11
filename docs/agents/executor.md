---
sidebar_position: 5
---

# AgentExecutor

`AgentExecutor` is the recommended high-level entry point. It wraps `ReActAgent` or `FunctionCallingAgent` behind a consistent interface.

## Usage

```python
from synapsekit import AgentExecutor, AgentConfig, CalculatorTool, WebSearchTool
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.base import LLMConfig

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

executor = AgentExecutor(AgentConfig(
    llm=llm,
    tools=[CalculatorTool(), WebSearchTool()],
    agent_type="function_calling",  # or "react"
    max_iterations=10,
    system_prompt="You are a helpful research assistant.",
))

# Async
answer = await executor.run("What is the square root of 1764?")

# Sync (scripts / notebooks)
answer = executor.run_sync("What is 12 factorial?")

# Streaming
async for token in executor.stream("Explain the result step by step"):
    print(token, end="")
```

## AgentConfig

| Field | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM` | required | LLM provider |
| `tools` | `list[BaseTool]` | required | Available tools |
| `agent_type` | `"react" \| "function_calling"` | `"react"` | Which agent to use |
| `max_iterations` | `int` | `10` | Max tool-call cycles |
| `system_prompt` | `str` | `"You are a helpful AI assistant."` | Agent system instruction |
| `verbose` | `bool` | `False` | Reserved for future logging |

## Inspecting agent steps

```python
await executor.run("Do some research")

for step in executor.memory.steps:
    print(f"[{step.action}] {step.action_input} → {step.observation}")
```

## Choosing agent type

| Situation | Recommended |
|---|---|
| Using OpenAI or Anthropic | `"function_calling"` |
| Using Ollama, Cohere, Mistral, Gemini, Bedrock | `"react"` |
| Many tools, need reliable selection | `"function_calling"` |
| Want to inspect reasoning chain | `"react"` |
