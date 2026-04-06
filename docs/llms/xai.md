---
sidebar_position: 28
---

# xAI (Grok)

xAI's Grok models via the OpenAI-compatible API.

## Install

```bash
pip install synapsekit[openai]
```

## Usage

```python
from synapsekit.llm.xai import XaiLLM
from synapsekit import LLMConfig

config = LLMConfig(
    model="grok-2",
    api_key="xai-...",
    provider="xai",
)

llm = XaiLLM(config)

# Streaming
async for token in llm.stream("Explain the trolley problem"):
    print(token, end="")

# Generate
response = await llm.generate("What is entropy?")
```

## Available models

| Model | Notes |
|---|---|
| `grok-beta` | Original Grok |
| `grok-2` | Latest generation |
| `grok-2-mini` | Faster, lower cost |

## Function calling

```python
from synapsekit import AgentExecutor, AgentConfig, CalculatorTool

config = AgentConfig(
    model="grok-2",
    api_key="xai-...",
    provider="xai",
    tools=[CalculatorTool()],
)
executor = AgentExecutor(config)
result = await executor.run("What is 15% of 284?")
```
