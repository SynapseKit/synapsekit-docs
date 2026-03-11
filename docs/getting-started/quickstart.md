---
sidebar_position: 2
---

# Quickstart

This page gets you from install to a working LLM application in under 5 minutes.

:::info Prerequisites
- Python 3.14+
- An OpenAI API key (or swap to any [supported provider](/docs/llms/overview))
:::

---

## 1. Install

```bash
pip install synapsekit[openai]
```

---

## 2. RAG in 3 lines

```python
from synapsekit import RAG

rag = RAG(model="gpt-4o-mini", api_key="sk-...")
rag.add("SynapseKit is an async-first Python framework for building LLM applications.")

answer = rag.ask_sync("What is SynapseKit?")
print(answer)
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

No code changes beyond the model name:

```python
# Anthropic
rag = RAG(model="claude-sonnet-4-6", api_key="sk-ant-...")

# Local model via Ollama (no API key needed)
rag = RAG(model="llama3", api_key="", provider="ollama")

# Google Gemini
rag = RAG(model="gemini-1.5-pro", api_key="...", provider="gemini")
```

→ See [all supported providers](/docs/llms/overview)

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
| [LLM Providers](/docs/llms/overview) | All 9 providers with examples |
