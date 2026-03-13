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
