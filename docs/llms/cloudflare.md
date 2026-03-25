---
sidebar_position: 19
---

# Cloudflare AI

Cloudflare Workers AI — run inference on Cloudflare's global GPU network. Supports models via `@cf/` and `@hf/` model identifiers. No SDK required — uses Cloudflare's native REST API.

## Install

No extra dependencies needed — `CloudflareLLM` uses the built-in `httpx` client.

## Setup

You need a Cloudflare account ID and API token with Workers AI permissions.

```bash
export CLOUDFLARE_ACCOUNT_ID=your-account-id
export CLOUDFLARE_API_TOKEN=your-api-token
```

## Usage

```python
from synapsekit.llm.cloudflare import CloudflareLLM
from synapsekit import LLMConfig
import os

config = LLMConfig(
    model="@cf/meta/llama-3.1-8b-instruct",
    api_key=os.environ["CLOUDFLARE_API_TOKEN"],
    provider="cloudflare",
)

llm = CloudflareLLM(
    config,
    account_id=os.environ["CLOUDFLARE_ACCOUNT_ID"],
)

# Streaming
async for token in llm.stream("Explain edge computing"):
    print(token, end="")

# Generate
response = await llm.generate("What is Cloudflare Workers AI?")
```

## Available models

| Model ID | Notes |
|---|---|
| `@cf/meta/llama-3.1-8b-instruct` | Llama 3.1 8B — fast and capable |
| `@cf/meta/llama-3.2-3b-instruct` | Llama 3.2 3B — ultra-fast |
| `@cf/mistral/mistral-7b-instruct-v0.1` | Mistral 7B |
| `@cf/google/gemma-7b-it` | Google Gemma 7B |
| `@hf/thebloke/deepseek-coder-6.7b-instruct-awq` | DeepSeek Coder |

See the full list at [developers.cloudflare.com/workers-ai/models](https://developers.cloudflare.com/workers-ai/models/).

## Via RAG facade

```python
from synapsekit import RAG
import os

rag = RAG(
    model="@cf/meta/llama-3.1-8b-instruct",
    api_key=os.environ["CLOUDFLARE_API_TOKEN"],
    provider="cloudflare",
)
rag.add("Your document text here")
answer = rag.ask_sync("Summarize this.")
```

## Auto-detection

The RAG facade auto-detects Cloudflare for models starting with `@cf/` or `@hf/`:

```python
rag = RAG(
    model="@cf/meta/llama-3.1-8b-instruct",
    api_key=os.environ["CLOUDFLARE_API_TOKEN"],
    provider="cloudflare",   # or omit — auto-detected from @cf/ prefix
)
```

:::tip
Set `CLOUDFLARE_ACCOUNT_ID` as an environment variable so you don't have to pass it explicitly. The `RAG` facade reads it automatically.
:::
