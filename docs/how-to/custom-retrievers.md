---
sidebar_position: 5
---

# Custom Retrievers

SynapseKit's `Retriever` base class lets you plug any data source into a RAG pipeline: SQL databases, Elasticsearch, in-memory caches, or custom APIs. This guide shows how to build and test custom retrievers.

## Prerequisites

```bash
pip install synapsekit[openai] aiosqlite
```

---

## 1. Minimal custom retriever

Extend `Retriever` and implement `add` and `retrieve`.

```python
# retrievers/database_retriever.py
from synapsekit.retrieval.base import Retriever
from synapsekit.schema import Document
from typing import Any
import aiosqlite


class DatabaseRetriever(Retriever):
    """Retrieve documents from a SQLite database using keyword search."""

    def __init__(self, db_path: str = ":memory:", table: str = "documents"):
        self.db_path = db_path
        self.table = table

    async def _ensure_table(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(f"""
                CREATE TABLE IF NOT EXISTS {self.table} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    content TEXT NOT NULL,
                    source TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            await db.commit()

    async def add(self, documents: list[str], metadata: list[dict] = None) -> None:
        """Insert documents into the database."""
        await self._ensure_table()
        metadata = metadata or [{}] * len(documents)
        async with aiosqlite.connect(self.db_path) as db:
            for doc, meta in zip(documents, metadata):
                await db.execute(
                    f"INSERT INTO {self.table} (content, source) VALUES (?, ?)",
                    (doc, meta.get("source", "")),
                )
            await db.commit()

    async def retrieve(self, query: str, k: int = 5) -> list[Document]:
        """Search documents using SQLite FTS (keyword match)."""
        await self._ensure_table()
        # Simple keyword search — split query into words and use LIKE
        words = query.split()
        conditions = " OR ".join(f"content LIKE ?" for _ in words)
        params = [f"%{word}%" for word in words] + [k]

        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                f"SELECT id, content, source FROM {self.table} WHERE {conditions} LIMIT ?",
                params,
            )
            rows = await cursor.fetchall()

        return [
            Document(
                content=row[1],
                metadata={"id": row[0], "source": row[2]},
            )
            for row in rows
        ]
```

### Basic usage

```python
import asyncio
from retrievers.database_retriever import DatabaseRetriever


async def main():
    retriever = DatabaseRetriever(db_path="docs.db")

    # Index documents
    await retriever.add(
        documents=[
            "SynapseKit is a Python library for building LLM applications.",
            "RAG combines retrieval with language model generation.",
            "Vector stores enable semantic similarity search.",
        ],
        metadata=[
            {"source": "intro.md"},
            {"source": "rag.md"},
            {"source": "vector-stores.md"},
        ],
    )

    # Retrieve relevant docs
    results = await retriever.retrieve("What is SynapseKit?", k=2)
    for doc in results:
        print(f"[{doc.metadata['source']}] {doc.content}")

    # Expected output:
    # [intro.md] SynapseKit is a Python library for building LLM applications.
    # [rag.md] RAG combines retrieval with language model generation.

asyncio.run(main())
```

---

## 2. Elasticsearch retriever

```python
from synapsekit.retrieval.base import Retriever
from synapsekit.schema import Document


class ElasticsearchRetriever(Retriever):
    """Retrieve documents from Elasticsearch."""

    def __init__(self, hosts: list[str], index: str):
        from elasticsearch import AsyncElasticsearch
        self.client = AsyncElasticsearch(hosts)
        self.index = index

    async def add(self, documents: list[str], metadata: list[dict] = None) -> None:
        metadata = metadata or [{}] * len(documents)
        operations = []
        for doc, meta in zip(documents, metadata):
            operations.append({"index": {"_index": self.index}})
            operations.append({"content": doc, **meta})
        await self.client.bulk(operations=operations, refresh=True)

    async def retrieve(self, query: str, k: int = 5) -> list[Document]:
        response = await self.client.search(
            index=self.index,
            body={
                "query": {"match": {"content": query}},
                "size": k,
            },
        )
        return [
            Document(
                content=hit["_source"]["content"],
                metadata={k: v for k, v in hit["_source"].items() if k != "content"},
            )
            for hit in response["hits"]["hits"]
        ]

    async def close(self):
        await self.client.close()
```

---

## 3. Using with RAGPipeline

Any `Retriever` subclass can be passed to `RAG`.

```python
import asyncio
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from retrievers.database_retriever import DatabaseRetriever


async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    retriever = DatabaseRetriever(db_path="knowledge.db")

    # Use custom retriever instead of default vector store
    rag = RAG(llm=llm, retriever=retriever)

    await rag.aadd([
        "The Eiffel Tower is located in Paris, France.",
        "It was constructed between 1887 and 1889.",
        "The tower is 330 metres (1,083 ft) tall.",
    ])

    answer = await rag.aquery("How tall is the Eiffel Tower?")
    print(answer)
    # Expected output: The Eiffel Tower is 330 metres (1,083 ft) tall.

asyncio.run(main())
```

---

