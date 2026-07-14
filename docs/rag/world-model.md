---
sidebar_position: 11
title: "WorldModelRAG — Temporal & Causal Graph RAG in Python"
description: "Temporal knowledge-graph RAG in Python: entities, relations, events and causal links with validity windows. Hybrid graph + vector retrieval, Mermaid export, optional Kuzu backend."
keywords: [temporal knowledge graph rag python, causal rag python, world model rag synapsekit, hybrid graph vector retrieval, kuzu graph rag python]
---

# WorldModelRAG

`WorldModelRAG` builds a **temporal, causal knowledge graph** from your documents and answers questions over it alongside vector search. Beyond plain entities and relations, it extracts **events** and **causal links**, and every relation can carry a temporal validity window (`valid_at` / `valid_until`). That lets you ask time-aware questions ("as of Q1 2023, what did X depend on?") and trace cause-and-effect chains. Retrieval fuses graph traversal with dense vector search using reciprocal rank fusion, and any query subgraph can be exported to Mermaid for visualization.

**Install:** included in core. The optional [Kuzu](https://kuzudb.com/) graph backend needs `pip install synapsekit[kuzu]`.

**Import:**
```python
from synapsekit import (
    WorldModelRAG,
    InMemoryWorldGraphBackend,
    HybridWorldModelRetriever,
    CausalLinker,
    ExtractionPolicy,
    HeuristicWorldModelExtractor,
    LLMWorldModelExtractor,
    KuzuWorldGraphBackend,
)
```

---

## Quickstart

`WorldModelRAG` defaults to a dependency-free heuristic extractor and an in-memory graph, so it runs offline. Pass an `api_key` (or a `llm=`) to answer with a real model.

```python
import asyncio
from synapsekit import WorldModelRAG


async def main():
    rag = WorldModelRAG(
        model="gpt-4o-mini",
        api_key="sk-...",
        strategy="hybrid",
        max_hops=2,
    )

    await rag.ingest([
        "In 2021 Acme acquired Beta Labs, which unblocked the Orion launch in 2022.",
        "The Orion launch led to a surge in enterprise adoption.",
        {"text": "Acme deprecated the legacy API in 2023.", "metadata": {"source": "changelog"}},
    ])

    # Time-aware query: only relations active as-of the given date are traversed.
    result = await rag.query("What caused enterprise adoption to grow?", as_of="2023-01-01")
    print(result.answer)
    print("entities:", [n.name for n in result.subgraph.nodes])

    # Visualize the query subgraph.
    print(rag.subgraph_to_mermaid("What caused enterprise adoption to grow?"))


asyncio.run(main())
```

Sync callers can use `rag.ingest_sync(...)` and `rag.query_sync(...)`.

---

## `WorldModelRAG`

The facade that wires the extractor, graph backend, entity resolver, causal linker, vector store, and a `RAGPipeline` together.

```python
rag = WorldModelRAG(
    extraction=None,               # ExtractionPolicy; controls entities/relations/temporal/causal
    graph_backend="in_memory",     # "in_memory" | "kuzu" | a GraphBackend instance
    vector_store=None,             # defaults to InMemoryVectorStore
    extractor=None,                # defaults to HeuristicWorldModelExtractor
    entity_resolver=None,
    causal_linker=None,
    llm=None,
    model="gpt-4o-mini",
    api_key="",
    provider=None,
    embedding_model="all-MiniLM-L6-v2",
    retrieval_top_k=5,
    max_hops=2,
    strategy="hybrid",             # "graph_first" | "vector_first" | "hybrid"
    temperature=0.2,
    max_tokens=1024,
    trace=True,
)
```

### Methods

- `async ingest(docs)` — extract entities/relations/events and index text. `docs` may be strings, `{"text", "metadata"}` dicts, or objects with `.text`/`.metadata`. Causal relations are scored by the `CausalLinker` before insertion. Sync: `ingest_sync(docs)`.
- `async query(query, *, strategy=None, top_k=None, as_of=None) -> WorldModelQueryResult` — hybrid retrieval + answer synthesis. `as_of` (ISO string or `datetime`) filters relations by temporal validity. Sync: `query_sync(...)`.
- `subgraph_to_mermaid(query=None, *, as_of=None) -> str` — render the full graph, or a query-selected subgraph, as a Mermaid `graph LR` diagram (causal edges are labeled `(causal)`).
- `delete_by_metadata(key, values) -> int` — remove indexed vectors by metadata (no-op if the vector store doesn't support deletion).
- `WorldModelRAG.kuzu(path, resolver=None)` — classmethod returning a `KuzuWorldGraphBackend` to pass as `graph_backend=`.

`WorldModelQueryResult` fields: `query`, `strategy`, `subgraph` (a `GraphQueryResult` with `nodes`/`edges`/`documents`/`query_entities`), `embeddings`, `contexts`, `answer`.

---

## `ExtractionPolicy`

Controls what the extractor emits.

```python
from synapsekit import ExtractionPolicy, WorldModelRAG

policy = ExtractionPolicy(
    entities=["person", "org", "product", "event", "location", "concept"],
    relations="open_schema",   # or an explicit list of allowed predicates
    temporal=True,
    causal=True,
    min_confidence=0.55,
)
rag = WorldModelRAG(extraction=policy)
```

---

## Extractors

- `HeuristicWorldModelExtractor` — dependency-free, deterministic. Detects capitalized/`@handle` entities, date literals (`2023`, `2023-04-01`, `Q2 2023`), relation-verb hints, causal markers ("led to", "caused", "unblocked"), and events from dated sentences. Default extractor.
- `LLMWorldModelExtractor(llm)` — prompts an `llm` for strict JSON entities/relations/events with confidence and temporal/causal fields, then validates defensively.

```python
from synapsekit import LLMWorldModelExtractor, WorldModelRAG, OpenAILLM, LLMConfig

extractor = LLMWorldModelExtractor(OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-...")))
rag = WorldModelRAG(extractor=extractor)
```

Both satisfy the `WorldModelExtractor` protocol (`async extract(text, policy) -> ExtractionResult`).

---

## `InMemoryWorldGraphBackend`

The default bitemporal graph backend. Nodes (`WorldModelNode`) track aliases, confidence, and provenance; edges (`WorldModelEdge`) carry `valid_at`, `valid_until`, and a `causal` flag. Entity resolution merges mentions via an `EntityResolver`.

```python
from synapsekit import InMemoryWorldGraphBackend, EntityResolver

backend = InMemoryWorldGraphBackend(resolver=EntityResolver())
result = backend.query_subgraph("Orion launch", max_hops=2, as_of="2022-06-01")
print(result.query_entities)
print(backend.to_mermaid(result))
```

Key methods: `upsert_entity`, `upsert_relation`, `add_event`, `query_subgraph(query, *, max_hops=2, as_of=None, min_confidence=0.0)`, `to_mermaid(result=None)`.

---

## `HybridWorldModelRetriever`

Fuses graph traversal with a vector `Retriever`. Used internally by `WorldModelRAG`, but usable standalone as a `retrieve()`-style retriever.

```python
from synapsekit import HybridWorldModelRetriever, InMemoryWorldGraphBackend, Retriever, InMemoryVectorStore, SynapsekitEmbeddings

retriever = HybridWorldModelRetriever(
    graph_backend=InMemoryWorldGraphBackend(),
    vector_retriever=Retriever(InMemoryVectorStore(SynapsekitEmbeddings())),
    strategy="hybrid",     # "graph_first" | "vector_first" | "hybrid"
    max_hops=2,
    min_confidence=0.0,
)

docs = await retriever.retrieve("query", top_k=5, as_of="2023-01-01")
scored = await retriever.retrieve_with_scores("query", top_k=5)
```

The `"hybrid"` strategy merges graph and vector results with reciprocal rank fusion; `"graph_first"` / `"vector_first"` concatenate in the named order.

---

## `CausalLinker`

Scores candidate causal edges, optionally delegating to an external verifier (e.g. a `NeuroSymbolicAgent`-style scorer with a `score`/`verify` method). Non-causal relations pass through unchanged.

```python
from synapsekit import CausalLinker, WorldModelRAG

rag = WorldModelRAG(causal_linker=CausalLinker(verifier=None, threshold=0.6))
```

---

## Optional Kuzu backend

`KuzuWorldGraphBackend` subclasses the in-memory backend and mirrors entity/relation/event writes into an embedded [Kuzu](https://kuzudb.com/) database on disk, keeping full in-process query behavior while persisting the graph.

```bash
pip install synapsekit[kuzu]
```

```python
from synapsekit import WorldModelRAG, KuzuWorldGraphBackend

backend = KuzuWorldGraphBackend("./world_model.kuzu")
rag = WorldModelRAG(graph_backend=backend)

# Or via the classmethod / string form:
rag = WorldModelRAG(graph_backend=WorldModelRAG.kuzu("./world_model.kuzu"))
rag = WorldModelRAG(graph_backend="kuzu")   # persists to ~/.synapsekit/world_model.kuzu
```

Backends named `"neo4j"` / `"memgraph"` are recognized but currently raise a clear "not available in core" error — use `"in_memory"`, `"kuzu"`, or a custom `GraphBackend`.

---

## API reference

| Symbol | Kind | Purpose |
|---|---|---|
| `WorldModelRAG` | facade | Temporal/causal graph + vector RAG |
| `ExtractionPolicy` | dataclass | Controls entity/relation/temporal/causal extraction |
| `HeuristicWorldModelExtractor` | extractor | Offline, deterministic extractor (default) |
| `LLMWorldModelExtractor` | extractor | LLM JSON extractor |
| `InMemoryWorldGraphBackend` | backend | In-memory bitemporal graph (default) |
| `KuzuWorldGraphBackend` | backend | Optional embedded Kuzu-backed graph |
| `HybridWorldModelRetriever` | retriever | RRF fusion of graph traversal + vector search |
| `CausalLinker` | class | Scores causal edges (optional verifier) |
| `EntityResolver` | class | Alias/name-based entity merging |
| `WorldModelNode` / `WorldModelEdge` | dataclass | Graph node / temporal-causal edge |
| `GraphQueryResult` / `WorldModelQueryResult` | dataclass | Subgraph / full query result |

---

## See also

- [Property Graph RAG](./property-graph.md) — vector search fused with a property graph
- [Knowledge Graph Retrieval](./knowledge-graph.md)
- [Personal Knowledge Mesh](../mesh/index.md) — local-first mesh built on `WorldModelRAG`
