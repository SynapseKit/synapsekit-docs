---
sidebar_position: 14
---

# Perplexity AI

[Perplexity AI](https://www.perplexity.ai/) provides search-augmented LLMs with an OpenAI-compatible API.

## Install

```bash
pip install synapsekit[openai]
```

Perplexity AI uses the OpenAI-compatible API, so it requires the `openai` package.

## Usage

```python
from synapsekit import LLMConfig
from synapsekit.llm.perplexity import PerplexityLLM

llm = PerplexityLLM(LLMConfig(
    model="sonar-pro",
    api_key="pplx-...",
))

async for token in llm.stream("What is RAG?"):
    print(token, end="", flush=True)
```

## Available models

| Model | ID |
|---|---|
| Sonar | `sonar` |
| Sonar Pro | `sonar-pro` |
| Sonar Reasoning | `sonar-reasoning` |
| Sonar Reasoning Pro | `sonar-reasoning-pro` |

See the full list at [docs.perplexity.ai](https://docs.perplexity.ai/guides/model-cards).

## Function calling

```python
result = await llm.call_with_tools(messages, tools)
```

## Custom base URL

```python
llm = PerplexityLLM(config, base_url="http://localhost:8000/v1")
```

## Parameters

| Parameter | Description |
|---|---|
| `model` | Perplexity model ID |
| `api_key` | Your Perplexity API key |
| `base_url` | Custom API base URL (default: `https://api.perplexity.ai`) |
