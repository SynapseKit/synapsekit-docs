---
sidebar_position: 3
---

**Tutorial Progress: Step 2 of 5**  
[← Previous: Installation & Setup](./installation-setup) | [Next: Adding an Agent with Tools →](./adding-agent-with-tools)

# Step 2: Your First RAG Pipeline

In this step you will build a complete Retrieval-Augmented Generation (RAG) pipeline that can answer questions over your own documents.

## What we will build

A minimal but production-pattern RAG system with:
- Document loading & chunking
- Embedding + vector storage
- Retrieval + generation
- Streaming responses
- Memory (conversation history)

## 1. The high-level RAGPipeline API

SynapseKit provides a high-level `RAGPipeline` that hides most boilerplate while still giving you full control when needed.

```python
from synapsekit import RAGPipeline

rag = RAGPipeline(
    model="gpt-4o-mini",
    vector_store="chroma",          # or "qdrant", "pinecone", "in_memory"
    embedder="openai",              # or "cohere", "huggingface"
    chunk_size=512,
    chunk_overlap=50,
)
```

## 2. Adding documents

You can add raw text, files, or URLs.

```python
# From raw text
rag.add(
    "SynapseKit is an async-first Python framework for building "
    "reliable LLM applications. It emphasizes typed interfaces, "
    "minimal magic, and production observability."
)

# From a file
rag.add_file("data/product-spec.pdf")

# From a directory (recursive)
rag.add_directory("docs/", glob="*.md")
```

Under the hood this performs:
1. Loading (using appropriate loader)
2. Splitting into chunks
3. Embedding each chunk
4. Storing in the vector database

## 3. Asking questions (sync & async)

```python
# Simple synchronous call
answer = rag.ask_sync("What is SynapseKit?")
print(answer)

# Async streaming (recommended for production)
import asyncio

async def stream_answer():
    async for token in rag.stream("What are the core design principles?"):
        print(token, end="", flush=True)
    print()

asyncio.run(stream_answer())
```

**Expected output (example)**
```
SynapseKit is an async-first Python framework that helps developers 
build reliable LLM applications with strong typing and observability.
```

## 4. Adding conversation memory

Real applications need memory across turns.

```python
from synapsekit.memory import SQLiteConversationMemory

memory = SQLiteConversationMemory(db_path=":memory:")
rag = RAGPipeline(model="gpt-4o-mini", memory=memory)

rag.ask_sync("What is SynapseKit?")
rag.ask_sync("What are its main advantages?")
```

The memory automatically injects previous turns into the prompt.

## 5. Full runnable example (copy-paste)

```python
import asyncio
from synapsekit import RAGPipeline
from synapsekit.memory import InMemoryConversationMemory

async def main():
    rag = RAGPipeline(
        model="gpt-4o-mini",
        vector_store="in_memory",
        embedder="openai",
        memory=InMemoryConversationMemory(),
    )

    # Seed with knowledge
    rag.add("""
    SynapseKit was created to solve three common problems in LLM apps:
    1. Callback hell and lack of typing
    2. Missing production observability
    3. Difficulty composing RAG + Agents + Graphs
    """)

    print("=== First question ===")
    answer = rag.ask_sync("What problems does SynapseKit solve?")
    print(answer)

    print("\n=== Follow-up (uses memory) ===")
    async for token in rag.stream("Can you give an example of each?"):
        print(token, end="", flush=True)
    print()

if __name__ == "__main__":
    asyncio.run(main())
```

## 6. Advanced options you can explore later

- `rag.retriever.top_k = 8`
- Custom chunking strategies
- Hybrid search (vector + BM25)
- Reranking with cross-encoders
- Metadata filtering

## Expected behavior checklist

- [ ] Documents are chunked and embedded
- [ ] Retrieval returns relevant context
- [ ] LLM answers are grounded in the provided context
- [ ] Streaming works without buffering the full response
- [ ] Memory carries context between turns

**Congratulations!** You now have a working RAG system.

**Tutorial Progress: Step 2 of 5**  
[← Previous: Installation & Setup](./installation-setup) | [Next: Adding an Agent with Tools →](./adding-agent-with-tools)