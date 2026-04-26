---
sidebar_position: 98
---

# Changelog

All notable changes to SynapseKit are documented here.

---

## v1.6.0 — 11 new vector stores, 9 loaders, SwarmAgent, RAPTOR RAG, PluginRegistry, ReplicateLLM

**Released:** 2026-04-26

### Added — Vector Stores (11 new, 22 total)

- **`VespaVectorStore`** — Vespa.ai vector search with BM25+ANN hybrid; `pip install synapsekit[vespa]`
- **`RedisVectorStore`** — Redis Stack vector similarity search via RediSearch module; `pip install synapsekit[redis]`
- **`ElasticsearchVectorStore`** — Elasticsearch dense_vector kNN search; `pip install synapsekit[elasticsearch]`
- **`OpenSearchVectorStore`** — OpenSearch kNN plugin with HNSW and IVF index support; `pip install synapsekit[opensearch]`
- **`SupabaseVectorStore`** — Supabase pgvector backend via the Supabase Python client; `pip install synapsekit[supabase]`
- **`TypesenseVectorStore`** — Typesense hybrid vector + keyword search; `pip install synapsekit[typesense]`
- **`MarqoVectorStore`** — Marqo multimodal search with built-in embedding; `pip install synapsekit[marqo]`
- **`ZillizVectorStore`** — Zilliz Cloud (managed Milvus) dedicated vector store class; `pip install synapsekit[milvus]`
- **`DuckDBVectorStore`** — in-process analytical vector store backed by DuckDB; `pip install synapsekit[duckdb-vector]`
- **`ClickHouseVectorStore`** — ClickHouse cosine/L2 vector search for high-throughput workloads; `pip install synapsekit[clickhouse]`
- **`CassandraVectorStore`** — Apache Cassandra / DataStax Astra DB SAI vector index; `pip install synapsekit[cassandra]`

### Added — Document Loaders (9 new, 64 total)

- **`FirestoreLoader`** — load documents from a Google Firestore collection; `pip install synapsekit[firestore]`
- **`ZendeskLoader`** — load Zendesk tickets via the Support API; `pip install synapsekit[zendesk]`
- **`IntercomLoader`** — load Intercom conversations via the REST API; `pip install synapsekit[intercom]`
- **`FreshdeskLoader`** — load Freshdesk tickets via the v2 API; `pip install synapsekit[freshdesk]`
- **`HackerNewsLoader`** — load HN stories and comments via the Firebase API; no extra deps
- **`RedditLoader`** — load Reddit posts and comments via PRAW; `pip install synapsekit[reddit]`
- **`TwitterLoader`** — load tweets via the Twitter API v2; `pip install synapsekit[twitter]`
- **`GoogleCalendarLoader`** — load calendar events via Google Calendar API v3; `pip install synapsekit[gcal]`
- **`TrelloLoader`** — load Trello cards and boards via the REST API; `pip install synapsekit[trello]`

### Added — Retrieval Strategies (4 new)

- **`RAPTORRetriever`** — recursive abstractive processing: cluster → summarize → embed → multi-level retrieval for long-document tasks
- **`AgenticRAGRetriever`** — LLM agent controls the retrieval loop; decides when to search, what to fetch, and when to stop
- **`DocumentAugmentationRetriever`** — augments each document with LLM-generated questions before embedding for higher recall
- **`LateChunkingRetriever`** — embeds full documents first, then chunks from the contextual embedding space

### Added — Memory Backends (3 new)

- **`VectorMemory`** — stores conversation turns as embeddings for semantic retrieval of past context
- **`KnowledgeGraphMemory`** — extracts entities and relationships from messages into a knowledge graph; retrieves by entity match
- **`ReadonlySharedMemory`** — read-only view of another memory instance, safe to share across concurrent agents

### Added — Agents / Triggers

- **`SwarmAgent`** — lightweight multi-agent swarm coordination: agents hand off tasks using tool calls with shared context
- **`EventTrigger`** — trigger graph or agent execution from an external event source (webhook, queue, file watch)
- **`StreamTrigger`** — trigger execution on each item from an async generator or data stream

### Added — LLM Provider

