---
sidebar_position: 34
---

# Replicate

Run thousands of open-source models via [Replicate](https://replicate.com/)'s cloud hosting platform — Llama, Mistral, SDXL, Whisper, and more — with a single API key and no GPU management.

## Install

```bash
pip install synapsekit[replicate]
```

## Usage

```python
from synapsekit.llm.replicate import ReplicateLLM
from synapsekit import LLMConfig

config = LLMConfig(
    model="meta/meta-llama-3-8b-instruct",
    api_key="r8_your_replicate_token",
    provider="replicate",
)

llm = ReplicateLLM(config)

# Streaming
async for token in llm.stream("Explain transformers in plain English"):
    print(token, end="", flush=True)

# Generate
response = await llm.generate("What is attention?")
print(response)
```

## Model versions

Pin to a specific model version for reproducibility:

```python
config = LLMConfig(
    model="meta/meta-llama-3-8b-instruct",
    api_key="r8_...",
    provider="replicate",
)
llm = ReplicateLLM(config, version="dp-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
```

## With RAG

```python
from synapsekit import RAG

rag = RAG(
    model="meta/meta-llama-3-8b-instruct",
    api_key="r8_...",
    provider="replicate",
)

rag.add("Your knowledge base document.")
answer = rag.ask_sync("Summarise the document.")
```

## Popular models

| Model | Replicate ID |
|-------|-------------|
| Llama 3 8B | `meta/meta-llama-3-8b-instruct` |
| Llama 3 70B | `meta/meta-llama-3-70b-instruct` |
| Mistral 7B | `mistralai/mistral-7b-instruct-v0.2` |
| Mixtral 8×7B | `mistralai/mixtral-8x7b-instruct-v0.1` |
| Code Llama | `meta/codellama-70b-instruct` |

## Notes

- Requires `REPLICATE_API_TOKEN` environment variable or explicit `api_key` in `LLMConfig`.
- Streaming is supported via `replicate.stream()`.
- Cold-start latency applies to infrequently-used model versions.
