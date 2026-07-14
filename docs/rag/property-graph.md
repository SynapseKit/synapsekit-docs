---
sidebar_position: 10
title: "Property Graph RAG — SynapseKit Python RAG Framework"
description: "Vector search fused with property-graph traversal in Python. LLM + heuristic entity/relationship extraction, NetworkX and Neo4j backends, graph-backed agent memory."
keywords: [property graph rag python, graph vector store python, knowledge graph extraction python, neo4j networkx rag, graph agent memory synapsekit]
---

# Property Graph RAG

Property Graph RAG stores extracted entities and relationships as a typed property graph and fuses graph traversal directly into vector search. `GraphVectorStore` is a drop-in `VectorStore`: it embeds your documents like any other store, but it also extracts an entity/relationship graph as you add text, then expands vector hits through that graph at query time so related documents surface even when their wording doesn't match the query. The same property-graph backends also power graph-backed `AgentMemory`.

**Install:** `pip install synapsekit[graph]` (adds `networkx` and `neo4j`).

**Import:**
```python
from synapsekit import (
    GraphVectorStore,
    KnowledgeGraphExtractor,
    NetworkXPropertyGraphBackend,
    Neo4jPropertyGraphBackend,
    PropertyGraphNode,
    PropertyGraphEdge,
)
```

:::note When to use this vs. Knowledge Graph Retrieval
[Knowledge Graph Retrieval](./knowledge-graph.md) (`KGRetriever`) is a **retriever**: it extracts subject–predicate–object triples with an LLM and returns document IDs from graph traversal. **Property Graph RAG** (`GraphVectorStore`) is a **vector store**: it keeps a richer typed property graph (nodes and edges carry arbitrary properties) and fuses graph expansion into ordinary vector `search()` results — so it plugs straight into `Retriever` and `RAGPipeline` with no separate retriever. Reach for `GraphVectorStore` when you want graph-aware recall behind the standard vector-store interface, and for graph-backed agent memory.
:::

---

## Quickstart

`GraphVectorStore` works fully offline: with no LLM the extractor falls back to a heuristic entity/relationship extractor, so you can run this without any API key.

```python
import asyncio
from synapsekit import GraphVectorStore, SynapsekitEmbeddings


async def main():
    store = GraphVectorStore(SynapsekitEmbeddings(), max_hops=2, graph_weight=0.25)

    await store.add([
        "Ada Lovelace worked on the Analytical Engine designed by Charles Babbage.",
        "Charles Babbage founded the field of mechanical computing.",
        "The Analytical Engine influenced early programmable computers.",
    ])

    # Vector hits are expanded through the property graph, so documents
    # connected via shared entities are pulled in and re-ranked.
    results = await store.search("Who pioneered programmable computing?", top_k=3)
    for hit in results:
        print(round(hit["score"], 3), hit["metadata"].get("retrieval_source"), hit["text"][:60])


asyncio.run(main())
```

Result dicts follow the standard `VectorStore` shape: `{"text", "score", "metadata"}`. When a hit was surfaced through the graph its `metadata["retrieval_source"]` is `"graph_vector"` and it carries `graph_nodes` / `graph_edges` labels.

---

## `GraphVectorStore`

A `VectorStore` subclass that wraps any inner vector store and a property-graph backend. On `add()`, each document is embedded **and** run through the extractor; the resulting entities/relationships are stored in the graph tagged with the document's `source`. On `search()`, the store runs a normal vector query, seeds the graph from the query text and the vector hits, traverses up to `max_hops`, then fuses the graph-linked documents back into the ranked results.

```python
store = GraphVectorStore(
    embedding_backend=SynapsekitEmbeddings(),
    vector_store=None,          # defaults to InMemoryVectorStore(embedding_backend)
    backend="networkx",         # "networkx" | "neo4j" | a PropertyGraphBackend instance
    extractor=None,             # defaults to KnowledgeGraphExtractor(store=graph)
    max_hops=2,
    min_confidence=0.0,
    graph_weight=0.25,
    uri=None,                   # required when backend="neo4j"
    username="neo4j",
    password="password",
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `embedding_backend` | `SynapsekitEmbeddings` | — | Required unless `vector_store` is provided |
| `vector_store` | `VectorStore` | `None` | Inner store; defaults to `InMemoryVectorStore` |
| `backend` | `"networkx" \| "neo4j" \| PropertyGraphBackend` | `"networkx"` | Graph backend name or instance |
| `extractor` | `KnowledgeGraphExtractor` | `None` | Extractor; defaults to a heuristic one bound to the graph |
| `max_hops` | `int` | `2` | Graph traversal depth from seed nodes |
| `min_confidence` | `float` | `0.0` | Minimum edge confidence to traverse |
| `graph_weight` | `float` | `0.25` | Weight applied to graph-linked documents during fusion |
| `uri` | `str \| None` | `None` | Neo4j Bolt URI (required for `backend="neo4j"`) |
| `username` / `password` | `str` | `"neo4j"` / `"password"` | Neo4j credentials |

### Methods

- `async add(texts, metadata=None)` — embed each text, extract its subgraph, and store it. `metadata[i]["source"]` (or `"id"`) becomes the document key; otherwise an auto `doc_N` id is assigned.
- `async search(query, top_k=5, metadata_filter=None)` — vector search fused with graph traversal. Respects `metadata_filter` for multi-tenant scoping (graph nodes/edges outside the filter are dropped before fusion, so a filtered search never leaks another tenant's entities).
- `async search_mmr(query, top_k=5, lambda_mult=0.5, fetch_k=20, metadata_filter=None)` — diversity-aware search delegated to the inner store.
- `save(path)` / `load(path)` — persist/reload the inner vector store.

---

## `KnowledgeGraphExtractor`

Turns raw text into a `KnowledgeGraphExtraction` (`entities` + `relationships`). With an `llm` it prompts for strict JSON; without one it uses a dependency-free heuristic extractor (capitalized-phrase / `@handle` entity detection plus relation-verb hints), which makes offline demos and deterministic tests possible.

```python
from synapsekit import KnowledgeGraphExtractor, NetworkXPropertyGraphBackend

