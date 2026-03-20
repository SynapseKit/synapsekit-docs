---
sidebar_position: 98
---

# Changelog

All notable changes to SynapseKit are documented here.

---

## v1.2.0 — Serve, Cost Intelligence & Eval CLI

**CLI**
- `synapsekit serve` — deploy any RAG/Agent/Graph app as a FastAPI server in one command with auto-detection, health checks, and OpenAPI docs (`pip install synapsekit[serve]`)
- `synapsekit test` — discover and run `@eval_case`-decorated evaluation suites with threshold enforcement and CI-friendly exit codes

**Cost Intelligence**
- `CostTracker` — hierarchical cost attribution with scope context manager, auto-calculated costs from built-in COST_TABLE
- `BudgetGuard` — per-request/per-user/daily spending limits with circuit breaker pattern (CLOSED → OPEN → HALF_OPEN → CLOSED)
- `BudgetLimit`, `BudgetExceeded`, `CircuitState` — supporting types for budget enforcement

**Evaluation**
- `@eval_case` decorator — define evaluation test cases with `min_score`, `max_cost_usd`, `max_latency_ms`, and `tags`
- `EvalCaseMeta` — metadata dataclass attached to decorated functions

**Prompts**
- `PromptHub` — local filesystem versioned prompt registry with push/pull/list/versions (`~/.synapsekit/prompts/`)

**Plugins**
- `PluginRegistry` — discover and load community plugins via `synapsekit.plugins` entry point group

**Graph Checkpointers**
- `RedisCheckpointer` — Redis-backed graph checkpoint persistence with optional TTL (`pip install synapsekit[redis]`)
- `PostgresCheckpointer` — PostgreSQL-backed graph checkpoint persistence with UPSERT and JSONB state (`pip install synapsekit[postgres]`)

**Stats:** 1127 tests, 16 LLM providers, 20 retrieval strategies, 6 text splitters, 9 memory backends, 5 checkpointers

---

## v1.1.0 — GraphRAG, Redis Memory, Vertex AI, MarkdownSplitter, Graph Visualization

**Retrieval**
- `GraphRAGRetriever` — entity-based graph traversal merged with vector retrieval for knowledge-graph-augmented RAG
- `KnowledgeGraph` — in-memory graph store with triples, BFS traversal, and LLM-powered entity extraction

**Memory**
- `RedisConversationMemory` — persistent conversation memory backed by Redis with windowing support (`pip install synapsekit[redis]`)

**LLM Providers**
- `VertexAILLM` — Google Vertex AI with Application Default Credentials, streaming, and native function calling (`pip install synapsekit[vertex]`)

**Text Splitters**
- `MarkdownTextSplitter` — header-aware chunking that preserves parent header context, with recursive fallback for oversized sections

**Graph Visualization**
- `GraphVisualizer` — ASCII timeline rendering, Mermaid trace highlighting, step-by-step replay, and standalone HTML export
- `get_mermaid_with_trace()` — Mermaid flowcharts with CSS classes for completed/errored/skipped nodes

**Stats:** 1047 tests, 16 LLM providers, 20 retrieval strategies, 6 text splitters, 9 memory backends

---

## v1.0.0 — Multimodal + Image Loader + API Markers

**Multimodal**
- `ImageContent` — image payloads with `from_file()`, `from_url()`, `from_base64()`, `to_openai_format()`, `to_anthropic_format()`
- `AudioContent` — audio payloads with `from_file()`, `from_base64()`
- `MultimodalMessage` — compose text + images + audio with `to_openai_messages()`, `to_anthropic_messages()`
- `ImageLoader` — sync `load()` and `async_load()` with optional vision LLM description

**API Markers**
- `@public_api` — mark stable public API surfaces
- `@experimental` — mark experimental features
- `@deprecated(reason, alternative)` — mark deprecated features with migration guidance

---

## v0.9.0 — A2A + Guardrails + Distributed Tracing

**Agent-to-Agent (A2A) Protocol**
- `A2AClient` — call remote agents via the A2A protocol
- `A2AServer` — expose agents as A2A-compatible endpoints
- `AgentCard` — agent metadata for discovery
- `A2ATask`, `A2AMessage`, `TaskState` — task lifecycle management

**Guardrails**
- `ContentFilter` — block harmful or inappropriate content
- `PIIDetector` — detect and redact personally identifiable information
- `TopicRestrictor` — restrict agent conversations to allowed topics
- `Guardrails` — compose multiple guardrail checks into a pipeline

**Distributed Tracing**
- `DistributedTracer` — trace requests across multiple services/agents
- `TraceSpan` — individual span in a distributed trace

---

## v0.8.0 — Evaluation + Observability

**Evaluation**
- `FaithfulnessMetric` — measure whether answers are faithful to source documents
- `RelevancyMetric` — measure answer relevancy to the question
- `GroundednessMetric` — measure how well answers are grounded in retrieved context
- `EvaluationPipeline` — run multiple metrics over a dataset
- `EvaluationResult` — structured results with per-metric scores and `mean_score`

