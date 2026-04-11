---
sidebar_position: 7
title: "RAG with Conversation Memory"
description: "Build a multi-turn RAG chatbot that remembers previous questions using SynapseKit's SQLiteConversationMemory."
---

import ColabBadge from '@site/src/components/ColabBadge';

# RAG with Conversation Memory

<ColabBadge path="rag/rag-with-memory.ipynb" />

A basic RAG pipeline treats every question as independent. Ask "What is the return policy?" and then "Can I return it after 90 days?" and the second question has no context. Adding conversation memory lets the LLM refer to earlier turns, follow-up questions work naturally, and you can build a real customer support or Q&A bot. **What you'll build:** A multi-turn Q&A assistant that remembers what was said earlier in the session, backed by a persistent SQLite conversation store. **Time:** ~15 min. **Difficulty:** Beginner

## Prerequisites

```bash
pip install synapsekit
export OPENAI_API_KEY="sk-..."
```

No extra dependencies — `SQLiteConversationMemory` uses the Python standard library's `sqlite3` module.

## What you'll learn

- How `SQLiteConversationMemory` stores conversation turns
- How `RAGPipeline` injects conversation history into the retrieval prompt
- How to manage multiple user sessions with `session_id`
- How to clear or inspect conversation history
- How to build a simple interactive chat loop

## Step 1: Set up RAGPipeline with memory

```python
from synapsekit import RAGPipeline
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.memory import SQLiteConversationMemory

# A single SQLite file stores all sessions. Using a file path (rather than
# ":memory:") means conversations survive process restarts, which is critical
# for any real support or chat application.
memory = SQLiteConversationMemory(db_path="conversations.db")

rag = RAGPipeline(
    llm=OpenAILLM(model="gpt-4o-mini"),
    embeddings=OpenAIEmbeddings(model="text-embedding-3-small"),
    vectorstore=InMemoryVectorStore(),
    memory=memory,
)
```

Passing `memory=` to `RAGPipeline` is the only change from a stateless pipeline. All other methods (`aadd`, `aquery`, `astream`) work identically — they just also read from and write to the memory store.

## Step 2: Add knowledge base documents

```python
await rag.aadd([
    "Our return policy allows returns within 30 days of purchase with a receipt.",
    "Items returned after 30 days but within 90 days receive store credit only.",
    "Electronics are final sale and cannot be returned under any circumstances.",
    "To initiate a return, visit any store location or use the returns portal at returns.example.com.",
    "Refunds are processed within 5-7 business days to the original payment method.",
])
```

## Step 3: First turn

```python
# session_id groups all turns in a conversation. Use a user ID, a UUID, or
# any string that uniquely identifies the conversation session.
session_id = "user-42"

answer = await rag.aquery(
    "What is the return policy?",
    session_id=session_id,
)
print("Turn 1:", answer)
```

`RAGPipeline` automatically saves this question and answer to the SQLite database under `session_id`.

## Step 4: Follow-up question that references the previous answer

```python
# "it" and "after that" refer back to the 30-day window mentioned in turn 1.
# Without memory the model would treat this as an unresolvable pronoun.
# With memory it correctly interprets "it" as "the return" and "after that"
# as "after 30 days".
answer = await rag.aquery(
    "What happens if I want to return it after that?",
    session_id=session_id,
)
print("Turn 2:", answer)
```

## Step 5: Continue the conversation

```python
answer = await rag.aquery(
    "What about electronics specifically?",
    session_id=session_id,
)
print("Turn 3:", answer)

answer = await rag.aquery(
    "How long does the refund take?",
    session_id=session_id,
)
print("Turn 4:", answer)
```

## Step 6: Inspect conversation history

```python
# Inspecting history is useful for debugging why the model answered a certain
# way, or for building a "conversation replay" feature in your UI.
history = await memory.aget_history(session_id)
for turn in history:
    print(f"[{turn['role'].upper()}] {turn['content'][:80]}")
```

## Step 7: Manage multiple sessions

```python
# Each user gets their own isolated conversation history.
# Session IDs are arbitrary strings — use whatever makes sense for your app.
sessions = ["user-42", "user-99", "support-agent-7"]

for sid in sessions:
    await rag.aquery("What is the return policy?", session_id=sid)

# List all sessions stored in the database.
all_sessions = await memory.alist_sessions()
print(f"Active sessions: {all_sessions}")
```

## Step 8: Clear a session

