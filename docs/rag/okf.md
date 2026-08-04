---
sidebar_position: 20
---

# Open Knowledge Format (OKF)

[Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf) (OKF v0.1) is Google's vendor-neutral, low-tech format for the curated knowledge agents need: a directory tree of Markdown files, one per *concept* (a dataset, table, metric, ...). Each file is YAML frontmatter (`type` required; `title`, `description`, `resource`, `tags`, `timestamp` optional) plus a Markdown body, and concepts cross-link via ordinary relative Markdown links — so a bundle is effectively a knowledge graph on disk. SynapseKit reads OKF bundles with a loader, and — because the cross-links are already explicit and canonical — maps them straight onto a WorldModel graph with **no** lossy LLM/heuristic extraction.

**Import:**
```python
from synapsekit import (
    OpenKnowledgeFormatLoader,   # OKFLoader is a short alias
    OKFLoader,
    okf_to_world_model,
    KnowledgeMesh,
    MeshConfig,
    InMemoryWorldGraphBackend,
)
```

Install the extra with `pip install synapsekit[okf]` (pulls in PyYAML, used to parse the frontmatter).

---

## Quickstart

`OpenKnowledgeFormatLoader` walks a bundle and yields one `Document` per concept. Frontmatter becomes `metadata`, and in-bundle cross-links are resolved into `metadata["linked_concepts"]` (bundle-relative paths):

```python
from synapsekit import OpenKnowledgeFormatLoader

# path is the bundle root (a directory) or a single .md concept file.
loader = OpenKnowledgeFormatLoader("knowledge/sales")
docs = loader.load()                      # or: await loader.aload()

for doc in docs:
    md = doc.metadata
    print(md["concept_path"], md["okf_type"])   # e.g. "tables/orders.md" table
    print(md.get("title"), md.get("resource"))
    print(md.get("linked_concepts"))             # ["tables/customers.md", ...]
    print(doc.text[:80])                         # the Markdown body
```

Every `Document` carries `metadata`:

| Key | Description |
|---|---|
| `source` | Always `"okf"` |
| `okf_type` | The frontmatter `type` (`None` only when `require_type=False`) |
| `concept_path` | Bundle-relative path, e.g. `"tables/orders.md"` — the concept's stable id |
| `bundle_root` | Absolute path to the bundle root |
| `frontmatter` | The full parsed YAML frontmatter dict |
| `title`, `description`, `resource`, `tags`, `timestamp` | Lifted from frontmatter when present |
| `linked_concepts` | Sorted bundle-relative paths of resolved in-bundle cross-links (when `resolve_links=True`) |

Link resolution excludes external links (`https:`, `mailto:`, protocol-relative `//`), pure anchors, and links that don't resolve to an existing `.md` file inside the bundle — those stay in the body text but are not treated as graph edges. Reserved navigation stubs (`index.md`) are skipped unless you pass `include_index=True`, and concept files with no `type` frontmatter are skipped unless you pass `require_type=False`.

---

## OKF → WorldModel graph

Because a bundle's cross-links are already explicit, `okf_to_world_model` maps the loader's `Document` list directly onto SynapseKit's WorldModel graph — one `WorldModelNode` per concept, one `WorldModelEdge` per resolved link — bypassing the entity resolver (OKF ids are canonical, so the fuzzy merging a resolver does must not apply):

```python
from synapsekit import (
    OpenKnowledgeFormatLoader,
    okf_to_world_model,
    InMemoryWorldGraphBackend,
)

docs = OpenKnowledgeFormatLoader("knowledge/sales").load()

# Defaults to a fresh InMemoryWorldGraphBackend if you don't pass one.
backend = okf_to_world_model(docs, InMemoryWorldGraphBackend())

# One node per concept; node id is a deterministic slug of concept_path.
for node in backend.nodes.values():
    print(node.metadata["concept_path"], node.type)   # "tables/orders.md" table

# One edge per resolved cross-link, predicate "links_to".
for edge in backend.edges.values():
    print(edge.subject_id, edge.predicate, edge.object_id)
```

