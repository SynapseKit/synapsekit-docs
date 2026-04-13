---
sidebar_position: 1
---

# Introduction

**SynapseKit** is the minimal, async-first Python framework for production LLM apps — RAG pipelines, tool-using agents, and graph workflows. 2 hard dependencies. No magic. No SaaS lock-in. No 200 MB install.

Every public API is `async`. Streaming tokens is the default, not an opt-in. There are no hidden chains, no magic callbacks, no global state. No LangSmith. Just Python.

---

## Quickstart — RAG in 3 lines

```python
from synapsekit import RAG

rag = RAG(model="gpt-4o-mini", api_key="sk-...")
rag.add("./my_docs")  # or a string, URL, PDF, directory...
async for token in rag.stream("What does the doc say about X?"):
    print(token, end="", flush=True)
```

That's it. No chains. No YAML. No global state.

---

## How it compares

| | SynapseKit | LangChain | LlamaIndex |
|---|---|---|---|
| Hard dependencies | **2** | 50+ | 20+ |
| Install size | **~5 MB** | ~200 MB+ | ~100 MB+ |
| Async-native | **✅ Default** | ⚠️ Partial | ⚠️ Partial |
| Cost tracking | **✅ Built-in** | ❌ LangSmith (SaaS) | ❌ No |
| Evaluation | **✅ CLI + GitHub Action** | ❌ LangSmith (SaaS) | ✅ Built-in |
| Graph workflows | **✅ Built-in** | ✅ LangGraph (separate pkg) | ❌ No |
| LLM providers | **31** | 38+ | 20+ |
| Stack traces | **Your code** | Framework internals | Framework internals |

LangChain has more raw integrations. SynapseKit is optimizing for something different: code you can ship, debug at 2am, and maintain without a SaaS subscription.

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

### 31 LLM providers

OpenAI, Anthropic, Ollama, Cohere, Mistral, Gemini, AWS Bedrock, Azure OpenAI, Groq, DeepSeek, OpenRouter, Together, Fireworks, Perplexity, Cerebras, Vertex AI, Moonshot, Zhipu, Cloudflare, AI21 Labs, Databricks, Baidu ERNIE, llama.cpp, LM Studio, Minimax, Aleph Alpha, Hugging Face, SambaNova, xAI (Grok), NovitaAI, Writer (Palmyra) — all behind `BaseLLM`. Auto-detected from the model name.

→ [LLM Provider docs](/docs/llms/overview)

### 9 vector store backends

InMemoryVectorStore (built-in, `.npz` persistence), ChromaDB, FAISS, Qdrant, Pinecone, Weaviate, PGVector, Milvus, LanceDB — all behind `VectorStore`.

→ [Vector store docs](/docs/rag/vector-stores)

### 43 document loaders

`TextLoader`, `StringLoader`, `PDFLoader`, `HTMLLoader`, `CSVLoader`, `JSONLoader`, `YAMLLoader`, `XMLLoader`, `DiscordLoader`, `SlackLoader`, `NotionLoader`, `GoogleDriveLoader`, `GoogleSheetsLoader`, `DirectoryLoader`, `WebLoader`, `ExcelLoader`, `PowerPointLoader`, `DocxLoader`, `MarkdownLoader`, `AudioLoader`, `VideoLoader`, `WikipediaLoader`, `ArXivLoader`, `EmailLoader`, `ImageLoader`, `ConfluenceLoader`, `RSSLoader`, `GCSLoader`, `SQLLoader`, `GitHubLoader`, `GitLoader`, `JiraLoader`, `SupabaseLoader`, `TeamsLoader`, `S3Loader`, `AzureBlobLoader`, `MongoDBLoader`, `DropboxLoader`, `LaTeXLoader`, `TSVLoader`, `RTFLoader`, `EPUBLoader`, `ConfigLoader`, `OneDriveLoader`.

→ [Loader docs](/docs/rag/loaders)

### Agents

`ReActAgent` — Thought → Action → Observation loop, works with any LLM.
`FunctionCallingAgent` — native `tool_calls` / `tool_use` for OpenAI, Anthropic, Gemini, and Mistral.
`AgentExecutor` — unified runner, picks the right agent from config.
48 built-in tools: Calculator, PythonREPL, CodeInterpreter, FileRead, FileWrite, FileList, WebSearch, DuckDuckGoSearch, SQL, HTTP, GraphQL, DateTime, Regex, JSONQuery, HumanInput, Wikipedia, Summarization, SentimentAnalysis, Translation, WebScraper, Shell, SQLSchemaInspection, PDFReader, ArxivSearch, TavilySearch, Email, GitHubAPI, PubMedSearch, VectorSearch, YouTubeSearch, Slack, Notion, Jira, BraveSearch, APIBuilder, GoogleCalendar, AWSLambda, ImageAnalysis, TextToSpeech, SpeechToText, BingSearch, WolframAlpha, GoogleSearch, Twilio, NewsTool, WeatherTool, StripeTool, LinearTool.

→ [Agent docs](/docs/agents/overview)

### Graph Workflows

`StateGraph` — fluent graph builder with compile-time validation, optional cycle support, typed state with reducers, and configurable step limits. Supports recursive subgraphs with `max_recursion_depth` guard.
`CompiledGraph` — wave-based async executor. Parallel nodes via `asyncio.gather`. Conditional routing, checkpointing, human-in-the-loop interrupts, subgraphs, recursive subgraphs, fan-out/fan-in, SSE streaming, event callbacks, token-level streaming, and Mermaid export.

→ [Graph docs](/docs/graph/overview)

### Advanced Retrieval

RAG Fusion, Contextual Retrieval, Sentence Window, Self-Query (LLM-generated filters), Parent Document, Cross-Encoder reranking, CRAG (Corrective RAG), Query Decomposition, Contextual Compression, Ensemble Retrieval, HyDE (Hypothetical Document Embeddings), Cohere Reranking, Step-Back, FLARE, Hybrid Search (BM25+vector RRF), Self-RAG, Adaptive RAG, Multi-Step Retrieval.

→ [Retrieval docs](/docs/rag/retriever)

### Memory

`ConversationMemory` (sliding window), `HybridMemory` (window + LLM summary), `SQLiteConversationMemory` (persistent SQLite-backed), `SummaryBufferMemory` (token-budget summarization), `TokenBufferMemory` (token-budget drop oldest), `BufferMemory` (unbounded buffer), `EntityMemory` (LLM-based entity tracking), `TokenTracer` (tokens, latency, cost).

### Utilities

Output parsers (JSON, Pydantic, List), prompt templates (standard, chat, few-shot), structured output with Pydantic validation.

---

## Version

Current version: **1.5.5** — see the [Changelog](/docs/changelog).
