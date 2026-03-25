---
sidebar_position: 18
---

# Zhipu AI

Zhipu AI's GLM (General Language Model) series — powerful Chinese-English bilingual models with function calling support.

## Install

```bash
pip install synapsekit[openai]
```

Uses the `openai` SDK with Zhipu's API endpoint.

## Usage

```python
from synapsekit.llm.zhipu import ZhipuLLM
from synapsekit import LLMConfig

config = LLMConfig(
    model="glm-4",
    api_key="your-zhipu-api-key",
    provider="zhipu",
)

llm = ZhipuLLM(config)

# Streaming
async for token in llm.stream("请解释量子计算的基本原理"):
    print(token, end="")

# Generate
response = await llm.generate("What are the key features of GLM-4?")
```

## Available models

| Model | Context | Notes |
|---|---|---|
| `glm-4` | 128K | Flagship, strongest quality |
| `glm-4-air` | 128K | Faster, lower cost |
| `glm-4-flash` | 128K | Fastest, free tier available |
| `glm-3-turbo` | 128K | Previous generation, very low cost |

## Function calling

```python
from synapsekit import FunctionCallingAgent, tool

@tool
def search_knowledge(query: str) -> str:
    """Search a knowledge base for relevant information."""
    return f"Results for '{query}': relevant information found."

llm = ZhipuLLM(LLMConfig(model="glm-4", api_key="..."))
agent = FunctionCallingAgent(llm=llm, tools=[search_knowledge])
answer = await agent.run("搜索关于深度学习的信息")
```

## Auto-detection

The RAG facade auto-detects Zhipu for `glm-*` model prefixes:

```python
from synapsekit import RAG

rag = RAG(model="glm-4", api_key="...")
rag.add("Your document text here")
answer = rag.ask_sync("Summarize this.")
```

:::tip
GLM-4 models are particularly strong at Chinese language tasks. `glm-4-flash` is free within rate limits — ideal for development and testing.
:::
