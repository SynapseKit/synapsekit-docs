---
sidebar_position: 1
---

# Conversation Memory

`ConversationMemory` maintains a sliding window of recent messages for multi-turn conversations.

## Usage

```python
from synapsekit.memory import ConversationMemory

memory = ConversationMemory(window_size=10)

memory.add_user("What is SynapseKit?")
memory.add_assistant("SynapseKit is an async-first RAG framework.")

memory.add_user("How do I install it?")
memory.add_assistant("Run: pip install synapsekit[openai]")

# Get full history as a list of dicts
history = memory.get()
# [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}, ...]

# Clear memory
memory.clear()
```

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `window_size` | `10` | Max number of message pairs to keep |

When the window fills up, the oldest messages are dropped automatically.

---

## HybridMemory

`HybridMemory` combines a sliding window of recent messages with an LLM-generated summary of older messages. This gives the model both precise recent context and compressed long-term context, reducing token usage while preserving important information.

### Usage

```python
from synapsekit.memory.hybrid import HybridMemory

memory = HybridMemory(llm=llm, window=5, summary_max_tokens=200)

memory.add("user", "What is SynapseKit?")
memory.add("assistant", "SynapseKit is an async-first RAG framework.")
memory.add("user", "How do I install it?")
memory.add("assistant", "Run: pip install synapsekit")
# ... many more messages ...
```

### Getting messages with summary

When the conversation exceeds the window size, older messages are summarized:

```python
# If <= window*2 messages, returns all messages unchanged
messages = await memory.get_messages_with_summary()

# If > window*2 messages, older messages are replaced by a summary:
# [
#   {"role": "system", "content": "Summary of earlier conversation:\n..."},
#   {"role": "user", "content": "most recent question"},
#   {"role": "assistant", "content": "most recent answer"},
#   ...
# ]
```

### Formatting for prompts

Use `format_context()` to get a formatted string suitable for prompt injection:

```python
context = await memory.format_context()
# "System: Summary of earlier conversation:\n...\nUser: latest question\nAssistant: latest answer"
```

### Other methods

```python
# All messages (no summary)
all_msgs = memory.get_messages()

# Only the recent window
recent = memory.get_recent_messages()

# Current summary (empty until first summarization)
print(memory.summary)

# Message count
print(len(memory))

# Clear everything
memory.clear()
```

### Parameters

| Parameter | Default | Description |
|---|---|---|
| `llm` | — | LLM instance used for summarization |
| `window` | `5` | Number of message pairs to keep in the recent window |
| `summary_max_tokens` | `200` | Max tokens for the summary |

### Methods

| Method | Returns | Description |
|---|---|---|
| `add(role, content)` | `None` | Append a message |
| `get_messages()` | `list[dict]` | All messages, no summary |
| `get_recent_messages()` | `list[dict]` | Only the recent window of messages |
| `get_messages_with_summary()` | `list[dict]` | Recent messages + summary of older ones (async) |
| `format_context()` | `str` | Formatted conversation string with summary (async) |
| `clear()` | `None` | Clear all messages and summary |

---

## SQLiteConversationMemory

`SQLiteConversationMemory` persists chat history to SQLite. Messages survive process restarts. Supports multiple conversations via `conversation_id` and an optional sliding window.

### Usage

```python
from synapsekit.memory.sqlite import SQLiteConversationMemory

memory = SQLiteConversationMemory(
    db_path="chat.db",
    conversation_id="user-1",
    window=10,  # Optional: keep only last N message pairs
)

memory.add("user", "Hello!")
memory.add("assistant", "Hi there!")

# Messages are persisted to disk
messages = memory.get_messages()
# [{"role": "user", "content": "Hello!"}, {"role": "assistant", "content": "Hi there!"}]
```

### Multiple conversations

```python
# Each conversation_id has its own history
user1_memory = SQLiteConversationMemory(db_path="chat.db", conversation_id="user-1")
user2_memory = SQLiteConversationMemory(db_path="chat.db", conversation_id="user-2")

# List all conversations in the database
conversations = user1_memory.list_conversations()
# ["user-1", "user-2"]
```

### Metadata support

```python
memory.add("user", "Hello!", metadata={"timestamp": "2026-03-13", "source": "web"})

messages = memory.get_messages()
# [{"role": "user", "content": "Hello!", "metadata": {"timestamp": "2026-03-13", "source": "web"}}]
```

### Formatting for prompts

```python
context = memory.format_context()
# "User: Hello!\nAssistant: Hi there!"
```

### Parameters

| Parameter | Default | Description |
|---|---|---|
| `db_path` | `"conversations.db"` | Path to the SQLite database file |
| `conversation_id` | `"default"` | Identifier for this conversation |
| `window` | `None` | Max message pairs to keep (oldest are deleted) |

### Methods

| Method | Returns | Description |
|---|---|---|
| `add(role, content, metadata=None)` | `None` | Append a message |
| `get_messages()` | `list[dict]` | All messages for this conversation |
| `format_context()` | `str` | Formatted conversation string |
| `clear()` | `None` | Delete all messages for this conversation |
| `list_conversations()` | `list[str]` | All conversation IDs in the database |
| `close()` | `None` | Close the database connection |

---

## SummaryBufferMemory

`SummaryBufferMemory` tracks approximate token count and progressively summarizes older messages when the buffer exceeds a token limit. Unlike `HybridMemory` (fixed window), this uses token estimation to decide when to summarize.

### Usage

```python
from synapsekit.memory.summary_buffer import SummaryBufferMemory

memory = SummaryBufferMemory(
    llm=llm,
    max_tokens=2000,
    chars_per_token=4,  # Estimation ratio
)

memory.add("user", "Hello!")
memory.add("assistant", "Hi there!")

# When under token limit, returns all messages as-is
messages = await memory.get_messages()

# When over limit, oldest message pairs are summarized
# and replaced with a system message containing the summary
```

