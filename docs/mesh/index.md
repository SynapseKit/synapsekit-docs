---
sidebar_position: 1
title: "Personal Knowledge Mesh — Local-First RAG over your files"
description: "Local-first, offline knowledge mesh in Python: SQLite incremental indexing, hash embeddings, privacy filtering, cross-project entity resolution, duplicate detection, CLI + MCP tools."
keywords: [local first rag python, personal knowledge mesh, offline rag python, markdown git rag, synapsekit mesh cli, mesh mcp server]
---

# Personal Knowledge Mesh

The Personal Knowledge Mesh indexes your local markdown and git repositories into a **local-first, offline-by-default** knowledge base you can query from the CLI, from Python, or from any MCP client. It runs with zero network calls: incremental indexing is tracked in SQLite, embeddings use a deterministic numpy-only hash backend, and answers cite exact files and line ranges. On top of that it adds privacy filtering (secrets are never indexed), cross-project entity resolution (the same concept across repos is merged), and duplicate detection. It is built on [`WorldModelRAG`](../rag/world-model.md), so the graph side is temporal and causal too.

**Install:** `pip install synapsekit[mesh]` (adds `sqlite-vec` and `kuzu`). The mesh also runs on core alone using the in-memory vector store and graph.

**Import:**
```python
from synapsekit.mesh import KnowledgeMesh, MeshConfig, MeshDaemon
```

---

## Quickstart

### CLI

```bash
# Index the current directory (and any git repos under it), then query it.
synapsekit mesh --root . reindex
synapsekit mesh --root . query "how does incremental indexing work?"

# Check status and find duplicated concepts across projects.
synapsekit mesh --root . status
```

### Python

```python
from synapsekit.mesh import KnowledgeMesh, MeshConfig

mesh = KnowledgeMesh(MeshConfig(roots=["."]))

summary = mesh.reindex_sync()
print(f"indexed {summary.ingested_chunks} chunks in {summary.duration_seconds:.2f}s")

result = mesh.query_sync("how does incremental indexing work?", top_k=5)
print(result.answer)
for hit in result.hits:
    print(f"{hit.path}:{hit.line_start} (score={hit.score:.3f})")

for dup in mesh.duplicates(limit=10):
    print(dup.left_path, "≈", dup.right_path, round(dup.score, 2))
```

`reindex`/`query` also have async forms (`await mesh.reindex()`, `await mesh.query(...)`).

---

## How it works

**Local-first & offline.** No LLM or API key is required. When you don't pass an `llm`, the mesh uses `LocalMeshLLM` and returns ranked, cited hits directly. Embeddings come from `HashingEmbeddings`, a deterministic numpy-only backend (default 384 dims) — so the mesh is useful before any semantic model is downloaded.

**SQLite incremental indexing.** `MeshIndexStore` records each file's content hash and mtime plus per-chunk metadata. On `reindex()`, only files whose hash/mtime changed are re-embedded; stale chunks are removed from the vector store. Pass `force=True` to reindex everything.

**Loaders.** `LocalMdLoader` walks a root for markdown/design-doc files (see default includes below), strips frontmatter, splits by heading section into line-numbered chunks, and stamps each chunk with `path`, `headings`, `content_hash`, and `chunk_id`. `GitRepoLoader` discovers git repos under a root, loads their docs, and (unless disabled) indexes recent commit subjects as a `git_history` document.

**Privacy filtering.** `MeshPrivacyFilter` applies gitignore-style rules from `~/.synapsekit/mesh.ignore`, skips VCS/build/cache directories, refuses secret-like filenames (`.env`, `*.key`, `id_rsa`, `*secret*`, …), and redacts sensitive lines (API keys, passwords, private-key blocks) from file text before it is ever indexed.

**Cross-project entity resolution.** `CrossProjectEntityResolver` extends the world-model `EntityResolver` with conservative concept aliasing (CamelCase splitting, dropping suffixes like `Service`/`Handler`/`Api`), so `AuthService` in one repo and `auth service` in another resolve to the same graph entity.

**Duplicate detection.** `DuplicationDetector` fingerprints chunks into token sets and reports cross-file pairs above a Jaccard-similarity threshold (default `0.72`), surfacing repeated concepts across projects.

**Optional Kuzu graph backend.** With `graph_backend="kuzu"` (or `"auto"`) the mesh persists its entity/relation graph to an embedded Kuzu database, falling back to the in-memory graph when Kuzu isn't installed.

---

## `KnowledgeMesh`

```python
from synapsekit.mesh import KnowledgeMesh, MeshConfig

mesh = KnowledgeMesh(
    config=MeshConfig(...),
    rag=None,               # bring your own WorldModelRAG
    llm=None,               # defaults to offline LocalMeshLLM
    extractor=None,
    graph_backend=None,
    vector_store=None,
    privacy_filter=None,
)
```

### Methods

| Method | Returns | Description |
|---|---|---|
| `async reindex(*, force=False)` / `reindex_sync` | `MeshIndexSummary` | Incrementally index changed files (all files if `force`) |
| `async query(query, *, top_k=None, strategy="hybrid")` / `query_sync` | `MeshQueryResult` | Query and return ranked hits with file/line citations |
| `duplicates(*, limit=20)` | `list[DuplicationMatch]` | Likely duplicate chunks across projects |
| `status()` | `MeshStatus` | Index state, counts, backends, and paths |
| `as_mcp_tools()` | `list[BaseTool]` | Build the four MCP tools for this mesh |

