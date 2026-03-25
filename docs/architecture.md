---
sidebar_position: 3
---

# Architecture

SynapseKit is structured as a set of loosely-coupled, composable layers. You can use each layer independently or compose them together.

## Layer overview

![SynapseKit layer architecture](/img/architecture-layers.svg)

## Core abstractions

### `BaseLLM`
All 23 LLM providers implement `BaseLLM`. The interface is:
```python
class BaseLLM:
    async def generate(self, prompt: str, **kwargs) -> str: ...
    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]: ...
    async def call_with_tools(self, messages, tools, **kwargs) -> dict: ...
```

### `RAGPipeline`
Composes embeddings, a vector store, a retriever, and an LLM into a single `aquery()` call with streaming support.

### `StateGraph` / `CompiledGraph`
A DAG of async node functions with typed state, conditional edges, parallel fan-out, checkpointing, and human-in-the-loop support.

### `BaseAgent` → `ReActAgent` / `FunctionCallingAgent`
Tool-using agents. ReAct uses chain-of-thought. FunctionCallingAgent uses native provider function calling.

## Optional dependency model

SynapseKit has **2 required dependencies** (`numpy`, `rank-bm25`). Everything else is opt-in:

```bash
pip install synapsekit[openai]         # OpenAI LLM
pip install synapsekit[chroma]         # ChromaDB vector store
pip install synapsekit[serve]          # CLI serve command (FastAPI)
pip install synapsekit[redis]          # Redis memory + checkpointer
pip install synapsekit[postgres]       # Postgres checkpointer
pip install synapsekit[all]            # Everything
```

Internals use lazy imports — uninstalled extras raise `ImportError` with a helpful message only when accessed.

## Async model

Every public API is `async def`. Sync wrappers (e.g., `rag.query()`) call `asyncio.run()` for convenience in scripts and notebooks. Never mix sync wrappers with an existing event loop.

## Data flow: RAG query

![RAG pipeline data flow](/img/rag-pipeline.svg)

## Data flow: Graph execution

![Graph execution flow](/img/graph-execution.svg)
