---
sidebar_position: 99
---

# Roadmap

## Phase 1 — Core RAG ✅ Done

- `BaseLLM` ABC + `LLMConfig`
- `OpenAILLM` — async streaming
- `AnthropicLLM` — async streaming
- `SynapsekitEmbeddings` — sentence-transformers backend
- `InMemoryVectorStore` — numpy cosine sim + `.npz` persistence
- `Retriever` — vector search + BM25 rerank
- `TextSplitter` — pure Python, zero deps
- `ConversationMemory` — sliding window
- `TokenTracer` — tokens, latency, cost per call
- `TextLoader`, `StringLoader`
- `RAGPipeline` — full orchestrator
- `RAG` facade — 3-line happy path
- `run_sync()` — works inside/outside event loops
- 52 tests, all passing

## Phase 2 — Own the Niche ✅ Done

- **Loaders**: `PDFLoader`, `HTMLLoader`, `CSVLoader`, `JSONLoader`, `DirectoryLoader`, `WebLoader`
- **Output parsers**: `JSONParser`, `PydanticParser`, `ListParser`
- **Vector store backends**: `ChromaVectorStore`, `FAISSVectorStore`, `QdrantVectorStore`, `PineconeVectorStore`
- **LLM providers**: `OllamaLLM`, `CohereLLM`, `MistralLLM`, `GeminiLLM`, `BedrockLLM`
- **Prompt templates**: `PromptTemplate`, `ChatPromptTemplate`, `FewShotPromptTemplate`
- **VectorStore ABC** — all backends share one interface
- `Retriever.add()` — cleaner API, no internal `_store` access
- `RAGPipeline.add_documents(docs)` — ingest `List[Document]` directly
- `RAG.add_documents()` + `RAG.add_documents_async()`
- 141 tests, all passing

## Phase 3 — Agents ✅ Done

- **`BaseTool` ABC** — `run()`, `schema()`, `anthropic_schema()`, `ToolResult`
- **`ToolRegistry`** — lookup by name, OpenAI + Anthropic schema generation
- **`AgentMemory`** — step scratchpad, `format_scratchpad()`, max_steps limit
- **`ReActAgent`** — Thought → Action → Observation loop, any `BaseLLM`, no function calling required
- **`FunctionCallingAgent`** — native OpenAI tool_calls / Anthropic tool_use, multi-tool per step
- **`AgentExecutor`** — unified runner, `run()` / `stream()` / `run_sync()`, picks agent from config
- **`call_with_tools()`** — added to `OpenAILLM` and `AnthropicLLM`
- **Built-in tools**:
  - `CalculatorTool` — safe math eval, no deps
  - `PythonREPLTool` — exec with persistent namespace, stdout capture
  - `FileReadTool` — read local files
  - `WebSearchTool` — DuckDuckGo search, no API key (`pip install synapsekit[search]`)
  - `SQLQueryTool` — SQLite (stdlib) + SQLAlchemy for other databases
- 223 tests, all passing

## Phase 4 — Graph Workflows ✅ Done

- **`StateGraph`** — fluent DAG builder with compile-time validation and cycle detection
- **`CompiledGraph`** — wave-based async executor, `run()` / `stream()` / `run_sync()`
- **`Node`**, **`Edge`**, **`ConditionalEdge`** — sync + async node functions and routing
- **`agent_node()`**, **`rag_node()`** — wrap agents and RAG pipelines as graph nodes
- **Parallel execution** — nodes in the same wave run via `asyncio.gather()`
- **Mermaid diagram export** — `get_mermaid()` for any compiled graph
- **`_MAX_STEPS = 100`** guard against infinite conditional loops
- 267 tests, all passing

## Phase 5 — Production Features ✅ Done

- **Text Splitters** — `BaseSplitter` ABC, `CharacterTextSplitter`, `RecursiveCharacterTextSplitter`, `TokenAwareSplitter`, `SemanticSplitter` (cosine similarity boundaries)
- **Function calling for Gemini + Mistral** — `call_with_tools()` added to `GeminiLLM` and `MistralLLM` (4 providers now support native tool use)
- **LLM Response Caching** — `AsyncLRUCache` with SHA-256 cache keys, opt-in via `LLMConfig(cache=True)`
- **LLM Retries** — exponential backoff via `retry_async()`, skips auth errors, opt-in via `LLMConfig(max_retries=N)`
- **Graph Cycles** — `compile(allow_cycles=True)` skips static cycle detection for intentional loops
- **Configurable max_steps** — `compile(max_steps=N)` overrides the default 100-step guard
- **Graph Checkpointing** — `BaseCheckpointer` ABC, `InMemoryCheckpointer`, `SQLiteCheckpointer`
- **`CompiledGraph.resume()`** — re-execute from saved state
- **Adjacency optimization** — pre-built index for faster edge lookup
- **`RAGConfig.splitter`** — plug any `BaseSplitter` into the RAG pipeline
- 332 tests, all passing