`MeshHit` fields: `text`, `score`, `path`, `line_start`, `line_end`, `headings`, `repo_root`, `metadata`.

---

## `MeshConfig`

| Field | Default | Description |
|---|---|---|
| `roots` | `[cwd]` | Directories to index |
| `include` | `DEFAULT_MESH_INCLUDES` | Glob patterns to index (`*.md`, `README*`, `CLAUDE.md`, `AGENTS.md`, `ADR*.md`, `docs/**/*.md`, …) |
| `ignore_file` | `~/.synapsekit/mesh.ignore` | Gitignore-style ignore file |
| `state_dir` | `~/.synapsekit/mesh` | Where SQLite index + vectors live |
| `db_path` | `None` | Override for the `sqlite-vec` database path |
| `graph_path` | `None` | Override for the Kuzu graph database path |
| `vector_backend` | `"auto"` | `"auto"` \| `"memory"` \| `"sqlite_vec"` |
| `graph_backend` | `"memory"` | `"auto"` \| `"memory"` \| `"kuzu"` |
| `use_git` | `True` | Discover and index git repos |
| `include_git_history` | `True` | Index recent commit subjects |
| `chunk_chars` | `4000` | Max characters per chunk |
| `embedding_dimensions` | `384` | Hash-embedding dimensionality |
| `retrieval_top_k` | `5` | Default hit count |

---

## `MeshDaemon`

Runs the initial index and, with `--watch`, polls for changes on an interval. `stop` signals a running watcher by PID and marks the mesh stopped.

```python
from synapsekit.mesh import KnowledgeMesh, MeshDaemon, MeshDaemonConfig

daemon = MeshDaemon(KnowledgeMesh(), config=MeshDaemonConfig(poll_interval=5.0, watch=True))
daemon.start_sync(watch=True)   # blocks, re-indexing every 5s until stopped
```

---

## CLI reference

Run subcommands as `synapsekit mesh [global options] <command> [options]`.

**Global options:** `--root DIR` (repeatable), `--include GLOB` (repeatable), `--ignore-file`, `--state-dir`, `--db`, `--graph-db`, `--graph-backend {auto,memory,kuzu}`, `--vector-backend {auto,memory,sqlite_vec}`, `--no-git`, `--no-git-history`, `--json`.

| Command | Options | Description |
|---|---|---|
| `reindex` | `--force` | Incrementally reindex changed files |
| `query` | `<query>`, `--top-k N` | Query the mesh; prints the answer (or full JSON with `--json`) |
| `status` | — | Print index state, counts, backends, and paths |
| `start` | `--watch`, `--poll-interval SECS` | Index once, then optionally keep watching |
| `stop` | — | Mark the mesh daemon stopped |
| `mcp` | — | Serve the mesh as an MCP server over stdio |

:::note Duplicates
Duplicate detection is exposed through the Python API (`mesh.duplicates()`) and the `mesh_duplicates` MCP tool rather than a dedicated CLI subcommand.
:::

---

## MCP tools

`KnowledgeMesh.as_mcp_tools()` (or `synapsekit mesh mcp`) exposes the mesh to any MCP client. See [MCP integration](../agents/mcp.md) for connecting clients.

| Tool | Params | Purpose |
|---|---|---|
| `mesh_query` | `query` (required), `top_k` | Query with file/line citations |
| `mesh_reindex` | `force` | Incrementally reindex changed documents |
| `mesh_duplicates` | `limit` | Find likely duplicate concepts across projects |
| `mesh_status` | — | Return indexing status |

```python
from synapsekit.mcp import MCPServer
from synapsekit.mesh import KnowledgeMesh

mesh = KnowledgeMesh()
MCPServer(name="synapsekit-mesh", tools=mesh.as_mcp_tools()).run()
```

---

## API reference

| Symbol | Kind | Purpose |
|---|---|---|
| `KnowledgeMesh` | class | Local-first mesh: index, query, duplicates, status |
| `MeshConfig` | dataclass | Roots, includes, backends, state paths |
| `MeshDaemon` / `MeshDaemonConfig` | class | Index + optional polling watcher |
| `MeshHit` / `MeshQueryResult` | dataclass | Ranked hit / query result |
| `MeshIndexSummary` / `MeshStatus` | dataclass | Reindex summary / status snapshot |
| `LocalMdLoader` / `GitRepoLoader` | loaders | Markdown and git-repo loaders |
| `HashingEmbeddings` | class | Offline numpy-only hash embeddings |
| `MeshPrivacyFilter` / `PrivacyDecision` | class | Secret filtering and redaction |
| `CrossProjectEntityResolver` | class | Cross-repo entity merging |
| `DuplicationDetector` / `DuplicationMatch` | class | Duplicate concept detection |
| `MeshQueryTool` / `MeshReindexTool` / `MeshDuplicatesTool` / `MeshStatusTool` | MCP tools | Mesh tools for MCP clients |

---

## See also

- [WorldModelRAG](../rag/world-model.md) — the temporal/causal graph engine under the mesh
- [Property Graph RAG](../rag/property-graph.md)
- [MCP integration](../agents/mcp.md)