**Observability**
- `OTelExporter` — export traces in OpenTelemetry format
- `Span` — individual trace span with timing and metadata
- `TracingMiddleware` — auto-trace LLM calls with zero code changes
- `TracingUI` — HTML dashboard for viewing traces

---

## v0.7.0 — MCP + Multi-Agent

**MCP (Model Context Protocol)**
- `MCPClient` — connect to MCP servers via `connect_stdio()` or `connect_sse()`
- `MCPToolAdapter` — wrap MCP tools as `BaseTool` instances for use with any agent
- `MCPServer` — expose your SynapseKit tools as an MCP-compatible server

**Multi-Agent: Supervisor/Worker**
- `SupervisorAgent` — orchestrates worker agents, routes tasks using DELEGATE/FINAL protocol
- `WorkerAgent` — specialized agent that reports results back to the supervisor

**Multi-Agent: Handoffs**
- `HandoffChain` — chain of agents with condition-based handoffs
- `Handoff` — defines a condition and target agent for automatic transfer

**Multi-Agent: Crew**
- `Crew` — role-based team of agents that execute tasks sequentially or in parallel
- `CrewAgent` — agent with a defined role, goal, and backstory
- `Task` — unit of work assigned to a crew agent

---

## v0.6.9 — Tools & Graph Routing

**Tools (3 new)**
- `SlackTool` — send messages via Slack webhook URL or Web API bot token (stdlib only, no deps)
- `JiraTool` — Jira REST API v2: search issues (JQL), get issue, create issue, add comment (stdlib only)
- `BraveSearchTool` — web search via Brave Search API (stdlib only)

**Graph Workflows (2 new)**
- `approval_node()` — factory returning a node that gates on human approval; raises `GraphInterrupt` when `state[key]` is falsy; supports dynamic messages via callable
- `dynamic_route_node()` — factory returning a node that routes to different compiled subgraphs based on a routing function; supports sync/async routing and input/output mapping

**Closes:** #199, #218, #234, #243, #247

**Stats:** 795 tests, 15 providers, 32 tools, 14 loaders, 18 retrieval strategies, 4 cache backends, 8 memory backends

---

## v0.6.8 — Tools, Execution Trace & WebSocket Streaming

**Tools (5 new)**
- `VectorSearchTool` — wraps a `Retriever` so agents can search a knowledge base (no extra deps)
- `PubMedSearchTool` — search PubMed for biomedical literature via E-utilities API (stdlib only, no deps)
- `GitHubAPITool` — interact with GitHub REST API: search repos, get repo info, search issues, get issue details (stdlib only)
- `EmailTool` — send emails via SMTP with STARTTLS (stdlib `smtplib` + `email`, config via env vars)
- `YouTubeSearchTool` — search YouTube for videos (`pip install synapsekit[youtube]`)

**Graph Workflows (2 new)**
- `ExecutionTrace` + `TraceEntry` — structured execution tracing that hooks into `EventHooks` with timestamps, durations, and JSON-serializable output
- `ws_stream()` — stream graph execution events over WebSocket connections (works with any object with `send_text()` or `send()`)
- `GraphEvent.to_ws()` — format events as JSON strings for WebSocket transmission

**Closes:** #217, #219, #220, #229, #231, #239, #241

**Stats:** 743 tests, 15 providers, 29 tools, 14 loaders, 18 retrieval strategies, 4 cache backends, 8 memory backends

---

## v0.6.6 — Providers, Retrieval, Tools & Memory

**LLM Providers (2 new)**
- `PerplexityLLM` — Perplexity AI with Sonar models, OpenAI-compatible (`pip install synapsekit[openai]`)
- `CerebrasLLM` — Cerebras ultra-fast inference, OpenAI-compatible (`pip install synapsekit[openai]`)

**Retrieval (4 new strategies)**
- `HybridSearchRetriever` — combines BM25 keyword matching with vector similarity using Reciprocal Rank Fusion
- `SelfRAGRetriever` — self-reflective RAG: retrieve → grade relevance → generate → check support → retry
- `AdaptiveRAGRetriever` — LLM classifies query complexity and routes to different retrieval strategies
- `MultiStepRetriever` — iterative retrieval-generation with gap identification and follow-up queries

**Tools (2 new)**
- `ArxivSearchTool` — search arXiv for academic papers via the Atom API (stdlib only, no deps)
- `TavilySearchTool` — AI-optimized web search via Tavily API (`pip install synapsekit[tavily]`)

**Memory (2 new)**
- `BufferMemory` — simplest unbounded buffer, keeps all messages until cleared (no LLM, no trimming)
- `EntityMemory` — LLM-based entity extraction with running descriptions and eviction policy

**Stats:** 698 tests, 15 providers, 24 tools, 14 loaders, 18 retrieval strategies, 4 cache backends, 8 memory backends

