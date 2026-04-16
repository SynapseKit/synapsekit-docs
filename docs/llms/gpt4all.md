---
sidebar_position: 32
---

# GPT4All

Run GGUF models entirely on-device using [GPT4All](https://gpt4all.io/) Python bindings. No API key, no internet connection required after model download.

## Install

```bash
pip install synapsekit[gpt4all]
```

## Download a model

Download any GPT4All-compatible GGUF model from [GPT4All's model explorer](https://gpt4all.io/index.html) or Hugging Face:

```bash
# Using the GPT4All Python API
from gpt4all import GPT4All
model = GPT4All("Phi-3-mini-4k-instruct.Q4_0.gguf")
# Downloads automatically on first use
```

## Usage

```python
from synapsekit.llm.gpt4all import GPT4AllLLM
from synapsekit import LLMConfig

config = LLMConfig(
    model="Phi-3-mini-4k-instruct.Q4_0.gguf",
    api_key="",  # no key needed
)

llm = GPT4AllLLM(config)

# Streaming
async for token in llm.stream("Explain neural networks briefly"):
    print(token, end="", flush=True)

# Generate (awaitable)
response = await llm.generate("What is RAG?")
print(response)
```

## With RAG

```python
from synapsekit import RAG

rag = RAG(
    model="Phi-3-mini-4k-instruct.Q4_0.gguf",
    api_key="",
    provider="gpt4all",
)

rag.add("SynapseKit is an async-native Python framework for LLM applications.")
answer = rag.ask_sync("What is SynapseKit?")
print(answer)
```

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `model` | required | GGUF model filename or path |
| `n_threads` | auto | Number of CPU threads |
| `device` | `"cpu"` | `"cpu"` or `"gpu"` |
| `n_ctx` | `2048` | Context window length |

## Notes

- Streaming is implemented via a callback shim: GPT4All's blocking `generate()` is called in `run_in_executor` to avoid blocking the event loop.
- Model files are cached in `~/.cache/gpt4all/` by default.
- GPU acceleration requires a compatible GPU and the CUDA build of GPT4All.