### How summarization works

1. When `get_messages()` is called, the buffer's token count is estimated
2. If under `max_tokens`, all messages are returned unchanged
3. If over `max_tokens`, the oldest 2 messages are summarized by the LLM
4. The summary is stored and prepended as a system message
5. This repeats until the buffer is under the limit (keeping at least 2 messages)

### Formatting for prompts

```python
# Sync, no summarization — just flattens current state
context = memory.format_context()
# "Summary: ...\nUser: latest question\nAssistant: latest answer"
```

### Parameters

| Parameter | Default | Description |
|---|---|---|
| `llm` | — | LLM instance used for summarization |
| `max_tokens` | `2000` | Token budget for the buffer (must be >= 100) |
| `chars_per_token` | `4` | Characters per token for estimation |

### Methods

| Method | Returns | Description |
|---|---|---|
| `add(role, content)` | `None` | Append a message |
| `get_messages()` | `list[dict]` | Messages with automatic summarization (async) |
| `format_context()` | `str` | Formatted string, sync, no summarization |
| `clear()` | `None` | Clear all messages and summary |
| `summary` | `str` | The current running summary (property) |

---

## TokenBufferMemory

`TokenBufferMemory` tracks approximate token count and drops the oldest messages when the buffer exceeds a token limit. Unlike `SummaryBufferMemory`, this does **not** use an LLM — it simply discards the oldest messages to stay within budget.

### Usage

```python
from synapsekit.memory.token_buffer import TokenBufferMemory

memory = TokenBufferMemory(
    max_tokens=4000,
    chars_per_token=4,  # Estimation ratio
)

memory.add("user", "Hello!")
memory.add("assistant", "Hi there! How can I help you today?")

# Messages are returned as-is (no async, no LLM needed)
messages = memory.get_messages()
# [{"role": "user", "content": "Hello!"}, {"role": "assistant", "content": "..."}]
```

### How it works

1. When `add()` is called, the message is appended to the buffer
2. The total token count is estimated (`len(content) // chars_per_token`)
3. If the total exceeds `max_tokens`, the oldest messages are dropped one at a time until the buffer fits

### Formatting for prompts

```python
context = memory.format_context()
# "User: Hello!\nAssistant: Hi there! How can I help you today?"
```

### Parameters

| Parameter | Default | Description |
|---|---|---|
| `max_tokens` | `4000` | Token budget for the buffer (must be >= 1) |
| `chars_per_token` | `4` | Characters per token for estimation |

### Methods

| Method | Returns | Description |
|---|---|---|
| `add(role, content)` | `None` | Append a message and trim if over budget |
| `get_messages()` | `list[dict]` | Current message history (sync) |
| `format_context()` | `str` | Formatted conversation string (sync) |
| `clear()` | `None` | Clear all messages |

---

## BufferMemory

`BufferMemory` is the simplest memory backend — an unbounded buffer that keeps all messages until cleared. No windowing, no trimming, no LLM calls.

### Usage

```python
from synapsekit.memory.buffer import BufferMemory

memory = BufferMemory()

memory.add("user", "Hello!")
memory.add("assistant", "Hi there!")

messages = memory.get_messages()
# [{"role": "user", "content": "Hello!"}, {"role": "assistant", "content": "Hi there!"}]

context = memory.format_context()
# "User: Hello!\nAssistant: Hi there!"

print(len(memory))  # 2
memory.clear()
```

### Methods

| Method | Returns | Description |
|---|---|---|
| `add(role, content)` | `None` | Append a message |
| `get_messages()` | `list[dict]` | All messages (copy) |
| `format_context()` | `str` | Formatted conversation string |
| `clear()` | `None` | Clear all messages |

---

## EntityMemory

`EntityMemory` uses an LLM to extract named entities from each message and maintains running descriptions. Useful for tracking people, places, organizations, and concepts across a conversation.

### Usage

```python
from synapsekit.memory.entity import EntityMemory

memory = EntityMemory(llm=llm, max_entities=50)

await memory.add("user", "Alice works at Acme Corp in Paris.")
await memory.add("assistant", "That's great! Acme Corp is a tech company.")

# View tracked entities
entities = memory.get_entities()
# {"Alice": "A person who works at Acme Corp in Paris.",
#  "Acme Corp": "A tech company located in Paris.",
#  "Paris": "A city where Acme Corp is located."}
```

### How it works

1. When `add()` is called, the LLM extracts entity names from the message
2. For each entity, the LLM generates or updates a running description
3. Entities are stored in an `OrderedDict` — most recently updated at the end
4. When the entity count exceeds `max_entities`, the oldest entities are evicted

### Formatting for prompts

`format_context()` includes both entities and messages:

```python
context = memory.format_context()
# "Known entities:
#   - Alice: A person who works at Acme Corp in Paris.
#   - Acme Corp: A tech company located in Paris.
#
# User: Alice works at Acme Corp in Paris.
# Assistant: That's great! Acme Corp is a tech company."
```

### Parameters

| Parameter | Default | Description |
|---|---|---|
| `llm` | — | LLM instance for entity extraction and summarization |
| `max_entities` | `50` | Maximum entities to track (oldest evicted first) |

### Methods

| Method | Returns | Description |
|---|---|---|
| `add(role, content)` | `None` | Add message and extract/update entities (async) |
| `get_messages()` | `list[dict]` | All messages (copy) |
| `get_entities()` | `dict[str, str]` | Entity name → description mapping |
| `format_context()` | `str` | Entities section + messages |
| `clear()` | `None` | Clear messages and entities |
