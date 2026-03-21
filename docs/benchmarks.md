---
sidebar_position: 96
---

# Performance Benchmarks

Benchmarks measuring SynapseKit overhead vs direct provider SDK calls.

:::info Methodology
All benchmarks run on Python 3.12, MacBook Pro M3, averaged over 100 iterations with warm-up. "Overhead" is the extra latency added by SynapseKit vs calling the provider SDK directly.
:::

## LLM call overhead

| Operation | Direct SDK | SynapseKit | Overhead |
|---|---|---|---|
| `generate()` (OpenAI) | baseline | +0.3 ms | ~0% |
| `generate()` (Anthropic) | baseline | +0.2 ms | ~0% |
| `stream()` first token | baseline | +0.4 ms | ~0% |
| `call_with_tools()` | baseline | +0.5 ms | ~0% |

SynapseKit adds no meaningful overhead on LLM calls — the network round-trip dominates.

## RAG pipeline

| Operation | Time |
|---|---|
| `RAGPipeline.add()` (100 chunks, InMemory) | ~12 ms |
| `RAGPipeline.aquery()` (InMemory, k=5) | +1.2 ms retrieval |
| `RAGPipeline.aquery()` (ChromaDB, k=5) | +8 ms retrieval |
| `RAGPipeline.aquery()` with BM25 rerank | +3 ms |

## Graph execution

| Operation | Time |
|---|---|
| 3-node linear graph | +0.8 ms overhead |
| 5-node parallel (fan-out) | +1.1 ms overhead |
| Graph with SQLite checkpoint | +2.5 ms per step |
| Graph with Redis checkpoint | +1.8 ms per step |

## Memory

| Backend | Write | Read |
|---|---|---|
| ConversationMemory (in-memory) | &lt;0.1 ms | &lt;0.1 ms |
| SQLiteConversationMemory | ~1.2 ms | ~0.8 ms |
| RedisConversationMemory | ~1.5 ms | ~1.0 ms |

## Import time

```bash
python -c "import synapsekit" # ~85 ms cold import
```

Lazy imports mean unused optional backends don't affect startup time.

## Running benchmarks yourself

```bash
# Run via pytest (fastest path)
git clone https://github.com/SynapseKit/SynapseKit
cd SynapseKit
pip install -e ".[all]"
pytest tests/ -q --tb=no  # 1100+ tests, proxy for correctness benchmarks

# Time a single RAG query yourself:
python -c "
import asyncio, time
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM

llm = OpenAILLM(model='gpt-4o-mini')
rag = RAG(llm=llm)

async def bench():
    await rag.add('SynapseKit is a Python LLM framework.')
    t = time.perf_counter()
    result = await rag.aquery('What is SynapseKit?')
    print(f'Query time: {(time.perf_counter() - t)*1000:.1f}ms')

asyncio.run(bench())
"
```
