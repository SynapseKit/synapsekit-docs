---
sidebar_position: 2
---

# Vector Store API Reference

## `VectorStore` (ABC)

All vector stores implement this interface.

```python
from synapsekit.retrieval.base import VectorStore

class VectorStore(ABC):
    async def add(
        self,
        texts: list[str],
        metadata: list[dict] | None = None,
    ) -> None: ...

    async def search(
        self,
        query: str,
        top_k: int = 5,
    ) -> list[dict]: ...

    def save(self, path: str) -> None: ...   # optional — raises NotImplementedError if unsupported
    def load(self, path: str) -> None: ...   # optional — raises NotImplementedError if unsupported
```

`search()` returns a list of dicts: `{"text": str, "score": float, "metadata": dict}`.

---

## `InMemoryVectorStore`

```python
from synapsekit import InMemoryVectorStore, SynapsekitEmbeddings

InMemoryVectorStore(embedding_backend: SynapsekitEmbeddings)
```

| Method | Description |
|---|---|
| `add(texts, metadata=None)` | Embed and store texts |
| `search(query, top_k=5)` | Cosine similarity search (L2-normalised vectors) |
| `save(path)` | Persist to `.npz` file |
| `load(path)` | Load from `.npz` file |
| `__len__()` | Number of stored texts |

---

## `ChromaVectorStore`

```python
from synapsekit.retrieval.chroma import ChromaVectorStore

ChromaVectorStore(
    embedding_backend: SynapsekitEmbeddings,
    collection_name: str = "synapsekit",
    persist_directory: str | None = None,
)
```

Pass `persist_directory` for on-disk persistence.

---

## `FAISSVectorStore`

```python
from synapsekit.retrieval.faiss import FAISSVectorStore

FAISSVectorStore(embedding_backend: SynapsekitEmbeddings)
```

| Method | Description |
|---|---|
| `save(path)` | Writes `path.faiss`, `path_texts.npy`, `path_meta.json` |
| `load(path)` | Loads the three files above |

---

## `QdrantVectorStore`

```python
from synapsekit.retrieval.qdrant import QdrantVectorStore

QdrantVectorStore(
    embedding_backend: SynapsekitEmbeddings,
    collection_name: str = "synapsekit",
    url: str = "http://localhost:6333",
    api_key: str | None = None,
)
```

Collection is auto-created on first `add()`.

---

## `PineconeVectorStore`

```python
from synapsekit.retrieval.pinecone import PineconeVectorStore

PineconeVectorStore(
    embedding_backend: SynapsekitEmbeddings,
    index_name: str,
    api_key: str,
    environment: str = "us-east-1",
)
```

Index must exist in your Pinecone project before calling `add()`.

---

## `SynapsekitEmbeddings`

```python
from synapsekit import SynapsekitEmbeddings

SynapsekitEmbeddings(model: str = "all-MiniLM-L6-v2")
```

Uses `sentence-transformers` under the hood (lazy import).

| Method | Returns | Description |
|---|---|---|
| `embed(texts)` | `np.ndarray (N, D)` | Embed a list of texts |
| `embed_one(text)` | `np.ndarray (D,)` | Embed a single text |
