---
sidebar_position: 29
---

# NovitaAI

NovitaAI hosts popular open models (Llama, Mistral, Qwen, etc.) via an OpenAI-compatible API.

## Install

```bash
pip install synapsekit[openai]
```

## Usage

```python
from synapsekit.llm.novita import NovitaLLM
from synapsekit import LLMConfig

config = LLMConfig(
    model="meta-llama/llama-3.1-8b-instruct",
    api_key="nvt_...",
    provider="novita",
)

llm = NovitaLLM(config)

# Streaming
async for token in llm.stream("Summarize the French Revolution"):
    print(token, end="")

# Generate
response = await llm.generate("Explain async/await in Python")
```

## Available models

NovitaAI hosts hundreds of models. Popular choices:

| Model | Notes |
|---|---|
| `meta-llama/llama-3.1-8b-instruct` | Fast, 8B params |
| `meta-llama/llama-3.1-70b-instruct` | High quality |
| `mistralai/mistral-7b-instruct-v0.3` | Efficient |
| `qwen/qwen2.5-72b-instruct` | Strong multilingual |

See the full list at [novita.ai/models](https://novita.ai/models/text-generation).
