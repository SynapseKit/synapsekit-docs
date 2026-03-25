---
sidebar_position: 23
---

# llama.cpp

Run GGUF models entirely on-device with [llama-cpp-python](https://github.com/abetlen/llama-cpp-python). No API key required. Works on CPU or GPU.

## Install

```bash
pip install synapsekit[llamacpp]
```

For GPU acceleration (CUDA):

```bash
CMAKE_ARGS="-DGGML_CUDA=on" pip install llama-cpp-python
```

For Apple Silicon (Metal):

```bash
CMAKE_ARGS="-DGGML_METAL=on" pip install llama-cpp-python
```

## Download a model

Download a GGUF file from [Hugging Face](https://huggingface.co/models?search=gguf):

```bash
# Example: Llama 3.1 8B quantized
huggingface-cli download \
  bartowski/Meta-Llama-3.1-8B-Instruct-GGUF \
  Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf \
  --local-dir ./models
```

## Usage

```python
from synapsekit.llm.llamacpp import LlamaCppLLM
from synapsekit import LLMConfig

config = LLMConfig(
    model="llama-3.1-8b",
    api_key="",  # no key needed
    provider="llamacpp",
)

llm = LlamaCppLLM(
    config,
    model_path="./models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
)

# Streaming
async for token in llm.stream("Explain gradient descent"):
    print(token, end="")

# Generate
response = await llm.generate("What is the capital of France?")
```

## GPU offloading

Use `n_gpu_layers` to offload layers to the GPU. Set to `-1` to offload all layers:

```python
llm = LlamaCppLLM(
    config,
    model_path="./models/llama-3.1-8b.gguf",
    n_gpu_layers=35,   # offload 35 layers to GPU
    n_ctx=4096,        # context window size
)
```

## Constructor parameters

| Parameter | Default | Description |
|---|---|---|
| `model_path` | — | Path to the GGUF model file (required) |
| `n_ctx` | `2048` | Context window size |
| `n_gpu_layers` | `0` | Number of layers to offload to GPU (0 = CPU only, -1 = all) |
| `top_p` | `0.95` | Top-p sampling parameter |

Any extra kwargs are forwarded directly to `llama_cpp.Llama()`.

## RAG with local models

```python
from synapsekit import RAG

rag = RAG(
    model="./models/llama-3.1-8b.gguf",
    api_key="",
    provider="llamacpp",
)
rag.add("Your document text here")
answer = rag.ask_sync("Summarize the document.")
```

## Recommended models

| Model | Size | Q4_K_M size | Notes |
|---|---|---|---|
| Llama 3.1 8B Instruct | 8B | ~4.7 GB | Best balance |
| Llama 3.2 3B Instruct | 3B | ~2.0 GB | Fastest on CPU |
| Mistral 7B Instruct v0.3 | 7B | ~4.1 GB | Good instruction following |
| Phi-3.5 Mini Instruct | 3.8B | ~2.2 GB | Strong for small size |
| Gemma 2 9B Instruct | 9B | ~5.4 GB | Google's open model |

:::tip
Start with a Q4_K_M quantization — it strikes the best balance between quality and file size. Use Q8_0 for maximum quality if you have the VRAM.
:::

:::note
`LlamaCppLLM` does not support native function calling. Use `ReActAgent` (which works via prompting) instead of `FunctionCallingAgent`.
:::