```python
# Clearing a session removes all turns for that session_id.
# Use this when a user explicitly starts a "new conversation".
await memory.aclear(session_id="user-42")
history_after = await memory.aget_history("user-42")
print(f"History after clear: {history_after}")  # []
```

## Step 9: Build an interactive chat loop

```python
async def chat_loop(session_id: str):
    print(f"Session: {session_id}")
    print("Type 'quit' to exit, 'history' to see the conversation so far.\n")

    while True:
        question = input("You: ").strip()
        if not question:
            continue
        if question.lower() == "quit":
            break
        if question.lower() == "history":
            history = await memory.aget_history(session_id)
            for turn in history:
                print(f"  [{turn['role']}]: {turn['content'][:100]}")
            continue

        answer = await rag.aquery(question, session_id=session_id)
        print(f"Assistant: {answer}\n")
```

## Complete working example

```python
import asyncio
from synapsekit import RAGPipeline
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.memory import SQLiteConversationMemory

async def main():
    memory = SQLiteConversationMemory(db_path="conversations.db")

    rag = RAGPipeline(
        llm=OpenAILLM(model="gpt-4o-mini"),
        embeddings=OpenAIEmbeddings(model="text-embedding-3-small"),
        vectorstore=InMemoryVectorStore(),
        memory=memory,
    )

    await rag.aadd([
        "Our return policy allows returns within 30 days of purchase with a receipt.",
        "Items returned after 30 days but within 90 days receive store credit only.",
        "Electronics are final sale and cannot be returned under any circumstances.",
        "To initiate a return, visit any store location or use the returns portal at returns.example.com.",
        "Refunds are processed within 5-7 business days to the original payment method.",
    ])

    session_id = "demo-session"
    questions = [
        "What is the return policy?",
        "What happens if I want to return it after that?",
        "What about electronics specifically?",
        "How long does the refund take?",
    ]

    for i, question in enumerate(questions, 1):
        answer = await rag.aquery(question, session_id=session_id)
        print(f"Turn {i}: {question}")
        print(f"         {answer}\n")

    history = await memory.aget_history(session_id)
    print(f"Conversation stored: {len(history)} turns in conversations.db")

asyncio.run(main())
```

## Expected output

```
Turn 1: What is the return policy?
         Returns are accepted within 30 days of purchase with a receipt.

Turn 2: What happens if I want to return it after that?
         If you return after the 30-day window but within 90 days, you will
         receive store credit rather than a cash refund.

Turn 3: What about electronics specifically?
         Electronics are final sale and cannot be returned under any circumstances.

Turn 4: How long does the refund take?
         Refunds are processed within 5-7 business days to the original payment method.

Conversation stored: 8 turns in conversations.db
```

## How it works

`SQLiteConversationMemory` maintains a `turns` table keyed by `session_id`. Before each `aquery()` call, `RAGPipeline` calls `memory.aget_history(session_id)` to retrieve all previous turns and prepends them to the LLM prompt as a `messages` array with alternating `user` / `assistant` roles. The retrieved RAG chunks are injected as a `system` message alongside the history. After the LLM responds, both the question and the answer are written back to the database via `memory.aadd_turn()`. The retrieval step itself is stateless — memory affects only the generation prompt, not which chunks are retrieved.

## Variations

| Variation | Change required |
|---|---|
| Limit history length | Pass `max_turns=10` to `SQLiteConversationMemory` to cap context size |
| Use in-memory storage (no persistence) | Use `InMemoryConversationMemory` instead of `SQLiteConversationMemory` |
| Redis-backed sessions (multi-process) | Use `RedisConversationMemory` for horizontally scaled deployments |
| Stream with memory | Replace `aquery()` with `astream()` — memory works identically |
| Summarise old turns to save tokens | Pass `summarize_after=20` to auto-compress older history |

## Troubleshooting

**Follow-up questions are not understood in context**
Verify you are passing the same `session_id` on every turn. If session IDs differ, each question is treated as an independent conversation.

**`OperationalError: database is locked`**
SQLite does not support concurrent writes. For multiple workers, switch to `RedisConversationMemory` or use a process-safe connection pool.

**Memory grows too large and answers slow down**
Set `max_turns` on `SQLiteConversationMemory` to keep only the N most recent turns, or enable `summarize_after` to compress older history automatically.

## Next steps

- [Streaming RAG Responses](./streaming-rag) — combine memory with token-by-token streaming
- [Metadata Filtering in Vector Search](./metadata-filtering) — scope retrieval while keeping memory
- [Memory reference](../../memory/conversation) — full API for all memory backends
