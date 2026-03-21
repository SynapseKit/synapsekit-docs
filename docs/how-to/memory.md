---
sidebar_position: 6
---

# Memory

Memory lets your pipelines and agents maintain context across multiple turns. Without memory, every call to `aquery()` or `agent.run()` is stateless — the LLM has no knowledge of prior exchanges. This guide covers every memory pattern from simple in-process memory to distributed Redis-backed storage.

## Prerequisites

```bash
pip install synapsekit[openai]

# For SQLite persistence (no extra deps — included in Python stdlib)
# For Redis memory:
pip install synapsekit[redis]
```

---

## 1. Add memory to RAGPipeline

`ConversationMemory` keeps a rolling window of recent messages and injects them into every prompt automatically.

```python
import asyncio
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.memory import ConversationMemory


async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    memory = ConversationMemory(max_messages=20)
    rag = RAG(llm=llm, memory=memory)

    await rag.aadd([
        "Retrieval-Augmented Generation (RAG) combines a retrieval system "
        "with a language model to answer questions using external knowledge.",
        "RAG reduces hallucinations by grounding answers in retrieved documents.",
    ])

    # First turn
    answer1 = await rag.aquery("What is RAG?")
    print(f"Turn 1: {answer1}")
    # Expected output:
    # Turn 1: Retrieval-Augmented Generation (RAG) combines a retrieval
    # system with a language model to answer questions using external knowledge.

    # Second turn — the pipeline knows "it" refers to RAG
    answer2 = await rag.aquery("Can you explain it more simply?")
    print(f"Turn 2: {answer2}")
    # Expected output:
    # Turn 2: Sure! RAG works by first searching through documents to find
    # relevant information, then using that information to generate an answer.

    # Third turn — follow-up still in context
    answer3 = await rag.aquery("What problem does it solve?")
    print(f"Turn 3: {answer3}")
    # Expected output:
    # Turn 3: It primarily solves the hallucination problem — without RAG,
    # the LLM might make up facts. RAG keeps answers grounded in real data.

asyncio.run(main())
```

---

## 2. Inspect memory state

```python
async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    memory = ConversationMemory(max_messages=10)
    rag = RAG(llm=llm, memory=memory)

    await rag.aquery("What is Python?")
    await rag.aquery("What is it used for?")

    # Inspect stored messages
    messages = await memory.get_messages()
    for msg in messages:
        print(f"[{msg.role}] {msg.content[:60]}...")

    # Expected output:
    # [user] What is Python?
    # [assistant] Python is a high-level, general-purpose programming la...
    # [user] What is it used for?
    # [assistant] Python is used for web development, data science, AI/M...

    print(f"\nTotal messages in memory: {len(messages)}")
    # Expected output: Total messages in memory: 4

asyncio.run(main())
```

---

## 3. SQLite persistence (survives restarts)

`SQLiteConversationMemory` persists every message to disk. Conversations survive process restarts.

```python
import asyncio
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.memory import SQLiteConversationMemory


async def session_one():
    """First session — index docs and ask a question."""
    llm = OpenAILLM(model="gpt-4o-mini")
    memory = SQLiteConversationMemory(
        db_path="chat_history.db",
        session_id="user-123",  # Separate history per user
        max_messages=50,
    )
    rag = RAG(llm=llm, memory=memory)
    await rag.aadd(["SynapseKit v1.2 introduced the serve command and cost intelligence."])

    answer = await rag.aquery("What's new in SynapseKit v1.2?")
    print(f"Session 1: {answer}")
    # Expected output: Session 1: SynapseKit v1.2 introduced the serve command...


async def session_two():
    """Second session (new process) — memory loaded from SQLite."""
    llm = OpenAILLM(model="gpt-4o-mini")
    memory = SQLiteConversationMemory(
        db_path="chat_history.db",
        session_id="user-123",   # Same user, same history
    )
    rag = RAG(llm=llm, memory=memory)

    # The LLM remembers the previous conversation
    answer = await rag.aquery("Can you remind me what you told me about v1.2?")
    print(f"Session 2: {answer}")
    # Expected output: Session 2: In our previous conversation, I mentioned that
    # SynapseKit v1.2 introduced the serve command and cost intelligence features.


asyncio.run(session_one())
asyncio.run(session_two())
```

---

## 4. Redis memory (distributed, multi-instance)

`RedisConversationMemory` stores messages in Redis with optional TTL. Ideal for deployed services running multiple workers.

```python
import asyncio
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.memory import RedisConversationMemory


async def main():
    llm = OpenAILLM(model="gpt-4o-mini")

    memory = RedisConversationMemory(
        redis_url="redis://localhost:6379",
        session_id="user-456",
        max_messages=30,
        ttl=86400,  # Messages expire after 24 hours
    )

    rag = RAG(llm=llm, memory=memory)
    await rag.aadd(["Redis is an in-memory key-value data store used for caching."])

    answer = await rag.aquery("What is Redis?")
    print(answer)
    # Expected output: Redis is an in-memory key-value data store used for caching.

asyncio.run(main())
```

---

## 5. Memory in agents

Agents use memory to maintain tool call history and conversation context.

