---
sidebar_position: 1
---

# Introduction

**SynapseKit** is an async-first Python framework for building LLM applications — RAG pipelines, tool-using agents, and async graph workflows — with a clean, minimal API.

It is designed from the ground up to be **async-native** and **streaming-first**. Every public API is `async`. Streaming tokens is the default, not an opt-in. There are no hidden chains, no magic callbacks, no global state.

---

## Design principles

These are not aspirational goals. They are hard constraints baked into every API decision.

**1. `stream()` is always primary.**
`ask()` and `run()` are implemented as `"".join(stream(...))`. Streaming is never a bolt-on.

**2. All I/O is async.**
Every method that does I/O — embedding, retrieval, LLM calls, tool execution — is a coroutine. Sync wrappers (`ask_sync`, `run_sync`) are provided for convenience but call into the async layer.

**3. Lazy external imports with clear errors.**
`import openai` only happens when you use OpenAI. Every optional import raises a helpful `ImportError` that tells you exactly what to install.

**4. No global state.**
Every class is independently instantiable. Two `RAG` instances with different models work without interference.

**5. 2 hard dependencies.**
`numpy` (vector math) and `rank-bm25` (BM25 retrieval) are the only required packages. Everything else — LLM providers, vector stores, PDF parsing, web fetching — is behind an optional install extra.

**6. Transparent, plain Python.**
No chains. No declarative pipelines. No YAML. Just async functions and plain Python classes you can read, subclass, and override.

---

## What's in the box

### RAG Pipelines

Full retrieval-augmented generation with chunking, embedding, vector search, BM25 reranking, conversation memory, token tracing, and streaming.

→ [RAG Pipeline docs](/docs/rag/pipeline)

### 13 LLM providers

OpenAI, Anthropic, Ollama, Cohere, Mistral, Gemini, AWS Bedrock, Azure OpenAI, Groq, DeepSeek, OpenRouter, Together, Fireworks — all behind `BaseLLM`. Auto-detected from the model name.

→ [LLM Provider docs](/docs/llms/overview)

### 5 vector store backends

InMemoryVectorStore (built-in, `.npz` persistence), ChromaDB, FAISS, Qdrant, Pinecone — all behind `VectorStore`.

→ [Vector store docs](/docs/rag/vector-stores)

### 12 document loaders

`TextLoader`, `StringLoader`, `PDFLoader`, `HTMLLoader`, `CSVLoader`, `JSONLoader`, `DirectoryLoader`, `WebLoader`, `ExcelLoader`, `PowerPointLoader`, plus contextual and sentence-window strategies.

→ [Loader docs](/docs/rag/loaders)

### Agents

`ReActAgent` — Thought → Action → Observation loop, works with any LLM.
`FunctionCallingAgent` — native `tool_calls` / `tool_use` for OpenAI, Anthropic, Gemini, and Mistral.
`AgentExecutor` — unified runner, picks the right agent from config.
11 built-in tools: Calculator, PythonREPL, FileRead, FileWrite, FileList, WebSearch, SQL, HTTP, DateTime, Regex, JSONQuery.

→ [Agent docs](/docs/agents/overview)

### Graph Workflows

`StateGraph` — fluent graph builder with compile-time validation, optional cycle support, and configurable step limits.
`CompiledGraph` — wave-based async executor. Parallel nodes via `asyncio.gather`. Conditional routing, checkpointing, human-in-the-loop interrupts, subgraphs, token-level streaming, and Mermaid export.

→ [Graph docs](/docs/graph/overview)

### Advanced Retrieval

RAG Fusion, Contextual Retrieval, Sentence Window, Self-Query (LLM-generated filters), Parent Document, Cross-Encoder reranking.

→ [Retrieval docs](/docs/rag/retriever)

### Memory

`ConversationMemory` (sliding window), `HybridMemory` (window + LLM summary), `TokenTracer` (tokens, latency, cost).

### Utilities

Output parsers (JSON, Pydantic, List), prompt templates (standard, chat, few-shot), structured output with Pydantic validation.

---

## Version

Current version: **0.6.1** — see the [Changelog](/docs/changelog) and [Roadmap](/docs/roadmap).