- **`ReplicateLLM`** — run any Replicate-hosted model (Llama, Mistral, SDXL, etc.) via the Replicate REST API; `pip install synapsekit[replicate]`

### Added — Graph

- **`TimedResumeGraph`** — compiled graph that can suspend itself and automatically resume after a specified delay (e.g. for scheduled retry workflows)

### Added — Plugin System

- **`PluginRegistry`** — discover and load community plugins via `synapsekit.plugins` entry-point group; `register()`, `get()`, `list_plugins()`
- **`BasePlugin`** — base class for third-party SynapseKit plugins; defines `name`, `version`, and `setup()`

### Also included — v1.5.7 batch (previously unreleased)

- **`VoiceAgent`** — end-to-end voice pipeline: audio in → STT → agent → TTS → audio out
- **`AgentMemory`** — persistent episodic + semantic memory; 4 backends: SQLite, Redis, Postgres, in-memory
- **`BrowserTool`** — Playwright-based browser automation tool; domain allow/block lists; `pip install synapsekit[browser]`
- **`MongoDBAtlasVectorStore`** — Atlas Vector Search backend; `pip install synapsekit[mongodb]`
- **`CronTrigger`** — cron-expression-based graph/agent scheduler
- **`SimpleAgent`** + **`agent()` factory** — zero-boilerplate one-liner agent construction
- **Auto-eval metrics** — `CoherenceMetric`, `CompletenessMetric`, `HallucinationMetric` run automatically in eval suites
- **`YouTubeLoader`** — load transcripts from YouTube videos via `youtube-transcript-api`; `pip install synapsekit[youtube]`
- **`ObsidianLoader`** — load an Obsidian vault directory; resolves `[[wikilinks]]` and YAML frontmatter
- **`AirtableLoader`** — load Airtable base records via the REST API; `pip install synapsekit[airtable]`
- **`SitemapLoader`** — crawl a sitemap XML and load all linked pages; `pip install synapsekit[web]`
- **`HubSpotLoader`** — load HubSpot contacts, companies, and deals; `pip install synapsekit[hubspot]`
- **`SalesforceLoader`** — load Salesforce objects via SOQL queries; `pip install synapsekit[salesforce]`
- **`BigQueryLoader`** — load rows from a Google BigQuery table or query; `pip install synapsekit[bigquery]`
- **`ImageGenerationTool`** — generate images via DALL-E 3 or Stable Diffusion; `pip install synapsekit[openai]`
- **`PubMedLoader`** — load PubMed abstracts and metadata by PMID list or text search; no extra deps
- **`SnowflakeLoader`** — load rows from Snowflake via a SQL query; `pip install synapsekit[snowflake]`
- **Visual Graph Builder** — `synapsekit graph-builder` CLI command launches an interactive graph construction UI
- **Agent Benchmarking Suite** — `synapsekit benchmark agents` runs standard multi-step reasoning benchmarks
- **12 performance fixes** — async connection pooling, embedding batch sizing, reduced lock contention in checkpointers

**Stats:** 34 LLM providers · 64 loaders · 22 vector stores · 48+ tools

---

## v1.5.6 — GPT4All, vLLM, SQLiteVecStore, 4 new loaders, bug fixes

**Released:** 2026-04-16

### Added

- **`GPT4AllLLM`** — local model provider via GPT4All Python bindings; no API key; streaming via callback shim wrapped in `run_in_executor`; `pip install synapsekit[gpt4all]`
- **`VLLMLlm`** — high-throughput local/self-hosted inference via vLLM's OpenAI-compatible API; `pip install synapsekit[vllm]`
- **`SQLiteVecStore`** — zero-infra vector store backed by `sqlite-vec`; local SQLite file persistence; drop-in for `InMemoryVectorStore`; `pip install synapsekit[sqlite-vec]`
- **`ParquetLoader`** — load Parquet files as Documents; configurable `text_column`; `pip install synapsekit[parquet]`
- **`RedisLoader`** — load key/value pairs from Redis; supports string, hash, and JSON value types; `pip install synapsekit[redis]`
- **`ElasticsearchLoader`** — load documents from an Elasticsearch index; search and scan modes; `pip install synapsekit[elasticsearch]`
- **`DynamoDBLoader`** — load items from AWS DynamoDB; scan and query modes with auto-pagination; `pip install synapsekit[dynamodb]`
- **Production-grade test suite** — preflight, E2E, behavioral, and API endpoint tests; 120 new tests; zero API calls

