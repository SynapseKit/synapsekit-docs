---
sidebar_position: 2
---

# Quickstart

This page gets you from install to a working LLM application in under 5 minutes.

:::info Prerequisites
- Python 3.10+
- An OpenAI API key (or swap to any [supported provider](/docs/llms/overview))
:::

---

## 1. Install

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs groupId="pkg-manager">
<TabItem value="pip" label="pip">

```bash
pip install synapsekit[openai]
```

</TabItem>
<TabItem value="uv" label="uv">

```bash
uv add synapsekit[openai]
```

</TabItem>
<TabItem value="poetry" label="Poetry">

```bash
poetry add synapsekit[openai]
```

</TabItem>
</Tabs>

---

## 2. RAG in 3 lines

```python
from synapsekit import RAG

rag = RAG(model="gpt-4o-mini", api_key="sk-...")
rag.add("SynapseKit is an async-first Python framework for building LLM applications.")

answer = rag.ask_sync("What is SynapseKit?")
print(answer)
# Expected output:
# SynapseKit is an async-first Python framework for building LLM applications.
```

That's it. Under the hood:
1. `rag.add()` chunks your text, embeds it, and stores it in an in-memory vector store
2. `rag.ask_sync()` embeds your query, retrieves the top-k chunks, and sends them to the LLM

---

## 3. Streaming response

```python
import asyncio
from synapsekit import RAG

async def main():
    rag = RAG(model="gpt-4o-mini", api_key="sk-...")
    rag.add("SynapseKit is an async-first Python framework.")

    async for token in rag.stream("What is SynapseKit?"):
        print(token, end="", flush=True)

asyncio.run(main())
```

`stream()` yields tokens as they arrive from the LLM — no buffering, no waiting.

---

## 4. Load real documents

```python
from synapsekit import RAG, PDFLoader, DirectoryLoader

rag = RAG(model="gpt-4o-mini", api_key="sk-...")

# PDF — one Document per page
rag.add_documents(PDFLoader("report.pdf").load())

# Entire directory — auto-detects .txt, .pdf, .csv, .json, .html
rag.add_documents(DirectoryLoader("./docs/").load())

answer = rag.ask_sync("What are the key findings?")
```

---

## 5. Use a different LLM

SynapseKit supports 31 providers. Swap the provider with no other code changes:

<Tabs groupId="llm-provider">
<TabItem value="openai" label="OpenAI" default>

```python
from synapsekit.llms.openai import OpenAILLM
llm = OpenAILLM(model="gpt-4o-mini")
result = await llm.generate("Explain RAG in one sentence.")
# Expected output:
# RAG (Retrieval-Augmented Generation) enhances LLM responses by retrieving
# relevant documents from a knowledge base before generating an answer.
```

Or via the RAG facade:

```python
rag = RAG(model="gpt-4o-mini", api_key="sk-...")
```

</TabItem>
<TabItem value="anthropic" label="Anthropic">

```python
from synapsekit.llms.anthropic import AnthropicLLM
llm = AnthropicLLM(model="claude-haiku-4-5-20251001")
result = await llm.generate("Explain RAG in one sentence.")
# Expected output:
# RAG combines retrieval of relevant documents with language model generation
# to produce grounded, accurate answers from a knowledge base.
```

Or via the RAG facade:

```python
rag = RAG(model="claude-sonnet-4-6", api_key="sk-ant-...")
```

</TabItem>
<TabItem value="ollama" label="Ollama (local)">

```python
from synapsekit.llms.ollama import OllamaLLM
llm = OllamaLLM(model="llama3")  # no API key needed
result = await llm.generate("Explain RAG in one sentence.")
# Expected output:
# RAG is a technique that retrieves relevant context from a document store
# and feeds it to an LLM to generate accurate, grounded answers.
```

Or via the RAG facade (no API key required):

```python
rag = RAG(model="llama3", api_key="", provider="ollama")
```

</TabItem>
<TabItem value="gemini" label="Google Gemini">

```python
from synapsekit.llms.gemini import GeminiLLM
llm = GeminiLLM(model="gemini-1.5-flash")
result = await llm.generate("Explain RAG in one sentence.")
```

Or via the RAG facade:

```python
rag = RAG(model="gemini-1.5-pro", api_key="...", provider="gemini")
```

</TabItem>
<TabItem value="groq" label="Groq">

```python
from synapsekit.llms.groq import GroqLLM
llm = GroqLLM(model="llama-3.1-8b-instant")  # ultra-fast inference
result = await llm.generate("Explain RAG in one sentence.")
```

Or via the RAG facade:

```python
rag = RAG(model="llama-3.1-8b-instant", api_key="gsk_...", provider="groq")
```

</TabItem>
</Tabs>

→ See [all 31 supported providers](/docs/llms/overview)

---

## 6. Add an agent

```python
from synapsekit import AgentExecutor, AgentConfig, CalculatorTool, WebSearchTool
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.base import LLMConfig

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

executor = AgentExecutor(AgentConfig(
    llm=llm,
    tools=[CalculatorTool(), WebSearchTool()],
    agent_type="function_calling",
))

answer = executor.run_sync("What is the square root of 1764?")
print(answer)
# Expected output:
# The square root of 1764 is 42.
```

---

## 7. Graph workflow

```python
import asyncio
from synapsekit import StateGraph, END

async def fetch(state):
    return {"data": f"result for: {state['query']}"}

async def summarise(state):
    return {"summary": f"Summary: {state['data']}"}

graph = (
    StateGraph()
    .add_node("fetch", fetch)
    .add_node("summarise", summarise)
    .add_edge("fetch", "summarise")
    .set_entry_point("fetch")
    .set_finish_point("summarise")
    .compile()
)

result = asyncio.run(graph.run({"query": "latest AI research"}))
print(result["summary"])
# Expected output:
# Summary: result for: latest AI research
```

---

## What happens under the hood

When you call `rag.add(text)`:

```
text → TextSplitter → chunks
chunks → SynapsekitEmbeddings → vectors
vectors → InMemoryVectorStore
```

When you call `rag.ask(query)`:

```
query → SynapsekitEmbeddings → query_vector
query_vector → VectorStore.search() → top-k chunks
top-k chunks + optional BM25 rerank → context
context + query → LLM.stream() → tokens
```

---

## Next steps

| | |
|---|---|
| [Installation](/docs/getting-started/installation) | All install extras explained |
| [RAG Pipeline](/docs/rag/pipeline) | Full RAG pipeline docs |
| [Agents](/docs/agents/overview) | ReAct and function calling agents |
| [Graph Workflows](/docs/graph/overview) | DAG-based async pipelines |
| [LLM Providers](/docs/llms/overview) | All 31 providers with examples |
