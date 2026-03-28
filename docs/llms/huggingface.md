---
sidebar_position: 26
---

# Hugging Face

Access thousands of open-source models via the Hugging Face Inference API. Supports both the free Serverless API and Dedicated Inference Endpoints.

## Install

```bash
pip install synapsekit[huggingface]
```

## Setup

```bash
export HUGGINGFACE_API_KEY=hf_...
```

## Usage

```python
from synapsekit.llm.huggingface import HuggingFaceLLM
from synapsekit import LLMConfig
import os

# Serverless Inference API
config = LLMConfig(
    model="meta-llama/Llama-3.2-3B-Instruct",
    api_key=os.environ["HUGGINGFACE_API_KEY"],
    provider="huggingface",
)

llm = HuggingFaceLLM(config)

# Streaming
async for token in llm.stream("Explain transformer architecture"):
    print(token, end="")

# Generate
response = await llm.generate("What is the Hugging Face Hub?")
```

## Dedicated Inference Endpoints

```python
llm = HuggingFaceLLM(
    config,
    endpoint_url="https://your-endpoint.huggingface.cloud",
)
```

## Popular models

| Model | Notes |
|---|---|
| `meta-llama/Llama-3.2-3B-Instruct` | Fast, small Llama 3.2 |
| `meta-llama/Llama-3.1-8B-Instruct` | Balanced quality |
| `mistralai/Mistral-7B-Instruct-v0.3` | Mistral 7B |
| `HuggingFaceH4/zephyr-7b-beta` | Strong instruction following |
| `Qwen/Qwen2.5-7B-Instruct` | Multilingual, 7B |

## Via RAG facade

```python
from synapsekit import RAG
import os

rag = RAG(
    model="meta-llama/Llama-3.2-3B-Instruct",
    api_key=os.environ["HUGGINGFACE_API_KEY"],
    provider="huggingface",
)
rag.add("Your document text here")
answer = rag.ask_sync("Summarize this.")
```

:::tip
The free Serverless Inference API has rate limits. For production use, deploy a [Dedicated Inference Endpoint](https://huggingface.co/inference-endpoints) and pass the URL via `endpoint_url`.
:::
