---
sidebar_position: 2
---

# RAGPipeline API Reference

## `RAGConfig`

```python
from synapsekit import RAGConfig
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM` | required | The language model used for answer generation |
| `vector_store` | `VectorStore` | required | The vector store used for chunk retrieval |
| `k` | `int` | `5` | Number of chunks to retrieve per query |
| `prompt_template` | `PromptTemplate \| None` | `None` | Custom prompt template; default stuffing template used if `None` |
| `memory` | `BaseMemory \| None` | `None` | Conversation memory backend for multi-turn chat |
| `retriever` | `Retriever \| None` | `None` | Custom retriever; overrides `vector_store` if provided |
| `stream` | `bool` | `False` | Whether to stream responses by default |
| `chunk_size` | `int` | `512` | Token size for document chunking via `add()` |
| `chunk_overlap` | `int` | `64` | Token overlap between adjacent chunks |
| `splitter` | `BaseSplitter \| None` | `None` | Custom splitter; overrides `chunk_size`/`chunk_overlap` if provided |
| `temperature` | `float \| None` | `None` | Override LLM temperature for this pipeline |
| `metadata_fields` | `list[str] \| None` | `None` | Document metadata fields to index alongside text |

```python
from synapsekit import RAGConfig, OpenAILLM, InMemoryVectorStore, LLMConfig, SynapsekitEmbeddings

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))
store = InMemoryVectorStore(SynapsekitEmbeddings())
config = RAGConfig(llm=llm, vector_store=store, k=5)
```

---

## `RAGPipeline`

```python
from synapsekit import RAGPipeline

rag = RAGPipeline(config: RAGConfig)
```

Short alias: `from synapsekit import RAG` (same class, shorter name).

### `add(documents, metadata=None)`

Add documents synchronously. Documents are chunked and embedded before being stored.

```python
def add(
    documents: list[str],
    metadata: list[dict] | None = None,
) -> None
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `documents` | `list[str]` | required | Raw document strings to chunk and embed |
| `metadata` | `list[dict] \| None` | `None` | Metadata dicts — one per document, not per chunk |

```python
rag.add(
    ["Document 1 text", "Document 2 text"],
    metadata=[{"source": "doc1.txt"}, {"source": "doc2.txt"}],
)
```

---

### `async aadd(documents, metadata=None)`

Add documents asynchronously. Preferred in async contexts.

```python
async def aadd(
    documents: list[str],
    metadata: list[dict] | None = None,
) -> None
```

```python
await rag.aadd(["Document 1", "Document 2"])
```

---

### `query(query, **kwargs)`

Query synchronously and return a string response.

```python
def query(
    query: str,
    k: int | None = None,
    metadata_filter: dict | None = None,
) -> str
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `str` | required | The user question |
| `k` | `int \| None` | `config.k` | Override number of retrieved chunks |
| `metadata_filter` | `dict \| None` | `None` | Filter retrieved documents by metadata field values |

```python
answer = rag.query("What is SynapseKit?")
```

---

### `async aquery(query, **kwargs)`

Query asynchronously. Returns a string response.

```python
async def aquery(
    query: str,
    k: int | None = None,
    metadata_filter: dict | None = None,
) -> str
```

```python
answer = await rag.aquery("What is SynapseKit?")
```

---

### `async astream(query, **kwargs)`

Stream the response token by token. Returns an `AsyncIterator[str]`.

```python
async def astream(
    query: str,
    k: int | None = None,
    metadata_filter: dict | None = None,
) -> AsyncIterator[str]
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `str` | required | The user question |
| `k` | `int \| None` | `config.k` | Override number of retrieved chunks |
| `metadata_filter` | `dict \| None` | `None` | Filter retrieved documents by metadata |

```python
async for token in rag.astream("Explain SynapseKit in detail"):
    print(token, end="", flush=True)
```

---

### `save(path)`

Persist the pipeline's vector store to disk.

```python
def save(path: str) -> None
```

```python
rag.save("/data/my_rag_index")
```

Raises `NotImplementedError` if the underlying vector store does not support persistence.

---

### `load(path)`

Load a previously saved vector store from disk.

```python
def load(path: str) -> None
```

```python
rag = RAG(config)
rag.load("/data/my_rag_index")
```

---

### `async get_relevant_documents(query, k=None, metadata_filter=None)`

Retrieve documents without generating an answer. Returns `list[dict]` with `"text"`, `"score"`, `"metadata"` keys.

```python
docs = await rag.get_relevant_documents("What is SynapseKit?", k=3)
for doc in docs:
    print(f"Score: {doc['score']:.3f} | {doc['text'][:80]}")
```

---

## Full example

```python
import asyncio
from synapsekit import RAG, RAGConfig, OpenAILLM, InMemoryVectorStore, SynapsekitEmbeddings, LLMConfig

async def main():
    llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))
    store = InMemoryVectorStore(SynapsekitEmbeddings())
    config = RAGConfig(llm=llm, vector_store=store, k=4)
    rag = RAG(config)

    await rag.aadd([
        "SynapseKit is an async-first Python library for building LLM applications.",
        "It supports RAG, agents, graph workflows, and multi-agent systems.",
    ])

    answer = await rag.aquery("What is SynapseKit?")
    print(answer)

    async for token in rag.astream("What is SynapseKit used for?"):
        print(token, end="", flush=True)

asyncio.run(main())
```

---

## See also

- [RAG pipeline guide](../rag/pipeline)
- [How RAG works](../concepts/rag)
- [Vector Store API reference](../api/vector-store)
- [Retriever API reference](../api/retriever)
