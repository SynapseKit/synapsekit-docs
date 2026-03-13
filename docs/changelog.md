---
sidebar_position: 98
---

# Changelog

All notable changes to SynapseKit are documented here.

---

## v0.6.1 — Graph Power-ups & Advanced Retrieval

**Graph Workflows**
- `GraphInterrupt` — raise from any node to pause execution for human review
- `InterruptState` — holds interrupt details (graph ID, node, state, message)
- `resume(updates=...)` — apply human edits and continue from checkpoint
- `subgraph_node()` — nest a `CompiledGraph` as a node in a parent graph with input/output key mapping
- `llm_node(stream=True)` — wrap any `BaseLLM` as a graph node with optional token streaming
- `stream_tokens()` — yields `{"type": "token", ...}` events for real-time LLM output

**Advanced Retrieval**
- `SelfQueryRetriever` — LLM decomposes natural-language queries into semantic search + metadata filters
- `ParentDocumentRetriever` — embeds small chunks for precision, returns full parent documents
- `CrossEncoderReranker` — reranks results with cross-encoder models for higher accuracy

**Memory**
- `HybridMemory` — sliding window of recent messages + LLM-generated summary of older context

**Stats:** 482 tests, 13 providers, 11 tools, 12 loaders, 6 retrieval strategies

---

## v0.6.0 — Tools, Providers & Retrieval Strategies

**Built-in Tools (6 new)**
- `HTTPRequestTool` — GET/POST/PUT/DELETE/PATCH with aiohttp
- `FileWriteTool` — write/append files with auto-mkdir
- `FileListTool` — list directories with glob patterns, recursive mode
- `DateTimeTool` — current time, parse, format with timezone support
- `RegexTool` — findall, match, search, replace, split
- `JSONQueryTool` — dot-notation path queries on JSON data

**LLM Providers (3 new)**
- `OpenRouterLLM` — unified API for 200+ models (auto-detected from `/` in model name)
- `TogetherLLM` — Together AI fast inference
- `FireworksLLM` — Fireworks AI optimized serving

**Advanced Retrieval (2 new)**
- `ContextualRetriever` — Anthropic-style contextual retrieval (LLM adds context before embedding)
- `SentenceWindowRetriever` — sentence-level embedding with window expansion at retrieval time

**Stats:** 452 tests, 13 providers, 11 tools, 12 loaders

---

## v0.5.3 — Enterprise Providers & Ecosystem

**LLM Providers (3 new)**
- `AzureOpenAILLM` — Azure OpenAI enterprise deployments
- `GroqLLM` — ultra-fast inference (Llama, Mixtral, Gemma)
- `DeepSeekLLM` — DeepSeek with function calling support

**Features**
- `LLMConfig(cache_backend="sqlite")` — persistent SQLite LLM cache
- `RAGFusionRetriever` — multi-query + Reciprocal Rank Fusion
- `ExcelLoader` — `.xlsx` file loading
- `PowerPointLoader` — `.pptx` file loading

**Stats:** 415 tests, 10 providers, 10 loaders

---

## v0.5.2 — Developer Experience

- `__repr__` methods on `StateGraph`, `CompiledGraph`, `RAGPipeline`, `ReActAgent`, `FunctionCallingAgent`
- Empty document handling — `RAGPipeline.add()` silently skips empty text
- Retry for `call_with_tools()` — retries apply to function calling
- `BaseLLM.cache_stats` — cache hit/miss statistics
- `search_mmr()` / `retrieve_mmr()` — MMR diversity-aware retrieval
- `LLMConfig(requests_per_minute=N)` — token-bucket rate limiting
- `generate_structured(llm, prompt, schema=Model)` — structured output with Pydantic validation and retry

**Stats:** 389 tests

---

## v0.5.1 — Polish

- `@tool` decorator — create agent tools from plain functions with auto-generated JSON Schema
- Metadata filtering — `VectorStore.search(metadata_filter={"key": "value"})`
- Vector store lazy exports — all backends importable directly from `synapsekit`
- File existence checks — loaders raise `FileNotFoundError` before reading
- Parameter validation — agents and memory reject invalid config

**Stats:** 357 tests

---

## v0.5.0 — Production Features

- **Text Splitters** — `BaseSplitter`, `CharacterTextSplitter`, `RecursiveCharacterTextSplitter`, `TokenAwareSplitter`, `SemanticSplitter`
- **Function calling** — `call_with_tools()` added to `GeminiLLM` and `MistralLLM`
- **LLM Caching** — `AsyncLRUCache` with SHA-256 keys, opt-in via `LLMConfig(cache=True)`
- **LLM Retries** — exponential backoff, skips auth errors, `LLMConfig(max_retries=N)`
- **Graph Cycles** — `compile(allow_cycles=True)` for intentional loops
- **Configurable max_steps** — `compile(max_steps=N)`
- **Graph Checkpointing** — `BaseCheckpointer`, `InMemoryCheckpointer`, `SQLiteCheckpointer`
- **`CompiledGraph.resume()`** — re-execute from saved state

**Stats:** 332 tests

---

## v0.4.0 — Graph Workflows

- `StateGraph` — fluent DAG builder with compile-time validation and cycle detection
- `CompiledGraph` — wave-based async executor with `run()` / `stream()` / `run_sync()`
- `Node`, `Edge`, `ConditionalEdge` — sync + async node functions and routing
- `agent_node()`, `rag_node()` — wrap agents and RAG pipelines as graph nodes
- Parallel execution via `asyncio.gather()`
- Mermaid diagram export

**Stats:** 267 tests

---

## v0.3.0 — Agents

- `BaseTool` ABC, `ToolRegistry`, `AgentMemory`
- `ReActAgent` — Thought / Action / Observation loop
- `FunctionCallingAgent` — native OpenAI `tool_calls` / Anthropic `tool_use`
- `AgentExecutor` — unified runner with `run()` / `stream()` / `run_sync()`
- `call_with_tools()` on `OpenAILLM` and `AnthropicLLM`
- 5 built-in tools: Calculator, PythonREPL, FileRead, WebSearch, SQL

**Stats:** 223 tests

---

## v0.2.0 — Ecosystem

- **Loaders**: PDF, HTML, CSV, JSON, Directory, Web
- **Output parsers**: JSON, Pydantic, List
- **Vector stores**: Chroma, FAISS, Qdrant, Pinecone
- **LLM providers**: Ollama, Cohere, Mistral, Gemini, Bedrock
- **Prompt templates**: standard, chat, few-shot

**Stats:** 141 tests

---

## v0.1.0 — Core RAG

- `BaseLLM` + `LLMConfig`, `OpenAILLM`, `AnthropicLLM`
- `SynapsekitEmbeddings`, `InMemoryVectorStore`, `Retriever`
- `TextSplitter`, `ConversationMemory`, `TokenTracer`
- `RAGPipeline`, `RAG` facade
- `TextLoader`, `StringLoader`

**Stats:** 52 tests
