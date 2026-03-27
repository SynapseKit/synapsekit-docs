---
sidebar_position: 25
---

# Aleph Alpha

Aleph Alpha's Luminous and Pharia language models — European-built LLMs with strong German and multilingual capabilities.

## Install

```bash
pip install synapsekit[aleph-alpha]
```

## Setup

```bash
export ALEPH_ALPHA_API_KEY=your-api-key
```

## Usage

```python
from synapsekit.llm.aleph_alpha import AlephAlphaLLM
from synapsekit import LLMConfig
import os

config = LLMConfig(
    model="luminous-supreme-control",
    api_key=os.environ["ALEPH_ALPHA_API_KEY"],
    provider="aleph-alpha",
)

llm = AlephAlphaLLM(config)

# Streaming
async for token in llm.stream("Erkläre maschinelles Lernen auf Deutsch"):
    print(token, end="")

# Generate
response = await llm.generate("What are the Luminous model capabilities?")
```

## Available models

| Model | Notes |
|---|---|
| `luminous-supreme-control` | Flagship, instruction-tuned |
| `luminous-supreme` | Highest quality |
| `luminous-extended-control` | Balanced, instruction-tuned |
| `luminous-base-control` | Fast, lightweight |
| `pharia-1-llm-7b-control` | Pharia 7B, instruction-tuned |

## Auto-detection

The RAG facade auto-detects Aleph Alpha for `luminous-*` and `pharia-*` model prefixes:

```python
from synapsekit import RAG

rag = RAG(model="luminous-supreme-control", api_key="...")
rag.add("Your document text here")
answer = rag.ask_sync("Summarize this.")
```

:::tip
Luminous models are particularly strong for German-language tasks and EU-based deployments where data residency matters.
:::