```python
import asyncio
from synapsekit.agents import FunctionCallingAgent
from synapsekit.llms.openai import OpenAILLM
from synapsekit.memory import ConversationMemory
from synapsekit.tools import tool


@tool
def get_weather(city: str) -> str:
    """Get the current weather for a city."""
    return f"{city}: 22°C, sunny"


async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    memory = ConversationMemory(max_messages=20)

    agent = FunctionCallingAgent(
        llm=llm,
        tools=[get_weather],
        memory=memory,
    )

    # Turn 1 — agent fetches weather
    result1 = await agent.run("What's the weather in London?")
    print(f"Turn 1: {result1}")
    # Expected output: Turn 1: The weather in London is 22°C and sunny.

    # Turn 2 — agent remembers the city without being told again
    result2 = await agent.run("Is that warm for this time of year?")
    print(f"Turn 2: {result2}")
    # Expected output: Turn 2: 22°C in London is quite warm, especially if it's
    # autumn or spring. It's above the average for most seasons there.

asyncio.run(main())
```

---

## 6. Sharing memory across multiple agents

Use a single `ConversationMemory` instance to share context across a pipeline of agents.

```python
import asyncio
from synapsekit.agents import FunctionCallingAgent
from synapsekit.llms.openai import OpenAILLM
from synapsekit.memory import ConversationMemory
from synapsekit.tools import tool


@tool
def search_web(query: str) -> str:
    """Search the web for information."""
    return f"Search results for '{query}': Found 3 relevant articles."


@tool
def summarize_text(text: str) -> str:
    """Summarize a block of text."""
    return f"Summary: {text[:100]}..."


async def main():
    llm = OpenAILLM(model="gpt-4o-mini")

    # Shared memory — both agents see the same conversation history
    shared_memory = ConversationMemory(max_messages=50)

    researcher = FunctionCallingAgent(
        llm=llm,
        tools=[search_web],
        memory=shared_memory,
        system="You are a research agent. Find information on topics.",
    )

    summarizer = FunctionCallingAgent(
        llm=llm,
        tools=[summarize_text],
        memory=shared_memory,
        system="You are a summarization agent. Condense findings.",
    )

    # Step 1: researcher finds info
    research = await researcher.run("Research the latest advances in RAG")
    print(f"Research: {research}")

    # Step 2: summarizer sees researcher's output in shared memory
    summary = await summarizer.run("Summarize what the researcher just found")
    print(f"Summary: {summary}")

asyncio.run(main())
```

---

## 7. Memory trimming and summarization

When conversations get long, summarize older messages to stay within the token budget.

```python
import asyncio
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.memory import SummarizingMemory


async def main():
    llm = OpenAILLM(model="gpt-4o-mini")

    # Summarize when conversation exceeds 10 messages
    memory = SummarizingMemory(
        llm=llm,
        max_messages=10,       # Keep 10 recent messages verbatim
        summarize_after=20,    # Summarize when total exceeds 20
        summary_max_tokens=200,
    )

    rag = RAG(llm=llm, memory=memory)

    # Simulate a long conversation
    topics = [
        "What is machine learning?",
        "Explain neural networks",
        "What is deep learning?",
        "How does backpropagation work?",
        "What are transformers?",
        "Explain attention mechanisms",
        "What is BERT?",
        "How does GPT work?",
        "What is fine-tuning?",
        "Explain RLHF",
        "What are vector embeddings?",
        "How does RAG differ from fine-tuning?",  # This triggers summarization
    ]

    for question in topics:
        answer = await rag.aquery(question)
        print(f"Q: {question}")
        print(f"A: {answer[:80]}...")
        print()

    # Check that memory is under control
    messages = await memory.get_messages()
    print(f"Messages in memory after {len(topics)} turns: {len(messages)}")
    # Expected output: Messages in memory after 12 turns: 12
    # (older messages compressed into a summary)

asyncio.run(main())
```

---

## 8. Clear and reset memory

```python
import asyncio
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.memory import ConversationMemory, SQLiteConversationMemory


async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    memory = ConversationMemory(max_messages=20)
    rag = RAG(llm=llm, memory=memory)

    await rag.aquery("What is Python?")
    await rag.aquery("What is Rust?")

    print(f"Messages before clear: {len(await memory.get_messages())}")
    # Expected output: Messages before clear: 4

    # Clear all messages
    await memory.clear()

    print(f"Messages after clear: {len(await memory.get_messages())}")
    # Expected output: Messages after clear: 0

    # For SQLite memory — clear a specific session
    sqlite_memory = SQLiteConversationMemory(
        db_path="chat.db",
        session_id="user-123",
    )
    await sqlite_memory.clear()  # Deletes only user-123's messages

    # List all sessions
    sessions = await sqlite_memory.list_sessions()
    print(f"Active sessions: {sessions}")
    # Expected output: Active sessions: ['user-456', 'user-789']

asyncio.run(main())
```

---

## Summary

| Memory type | Storage | Persistence | Multi-process |
|---|---|---|---|
| `ConversationMemory` | In-process dict | No | No |
| `SQLiteConversationMemory` | SQLite file | Yes | No (single writer) |
| `RedisConversationMemory` | Redis | Yes | Yes |
| `SummarizingMemory` | In-process + LLM | No | No |