### Fixed

- **Stream disconnect race condition** — client disconnects during streaming now terminate cleanly
- **Summary buffer memory corruption** — fixed mutation of buffer before summarisation LLM call completed

---

## v1.5.5 — LM Studio, 10 new loaders, EvalDataset, FineTuner, recursive subgraphs, MCPServer SSE

**Released:** 2026-04-13

### Added

- **`LMStudioLLM`** — local model provider via LM Studio's OpenAI-compatible API; connects to a running LM Studio server (default `http://localhost:1234/v1`); supports streaming, tool calling, and custom `base_url` via constructor kwarg; no API key required; `pip install synapsekit[lmstudio]`
- **`S3Loader`** — load files from Amazon S3 buckets; supports text, binary fallback, and rich extraction (PDF, DOCX, XLSX, PPTX, CSV, JSON, HTML); prefix/extension filtering, `max_files`; credential chain (explicit keys, session tokens, or ambient IAM role); `pip install synapsekit[s3]`
- **`AzureBlobLoader`** — load blobs from Azure Blob Storage; connection-string and account URL + credential auth; same extraction chain as S3Loader; `pip install synapsekit[azure]`
- **`MongoDBLoader`** — load documents from a MongoDB collection; configurable `text_fields` and `metadata_fields`; optional `query_filter`; `pip install synapsekit[mongodb]`
- **`DropboxLoader`** — load files from a Dropbox folder; 20+ text/code extensions; pagination via cursor; `pip install synapsekit[dropbox]`
- **`OneDriveLoader`** — load files from OneDrive and SharePoint via Microsoft Graph API; folder traversal with optional recursion; extension filtering; no external SDK required
- **`ConfigLoader`** — load `.env`, `.ini`, `.cfg`, `.toml`, and environment-specific dotfiles (`.env.local`, `.env.staging`, `.env.production`) into Documents; redacts sensitive keys automatically
- **`RTFLoader`** — load RTF files as plain text via `striprtf`; default encoding `latin-1` for real-world Office files; `pip install synapsekit[rtf]`
- **`EPUBLoader`** — load EPUB files chapter-by-chapter; extracts title, author, and chapter name into metadata; `pip install synapsekit[epub]`
- **`LaTeXLoader`** — load `.tex` files as plain text; strips commands, environments, math, and comments; no external deps required
- **`TSVLoader`** — load tab-separated files one Document per row; configurable `text_column`; remaining columns become metadata
- **`EvalDataset` / `EvalRecord`** — filterable, exportable collection of eval result records; `export()` writes fine-tuning datasets in OpenAI, Anthropic, Together, JSONL, and DPO pair formats; `from_snapshot()` loads from existing EvalCI snapshots
- **`FineTuner`** — orchestrates fine-tuning jobs against OpenAI and Together AI; `submit()`, `status()`, `wait()` (polls until terminal state)
- **`@eval_case(capture_io=True)`** — opt-in capture of `input`, `output`, and `ideal` fields; required for `EvalDataset.export()`
- **`synapsekit eval` CLI** — `report`, `export`, `compare` subcommands for eval snapshots
- **`synapsekit finetune` CLI** — `submit`, `status`, `wait` subcommands for fine-tuning jobs
- **Recursive subgraph support** — pass a `StateGraph` to `subgraph_node()` for self-referential / recursive workflows; `max_recursion_depth` guard (default 10); `RecursionDepthError` on limit breach
- **`MCPServer` SSE transport** — `run_sse(host, port, api_key)` for HTTP/SSE MCP serving with optional Bearer auth; `MCPServer` package refactored to `synapsekit.mcp.server`

### Fixed

