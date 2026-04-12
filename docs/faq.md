---
sidebar_position: 97
---

# FAQ

Below are common questions about SynapseKit.

---

## What Python version is required?

<details>
<summary>Answer</summary>

SynapseKit requires **Python 3.14 or newer**.

</details>

---

## How is SynapseKit different from LangChain?

<details>
<summary>Answer</summary>

SynapseKit is **async-native and streaming-first** from the ground up — every public API is `async`, streaming is the default. It has only 2 hard dependencies (`numpy` and `rank-bm25`), compared to LangChain's heavy dependency tree. No chains, no magic callbacks, no global state — just plain Python classes you can read, subclass, and override. See the [Feature Parity Report](https://github.com/SynapseKit/SynapseKit/blob/main/docs/FEATURE_PARITY.md) for a detailed comparison.

</details>

---

## Can I use it with local models (Ollama)?

<details>
<summary>Answer</summary>

Yes. Install with `pip install synapsekit[ollama]` and use `OllamaLLM` or pass `provider="ollama"` to the `RAG` facade. See the [Ollama docs](/docs/llms/ollama) for details.

</details>

---

## How do I add a custom LLM provider?

<details>
<summary>Answer</summary>

Extend `BaseLLM` and implement the `stream()` method. All other methods (`generate()`, `stream_with_messages()`, `generate_with_messages()`) are derived from it. See the [LLM Overview](/docs/llms/overview) for the full interface.

</details>

---

## Does it work with FastAPI?

<details>
<summary>Answer</summary>

Yes. Since SynapseKit is fully async, it integrates naturally with FastAPI. Graph workflows also support SSE streaming via `sse_stream()` for real-time HTTP responses.

</details>

---

## Is it production-ready?

<details>
<summary>Answer</summary>

Yes. SynapseKit includes LLM response caching (memory, SQLite, filesystem, Redis), exponential backoff retries, token-bucket rate limiting, structured output with Pydantic validation, and graph checkpointing for fault tolerance.

</details>

---

## How can I contribute?

<details>
<summary>Answer</summary>

Check out the [GitHub repo](https://github.com/SynapseKit/SynapseKit) — open issues, submit pull requests, improve documentation, or add new integrations.

</details>
