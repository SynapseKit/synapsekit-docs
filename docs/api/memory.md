---
sidebar_position: 5
---

# Memory API Reference

SynapseKit provides 9 memory backends for conversation history management. All implement `BaseMemory`.

## `BaseMemory` interface

```python
class BaseMemory(ABC):
    async def add(self, role: str, content: str) -> None: ...
    async def get(self) -> list[dict]: ...
    async def clear(self) -> None: ...
    def to_string(self) -> str: ...
    def to_messages(self) -> list[dict]: ...
```

- `add(role, content)` — `role` is `"user"`, `"assistant"`, or `"system"`
- `get()` — returns `[{"role": str, "content": str}, ...]` in chronological order
- `clear()` — removes all messages including from the underlying store
- `to_string()` — formats as `"User: ...\nAssistant: ..."`
- `to_messages()` — synchronous; reads from local cache

---

## `InMemoryConversation`

In-process list. No persistence.

```python
from synapsekit.memory import InMemoryConversation

memory = InMemoryConversation(max_messages: int = 100)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `max_messages` | `int` | `100` | Rolling window — oldest messages dropped when exceeded |

**Thread-safety:** Not thread-safe. Safe for standard asyncio (single-task).

```python
memory = InMemoryConversation(max_messages=20)
await memory.add("user", "What is SynapseKit?")
await memory.add("assistant", "SynapseKit is an async-first Python library.")
```

---

## `SqliteMemory`

SQLite-backed persistent memory.

```python
from synapsekit.memory import SqliteMemory

