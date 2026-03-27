---
sidebar_position: 24
---

# Minimax AI

Minimax's language models with SSE streaming support. Requires a `group_id` in addition to an API key.

## Install

No extra dependencies needed — `MinimaxLLM` uses the built-in `httpx` client.

## Setup

```bash
export MINIMAX_API_KEY=your-api-key
export MINIMAX_GROUP_ID=your-group-id
```

## Usage

```python
from synapsekit.llm.minimax import MinimaxLLM
from synapsekit import LLMConfig
import os

config = LLMConfig(
    model="abab6.5s-chat",
    api_key=os.environ["MINIMAX_API_KEY"],
    provider="minimax",
)

llm = MinimaxLLM(
    config,
    group_id=os.environ["MINIMAX_GROUP_ID"],
)

# Streaming
async for token in llm.stream("Explain SSE streaming"):
    print(token, end="")

# Generate
response = await llm.generate("What is Minimax AI?")
```

## Available models

| Model | Notes |
|---|---|
| `abab6.5s-chat` | Fast, efficient |
| `abab6.5-chat` | Balanced quality |
| `abab5.5s-chat` | Previous generation |

## Auto-detection

The RAG facade auto-detects Minimax for `minimax-*` model prefixes:

```python
from synapsekit import RAG
import os

rag = RAG(
    model="minimax-abab6.5s",
    api_key=os.environ["MINIMAX_API_KEY"],
    provider="minimax",
)
rag.add("Your document text here")
answer = rag.ask_sync("Summarize this.")
```

:::tip
Set `MINIMAX_GROUP_ID` as an environment variable — it's required for all Minimax API calls and is automatically read from the environment.
:::
