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

## Phase 7.1 — Graph Power-ups & Advanced Retrieval ✅ Done (v0.6.1)

- **Graph: Human-in-the-Loop** — `GraphInterrupt` exception pauses execution for human review; `InterruptState` holds interrupt details; `resume(updates=...)` applies human edits and continues
- **Graph: Subgraphs** — `subgraph_node(compiled_graph, input_mapping, output_mapping)` nests a `CompiledGraph` as a node in a parent graph
- **Graph: Token Streaming** — `llm_node(llm, stream=True)` + `compiled.stream_tokens(state)` yields `{"type": "token", "node", "token"}` events for real-time LLM output
- **Retrieval: SelfQueryRetriever** — LLM decomposes natural-language queries into semantic search + metadata filters automatically
- **Retrieval: ParentDocumentRetriever** — embeds small chunks for precision, returns full parent documents for context
- **Retrieval: CrossEncoderReranker** — reranks retrieval results with cross-encoder models for higher precision (`pip install synapsekit[semantic]`)
- **Memory: HybridMemory** — sliding window of recent messages + LLM summary of older messages for token-efficient long conversations

## Phase 7.2 — Retrieval Strategies, Memory & Tools ✅ Done (v0.6.2)

- **Retrieval: CRAGRetriever** — Corrective RAG: grades retrieved docs for relevance, rewrites query and retries when too few are relevant
- **Retrieval: QueryDecompositionRetriever** — breaks complex queries into sub-queries, retrieves for each, deduplicates
- **Retrieval: ContextualCompressionRetriever** — compresses retrieved documents to only relevant excerpts using an LLM
- **Retrieval: EnsembleRetriever** — fuses results from multiple retrievers using weighted Reciprocal Rank Fusion
- **Memory: SQLiteConversationMemory** — persistent chat history in SQLite, multi-conversation support, optional sliding window
- **Memory: SummaryBufferMemory** — token-budget-aware memory that progressively summarizes older messages
- **Tools: HumanInputTool** — pauses agent execution to ask the user a question (custom sync/async input functions)
- **Tools: WikipediaTool** — searches and fetches Wikipedia article summaries via REST API, no extra deps
- 13 providers, 13 tools, 12 loaders, 10 retrieval strategies, 4 memory backends, 512 tests passing

## Phase 7.3 — Typed State, Fan-Out, SSE & LLM Tools ✅ Done (v0.6.3)

- **Graph: TypedState with reducers** — `StateField` with per-field reducers for safe parallel state merging
- **Graph: fan_out_node()** — run multiple subgraphs concurrently with `asyncio.gather()`, custom merge functions
- **Graph: SSE streaming** — `sse_stream()` for HTTP Server-Sent Events streaming
- **Graph: Event callbacks** — `EventHooks` with `on_node_start`, `on_node_complete`, `on_wave_start`, `on_wave_complete`
- **LLM: SemanticCache** — similarity-based cache lookup using embeddings, configurable threshold
- **Tools: SummarizationTool** — summarize text with concise, bullet_points, or detailed styles
- **Tools: SentimentAnalysisTool** — sentiment analysis with confidence and explanation
- **Tools: TranslationTool** — translate text between languages
- 13 providers, 16 tools, 12 loaders, 10 retrieval strategies, 4 memory backends, 540 tests passing

## Phase 7.4 — Loaders, HyDE, Tools, Caching & Checkpointing ✅ Done (v0.6.4)

- **Loaders: DocxLoader** — load Microsoft Word (.docx) files with python-docx (`pip install synapsekit[docx]`)
- **Loaders: MarkdownLoader** — load Markdown files with optional YAML frontmatter stripping (stdlib, no deps)
- **Retrieval: HyDERetriever** — Hypothetical Document Embeddings: generates a hypothetical answer with an LLM and uses it as the search query for improved retrieval
- **Tools: ShellTool** — async shell command execution with configurable timeout and allowed_commands whitelist
- **Tools: SQLSchemaInspectionTool** — inspect database schema (list_tables, describe_table) for SQLite and SQLAlchemy backends
- **LLM: FilesystemLLMCache** — persistent file-based LLM cache using JSON files on disk (`cache_backend="filesystem"`)
- **Graph: JSONFileCheckpointer** — file-based graph checkpointing using JSON files
- **Observability: COST_TABLE** — updated with GPT-4.1 family, o3/o4-mini, Gemini 2.5, DeepSeek, Groq-hosted models
- 13 providers, 19 tools, 14 loaders, 11 retrieval strategies, 3 cache backends, 3 checkpointers, 587 tests passing

