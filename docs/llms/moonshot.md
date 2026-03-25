---
sidebar_position: 17
---

# Moonshot AI

Moonshot AI's Kimi models — long-context Chinese-English bilingual LLMs with up to 128K context.

## Install

```bash
pip install synapsekit[openai]
```

Uses the `openai` SDK with Moonshot's API endpoint.

## Usage

```python
from synapsekit.llm.moonshot import MoonshotLLM
from synapsekit import LLMConfig

config = LLMConfig(
    model="moonshot-v1-8k",
    api_key="sk-...",
    provider="moonshot",
)

llm = MoonshotLLM(config)

# Streaming
async for token in llm.stream("用中文解释机器学习"):
    print(token, end="")

# Generate
response = await llm.generate("What is Moonshot AI?")
```

## Available models

| Model | Context | Notes |
|---|---|---|
| `moonshot-v1-8k` | 8K | Fast, low cost |
| `moonshot-v1-32k` | 32K | Balanced |
| `moonshot-v1-128k` | 128K | Long-context tasks |

## Function calling

```python
from synapsekit import FunctionCallingAgent, tool

@tool
def get_time(timezone: str = "UTC") -> str:
    """Get the current time in a timezone."""
    from datetime import datetime, timezone as tz
    return datetime.now(tz.utc).strftime("%Y-%m-%d %H:%M UTC")

llm = MoonshotLLM(LLMConfig(model="moonshot-v1-8k", api_key="sk-..."))
agent = FunctionCallingAgent(llm=llm, tools=[get_time])
answer = await agent.run("What time is it now?")
```

## Auto-detection

The RAG facade auto-detects Moonshot for `moonshot-*` model prefixes:

```python
from synapsekit import RAG

rag = RAG(model="moonshot-v1-8k", api_key="sk-...")
rag.add("Your document text here")
answer = rag.ask_sync("Summarize this.")
```

:::tip
Use `moonshot-v1-128k` for long-document RAG where the entire source may fit in a single context window.
:::