- **`LMStudioLLM` `base_url`** — `LLMConfig` has no `base_url` field; passing it via `LLMConfig(base_url=...)` raised `TypeError`. Fixed by adding `base_url: str | None = None` as a keyword argument to `LMStudioLLM.__init__` directly
- **`LMStudioLLM` stream stability** — removed `stream_options={"include_usage": True}` which caused API errors on older LM Studio builds; usage tracking now reads `chunk.usage` defensively via `getattr`
- **`ConfigLoader` rejects `.env.local` / `.env.staging`** — `os.path.splitext(".env.local")` returns `('.env', '.local')` making `ext = '.local'` which raised `ValueError`. Fixed by detecting any filename starting with `.env` and treating it as env format
- **`RTFLoader` default encoding** — changed default from `"utf-8"` to `"latin-1"` since real-world RTF files from Office/WordPad are Windows-encoded

**Stats:** 2041 tests · 31 LLM providers · 48 tools · 43 loaders

---

## v1.5.3 — TeamsLoader, CodeInterpreterTool, Windows ShellTool fix

**Released:** 2026-04-11

### Added

- **`TeamsLoader`** — load messages from Microsoft Teams channels via the Microsoft Graph API; automatic pagination; HTML-to-plain-text conversion; exponential backoff retry for 429 and 5xx responses; `pip install synapsekit[teams]`
- **`CodeInterpreterTool`** — execute Python code in an isolated subprocess; captures stdout, stderr, generated files, matplotlib plot artifacts, and pandas dataframe reprs; configurable timeout (default 5s) and memory limit (default 256 MB); workspace isolation via `tempfile.TemporaryDirectory`; structured JSON output

### Fixed

- **`ShellTool` Windows compatibility** — use `asyncio.create_subprocess_shell()` on Windows so shell builtins (`echo`, `dir`, etc.) work correctly; keep `create_subprocess_exec()` on Unix

**Stats:** 1950 tests · 30 LLM providers · 46 tools · 33 loaders

---

## v1.5.2 — Async eval_case bug fix

**Released:** 2026-04-09

### Fixed

- **`@eval_case` async functions** — the decorator wrapped async functions in a sync `wrapper`, causing `inspect.iscoroutinefunction()` to return `False`; the CLI skipped `asyncio.run()` and passed the raw coroutine to `float()`, raising `TypeError: float() argument must be a string or a real number, not 'coroutine'`. Fixed by adding an `async_wrapper` branch for async eval case functions.

**Upgrade:** `pip install --upgrade synapsekit` or pin `synapsekit-version: "1.5.2"` in your EvalCI workflow.

**Stats:** 1752 tests · 30 LLM providers · 46 tools · 33 loaders · 9 text splitters · 9 vector store backends

---

## v1.5.1 — Security hardening

**Released:** 2026-04-09

### Security

- **SQL injection** — `SQLSchemaInspectionTool` now validates table names against `^[A-Za-z0-9_]+$` before PRAGMA interpolation
- **Shell injection** — `ShellTool` switched from `create_subprocess_shell` to `create_subprocess_exec` + `shlex.split()`; allowlist enforced on `argv[0]`
- **Path traversal** — `FileReadTool` and `FileWriteTool` accept optional `base_dir`; all paths resolved and checked before I/O
- **TOCTOU** — replaced `tempfile.mktemp()` with `NamedTemporaryFile(delete=False)` in `VideoLoader`
- **SSRF** — `WebLoader` and `WebScraperTool` validate URL scheme and block private/internal IP ranges
- **ReDoS** — `WebScraperTool` limits CSS selector to 200 characters

### Added

- **`GitLoader`** — load files from any Git repository (local path or remote URL) at a specific revision; glob pattern filtering; metadata includes path, commit hash, author, date; sync `load()` and async `aload()`; `pip install synapsekit[git]`
- **`GoogleSheetsLoader`** — load rows from a Google Sheets spreadsheet as Documents; service account auth via credentials file; auto-detects first sheet if none specified; header-based row-to-text formatting; sync `load()` and async `aload()`; `pip install synapsekit[gsheets]`
- **`JiraLoader`** — load Jira issues via JQL queries; full Atlassian Document Format (ADF) parsing; pagination; rate-limit retry; async `aload()` via httpx; optional `limit`; `pip install synapsekit[jira]`
- **`SupabaseLoader`** — load rows from a Supabase table as Documents; configurable text/metadata columns; env var auth (`SUPABASE_URL`, `SUPABASE_KEY`); sync `load()` and async `aload()`; `pip install synapsekit[supabase]`