## Phase 7.5 — Retrieval, Tools, Memory & Redis Cache ✅ Done (v0.6.5)

- **Retrieval: CohereReranker** — rerank results using the Cohere Rerank API (`pip install synapsekit[cohere]`)
- **Retrieval: StepBackRetriever** — generate a step-back question, retrieve in parallel for both, deduplicate
- **Retrieval: FLARERetriever** — Forward-Looking Active REtrieval: iterative generate/retrieve loop with `[SEARCH: ...]` markers
- **Tools: DuckDuckGoSearchTool** — extended DuckDuckGo search with text and news search types
- **Tools: PDFReaderTool** — read and extract text from PDF files with optional page selection
- **Tools: GraphQLTool** — execute GraphQL queries against any endpoint
- **Memory: TokenBufferMemory** — token-budget-aware memory that drops oldest messages (no LLM needed)
- **LLM: RedisLLMCache** — distributed Redis cache backend (`pip install synapsekit[redis]`)
- 13 providers, 22 tools, 14 loaders, 14 retrieval strategies, 4 cache backends, 6 memory backends, 642 tests passing

## Phase 7.6 — Providers, Retrieval, Tools & Memory ✅ Done (v0.6.6)

- **LLM: PerplexityLLM** — Perplexity AI with Sonar models, OpenAI-compatible
- **LLM: CerebrasLLM** — Cerebras ultra-fast inference, OpenAI-compatible
- **Retrieval: HybridSearchRetriever** — BM25 keyword matching + vector similarity via Reciprocal Rank Fusion (RRF)
- **Retrieval: SelfRAGRetriever** — self-reflective RAG: retrieve, grade relevance, generate, check support, retry if needed
- **Retrieval: AdaptiveRAGRetriever** — LLM classifies query complexity (simple/moderate/complex) and routes to different retrievers
- **Retrieval: MultiStepRetriever** — iterative retrieval-generation with automatic gap identification and follow-up queries
- **Tools: ArxivSearchTool** — search arXiv for academic papers via Atom API (stdlib only, no deps)
- **Tools: TavilySearchTool** — AI-optimized web search via Tavily API (`pip install synapsekit[tavily]`)
- **Memory: BufferMemory** — simplest unbounded buffer, keeps all messages until cleared
- **Memory: EntityMemory** — LLM-based entity extraction with running descriptions and eviction policy
- 15 providers, 24 tools, 14 loaders, 18 retrieval strategies, 4 cache backends, 8 memory backends, 698 tests passing

## Phase 7.8 — Tools & Graph Routing ✅ Done (v0.6.9)

- **Tools: SlackTool** — send messages via Slack webhook or bot token (stdlib only, no deps)
- **Tools: JiraTool** — Jira REST API v2: search, get, create issues, add comments (stdlib only)
- **Tools: BraveSearchTool** — web search via Brave Search API (stdlib only)
- **Graph: approval_node()** — gate graph execution on human approval; raises `GraphInterrupt` when state key is falsy; dynamic messages via callable
- **Graph: dynamic_route_node()** — route to different compiled subgraphs at runtime based on routing function; sync/async, input/output mapping
- 15 providers, 32 tools, 14 loaders, 18 retrieval strategies, 4 cache backends, 8 memory backends, 795 tests passing

## Phase 8 — Evaluation & Multi-modal 🔜

- Multi-modal support (image inputs for vision models)
- `Evaluator` — faithfulness, relevancy, groundedness
- RAGAS-style metrics
- Conversation branching and tree-of-thought

## Phase 9 — Platform 🔜

- Local observability UI (LangSmith-style, open source)
- Streaming UI helpers — SSE + WebSocket for FastAPI
- `synapsekit serve` — deploy any app as FastAPI in one command
- Prompt hub — versioned prompt registry
- Plugin system for community extensions
