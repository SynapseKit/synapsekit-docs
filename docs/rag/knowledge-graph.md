---
sidebar_position: 9
---

# Knowledge Graph Retrieval

Multi-hop retrieval over an entity graph built from your documents. Entities and relationships are extracted using an LLM, stored in a graph backend, and then traversed at query time to surface non-obvious connections.

**Install:** `pip install synapsekit[graph]`

**Import:**
```python
from synapsekit.retrieval.kg import KnowledgeGraphBuilder, KGRetriever, HybridKGRetriever
```

---

## `KnowledgeGraphBuilder`

Extracts entities and relationship triples from documents using an LLM and writes them to a graph store.

```python
from synapsekit.retrieval.kg import KnowledgeGraphBuilder

builder = KnowledgeGraphBuilder(
    llm: BaseLLM,
    store: BaseGraphStore,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM` | required | LLM used to extract entities and triples |
| `store` | `BaseGraphStore` | required | Graph store to write triples into |

### Methods

- `async extract_entities(text: str) -> list[str]` — extract named entities from text; returns a JSON array of strings
- `async extract_triples(text: str) -> list[dict]` — extract `{subject, predicate, object, confidence}` triples from text
- `async build_from_documents(docs: list[str], doc_ids: list[str] | None = None) -> None` — process each document, extract triples, and store them with document links; `doc_ids` defaults to `"doc_0"`, `"doc_1"`, …

---

## `BaseGraphStore`

Protocol implemented by all graph store backends.

```python
class BaseGraphStore(Protocol):
    def add_triple(self, subject: str, predicate: str, obj: str, confidence: float = 1.0) -> None: ...
    def add_document_link(self, entity: str, doc_id: str) -> None: ...
    def get_neighbors(self, entity: str, max_hops: int = 1, min_confidence: float = 0.0) -> set[str]: ...
    def get_related_documents(self, entity: str) -> list[str]: ...
```

---

## `NetworkXStore`

In-memory graph backend backed by [NetworkX](https://networkx.org/). Recommended for development and single-process deployments.

```python
from synapsekit.retrieval.kg.backends import NetworkXStore

store = NetworkXStore()
```

No parameters. Requires `pip install synapsekit[graph]` (includes `networkx`).

---

## `Neo4jStore`

Persistent graph backend using [Neo4j](https://neo4j.com/). Recommended for production.

```python
from synapsekit.retrieval.kg.backends import Neo4jStore

store = Neo4jStore(
    uri: str,
    user: str,
    password: str,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `uri` | `str` | required | Neo4j Bolt URI, e.g. `"bolt://localhost:7687"` |
| `user` | `str` | required | Neo4j username |
| `password` | `str` | required | Neo4j password |

Call `store.close()` when done to release the driver connection.

**Extra dependency:** `pip install neo4j`

---

## `KGRetriever`

Retrieves documents from a graph store by finding entities matching the query, then traversing up to `max_hops` edges to collect related documents.

```python
from synapsekit.retrieval.kg import KGRetriever

retriever = KGRetriever(
    store: BaseGraphStore,
    builder: KnowledgeGraphBuilder,
    max_hops: int = 2,
    min_confidence: float = 0.5,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `store` | `BaseGraphStore` | required | Graph store to query |
| `builder` | `KnowledgeGraphBuilder` | required | Builder used to extract query entities |
| `max_hops` | `int` | `2` | Maximum graph traversal depth |
| `min_confidence` | `float` | `0.5` | Minimum edge confidence to follow |

### Methods

- `async retrieve(query: str) -> list[str]` — extract entities from `query`, traverse the graph, return a list of document IDs

---

## `HybridKGRetriever`

Combines standard vector/dense retrieval with knowledge graph traversal. Results from both paths are merged and deduplicated.

```python
from synapsekit.retrieval.kg import HybridKGRetriever

retriever = HybridKGRetriever(
    vector_retriever: Retriever,
    kg_retriever: KGRetriever,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `vector_retriever` | `Retriever` | required | Any SynapseKit retriever for dense search |
| `kg_retriever` | `KGRetriever` | required | Knowledge graph retriever |

### Methods

- `async retrieve(query: str, top_k: int = 5, metadata_filter: dict | None = None) -> list[str]` — run both retrievers in parallel, merge results

---

## End-to-end example

```python
import asyncio
from synapsekit import OpenAILLM, LLMConfig, InMemoryVectorStore, SynapsekitEmbeddings
from synapsekit.retrieval import DenseRetriever
from synapsekit.retrieval.kg import KnowledgeGraphBuilder, KGRetriever, HybridKGRetriever
from synapsekit.retrieval.kg.backends import NetworkXStore

documents = [
    "Albert Einstein developed the theory of special relativity in 1905.",
    "Special relativity introduced the concept of spacetime and the famous equation E=mc².",
    "Einstein was awarded the Nobel Prize in Physics in 1921 for the photoelectric effect.",
    "The photoelectric effect was later used to develop modern solar panels.",
]

async def main():
    llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

    # 1. Build the knowledge graph
    store = NetworkXStore()
    builder = KnowledgeGraphBuilder(llm=llm, store=store)
    await builder.build_from_documents(documents)

    # 2. Create a KG retriever
    kg_retriever = KGRetriever(
        store=store,
        builder=builder,
        max_hops=2,
        min_confidence=0.4,
    )

    # 3. Create a vector retriever for hybrid search
    vector_store = InMemoryVectorStore(SynapsekitEmbeddings())
    await vector_store.add(documents)
    vector_retriever = DenseRetriever(vector_store=vector_store, top_k=3)

    # 4. Combine into a hybrid retriever
    hybrid = HybridKGRetriever(
        vector_retriever=vector_retriever,
        kg_retriever=kg_retriever,
    )

    # Multi-hop query: solar panels → photoelectric effect → Einstein → relativity
    results = await hybrid.retrieve("Who discovered the science behind solar panels?")
    print(results)

asyncio.run(main())
```

---

## See also

- [Graph RAG guide](../guides/retrieval/graph-rag)
- [RAG pipeline](../rag/pipeline)
- [Vector stores](../rag/vector-stores)