**Stats:** 1752 tests · 30 LLM providers · 46 tools · 33 loaders · 9 text splitters · 9 vector store backends

---

## v1.5.0 — New Loaders, Tools & Providers

**Released:** 2026-04-07

### Added
- **`ConfluenceLoader`** — load pages from Atlassian Confluence as Documents; single page by `page_id` or full space by `space_key`; automatic pagination; HTML→text via BeautifulSoup; retry with exponential back-off on rate limits; sync `load()` and async `aload()`; `pip install synapsekit[confluence]`
- **`RSSLoader`** — load articles from RSS/Atom feeds as Documents; content/summary fallback; metadata includes title, published, link, author; async `aload()`; `pip install synapsekit[rss]`
- **`SentenceTextSplitter`** — split text into chunks by grouping complete sentences; `chunk_size` and `chunk_overlap` in sentences (not characters); regex-based sentence boundary detection
- **`CodeSplitter`** — split source code using language-aware separators; supports Python, JavaScript, TypeScript, Go, Rust, Java, C++; preserves logical structures (classes, functions); falls back to recursive character splitting
- **`SentenceWindowSplitter`** — one chunk per sentence, padded with up to `window_size` surrounding sentences; `split_with_metadata()` adds `target_sentence` to each chunk's metadata; useful for retrieval systems that embed with context but score by target sentence
- **`TwilioTool`** — send SMS and WhatsApp messages via the Twilio REST API; stdlib `urllib` only, no extra deps; auth via constructor args or env vars; automatic `whatsapp:` prefix handling for both sender and recipient; security warning logged on instantiation
- **`NewsTool`** — fetch top headlines and search articles via NewsAPI; actions: `get_headlines`, `search`; stdlib urllib only; auth via constructor arg or `NEWS_API_KEY` env var
- **`WeatherTool`** — get current weather and short-term forecasts via OpenWeatherMap; actions: `current`, `forecast` (1–5 day); async-safe with `run_in_executor`; auth via `OPENWEATHERMAP_API_KEY`
- **`StripeTool`** — read-only Stripe data lookup: `get_customer`, `list_invoices`, `get_charge`, `list_products`; stdlib urllib only; auth via `STRIPE_API_KEY`; async-safe with `run_in_executor`
- **`LinearTool`** — manage Linear issues via the Linear GraphQL API; actions: `list_issues`, `get_issue`, `create_issue`, `update_issue`; stdlib urllib only, no extra deps; auth via constructor arg or `LINEAR_API_KEY`
- **`XaiLLM`** — xAI Grok LLM provider; OpenAI-compatible API; supports `grok-beta`, `grok-2`, `grok-2-mini`; streaming and tool calling; `pip install synapsekit[openai]`
- **`NovitaLLM`** — NovitaAI LLM provider; OpenAI-compatible API; supports Llama, Mistral, Qwen, and other open models; streaming and tool calling; `pip install synapsekit[openai]`
- **`WriterLLM`** — Writer (Palmyra) LLM provider; OpenAI-compatible API; supports `palmyra-x-004`, `palmyra-x-003-instruct`, `palmyra-med`, `palmyra-fin`; streaming and tool calling; `pip install synapsekit[openai]`
- **`HTMLTextSplitter`** — split HTML documents on block-level tags (h1–h6, p, div, section, article, li, blockquote, pre); strips tags to plain text; falls back to `RecursiveCharacterTextSplitter` for long sections; stdlib `html.parser` only
- **`GCSLoader`** — load files from Google Cloud Storage buckets as Documents; service account auth (file path or dict) or default credentials; prefix filtering, `max_files` limit, binary file handling; sync `load()` and async `aload()`; `pip install synapsekit[gcs]`
- **`SQLLoader`** — load rows from any SQLAlchemy-supported database (PostgreSQL, MySQL, SQLite, etc.) as Documents; configurable text/metadata columns; full SQL query support; sync `load()` and async `aload()`; `pip install synapsekit[sql]`
- **`GitHubLoader`** — load README, issues, pull requests, or repository files from GitHub via the REST API; retry with exponential back-off for rate limits and 5xx; optional token auth for higher rate limits; path filtering and limit for files; uses existing `httpx` dep; sync `load_sync()` and async `load()`

