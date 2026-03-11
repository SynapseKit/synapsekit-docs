---
sidebar_position: 2
---

# ReActAgent

`ReActAgent` implements the Reasoning + Acting pattern. It works with **any** `BaseLLM` — no native function calling required.

## How it works

Each iteration:
1. LLM generates a **Thought**, **Action**, and **Action Input**
2. The named tool is called with the input
3. The **Observation** (tool result) is appended to the scratchpad
4. Repeat until the LLM produces a **Final Answer**

```
Thought: I need to calculate 2 ** 10.
Action: calculator
Action Input: 2 ** 10
Observation: 1024

Thought: I now know the final answer.
Final Answer: 2 to the power of 10 is 1024.
```

## Usage

```python
from synapsekit import ReActAgent, CalculatorTool, WebSearchTool
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.base import LLMConfig

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

agent = ReActAgent(
    llm=llm,
    tools=[CalculatorTool(), WebSearchTool()],
    max_iterations=10,
)

answer = await agent.run("What is the population of France divided by 2?")
```

## Streaming

```python
async for token in agent.stream("What is 99 * 99?"):
    print(token, end="", flush=True)
```

Intermediate tool calls run silently; the final answer is streamed.

## Inspecting steps

```python
await agent.run("compute something")

for step in agent.memory.steps:
    print(f"Action: {step.action}")
    print(f"Input:  {step.action_input}")
    print(f"Result: {step.observation}")
```

## Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM` | required | Any LLM provider |
| `tools` | `list[BaseTool]` | required | Available tools |
| `max_iterations` | `int` | `10` | Max Thought→Action cycles |
| `memory` | `AgentMemory \| None` | auto | Custom memory instance |
