---
sidebar_position: 1
---

# RAG Pipeline

`RAGPipeline` is the full orchestrator. The `RAG` facade wraps it for the happy path.

## Using the `RAG` facade

```python
from synapsekit import RAG

rag = RAG(model="gpt-4o-mini", api_key="sk-...")
rag.add("Document text...")

# Async
answer = await rag.ask("Your question?")

# Streaming
async for token in rag.stream("Your question?"):
    print(token, end="")

# Sync
answer = rag.ask_sync("Your question?")
```

## Loading documents

```python
from synapsekit import RAG, PDFLoader, DirectoryLoader

rag = RAG(model="gpt-4o-mini", api_key="sk-...")

# From a loader (List[Document])
rag.add_documents(PDFLoader("report.pdf").load())

# Entire directory
rag.add_documents(DirectoryLoader("./docs/").load())

# Async versions
await rag.add_async("raw text string")
await rag.add_documents_async(docs)
```

## Persistence

Save and load your vector store across sessions:

```python
rag.save("my_store.npz")

# Later
rag.load("my_store.npz")
```

## Using `RAGPipeline` directly

For full control over every component:

```python
from synapsekit.rag.pipeline import RAGConfig, RAGPipeline
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.base import LLMConfig
from synapsekit import SynapsekitEmbeddings, InMemoryVectorStore, Retriever
from synapsekit.memory.conversation import ConversationMemory
from synapsekit.observability.tracer import TokenTracer

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))
embeddings = SynapsekitEmbeddings()
store = InMemoryVectorStore(embeddings)
retriever = Retriever(store, rerank=True)

pipeline = RAGPipeline(RAGConfig(
    llm=llm,
    retriever=retriever,
    memory=ConversationMemory(window=10),
    tracer=TokenTracer(model="gpt-4o-mini"),
    retrieval_top_k=5,
    chunk_size=512,
    chunk_overlap=50,
))

await pipeline.add("Your document text...")
await pipeline.add_documents(docs)   # List[Document]

answer = await pipeline.ask("Your question?")
```

## RAGConfig reference

| Field | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM` | required | LLM provider |
| `retriever` | `Retriever` | required | Vector store + retrieval logic |
| `memory` | `ConversationMemory` | required | Conversation history |
| `tracer` | `TokenTracer \| None` | `None` | Token/latency tracking |
| `retrieval_top_k` | `int` | `5` | Chunks to retrieve per query |
| `system_prompt` | `str` | `"Answer using only..."` | LLM system instruction |
| `chunk_size` | `int` | `512` | Max characters per chunk |
| `chunk_overlap` | `int` | `50` | Overlap between chunks |

## Next steps

- [Retriever](./retriever) — advanced retrieval strategies (RAG Fusion, GraphRAG, HyDE, and more)
- [Loaders](./loaders) — PDF, HTML, CSV, directory, and web loaders
- [Splitter](./splitter) — text splitting strategies and chunk size tuning
- [Vector Stores](./vector-stores) — ChromaDB, FAISS, Qdrant, Pinecone backends
- [PromptHub](./prompt-hub) — version and share prompt templates across your team
