---
sidebar_position: 1
title: "Edge Runtime — Local-First LLM Inference"
description: "Run LLMs locally with SynapseKit's EdgeRuntime. Policy-gated cloud fallback, PII redaction, ONNX embeddings, and MLX on Apple Silicon."
---

# Edge Runtime

`EdgeRuntime` wraps a local model as a first-class SynapseKit LLM and only reaches for the cloud when an explicit policy permits it. It runs every request locally by default; a declarative, default-deny `FallbackPolicy` decides whether a specific call may escalate to a cloud model (for example, when the context is too large or the local model can't handle a tool). Before any text leaves the device, PII is redacted. Because `EdgeRuntime` *is* a `BaseLLM`, you can drop it into agents and RAG pipelines anywhere a normal model is accepted.

**Import:**
```python
from synapsekit import EdgeRuntime, FallbackPolicy, EdgeRouteMetadata, EdgeFallbackBlockedError
from synapsekit import ONNXEmbeddings, MLXLLM
```

Local backends are optional extras: `pip install synapsekit[onnx]` for `ONNXEmbeddings`, and `pip install synapsekit[mlx]` for `MLXLLM` on Apple Silicon.

---

## Quickstart

```python
import asyncio
from synapsekit import EdgeRuntime, FallbackPolicy, MLXLLM
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.base import LLMConfig

async def main():
    local = MLXLLM(LLMConfig(model="mlx-community/Llama-3.2-3B-Instruct-4bit"))
    cloud = OpenAILLM(LLMConfig(model="gpt-4o", api_key="sk-..."))

    edge = EdgeRuntime(
        local_llm=local,
        cloud_llm=cloud,
        fallback=FallbackPolicy(
            if_context_exceeds=4096,             # escalate long contexts
            if_user_opts_in=True,                # allow explicit opt-in
            require_pii_redaction_before_fallback=True,
        ),
    )

    # Runs locally
    answer = await edge.generate("Summarize this in one line: ...")
    print(edge.last_route)            # "local"

    # Caller opts in for this request → may route to cloud (PII-redacted)
    answer = await edge.generate("Draft a reply", allow_cloud_fallback=True)
    print(edge.last_route, edge.last_fallback_reason)   # "cloud" "user_opt_in"

asyncio.run(main())
```

---

## Fallback policy

Cloud fallback is **default-deny**: a request escalates only when a matching gate is enabled *and* a `cloud_llm` is configured (otherwise `EdgeFallbackBlockedError` is raised). `FallbackPolicy` gates:

| Field | Type | Default | Trigger |
|---|---|---|---|
| `if_context_exceeds` | `int \| None` | `None` | Estimated context tokens exceed this limit → reason `context_exceeds` |
| `if_tool_unsupported_locally` | `bool` | `False` | Local model raises `NotImplementedError` for tool calls → reason `tool_unsupported` |
| `if_user_opts_in` | `bool` | `False` | Caller passes `allow_cloud_fallback=True` → reason `user_opt_in` |
| `require_pii_redaction_before_fallback` | `bool` | `True` | Redact PII from prompt/messages before any cloud call |
| `fallback_on_local_error` | `bool` | `False` | Local model raises an error → reason `local_error` |

Every call records `EdgeRouteMetadata` (route, fallback reason, estimated tokens, PII types found), available via `edge.last_metadata`, `edge.last_route`, `edge.last_fallback_reason`, and `edge.last_redaction`.

---

## PII redaction before fallback

When a request escalates and `require_pii_redaction_before_fallback` is `True`, the prompt or messages are passed through a `PIIRedactor` before being sent to the cloud model. The redaction result (redacted text, replacement mapping, and the PII types found) is exposed on `edge.last_redaction`, and the detected types are also recorded on `edge.last_metadata.pii_types_found`. Local calls never redact — data stays on-device.

---

## Local providers

### `MLXLLM` — Apple Silicon

A `BaseLLM` backed by `mlx-lm` for on-device inference on Apple Silicon. Supports `generate`, `stream`, and message-based calls; accepts an optional `adapter_path` for LoRA adapters.

```python
from synapsekit import MLXLLM
from synapsekit.llm.base import LLMConfig

llm = MLXLLM(LLMConfig(model="mlx-community/Llama-3.2-3B-Instruct-4bit"))
```

Requires `pip install synapsekit[mlx]` (Apple Silicon only).

### `ONNXEmbeddings` — portable local embeddings

Async embeddings backed by an ONNX Runtime session, suitable for edge RAG. Accepts an optional tokenizer callable and execution `providers`; falls back to a deterministic byte tokenizer for smoke tests.

```python
from synapsekit import ONNXEmbeddings

embeddings = ONNXEmbeddings("model.onnx", normalize=True)
vectors = await embeddings.embed(["hello", "world"])   # (2, D) float32
one = await embeddings.embed_one("hello")
```

Requires `pip install synapsekit[onnx]`.

---

## Managing models: the `edge` CLI

Manage local model artifacts with `synapsekit edge`:

```bash
# List known edge models and download status
synapsekit edge list
synapsekit edge list --format json

# Download a registry model (e.g. llama-3.2-3b, phi-3.5-mini, minilm-l6-onnx)
synapsekit edge pull llama-3.2-3b
synapsekit edge pull minilm-l6-onnx --force

# Quantize a GGUF model with llama.cpp's llama-quantize
synapsekit edge quantize model-f16.gguf model-q4.gguf --quantization Q4_K_M
```

`edge pull` uses `huggingface-hub` to fetch into `~/.cache/synapsekit/edge` (override with `--cache-dir`). `edge quantize` shells out to `llama-quantize`; pass `--llama-quantize /path/to/binary` if it is not on PATH.

---

## API reference

### `EdgeRuntime(*, local_llm, cloud_llm=None, fallback=None, local_embeddings=None, pii_redactor=None, token_chars=4)`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `local_llm` | `BaseLLM` | required | Default local model |
| `cloud_llm` | `BaseLLM \| None` | `None` | Escalation target; required for any fallback |
| `fallback` | `FallbackPolicy \| None` | `None` | Routing gates (default-deny if omitted) |
| `local_embeddings` | `Any \| None` | `None` | Optional local embeddings (e.g. `ONNXEmbeddings`) |
| `pii_redactor` | `PIIRedactor \| None` | `None` | Redactor used before cloud calls |
| `token_chars` | `int` | `4` | Chars-per-token estimate for context sizing |

### Methods (from `BaseLLM`)

- `async generate(prompt, *, allow_cloud_fallback=False, **kw) -> str`
- `async stream(prompt, **kw)` — async token generator
- `async generate_with_messages(messages, **kw) -> str`
- `async stream_with_messages(messages, **kw)`
- `async call_with_tools(messages, tools) -> dict` — escalates on local `NotImplementedError` if `if_tool_unsupported_locally`

### Properties

- `last_route: "local" | "cloud"`
- `last_fallback_reason: str | None`
- `last_metadata: EdgeRouteMetadata`
- `last_redaction: RedactionResult | None`

---

## See also

- [LLM providers](../llms/overview)
- [Agents overview](../agents/overview)
- [Guardrails and PII](../agents/overview)