graph = NetworkXPropertyGraphBackend()
extractor = KnowledgeGraphExtractor(llm=None, store=graph, min_confidence=0.5)

extraction = await extractor.extract("Acme Corp acquired Beta Labs in 2021.")
print([e.name for e in extraction.entities])
print([(r.source, r.relation, r.target) for r in extraction.relationships])

# Ingest a batch straight into the bound (or passed) store
await extractor.ingest([
    "Acme Corp acquired Beta Labs.",
    {"text": "Beta Labs built the Orion platform.", "metadata": {"source": "wiki"}},
])
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM \| None` | `None` | LLM for JSON extraction; `None` uses the heuristic extractor |
| `store` | `PropertyGraphBackend \| None` | `None` | Default store for `ingest()` |
| `min_confidence` | `float` | `0.5` | Drop entities/relationships below this confidence |

- `async extract(text) -> KnowledgeGraphExtraction`
- `async ingest(documents, *, store=None) -> list[KnowledgeGraphExtraction]` — accepts plain strings or `{"text", "metadata"}` dicts; requires a store.

---

## Property-graph backends

Both backends implement the `PropertyGraphBackend` protocol (`upsert_node`, `upsert_edge`, `neighbors`, `traverse`, `document_ids_for_nodes`, `remove_node`, …), so they are interchangeable in `GraphVectorStore` and `GraphMemoryBackend`.

### `NetworkXPropertyGraphBackend`

In-memory property graph. Uses `networkx.MultiDiGraph` when NetworkX is installed and transparently falls back to a built-in adjacency graph when it is not — so it works even without the `graph` extra. Recommended for development and single-process deployments.

```python
from synapsekit import NetworkXPropertyGraphBackend

graph = NetworkXPropertyGraphBackend()
graph.upsert_node(PropertyGraphNode(id="pg_acme", label="Acme Corp", type="org"))
```

No constructor parameters. The `.uses_networkx` attribute reports whether the real NetworkX backend is active.

### `Neo4jPropertyGraphBackend`

Persistent property graph on [Neo4j](https://neo4j.com/). Recommended for production. Nodes are stored as `:PropertyGraphNode` and edges as `:RELATED`.

```python
from synapsekit import Neo4jPropertyGraphBackend

graph = Neo4jPropertyGraphBackend(
    "bolt://localhost:7687",
    username="neo4j",
    password="password",
    database=None,
)
# ... use with GraphVectorStore(backend=graph) ...
graph.close()
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `uri` | `str` | required | Neo4j Bolt URI |
| `username` | `str` | `"neo4j"` | Username |
| `password` | `str` | `"password"` | Password |
| `database` | `str \| None` | `None` | Target database name |

Call `.close()` to release the driver.

---

## Graph-backed agent memory

The property graph doubles as an `AgentMemory` backend. `GraphMemoryBackend` (aliased `GraphAgentMemory`) stores each memory record as a typed node (`memory_<type>`) and links records to each other through `related_to` edges derived from `metadata["related_to"]`. Wire it into `AgentMemory` with `backend="graph"` and pass the property-graph store as `store=`:

```python
from synapsekit import AgentMemory, NetworkXPropertyGraphBackend

memory = AgentMemory(backend="graph", store=NetworkXPropertyGraphBackend())

# Any PropertyGraphBackend works — swap in Neo4j for persistence:
# memory = AgentMemory(backend="graph", store=Neo4jPropertyGraphBackend("bolt://localhost:7687"))
```

If `store` is omitted, `GraphMemoryBackend` creates a `NetworkXPropertyGraphBackend` for you. You can also construct the backend directly:

```python
from synapsekit.memory.backends.graph import GraphMemoryBackend, GraphAgentMemory
backend = GraphMemoryBackend(store=NetworkXPropertyGraphBackend())
```

---

## API reference

| Symbol | Kind | Purpose |
|---|---|---|
| `GraphVectorStore` | `VectorStore` | Vector search fused with property-graph traversal |
| `KnowledgeGraphExtractor` | class | LLM + heuristic entity/relationship extraction |
| `KnowledgeGraphExtraction` | dataclass | Extraction output: `entities`, `relationships` |
| `ExtractedEntity` / `ExtractedRelationship` | dataclass | Extracted items with `confidence` + `properties` |
| `PropertyGraphNode` / `PropertyGraphEdge` | dataclass | Typed graph node / directed edge with `properties` |
| `NetworkXPropertyGraphBackend` | backend | In-memory graph (NetworkX or built-in fallback) |
| `Neo4jPropertyGraphBackend` | backend | Persistent Neo4j graph |
| `GraphMemoryBackend` / `GraphAgentMemory` | backend | Graph-backed `AgentMemory` backend |

---

## See also

- [Knowledge Graph Retrieval](./knowledge-graph.md) — `KGRetriever` triple-based retriever
- [WorldModelRAG](./world-model.md) — temporal & causal knowledge-graph RAG
- [Vector stores](./vector-stores.md)
- [Agents overview](../agents/overview.md)
