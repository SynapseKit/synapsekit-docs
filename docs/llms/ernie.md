---
sidebar_position: 22
---

# Baidu ERNIE

Baidu's ERNIE Bot (文心一言) — a family of Chinese-English bilingual LLMs with strong performance on Chinese language tasks.

## Install

```bash
pip install synapsekit[ernie]
```

## Usage

```python
from synapsekit.llm.ernie import ErnieLLM
from synapsekit import LLMConfig

config = LLMConfig(
    model="ernie-4.0",
    api_key="your-aistudio-token",
    provider="ernie",
)

llm = ErnieLLM(config)

# Streaming
async for token in llm.stream("用中文解释量子计算"):
    print(token, end="")

# Generate
response = await llm.generate("What is the Great Wall of China?")
```

## Authentication

ERNIE Bot uses Baidu AI Studio access tokens. Set your token as the `api_key`:

```bash
export ERNIE_ACCESS_TOKEN=your-aistudio-token
```

```python
import os
config = LLMConfig(
    model="ernie-4.0",
    api_key=os.environ["ERNIE_ACCESS_TOKEN"],
    provider="ernie",
)
```

## Available models

| Model | Notes |
|---|---|
| `ernie-4.0` | Flagship, best quality |
| `ernie-3.5` | Good balance of speed and quality |
| `ernie-speed` | Fast inference |
| `ernie-lite` | Lightweight |
| `ernie-tiny-8k` | Smallest, 8K context |

## Function calling

ErnieLLM supports ERNIE's native function-calling interface:

```python
from synapsekit import FunctionCallingAgent, tool

@tool
def search_web(query: str) -> str:
    """Search the web for information."""
    return f"Search results for: {query}"

agent = FunctionCallingAgent(llm=llm, tools=[search_web])
answer = await agent.run("搜索关于人工智能的最新新闻")
print(answer)
```

## Auto-detection

The RAG facade auto-detects ERNIE for `ernie-*` model prefixes:

```python
from synapsekit import RAG

rag = RAG(model="ernie-4.0", api_key="your-token")
rag.add("Your document text here")
answer = rag.ask_sync("Summarize this.")
```

## API type

By default, `ErnieLLM` uses the `aistudio` API type. You can change this when constructing the provider directly:

```python
llm = ErnieLLM(config, api_type="aistudio")  # default
```

:::tip
ERNIE models are particularly strong for Chinese-English bilingual tasks and knowledge of Chinese culture and geography. For predominantly English workloads, consider using a different provider.
:::