memory = SqliteMemory(
    db_path: str = "memory.db",
    session_id: str = "default",
    max_messages: int | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `db_path` | `str` | `"memory.db"` | Path to the SQLite database file |
| `session_id` | `str` | `"default"` | Identifier to isolate separate conversations |
| `max_messages` | `int \| None` | `None` | Rolling window; `None` = unlimited |

**Persistence:** Survives process restarts. **Thread-safety:** Safe (WAL mode).

```python
memory = SqliteMemory(db_path="/data/chat.db", session_id="user-123")
await memory.add("user", "Remember my name is Alice")
```

---

## `RedisMemory`

Redis-backed memory.

```python
from synapsekit.memory import RedisMemory

memory = RedisMemory(
    url: str = "redis://localhost:6379",
    session_id: str = "default",
    ttl_seconds: int | None = None,
    max_messages: int | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `url` | `str` | `"redis://localhost:6379"` | Redis connection URL |
| `session_id` | `str` | `"default"` | Key namespace for this conversation |
| `ttl_seconds` | `int \| None` | `None` | Auto-expire after N seconds |
| `max_messages` | `int \| None` | `None` | Rolling window |

**Extra dependency:** `pip install synapsekit[redis]`

---

## `PostgresMemory`

PostgreSQL-backed memory. Table `synapsekit_conversations` is auto-created on first use.

```python
from synapsekit.memory import PostgresMemory

memory = PostgresMemory(
    dsn: str,
    session_id: str = "default",
    max_messages: int | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `dsn` | `str` | required | PostgreSQL connection string |
| `session_id` | `str` | `"default"` | Conversation identifier |
| `max_messages` | `int \| None` | `None` | Rolling window |

**Extra dependency:** `pip install synapsekit[postgres]`

---

## `DynamoDBMemory`

AWS DynamoDB-backed memory.

```python
from synapsekit.memory import DynamoDBMemory

memory = DynamoDBMemory(
    table_name: str,
    session_id: str = "default",
    region: str = "us-east-1",
    max_messages: int | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `table_name` | `str` | required | DynamoDB table name |
| `session_id` | `str` | `"default"` | Partition key value for this conversation |
| `region` | `str` | `"us-east-1"` | AWS region |
| `max_messages` | `int \| None` | `None` | Rolling window |

**Extra dependency:** `pip install synapsekit[aws]`

---

## `MongoMemory`

MongoDB-backed memory.

```python
from synapsekit.memory import MongoMemory

memory = MongoMemory(
    uri: str = "mongodb://localhost:27017",
    db_name: str = "synapsekit",
    collection_name: str = "conversations",
    session_id: str = "default",
    max_messages: int | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `uri` | `str` | `"mongodb://localhost:27017"` | MongoDB connection URI |
| `db_name` | `str` | `"synapsekit"` | Database name |
| `collection_name` | `str` | `"conversations"` | Collection name |
| `session_id` | `str` | `"default"` | Conversation identifier |
| `max_messages` | `int \| None` | `None` | Rolling window |

**Extra dependency:** `pip install synapsekit[mongo]`

---

## `SummaryMemory`

Wraps another backend. When message count exceeds `max_messages`, it runs LLM summarization on the oldest messages and replaces them with a single summary message.

```python
from synapsekit.memory import SummaryMemory

memory = SummaryMemory(
    backend: BaseMemory,
    llm: BaseLLM,
    max_messages: int = 20,
    summary_prompt: str | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `backend` | `BaseMemory` | required | Underlying memory backend to wrap |
| `llm` | `BaseLLM` | required | LLM used to generate summaries |
| `max_messages` | `int` | `20` | Trigger summarization threshold |
| `summary_prompt` | `str \| None` | `None` | Custom summarization prompt |

---

## `VectorMemory`

Stores messages as embeddings. `get()` returns the N most semantically relevant messages to the last user query rather than the N most recent.

```python
from synapsekit.memory import VectorMemory

memory = VectorMemory(
    vector_store: VectorStore,
    max_results: int = 5,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `vector_store` | `VectorStore` | required | Vector store for embedding and retrieval |
| `max_results` | `int` | `5` | Number of relevant messages to return |

---

## `WindowMemory`

Simple fixed-window memory. Always returns the last N messages.

```python
from synapsekit.memory import WindowMemory

memory = WindowMemory(window_size: int = 10)
```

---

## Choosing a memory backend

| Backend | Persistence | Thread-safe | Best for |
|---|---|---|---|
| `InMemoryConversation` | No | No | Single-user dev/testing |
| `WindowMemory` | No | No | Stateless APIs needing recent context |
| `SqliteMemory` | Yes | Yes | Single-server deployments |
| `RedisMemory` | Yes | Yes | Multi-server deployments |
| `PostgresMemory` | Yes | Yes | Existing Postgres infrastructure |
| `DynamoDBMemory` | Yes | Yes | AWS-native deployments |
| `MongoMemory` | Yes | Yes | Existing MongoDB infrastructure |
| `SummaryMemory` | Depends | Depends | Very long conversations |
| `VectorMemory` | Depends | Depends | Semantic recall over long history |

---

---

## `SmartContextManager`

Hierarchical context window management with sliding window pruning, automatic summarization, and prompt caching tags. Manages four context tiers in priority order:

1. System prompt (static, cached)
2. Conversation summary (updated, cached)
3. Search results (dynamic, bounded)
4. Recent messages (sliding window)

`cache_control: {"type": "ephemeral"}` is injected on the system and summary blocks for Anthropic models, enabling up to 80% cost reduction via prompt caching. For non-Anthropic providers the `cache_control` key is ignored by the API.

```python
from synapsekit.memory import SmartContextManager

manager = SmartContextManager(
    cheap_llm: BaseLLM | None = None,
    max_recent_tokens: int = 4000,
    max_search_tokens: int = 2000,
    chars_per_token: int = 4,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `cheap_llm` | `BaseLLM \| None` | `None` | LLM used to summarize old messages when the recent buffer overflows; if `None`, oldest messages are dropped without summarization |
| `max_recent_tokens` | `int` | `4000` | Maximum tokens in the recent messages buffer before summarization triggers |
| `max_search_tokens` | `int` | `2000` | Maximum tokens of search result context to include |
| `chars_per_token` | `int` | `4` | Character-to-token ratio used for estimation |

### Methods

- `set_system(content: str) -> None` — set the static system prompt
- `set_search_results(content: str) -> None` — replace the current search results block
- `clear_search_results() -> None` — remove search results from the context
- `add(role: str, content: str) -> None` — append a message to the recent buffer
- `async get_messages() -> list[dict]` — return the full hierarchical message list; summarizes older messages if the buffer is over budget; injects `cache_control` on system and summary blocks
- `clear() -> None` — reset all context including messages, summary, system, and search results
- `summary` — (property) the current running summary string
- `len(manager)` — number of messages in the recent buffer

```python
import asyncio
from synapsekit import AnthropicLLM, LLMConfig
from synapsekit.memory import SmartContextManager

async def main():
    cheap_llm = AnthropicLLM(LLMConfig(model="claude-3-haiku-20240307", api_key="sk-ant-..."))
    main_llm = AnthropicLLM(LLMConfig(model="claude-3-5-sonnet-20241022", api_key="sk-ant-..."))

    manager = SmartContextManager(
        cheap_llm=cheap_llm,
        max_recent_tokens=4000,
        max_search_tokens=2000,
    )

    # Set a static system prompt (will be cached by Anthropic)
    manager.set_system(
        "You are a helpful research assistant. "
        "Answer questions based on the provided search results."
    )

    # Inject search results for the current query
    manager.set_search_results(
        "SynapseKit v1.9.0 adds SmartContextManager, PrometheusMetrics, "
        "and ContinuousTrainer to its feature set."
    )

    # Add conversation turns
    manager.add("user", "What is new in SynapseKit v1.9.0?")
    manager.add("assistant", "SynapseKit v1.9.0 introduces SmartContextManager, "
                             "PrometheusMetrics, and ContinuousTrainer.")
    manager.add("user", "How does SmartContextManager reduce costs?")

    # get_messages() may summarize old messages and always injects cache_control
    messages = await manager.get_messages()

    # Pass directly to the Anthropic LLM
    response = await main_llm.generate_with_messages(messages)
    print(response)

asyncio.run(main())
```

---

## See also

- [Memory guide](../memory/conversation)
- [How agents work](../concepts/agents)
