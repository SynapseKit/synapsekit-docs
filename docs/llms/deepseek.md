---
sidebar_position: 10
---

# DeepSeek

DeepSeek models via their OpenAI-compatible API. Supports streaming, generate, and function calling.

## Install

```bash
pip install synapsekit[openai]
```

Uses the `openai` SDK with a custom base URL.

## Usage

```python
from synapsekit.llm.deepseek import DeepSeekLLM
from synapsekit import LLMConfig

config = LLMConfig(
    model="deepseek-chat",
    api_key="sk-...",
    provider="deepseek",
)

llm = DeepSeekLLM(config)

# Streaming
async for token in llm.stream("Explain async/await in Python"):
    print(token, end="")

# Generate
response = await llm.generate("What is DeepSeek?")
```

## Available models

| Model | Description |
|---|---|
| `deepseek-chat` | General-purpose chat model |
| `deepseek-reasoner` | Enhanced reasoning capabilities |

## Function calling

```python
result = await llm.call_with_tools(
    messages=[{"role": "user", "content": "Calculate 15% tip on $85"}],
    tools=[...],
)
```

## Custom base URL

For self-hosted or proxy deployments:

```python
llm = DeepSeekLLM(config, base_url="http://localhost:8000")
```

## Auto-detection

The RAG facade auto-detects DeepSeek for `deepseek-*` model names:

```python
from synapsekit import RAG

rag = RAG(model="deepseek-chat", api_key="sk-...")
```
