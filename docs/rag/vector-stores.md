---
sidebar_position: 4
---

# Vector Store Backends

All vector stores implement the `VectorStore` ABC and share the same interface.

```python
from synapsekit.retrieval.base import VectorStore

class VectorStore(ABC):
    async def add(self, texts: list[str], metadata: list[dict] | None = None) -> None: ...
    async def search(self, query: str, top_k: int = 5, metadata_filter: dict | None = None) -> list[dict]: ...
    async def search_mmr(self, query: str, top_k: int = 5, lambda_mult: float = 0.5, fetch_k: int = 20) -> list[dict]: ...
    def save(self, path: str) -> None: ...   # optional
    def load(self, path: str) -> None: ...   # optional
```

---

## InMemoryVectorStore

Zero-dependency, numpy-backed store. Best for development and small datasets.

```python
from synapsekit import InMemoryVectorStore, SynapsekitEmbeddings

embeddings = SynapsekitEmbeddings()
store = InMemoryVectorStore(embeddings)

await store.add(["chunk one", "chunk two"], metadata=[{"src": "doc1"}, {"src": "doc2"}])

results = await store.search("my query", top_k=3)
# results[0] -> {"text": "...", "score": 0.92, "metadata": {...}}

# Metadata filtering
results = await store.search("my query", top_k=3, metadata_filter={"src": "doc1"})

# MMR search (diversity-aware)
results = await store.search_mmr("my query", top_k=3, lambda_mult=0.5)

# Persist to disk
store.save("my_store.npz")

# Reload
store2 = InMemoryVectorStore(embeddings)
store2.load("my_store.npz")
```

---

## ChromaVectorStore

Persistent or ephemeral Chroma backend.

```bash
pip install synapsekit[chroma]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.chroma import ChromaVectorStore

embeddings = SynapsekitEmbeddings()

# Ephemeral (in-memory Chroma)
store = ChromaVectorStore(embeddings, collection_name="my_docs")

# Persistent (saved to disk)
store = ChromaVectorStore(
    embeddings,
    collection_name="my_docs",
    persist_directory="./chroma_db",
)

await store.add(["doc text..."])
results = await store.search("query", top_k=5)
```

---

## FAISSVectorStore

Facebook AI Similarity Search — fast exact and approximate nearest-neighbour search.

```bash
pip install synapsekit[faiss]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.faiss import FAISSVectorStore

embeddings = SynapsekitEmbeddings()
store = FAISSVectorStore(embeddings)

await store.add(["doc one", "doc two"])
results = await store.search("query", top_k=5)

# Save / load
store.save("my_index")   # writes my_index.faiss + my_index_texts.npy + my_index_meta.json
store.load("my_index")
```

---

## QdrantVectorStore

[Qdrant](https://qdrant.tech/) — production-grade vector database.

```bash
pip install synapsekit[qdrant]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.qdrant import QdrantVectorStore

embeddings = SynapsekitEmbeddings()

store = QdrantVectorStore(
    embeddings,
    collection_name="my_docs",
    url="http://localhost:6333",
    api_key=None,           # set for Qdrant Cloud
)

await store.add(["doc text..."])
results = await store.search("query", top_k=5)
```

---

## PineconeVectorStore

[Pinecone](https://www.pinecone.io/) — managed serverless vector database.

```bash
pip install synapsekit[pinecone]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.pinecone import PineconeVectorStore

embeddings = SynapsekitEmbeddings()

store = PineconeVectorStore(
    embeddings,
    index_name="my-index",
    api_key="pcsk_...",
)

await store.add(["doc text..."])
results = await store.search("query", top_k=5)
```

---

## Using a custom backend with `Retriever`

Any `VectorStore` subclass plugs straight into `Retriever` and `RAGPipeline`:

```python
from synapsekit import SynapsekitEmbeddings, Retriever
from synapsekit.retrieval.chroma import ChromaVectorStore
from synapsekit.rag.pipeline import RAGConfig, RAGPipeline
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.base import LLMConfig
from synapsekit.memory.conversation import ConversationMemory

embeddings = SynapsekitEmbeddings()
store = ChromaVectorStore(embeddings, persist_directory="./db")
retriever = Retriever(store, rerank=True)

pipeline = RAGPipeline(RAGConfig(
    llm=OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-...")),
    retriever=retriever,
    memory=ConversationMemory(),
))

await pipeline.add("Your document text...")
answer = await pipeline.ask("Your question?")
```