**Stats:** 1715 tests · 30 LLM providers · 46 tools · 29 loaders · 9 text splitters · 9 vector store backends

---

## v1.4.8 — WikipediaLoader, ArXivLoader, EmailLoader, ColBERT retriever

**Released:** 2026-04-03

### Added
- **`WikipediaLoader`** — load Wikipedia articles as Documents; single title or pipe-delimited multi-title; async `aload()`; `pip install synapsekit[wikipedia]`
- **`ArXivLoader`** — search arXiv and load papers as Documents; downloads PDFs and extracts text; async `aload()`; `pip install synapsekit[arxiv,pdf]`
- **`EmailLoader`** — load emails from IMAP mailboxes (Gmail, Outlook, etc.); stdlib-only, no extra deps; configurable search filters; async `aload()`
- **`ColBERTRetriever`** — late-interaction ColBERT retrieval via RAGatouille; `add()`, `retrieve()`, `retrieve_with_scores()`; `pip install synapsekit[colbert]`

**Stats:** 1500 tests · 27 LLM providers · 42 tools · 24 loaders · 9 vector store backends

---

## v1.4.7 — SlackLoader, NotionLoader, NotionTool

**Released:** 2026-04-02

### Added
- **`SlackLoader`** — load messages from Slack channels via Bot API; sync `load()` and async `aload()`; configurable `limit`; per-message metadata (user, timestamp, thread); `pip install synapsekit[slack]`
- **`NotionLoader`** — load pages or full databases from Notion via the Notion API; sync `load()` and async `aload()`; configurable retry/timeout; metadata includes page URL and title; `pip install synapsekit[notion]`
- **`NotionTool`** — agent tool for Notion: `search`, `get_page`, `create_page`, `append_block`; built-in retry with exponential back-off and jitter; `pip install synapsekit[notion]`

**Stats:** 1450 tests · 27 LLM providers · 42 tools · 20 loaders · 9 vector store backends

---

## v1.4.6 — Subgraph Error Handling

**Released:** 2026-04-01

### Added
- **`subgraph_node` error strategies** — four keyword-only parameters on `subgraph_node()`:
  - `on_error="raise"` (default) — re-raise immediately, no overhead
  - `on_error="retry"` + `max_retries=N` — re-run up to N times before raising
  - `on_error="fallback"` + `fallback=CompiledGraph` — run an alternative graph on failure
  - `on_error="skip"` — continue the parent graph silently on failure
- **`__subgraph_error__`** — on any handled failure, the parent state receives `{"type": ..., "message": ..., "attempts": ...}`
- Fully backward-compatible: existing `subgraph_node()` calls default to `on_error="raise"` with no behaviour change

**Stats:** 1450 tests · 27 LLM providers · 41 tools · 18 loaders · 9 vector store backends

---

## v1.4.5 — Weaviate, PGVector, Milvus, LanceDB Vector Store Backends

**Released:** 2026-03-31

### Added
- **WeaviateVectorStore** — Weaviate v4 client; lazy collection creation; cosine vector search via `query.near_vector`; metadata filtering; `pip install synapsekit[weaviate]`
- **PGVectorStore** — PostgreSQL + pgvector; async psycopg3 connection; cosine/L2/inner-product distance strategies; SQL-injection-safe via `psycopg.sql.Identifier`; metadata JSONB filtering; `pip install synapsekit[pgvector]`
- **MilvusVectorStore** — IVF_FLAT and HNSW index types; `MilvusIndexType` enum; metadata filtering via Milvus expressions; Zilliz Cloud support; `pip install synapsekit[milvus]`
- **LanceDBVectorStore** — embedded, no server required; local and cloud (S3/GCS) storage; automatic FTS index; metadata filtering; `pip install synapsekit[lancedb]`