## Phase 6 — Polish & Ecosystem ✅ Done (v0.5.1–v0.5.3)

### v0.5.1
- **`@tool` decorator** — create agent tools from plain functions with auto-generated JSON Schema
- **Metadata filtering** — `VectorStore.search(metadata_filter={"key": "value"})`
- **Vector store lazy exports** — all backends importable from `synapsekit`
- **File existence checks** — loaders raise `FileNotFoundError` before attempting to read
- **Parameter validation** — agents and memory reject invalid config
- 357 tests, all passing

### v0.5.2
- **`__repr__` methods** — human-readable repr on `StateGraph`, `CompiledGraph`, `RAGPipeline`, `ReActAgent`, `FunctionCallingAgent`
- **Empty document handling** — `RAGPipeline.add()` silently skips empty text
- **Retry for `call_with_tools()`** — `LLMConfig(max_retries=N)` applies to function calling
- **Cache hit/miss statistics** — `BaseLLM.cache_stats` property
- **MMR retrieval** — `search_mmr()` and `retrieve_mmr()` for diversity-aware retrieval
- **Rate limiting** — `LLMConfig(requests_per_minute=N)` with token-bucket algorithm
- **Structured output with retry** — `generate_structured(llm, prompt, schema=Model)` parses to Pydantic
- 389 tests, all passing

### v0.5.3
- **Azure OpenAI** — `AzureOpenAILLM` for enterprise Azure deployments
- **Groq** — `GroqLLM` for ultra-fast inference (Llama, Mixtral, Gemma)
- **DeepSeek** — `DeepSeekLLM` with function calling support
- **SQLite LLM cache** — persistent cache via `LLMConfig(cache_backend="sqlite")`
- **RAG Fusion** — `RAGFusionRetriever` with multi-query + Reciprocal Rank Fusion
- **Excel loader** — `ExcelLoader` for `.xlsx` files
- **PowerPoint loader** — `PowerPointLoader` for `.pptx` files
- 10 LLM providers, 10 document loaders, 415 tests passing

## Phase 7 — Tools, Providers & Advanced Retrieval ✅ Done (v0.6.0)

- **Built-in tools** (6 new):
  - `HTTPRequestTool` — GET/POST/PUT/DELETE/PATCH with aiohttp
  - `FileWriteTool` — write/append with auto-mkdir
  - `FileListTool` — list directories with glob patterns, recursive
  - `DateTimeTool` — current time, parse, format with tz support
  - `RegexTool` — findall, match, search, replace, split
  - `JSONQueryTool` — dot-notation path queries on JSON data
- **LLM providers** (3 new, all OpenAI-compatible):
  - `OpenRouterLLM` — unified API for 200+ models
  - `TogetherLLM` — Together AI fast inference
  - `FireworksLLM` — Fireworks AI optimized serving
- **Advanced retrieval** (2 new):
  - `ContextualRetriever` — Anthropic-style contextual retrieval
  - `SentenceWindowRetriever` — sentence-level embedding with window expansion
- 13 LLM providers, 11 built-in tools, 12 document loaders, 452 tests passing

## Phase 7.1 — Graph Power-ups & Advanced Retrieval (v0.6.1)

- **Graph: Human-in-the-Loop** — `GraphInterrupt` exception pauses execution for human review; `InterruptState` holds interrupt details; `resume(updates=...)` applies human edits and continues
- **Graph: Subgraphs** — `subgraph_node(compiled_graph, input_mapping, output_mapping)` nests a `CompiledGraph` as a node in a parent graph
- **Graph: Token Streaming** — `llm_node(llm, stream=True)` + `compiled.stream_tokens(state)` yields `{"type": "token", "node", "token"}` events for real-time LLM output
- **Retrieval: SelfQueryRetriever** — LLM decomposes natural-language queries into semantic search + metadata filters automatically
- **Retrieval: ParentDocumentRetriever** — embeds small chunks for precision, returns full parent documents for context
- **Retrieval: CrossEncoderReranker** — reranks retrieval results with cross-encoder models for higher precision (`pip install synapsekit[semantic]`)
- **Memory: HybridMemory** — sliding window of recent messages + LLM summary of older messages for token-efficient long conversations

## Phase 8 — Evaluation & Multi-modal 🔜

- Multi-modal support (image inputs for vision models)
- `Evaluator` — faithfulness, relevancy, groundedness
- RAGAS-style metrics
- Advanced retrieval: FLARE, Step-Back Prompting
- Conversation branching and tree-of-thought

## Phase 9 — Platform 🔜

- Local observability UI (LangSmith-style, open source)
- Streaming UI helpers — SSE + WebSocket for FastAPI
- `synapsekit serve` — deploy any app as FastAPI in one command
- Prompt hub — versioned prompt registry
- Plugin system for community extensions
