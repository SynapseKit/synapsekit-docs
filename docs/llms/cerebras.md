---
sidebar_position: 15
---

# Cerebras

[Cerebras](https://cerebras.ai/) provides ultra-fast inference on their custom wafer-scale hardware with an OpenAI-compatible API.

## Install

```bash
pip install synapsekit[openai]
```

Cerebras uses the OpenAI-compatible API, so it requires the `openai` package.

## Usage

```python
from synapsekit import LLMConfig
from synapsekit.llm.cerebras import CerebrasLLM

llm = CerebrasLLM(LLMConfig(
    model="llama3.1-70b",
    api_key="csk-...",
))

async for token in llm.stream("What is RAG?"):
    print(token, end="", flush=True)
```

## Available models

| Model | ID |
|---|---|
| Llama 3.1 8B | `llama3.1-8b` |
| Llama 3.1 70B | `llama3.1-70b` |
| Llama 3.3 70B | `llama-3.3-70b` |

See the full list at [inference-docs.cerebras.ai](https://inference-docs.cerebras.ai/introduction).

## Function calling

```python
result = await llm.call_with_tools(messages, tools)
```

## Custom base URL

```python
llm = CerebrasLLM(config, base_url="http://localhost:8000/v1")
```

## Parameters

| Parameter | Description |
|---|---|
| `model` | Cerebras model ID |
| `api_key` | Your Cerebras API key |
| `base_url` | Custom API base URL (default: `https://api.cerebras.ai/v1`) |
