---
sidebar_position: 4
---

# Vector Store Backends

22 backends available. All implement the `VectorStore` ABC and share the same interface.

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

## WeaviateVectorStore

[Weaviate](https://weaviate.io/) — open-source vector database with multi-modal support and cloud-managed offering.

```bash
pip install synapsekit[weaviate]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.weaviate import WeaviateVectorStore

embeddings = SynapsekitEmbeddings()

# Local Weaviate instance
store = WeaviateVectorStore(embeddings, collection_name="Docs")

# Weaviate Cloud
store = WeaviateVectorStore(
    embeddings,
    collection_name="Docs",
    url="https://your-cluster.weaviate.network",
    api_key="your-weaviate-api-key",
)

# Pass an existing client
import weaviate
client = weaviate.connect_to_local()
store = WeaviateVectorStore(embeddings, client=client)

await store.add(["doc text..."], metadata=[{"source": "manual"}])
results = await store.search("query", top_k=5)
results = await store.search("query", metadata_filter={"source": "manual"})
```

| Parameter | Default | Description |
|---|---|---|
| `embedding_backend` | — | `SynapsekitEmbeddings` instance |
| `collection_name` | `"SynapseKit"` | Weaviate collection to use or create |
| `client` | `None` | Pass a pre-built `weaviate.Client` |
| `url` | `None` | Weaviate instance URL |
| `api_key` | `None` | API key for Weaviate Cloud |

:::note
The collection is created automatically on the first `add()` call if it doesn't already exist.
:::

---

## PGVectorStore

PostgreSQL with the [pgvector](https://github.com/pgvector/pgvector) extension — cosine, L2, and inner-product distance.

```bash
pip install synapsekit[pgvector]
```

:::note Prerequisites
The PostgreSQL user must have permission to run `CREATE EXTENSION IF NOT EXISTS vector`. On managed PostgreSQL (RDS, Cloud SQL), this requires `rds_superuser` or the extension must be pre-installed by an admin.
:::

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.pgvector import PGVectorStore, DistanceStrategy

embeddings = SynapsekitEmbeddings()

store = PGVectorStore(
    embeddings,
    connection_string="postgresql://user:pass@localhost/mydb",
    table_name="documents",                        # created automatically
    distance_strategy=DistanceStrategy.COSINE,     # default
)

await store.add(["doc text..."], metadata=[{"source": "wiki"}])
results = await store.search("query", top_k=5)
results = await store.search("query", metadata_filter={"source": "wiki"})
```

**Distance strategies**

| `DistanceStrategy` | SQL operator | Best for |
|---|---|---|
| `COSINE` | `<=>` | Normalized embeddings (default) |
| `L2` | `<->` | Euclidean similarity |
| `INNER_PRODUCT` | `<#>` | Dot-product similarity |

| Parameter | Default | Description |
|---|---|---|
| `embedding_backend` | — | `SynapsekitEmbeddings` instance |
| `connection_string` | — | psycopg3 connection string |
| `table_name` | `"documents"` | Table name (created if missing) |
| `distance_strategy` | `COSINE` | Distance metric |

---

## MilvusVectorStore

[Milvus](https://milvus.io/) — open-source vector database with IVF_FLAT and HNSW index support.

```bash
pip install synapsekit[milvus]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.milvus import MilvusVectorStore, MilvusIndexType

embeddings = SynapsekitEmbeddings()

# IVF_FLAT (default)
store = MilvusVectorStore(
    embeddings,
    collection_name="synapsekit",
    uri="http://localhost:19530",
)

# HNSW index
store = MilvusVectorStore(
    embeddings,
    collection_name="synapsekit",
    index_type=MilvusIndexType.HNSW,
    m=16,
    ef_construction=200,
    ef=64,
)

# Zilliz Cloud (managed Milvus)
store = MilvusVectorStore(
    embeddings,
    uri="https://your-cluster.zillizcloud.com",
    token="your-api-token",
)

await store.add(["doc text..."], metadata=[{"category": "tech"}])
results = await store.search("query", top_k=5)
results = await store.search("query", metadata_filter={"category": "tech"})
```

| Parameter | Default | Description |
|---|---|---|
| `embedding_backend` | — | `SynapsekitEmbeddings` instance |
| `collection_name` | `"synapsekit"` | Milvus collection name |
| `uri` | `"http://localhost:19530"` | Milvus server URI |
| `token` | `None` | API token (Zilliz Cloud) |
| `index_type` | `IVF_FLAT` | `IVF_FLAT` or `HNSW` |
| `metric_type` | `"COSINE"` | Distance metric |
| `nlist` | `128` | IVF_FLAT: number of cluster units |
| `nprobe` | `8` | IVF_FLAT: clusters to search at query time |
| `m` | `16` | HNSW: number of edges per node |
| `ef_construction` | `200` | HNSW: size of dynamic candidate list |
| `ef` | `64` | HNSW: search depth |

---

## LanceDBVectorStore

[LanceDB](https://lancedb.com/) — embedded vector database, no server required. Persists to local disk or cloud storage.

```bash
pip install synapsekit[lancedb]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.lancedb import LanceDBVectorStore

embeddings = SynapsekitEmbeddings()

# Local storage (default)
store = LanceDBVectorStore(embeddings, uri=".lancedb", table_name="docs")

# S3 or GCS
store = LanceDBVectorStore(
    embeddings,
    uri="s3://my-bucket/lancedb",
    table_name="docs",
)

await store.add(["doc text..."], metadata=[{"topic": "ai"}])
results = await store.search("query", top_k=5)
results = await store.search("query", metadata_filter={"topic": "ai"})
```

| Parameter | Default | Description |
|---|---|---|
| `embedding_backend` | — | `SynapsekitEmbeddings` instance |
| `uri` | `".lancedb"` | Storage path or cloud URI |
| `table_name` | `"synapsekit"` | LanceDB table name (created if missing) |
| `text_field` | `"text"` | Column name for document text |
| `vector_field` | `"embedding"` | Column name for embedding vectors |

:::note
LanceDB is embedded — no separate server process needed. Tables are created on the first `add()` call. FTS index is built automatically for full-text search.
:::

---

## SQLiteVecStore

Zero-infrastructure vector store backed by [`sqlite-vec`](https://github.com/asg017/sqlite-vec). Stores embeddings in a local SQLite file — persistent across sessions, no server needed.

```bash
pip install synapsekit[sqlite-vec]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.sqlite_vec import SQLiteVecStore

embeddings = SynapsekitEmbeddings()

store = SQLiteVecStore(embeddings, db_path="./my_store.db")

await store.add(["chunk one", "chunk two"], metadata=[{"src": "doc1"}, {"src": "doc2"}])

results = await store.search("my query", top_k=3)
```

| Parameter | Default | Description |
|---|---|---|
| `embedding_backend` | — | `SynapsekitEmbeddings` instance |
| `db_path` | `"synapsekit.db"` | Path to the SQLite database file |
| `table_name` | `"vectors"` | Table name within the database |

:::note
`SQLiteVecStore` is a drop-in replacement for `InMemoryVectorStore` when you need persistence between process restarts without running a separate vector database server.
:::

---

## MongoDBAtlasVectorStore

[MongoDB Atlas Vector Search](https://www.mongodb.com/docs/atlas/atlas-vector-search/) — managed cloud vector search on your Atlas cluster.

```bash
pip install synapsekit[mongodb]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.mongodb_atlas import MongoDBAtlasVectorStore

embeddings = SynapsekitEmbeddings()

store = MongoDBAtlasVectorStore(
    embeddings,
    connection_string="mongodb+srv://user:pass@cluster.mongodb.net",
    database="mydb",
    collection="documents",
    index_name="vector_index",
)

await store.add(["doc text..."], metadata=[{"topic": "ai"}])
results = await store.search("query", top_k=5)
```

---

## VespaVectorStore

[Vespa](https://vespa.ai/) — open-source search and recommendation engine with BM25+ANN hybrid retrieval.

```bash
pip install synapsekit[vespa]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.vespa import VespaVectorStore

embeddings = SynapsekitEmbeddings()

store = VespaVectorStore(
    embeddings,
    url="http://localhost:8080",
    application="myapp",
    schema="doc",
)

await store.add(["doc text..."])
results = await store.search("query", top_k=5)
```

---

## RedisVectorStore

Redis Stack with the RediSearch module for vector similarity search.

```bash
pip install synapsekit[redis]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.redis_vector import RedisVectorStore

embeddings = SynapsekitEmbeddings()

store = RedisVectorStore(
    embeddings,
    url="redis://localhost:6379",
    index_name="synapsekit_idx",
)

await store.add(["doc text..."])
results = await store.search("query", top_k=5)
```

---

## ElasticsearchVectorStore

Elasticsearch 8+ dense_vector kNN search.

```bash
pip install synapsekit[elasticsearch]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.elasticsearch_vector import ElasticsearchVectorStore

embeddings = SynapsekitEmbeddings()

store = ElasticsearchVectorStore(
    embeddings,
    hosts=["http://localhost:9200"],
    index_name="synapsekit_docs",
)

await store.add(["doc text..."])
results = await store.search("query", top_k=5)
```

---

## OpenSearchVectorStore

OpenSearch with the kNN plugin using HNSW or IVF index.

```bash
pip install synapsekit[opensearch]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.opensearch import OpenSearchVectorStore

embeddings = SynapsekitEmbeddings()

store = OpenSearchVectorStore(
    embeddings,
    hosts=[{"host": "localhost", "port": 9200}],
    index_name="synapsekit_docs",
)

await store.add(["doc text..."])
results = await store.search("query", top_k=5)
```

---

## SupabaseVectorStore

[Supabase](https://supabase.com/) pgvector backend via the Supabase Python client.

```bash
pip install synapsekit[supabase]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.supabase_vector import SupabaseVectorStore

embeddings = SynapsekitEmbeddings()

store = SupabaseVectorStore(
    embeddings,
    supabase_url="https://xyz.supabase.co",
    supabase_key="your-service-key",
    table_name="documents",
)

await store.add(["doc text..."])
results = await store.search("query", top_k=5)
```

---

## TypesenseVectorStore

[Typesense](https://typesense.org/) hybrid vector + keyword search.

```bash
pip install synapsekit[typesense]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.typesense import TypesenseVectorStore

embeddings = SynapsekitEmbeddings()

store = TypesenseVectorStore(
    embeddings,
    api_key="xyz",
    host="localhost",
    port=8108,
    collection_name="synapsekit_docs",
)

await store.add(["doc text..."])
results = await store.search("query", top_k=5)
```

---

## MarqoVectorStore

[Marqo](https://www.marqo.ai/) multimodal search with built-in embedding generation.

```bash
pip install synapsekit[marqo]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.marqo import MarqoVectorStore

embeddings = SynapsekitEmbeddings()

store = MarqoVectorStore(
    embeddings,
    url="http://localhost:8882",
    index_name="synapsekit-docs",
)

await store.add(["doc text..."])
results = await store.search("query", top_k=5)
```

---

## ZillizVectorStore

[Zilliz Cloud](https://zilliz.com/) — managed Milvus with a dedicated cluster class.

```bash
pip install synapsekit[milvus]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.zilliz import ZillizVectorStore

embeddings = SynapsekitEmbeddings()

store = ZillizVectorStore(
    embeddings,
    uri="https://your-cluster.zillizcloud.com",
    token="your-api-token",
    collection_name="synapsekit",
)

await store.add(["doc text..."])
results = await store.search("query", top_k=5)
```

---

## DuckDBVectorStore

In-process analytical vector store backed by DuckDB. Embedded, no server required.

```bash
pip install synapsekit[duckdb-vector]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.duckdb import DuckDBVectorStore

embeddings = SynapsekitEmbeddings()

store = DuckDBVectorStore(embeddings, db_path="./vectors.duckdb")

await store.add(["chunk one", "chunk two"])
results = await store.search("query", top_k=5)
```

| Parameter | Default | Description |
|---|---|---|
| `embedding_backend` | — | `SynapsekitEmbeddings` instance |
| `db_path` | `":memory:"` | DuckDB database path; `":memory:"` for ephemeral |
| `table_name` | `"vectors"` | Table name |

---

## ClickHouseVectorStore

ClickHouse cosine/L2 vector search for high-throughput analytical workloads.

```bash
pip install synapsekit[clickhouse]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.clickhouse import ClickHouseVectorStore

embeddings = SynapsekitEmbeddings()

store = ClickHouseVectorStore(
    embeddings,
    host="localhost",
    port=8123,
    database="default",
    table="synapsekit_vectors",
)

await store.add(["doc text..."])
results = await store.search("query", top_k=5)
```

---

## CassandraVectorStore

Apache Cassandra / DataStax Astra DB with SAI (Storage-Attached Index) vector search.

```bash
pip install synapsekit[cassandra]
```

```python
from synapsekit import SynapsekitEmbeddings
from synapsekit.retrieval.cassandra import CassandraVectorStore

embeddings = SynapsekitEmbeddings()

# Local Cassandra
store = CassandraVectorStore(
    embeddings,
    contact_points=["127.0.0.1"],
    keyspace="synapsekit",
    table_name="vectors",
)

# DataStax Astra DB
store = CassandraVectorStore(
    embeddings,
    astra_db_id="your-db-id",
    astra_token="AstraCS:...",
    keyspace="synapsekit",
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