All 4 new backends are included in `synapsekit[all]` and follow the existing lazy-import `_BACKENDS` pattern.

**Stats:** 1433 tests · 27 LLM providers · 41 tools · 18 loaders · 9 vector store backends

---

## v1.4.4 — SambaNova, GoogleDriveLoader, Metadata-Aware Splitters

**Released:** 2026-03-30

### Added
- **SambaNova provider** — fast inference on Meta Llama, Qwen, and other open models via OpenAI-compatible API; `pip install synapsekit[openai]`; always specify `provider="sambanova"` (model names have no unique prefix)
- **GoogleDriveLoader** — load files and folders from Google Drive via service account credentials; supports Google Docs (text export), Sheets (CSV export), PDFs, and text files; `pip install synapsekit[gdrive]`
- **`split_with_metadata()`** — new method on `BaseSplitter`; returns `list[dict]` with `text` and `metadata` keys; automatically adds `chunk_index`; all splitters inherit it

### Fixed
- `asyncio.get_event_loop()` → `asyncio.get_running_loop()` in `GoogleDriveLoader` (deprecated in Python 3.10+)
- `build()` in `GoogleDriveLoader.aload()` wrapped in executor (was blocking the event loop)
- Failed file downloads in `GoogleDriveLoader._load_folder` now log a warning instead of silently skipping

**Stats:** 1452 tests · 27 LLM providers · 41 tools · 18 loaders · 6 cache backends

---

## v1.4.3 — XMLLoader, DiscordLoader, PythonREPL Timeout, Graph & Windows Fixes

**Released:** 2026-03-29

### Added
- **XMLLoader** — load XML files via stdlib `xml.etree.ElementTree`; optional `tags` filter; no new dependencies
- **DiscordLoader** — load messages from Discord channels via bot API; `before_message_id`/`after_message_id` pagination; rich metadata; `pip install synapsekit[discord]`
- **PythonREPLTool timeout** — `timeout: float = 5.0` parameter; Unix uses `signal.SIGALRM`, Windows uses `multiprocessing.Process`; security warning logged on instantiation

### Improved
- **Mermaid conditional edges** — render as dashed arrows (`-.->`) to distinguish from deterministic edges; branch labels prefixed with condition function name (e.g. `route:approve`)
- **SQLiteCheckpointer** — supports `async with` for automatic connection cleanup
- **Windows compatibility** — `audio/x-wav` MIME normalised to `audio/wav`; shell timeout test uses portable Python sleep; graph tracer uses `time.perf_counter()` for sub-millisecond resolution on Windows

**Stats:** 1403 tests · 26 LLM providers · 41 tools · 17 loaders · 6 cache backends

---

## v1.4.2 — HuggingFace, Cache Backends, Graph Versioning

**Released:** 2026-03-28

### Added
- **HuggingFaceLLM** — Hugging Face Inference API via `AsyncInferenceClient`; serverless and Dedicated Endpoint support
- **DynamoDBCacheBackend** — serverless LLM caching on AWS DynamoDB with TTL (`pip install synapsekit[dynamodb]`)
- **MemcachedCacheBackend** — distributed LLM caching via aiomcache (`pip install synapsekit[memcached]`)
- **GoogleSearchTool** — Google web search via SerpAPI (`pip install synapsekit[google-search]`)
- **Graph versioning + checkpoint migration** — `StateGraph(version=, migrations={...})`; `CompiledGraph.resume()` applies migration chains; missing paths raise `GraphRuntimeError`

### Improved
- **SQLQueryTool** — parameterized queries via `params` dict; `max_rows` cap; security hardening

**Stats:** 1368 tests · 26 LLM providers · 41 tools · 15 loaders · 6 cache backends

---

## v1.4.1 — Community Providers, Tools & Examples

**Released:** 2026-03-27