Node ids are `_slug(concept_path)` — deterministic and path-unique, so the same bundle always yields the same graph and re-ingesting is **idempotent** (it merges onto the same ids instead of duplicating). Frontmatter (`resource`/`tags`/`timestamp`/`okf_type`/`title`/`description`) is mapped onto node `metadata`; `timestamp` also seeds each outgoing edge's `valid_at`. Links to concepts not present in `documents` (e.g. a skipped `index.md`) resolve to no edge. The cross-link predicate defaults to `"links_to"` — override it with `link_predicate=`. Any backend exposing the in-memory storage model (in-memory, Kuzu, Neo4j) is supported; other backends raise `TypeError`.

---

## End-to-end graph RAG with `KnowledgeMesh`

`KnowledgeMesh.ingest_okf(path)` wires the two pieces together: it loads the bundle, vector-indexes each concept body, **and** builds the explicit cross-link graph on the mesh's world model — so you get hybrid graph + vector retrieval over an OKF bundle in one call:

```python
import asyncio
from synapsekit import KnowledgeMesh, MeshConfig

async def main():
    mesh = KnowledgeMesh(
        MeshConfig(vector_backend="memory", graph_backend="memory")
    )

    count = await mesh.ingest_okf("knowledge/sales")
    print(f"ingested {count} concepts")

    # Query through the mesh's WorldModelRAG (graph_first / vector_first / hybrid).
    result = await mesh.query("How does revenue relate to orders?", top_k=5)
    for hit in result.hits:
        print(hit.path)

asyncio.run(main())
```

Link resolution is forced on (the graph needs it), so any `resolve_links` kwarg is ignored; other loader kwargs (e.g. `include_index`, `require_type`, `recursive`) pass straight through. `ingest_okf` returns the number of concepts ingested. Pass `extract_body=True` to *also* run the heuristic WorldModel extractor over the freeform Markdown bodies (in addition to the explicit OKF structure). A synchronous wrapper, `mesh.ingest_okf_sync(path)`, is available for non-async callers.

---

## API reference

### `OpenKnowledgeFormatLoader(path, *, recursive=True, resolve_links=True, include_index=False, require_type=True, encoding="utf-8")`

Loads an OKF bundle into `Document` objects. `OKFLoader` is a short alias for the same class.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `str \| Path` | required | Bundle root (a directory) or a single `.md` concept file |
| `recursive` | `bool` | `True` | Walk subdirectories (directory `path` only) |
| `resolve_links` | `bool` | `True` | Parse Markdown cross-links into `metadata["linked_concepts"]` |
| `include_index` | `bool` | `False` | Include reserved navigation stubs (`index.md`) |
| `require_type` | `bool` | `True` | Skip concepts with no OKF `type` frontmatter; when `False`, emit them with `okf_type=None` |
| `encoding` | `str` | `"utf-8"` | Text encoding used to read concept files |

Methods: `load() -> list[Document]` and `async aload() -> list[Document]`. Files are discovered in deterministic (sorted) order; malformed YAML frontmatter surfaces a warning and is treated as no frontmatter, never a crash.

### `okf_to_world_model(documents, backend=None, *, link_predicate="links_to")`

Builds a WorldModel graph from OKF loader `Document` objects — one node per concept, one edge per resolved cross-link, with deterministic ids and no LLM/heuristic extraction.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `documents` | `list[Document]` | required | Output of `OpenKnowledgeFormatLoader(...).load()` (each carries `concept_path` and, when link resolution was on, `linked_concepts`) |
| `backend` | `GraphBackend \| None` | `None` | Backend to populate; defaults to a fresh `InMemoryWorldGraphBackend` |
| `link_predicate` | `str` | `"links_to"` | Predicate used for cross-link edges |

Returns the populated `backend` (the same instance passed in, or the new one). The build is idempotent. Raises `TypeError` if the backend doesn't expose the world-model storage model.

### `KnowledgeMesh.ingest_okf(path, *, extract_body=False, **loader_kwargs)`

Ingests an OKF bundle end-to-end: vector-indexes each concept body and builds the explicit cross-link graph on the mesh's world model.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `str \| Path` | required | Bundle root or single concept file |
| `extract_body` | `bool` | `False` | Also run the heuristic WorldModel extractor over the Markdown bodies |
| `**loader_kwargs` | | | Forwarded to `OpenKnowledgeFormatLoader` (`resolve_links` is ignored — forced on) |

Returns the number of concepts ingested (`int`). Query the result through `mesh.query(...)` / `mesh.rag`. `ingest_okf_sync(...)` is the synchronous wrapper.

---

## See also

- [Loaders](loaders)
- [Vector stores](vector-stores)