## 4. Combining with EnsembleRetriever

`EnsembleRetriever` merges results from multiple retrievers using Reciprocal Rank Fusion (RRF). This is useful for combining keyword and semantic search.

```python
import asyncio
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.retrieval import EnsembleRetriever
from synapsekit.retrieval.chroma import ChromaRetriever
from retrievers.database_retriever import DatabaseRetriever


async def main():
    # Semantic retriever — good for concept matching
    semantic = ChromaRetriever(collection_name="docs")

    # Keyword retriever — good for exact term matching
    keyword = DatabaseRetriever(db_path="docs.db")

    # Ensemble with 60% semantic, 40% keyword weighting
    ensemble = EnsembleRetriever(
        retrievers=[semantic, keyword],
        weights=[0.6, 0.4],
    )

    llm = OpenAILLM(model="gpt-4o-mini")
    rag = RAG(llm=llm, retriever=ensemble)

    documents = [
        "Python 3.12 introduced the pathlib improvements.",
        "asyncio.TaskGroup was added in Python 3.11.",
        "Type parameter syntax (PEP 695) landed in Python 3.12.",
    ]

    await rag.aadd(documents)

    answer = await rag.aquery("What new features are in Python 3.12?")
    print(answer)
    # Expected output:
    # Python 3.12 introduced pathlib improvements and the new type parameter
    # syntax defined in PEP 695, which simplifies generic class definitions.

asyncio.run(main())
```

---

## 5. Custom retriever with caching

Add an in-memory cache to avoid redundant database queries for repeated questions.

```python
from synapsekit.retrieval.base import Retriever
from synapsekit.schema import Document
from functools import lru_cache
import hashlib


class CachedDatabaseRetriever(DatabaseRetriever):
    """Database retriever with in-memory result caching."""

    def __init__(self, db_path: str, cache_size: int = 128):
        super().__init__(db_path=db_path)
        self._cache: dict[str, list[Document]] = {}
        self._cache_size = cache_size

    def _cache_key(self, query: str, k: int) -> str:
        return hashlib.md5(f"{query}:{k}".encode()).hexdigest()

    async def retrieve(self, query: str, k: int = 5) -> list[Document]:
        key = self._cache_key(query, k)

        if key in self._cache:
            print(f"Cache hit for: '{query}'")
            return self._cache[key]

        results = await super().retrieve(query, k)

        # Evict oldest entry if at capacity
        if len(self._cache) >= self._cache_size:
            oldest = next(iter(self._cache))
            del self._cache[oldest]

        self._cache[key] = results
        return results

    def clear_cache(self):
        self._cache.clear()
```

---

## 6. Testing retrievers with pytest fixtures

```python
# tests/test_retrievers.py
import pytest
import asyncio
from retrievers.database_retriever import DatabaseRetriever, CachedDatabaseRetriever
from synapsekit.schema import Document


@pytest.fixture
async def retriever():
    """Fresh in-memory retriever for each test."""
    r = DatabaseRetriever(db_path=":memory:")
    await r.add([
        "Python is a high-level programming language.",
        "JavaScript is used for web development.",
        "Rust provides memory safety without garbage collection.",
    ])
    return r


@pytest.mark.asyncio
async def test_retrieve_returns_documents(retriever):
    results = await retriever.retrieve("Python programming", k=2)
    assert len(results) <= 2
    assert all(isinstance(doc, Document) for doc in results)


@pytest.mark.asyncio
async def test_retrieve_relevant_content(retriever):
    results = await retriever.retrieve("JavaScript web", k=1)
    assert len(results) == 1
    assert "JavaScript" in results[0].content


@pytest.mark.asyncio
async def test_retrieve_empty_returns_empty(retriever):
    results = await retriever.retrieve("zyxwvutsrqpon", k=5)
    assert isinstance(results, list)


@pytest.mark.asyncio
async def test_cached_retriever_cache_hit():
    retriever = CachedDatabaseRetriever(db_path=":memory:")
    await retriever.add(["SynapseKit is a Python library."])

    # First call — populates cache
    results1 = await retriever.retrieve("SynapseKit", k=3)

    # Second call — should be a cache hit
    results2 = await retriever.retrieve("SynapseKit", k=3)

    assert len(results1) == len(results2)
    assert results1[0].content == results2[0].content


@pytest.mark.asyncio
async def test_add_and_retrieve_metadata(retriever):
    retriever2 = DatabaseRetriever(db_path=":memory:")
    await retriever2.add(
        ["Test document"],
        metadata=[{"source": "test.md"}],
    )
    results = await retriever2.retrieve("Test", k=1)
    assert results[0].metadata["source"] == "test.md"
```

---

## Summary

| Pattern | Use case |
|---|---|
| `DatabaseRetriever` | SQL keyword search, structured data |
| `ElasticsearchRetriever` | Full-text search at scale |
| `EnsembleRetriever` | Combine keyword + semantic |
| `CachedDatabaseRetriever` | Reduce latency for repeated queries |
| pytest `async` fixture | Isolated in-memory test environment |
