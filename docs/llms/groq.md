---
sidebar_position: 9
---

# Groq

Ultra-fast inference with Groq's LPU hardware. Supports Llama, Mixtral, Gemma, and other open models.

## Install

```bash
pip install synapsekit[groq]
```

## Usage

```python
from synapsekit.llm.groq import GroqLLM
from synapsekit import LLMConfig

config = LLMConfig(
    model="llama-3.3-70b-versatile",
    api_key="gsk_...",
    provider="groq",
)

llm = GroqLLM(config)

# Streaming
async for token in llm.stream("Explain quantum computing"):
    print(token, end="")

# Generate
response = await llm.generate("What is Rust?")
```

## Available models

| Model | Context | Notes |
|---|---|---|
| `llama-3.3-70b-versatile` | 128K | Best quality |
| `llama-3.1-8b-instant` | 128K | Fastest |
| `mixtral-8x7b-32768` | 32K | Good balance |
| `gemma2-9b-it` | 8K | Google Gemma |

## Function calling

```python
result = await llm.call_with_tools(
    messages=[{"role": "user", "content": "What's 2+2?"}],
    tools=[...],
)
```

## Auto-detection

The RAG facade auto-detects Groq for `llama`, `mixtral`, and `gemma` model prefixes:

```python
from synapsekit import RAG

rag = RAG(model="llama-3.3-70b-versatile", api_key="gsk_...")
```

:::tip
Groq is ideal for latency-sensitive applications. Most models respond in under 500ms.
:::