### Added
- **MinimaxLLM** — Minimax API with SSE streaming; requires `group_id`; auto-detected from `minimax-*`
- **AlephAlphaLLM** — Aleph Alpha Luminous and Pharia models; auto-detected from `luminous-*`/`pharia-*`
- **BingSearchTool** — Bing Web Search API v7 with `Ocp-Apim-Subscription-Key` auth
- **WolframAlphaTool** — Wolfram Alpha short-answer API
- **YAMLLoader** — load YAML files into Documents; `yaml.safe_load()` based
- **`examples/`** — 5 runnable scripts (RAG quickstart, agent tools, graph workflow, multi-provider, caching & retries)

### Fixed
- Missing return type annotations in loader helper functions (`_loader_for`, `__getattr__`)

**Stats:** 1357 tests, 25 LLM providers, 40 tools, 15 loaders

---

## v1.4.0 — New Providers, Tools & Multimodal

**4 new LLM providers**
- `AI21LLM` — AI21 Jamba models (`jamba-1.5-mini`, `jamba-1.5-large`) with 256K context and native function calling
- `DatabricksLLM` — Databricks Foundation Model APIs (DBRX, Llama 3.1, Mixtral) via OpenAI-compatible endpoint; resolves workspace URL from `DATABRICKS_HOST`
- `ErnieLLM` — Baidu ERNIE Bot (`ernie-4.0`, `ernie-3.5`, `ernie-speed`, `ernie-lite`, `ernie-tiny-8k`) for Chinese-English tasks
- `LlamaCppLLM` — local GGUF models via llama-cpp-python with true async streaming; no API key required; GPU offload via `n_gpu_layers`

**6 new built-in tools**
- `APIBuilderTool` — build and execute API calls from OpenAPI specs or natural-language intent; optional LLM-assisted operation selection
- `GoogleCalendarTool` — create, list, delete Google Calendar events via Calendar API v3 (`pip install synapsekit[gcal-tool]`)
- `AWSLambdaTool` — invoke AWS Lambda functions with RequestResponse/Event/DryRun types (`pip install synapsekit[aws-lambda]`)
- `ImageAnalysisTool` — analyze images with any multimodal LLM; accepts local paths or public URLs
- `TextToSpeechTool` — convert text to speech audio via OpenAI TTS; 6 voices, 4 formats (`pip install synapsekit[openai]`)
- `SpeechToTextTool` — transcribe audio files via Whisper API or local Whisper model

**Auto-detection extended**

RAG facade now auto-detects `moonshot-*`, `glm-*`, `jamba-*`, `@cf/*`, `@hf/*`, `dbrx-*`/`databricks-*`, `ernie-*` model prefixes.

**Stats:** 1327 tests, 23 LLM providers, 38 built-in tools, 20 retrieval strategies, 9 memory backends

---

## v1.3.0 — Cost Routing, Compliance & Media Loaders

**Cost-Intelligent Routing**
- `CostRouter` — route to the cheapest model meeting a quality threshold, with automatic fallback on error
- `FallbackChain` — try models in priority order, cascade on error or short responses
- `QUALITY_TABLE` — built-in quality scores for 30+ models

**Compliance**
- `PIIRedactor` — reversible masking (`[EMAIL_1]`, `[PHONE_1]`) or permanent redaction with `wrap_generate()` for transparent LLM integration
- `AuditLog` — immutable, append-only compliance log with memory, SQLite, and JSONL backends

**Evaluation**
- `EvalRegression` — snapshot-based regression detection with configurable thresholds for score, cost, and latency
- `synapsekit test --save NAME` / `--compare BASELINE` / `--fail-on-regression` — CI gate for eval regressions

**Media Loaders**
- `AudioLoader` — transcribe audio files via Whisper API or local Whisper (`pip install synapsekit[audio]`)
- `VideoLoader` — extract audio from video via ffmpeg, then transcribe (`pip install synapsekit[video]`)

**Agents**
- `stream_steps()` on `ReActAgent` and `FunctionCallingAgent` — stream `ThoughtEvent`, `ActionEvent`, `ObservationEvent`, `TokenEvent`, `FinalAnswerEvent` in real time

**Stats:** 1203 tests, 19 LLM providers (added Moonshot, Zhipu, Cloudflare), 32 tools, 20 retrieval strategies, 6 text splitters, 9 memory backends, 5 checkpointers

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