---

## v0.6.5 — Retrieval, Tools, Memory & Redis Cache

**Retrieval (3 new strategies)**
- `CohereReranker` — rerank retrieval results using the Cohere Rerank API (`pip install synapsekit[cohere]`)
- `StepBackRetriever` — generates a more abstract "step-back" question, retrieves for both original and step-back in parallel, deduplicates
- `FLARERetriever` — Forward-Looking Active REtrieval: iterative generate/retrieve loop with `[SEARCH: ...]` markers

**Tools (3 new)**
- `DuckDuckGoSearchTool` — extended DuckDuckGo search with text and news search types (`pip install synapsekit[search]`)
- `PDFReaderTool` — read and extract text from PDF files with optional page selection (`pip install synapsekit[pdf]`)
- `GraphQLTool` — execute GraphQL queries against any endpoint (`pip install synapsekit[http]`)

**Memory (1 new)**
- `TokenBufferMemory` — token-budget-aware memory that drops oldest messages when over limit (no LLM needed)

**LLM Caching (1 new backend)**
- `RedisLLMCache` — distributed Redis cache backend (`pip install synapsekit[redis]`)

**Stats:** 642 tests, 13 providers, 22 tools, 14 loaders, 14 retrieval strategies, 4 cache backends, 6 memory backends

---

## v0.6.4 — Loaders, HyDE, Tools, Caching & Checkpointing

**Loaders (2 new)**
- `DocxLoader` — load Microsoft Word (.docx) files (`pip install synapsekit[docx]`)
- `MarkdownLoader` — load Markdown files with optional YAML frontmatter stripping (stdlib, no deps)

**Retrieval (1 new strategy)**
- `HyDERetriever` — Hypothetical Document Embeddings: generates a hypothetical answer with an LLM and uses it as the search query for improved retrieval

**Tools (2 new)**
- `ShellTool` — async shell command execution with configurable timeout and allowed_commands whitelist
- `SQLSchemaInspectionTool` — inspect database schema (list_tables, describe_table) for SQLite and SQLAlchemy backends

**LLM Caching (1 new backend)**
- `FilesystemLLMCache` — persistent file-based cache using JSON files on disk (`cache_backend="filesystem"`)

**Graph (1 new checkpointer)**
- `JSONFileCheckpointer` — file-based graph checkpointing using JSON files

**Observability**
- `COST_TABLE` updated with GPT-4.1 family, o3/o3-mini/o4-mini, Gemini 2.5 Pro/Flash, DeepSeek-V3/R1, Groq-hosted models

**Stats:** 587 tests, 13 providers, 19 tools, 14 loaders, 11 retrieval strategies, 3 cache backends, 3 checkpointers

---

## v0.6.3 — Typed State, Fan-Out, SSE Streaming & LLM Tools

**Graph Workflows**
- `TypedState` + `StateField` — typed state with per-field reducers for safe parallel merge
- `fan_out_node()` — run multiple subgraphs concurrently and merge results
- `sse_stream()` — stream graph execution as Server-Sent Events for HTTP responses
- `EventHooks` + `GraphEvent` — register callbacks on node_start, node_complete, wave_start, wave_complete

**LLM Caching**
- `SemanticCache` — similarity-based cache lookup using embeddings (configurable threshold)

**Tools (3 new, LLM-powered)**
- `SummarizationTool` — summarize text (concise, bullet points, or detailed styles)
- `SentimentAnalysisTool` — sentiment analysis with confidence and explanation
- `TranslationTool` — translate text between languages

**Stats:** 540 tests, 13 providers, 16 tools, 12 loaders, 10 retrieval strategies, 4 memory backends

---

## v0.6.2 — Retrieval Strategies, Memory & Tools

**Retrieval (4 new strategies)**
- `CRAGRetriever` — Corrective RAG: grades retrieved docs for relevance, rewrites query and retries when too few are relevant
- `QueryDecompositionRetriever` — breaks complex queries into sub-queries, retrieves for each, deduplicates
- `ContextualCompressionRetriever` — compresses retrieved documents to only relevant excerpts using an LLM
- `EnsembleRetriever` — fuses results from multiple retrievers using weighted Reciprocal Rank Fusion

**Memory (2 new backends)**
- `SQLiteConversationMemory` — persistent chat history in SQLite, multi-conversation support, optional sliding window
- `SummaryBufferMemory` — token-budget-aware memory that progressively summarizes older messages

**Tools (2 new)**
- `HumanInputTool` — pauses agent execution to ask the user a question (custom sync/async input functions)
- `WikipediaTool` — searches and fetches Wikipedia article summaries via REST API, no extra deps

**Stats:** 512 tests, 13 providers, 13 tools, 12 loaders, 10 retrieval strategies, 4 memory backends

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

**Stats:** 482 tests, 13 providers, 11 tools, 12 loaders, 6 retrieval strategies, 2 memory backends

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
