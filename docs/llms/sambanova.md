---
sidebar_position: 27
---

# SambaNova

[SambaNova Cloud](https://sambanova.ai/) provides fast inference on open-source models including Meta Llama, Qwen, and others, using the OpenAI-compatible API.

## Install

```bash
pip install synapsekit[openai]
```

SambaNova uses the OpenAI-compatible API — no separate package required.

## Quick start

```python
from synapsekit import SambaNovaLLM, LLMConfig

llm = SambaNovaLLM(
    LLMConfig(
        model="Meta-Llama-3.1-8B-Instruct",
        api_key="your-sambanova-api-key",
        provider="sambanova",
    )
)

# Streaming
async for token in llm.stream("Explain attention mechanisms"):
    print(token, end="", flush=True)

# Full response
response = await llm.generate("What is a transformer?")
```

## Via the RAG facade

SambaNova model names don't have a unique prefix, so **always specify `provider="sambanova"` explicitly**:

```python
from synapsekit import RAG

rag = RAG(
    model="Meta-Llama-3.1-8B-Instruct",
    api_key="your-sambanova-api-key",
    provider="sambanova",
)

answer = await rag.ask("What is RAG?")
```

## Custom base URL

```python
llm = SambaNovaLLM(
    LLMConfig(model="Meta-Llama-3.1-8B-Instruct", api_key="..."),
    base_url="https://your-sambanova-proxy.example.com/v1",
)
```

## Tool use

```python
from synapsekit import AgentExecutor

executor = AgentExecutor(
    llm=SambaNovaLLM(config),
    tools=["calculator", "web_search"],
    agent_type="function_calling",
)

result = await executor.run("What is 2349 * 8712?")
```

## Popular models

| Model | Description |
|---|---|
| `Meta-Llama-3.1-8B-Instruct` | Fast, efficient, great for most tasks |
| `Meta-Llama-3.1-70B-Instruct` | High-quality, strong reasoning |
| `Meta-Llama-3.1-405B-Instruct` | Largest Llama — maximum capability |
| `Qwen2.5-72B-Instruct` | Strong multilingual and coding model |
| `Qwen2.5-Coder-32B-Instruct` | Code generation specialist |

Check [SambaNova's model catalog](https://sambanova.ai/fast-api) for the full list.

## Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `config` | `LLMConfig` | required | Model configuration |
| `base_url` | `str \| None` | `"https://api.sambanova.ai/v1"` | Override the API base URL |

## Token tracking

```python
llm = SambaNovaLLM(config)
await llm.generate("Hello!")
print(llm.tokens_used)  # {"input": 12, "output": 8}
```
