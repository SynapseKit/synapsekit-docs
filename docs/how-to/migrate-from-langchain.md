---
sidebar_position: 10
---

# Migrate from LangChain

SynapseKit covers the same problem space as LangChain with a simpler, more Pythonic API. This guide provides side-by-side comparisons for every common pattern so you can migrate incrementally.

## At a glance

| Pattern | LangChain | SynapseKit |
|---|---|---|
| LLM | `ChatOpenAI(model="gpt-4o")` | `OpenAILLM(model="gpt-4o")` |
| Anthropic | `ChatAnthropic(model="claude-sonnet-4-6")` | `AnthropicLLM(model="claude-sonnet-4-6")` |
| Local LLM | `OllamaLLM(model="llama3")` | `OllamaLLM(model="llama3")` |
| RAG chain | `RetrievalQA.from_chain_type(...)` | `RAG(llm=llm, vector_store=store)` |
| Memory | `ConversationBufferMemory` | `ConversationMemory` |
| Agent | `AgentExecutor` + `create_react_agent` | `FunctionCallingAgent(llm, tools)` |
| Graph workflows | LangGraph `StateGraph` | `synapsekit.graph.StateGraph` |
| Observability | LangSmith | `CostTracker` + `synapsekit serve` |
| Serving | LangServe | `synapsekit serve app:app` |
| Prompt registry | LangSmith Hub | `PromptHub` |

---

## 1. LLM initialization

```python
# LangChain
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7, max_tokens=1024)
claude = ChatAnthropic(model="claude-sonnet-4-6")
```

```python
# SynapseKit
from synapsekit.llms.openai import OpenAILLM
from synapsekit.llms.anthropic import AnthropicLLM
from synapsekit.llms.base import LLMConfig

llm = OpenAILLM(
    model="gpt-4o-mini",
    config=LLMConfig(temperature=0.7, max_tokens=1024),
)
claude = AnthropicLLM(model="claude-sonnet-4-6")
```

### Calling the LLM

```python
# LangChain
from langchain_core.messages import HumanMessage

response = llm.invoke([HumanMessage(content="What is RAG?")])
print(response.content)
# Expected output: RAG is Retrieval-Augmented Generation...
```

```python
# SynapseKit
import asyncio

async def main():
    response = await llm.generate("What is RAG?")
    print(response)
    # Expected output: RAG is Retrieval-Augmented Generation...

asyncio.run(main())
```

---

## 2. RAG pipeline

```python
# LangChain
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.chains import RetrievalQA
from langchain_community.vectorstores import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter

llm = ChatOpenAI(model="gpt-4o-mini")
embeddings = OpenAIEmbeddings()

# Build vector store
splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
texts = splitter.split_text("Long document text here...")
db = Chroma.from_texts(texts, embeddings)

# Build chain
chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=db.as_retriever(search_kwargs={"k": 4}),
)
result = chain.invoke({"query": "What is RAG?"})
print(result["result"])
```

```python
# SynapseKit
import asyncio
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.vectorstores.chroma import ChromaVectorStore
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.splitters import RecursiveCharacterSplitter

async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    embeddings = OpenAIEmbeddings()
    store = ChromaVectorStore(embeddings=embeddings)

    splitter = RecursiveCharacterSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split("Long document text here...")

    rag = RAG(llm=llm, vector_store=store, top_k=4)
    await rag.aadd(chunks)

    result = await rag.aquery("What is RAG?")
    print(result)
    # Expected output: RAG (Retrieval-Augmented Generation) is a technique...

asyncio.run(main())
```

---

## 3. Conversation memory

```python
# LangChain
from langchain_openai import ChatOpenAI
from langchain.chains import ConversationChain
from langchain.memory import ConversationBufferMemory

llm = ChatOpenAI(model="gpt-4o-mini")
memory = ConversationBufferMemory()
chain = ConversationChain(llm=llm, memory=memory)

r1 = chain.predict(input="What is Python?")
r2 = chain.predict(input="What is it used for?")  # "it" = Python
print(r2)
```

```python
# SynapseKit
import asyncio
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.memory import ConversationMemory

async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    memory = ConversationMemory(max_messages=20)
    rag = RAG(llm=llm, memory=memory)

    r1 = await rag.aquery("What is Python?")
    r2 = await rag.aquery("What is it used for?")  # "it" = Python
    print(r2)
    # Expected output: Python is used for web development, data science,
    # automation, AI/ML, and much more.

asyncio.run(main())
```

### SQLite persistence

```python
# LangChain
from langchain.memory import SQLChatMessageHistory
from langchain_community.chat_message_histories import SQLChatMessageHistory

history = SQLChatMessageHistory(
    session_id="user-123",
    connection_string="sqlite:///chat_history.db",
)
```

```python
# SynapseKit
from synapsekit.memory import SQLiteConversationMemory

memory = SQLiteConversationMemory(
    db_path="chat_history.db",
    session_id="user-123",
    max_messages=50,
)
```

---

## 4. Agents and tools

```python
# LangChain
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_react_agent
from langchain_community.tools import TavilySearchResults
from langchain import hub

llm = ChatOpenAI(model="gpt-4o")
tools = [TavilySearchResults(max_results=3)]
prompt = hub.pull("hwchase17/react")
agent = create_react_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

result = agent_executor.invoke({"input": "What is the latest news about AI?"})
print(result["output"])
```

```python
# SynapseKit
import asyncio
from synapsekit.llms.openai import OpenAILLM
from synapsekit.agents import FunctionCallingAgent
from synapsekit.tools import tool


@tool
async def web_search(query: str, max_results: int = 3) -> str:
    """Search the web for current information.

    Args:
        query: The search query
        max_results: Maximum number of results
    """
    # Integrate your preferred search API here
    return f"Search results for: {query}"


async def main():
    llm = OpenAILLM(model="gpt-4o")
    agent = FunctionCallingAgent(llm=llm, tools=[web_search], max_iterations=5)
    result = await agent.run("What is the latest news about AI?")
    print(result)
    # Expected output: Based on recent search results, the latest AI news...

asyncio.run(main())
```

---

## 5. LCEL chains → async functions

LangChain's LCEL (LangChain Expression Language) uses `|` to compose chains. In SynapseKit, compose with plain async functions.

```python
# LangChain — LCEL chain
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="gpt-4o-mini")
prompt = ChatPromptTemplate.from_template("Translate to French: {text}")
chain = prompt | llm | StrOutputParser()

result = chain.invoke({"text": "Hello, world!"})
print(result)
# Expected output: Bonjour, le monde !
```

```python
# SynapseKit — plain async functions
import asyncio
from synapsekit.llms.openai import OpenAILLM

llm = OpenAILLM(model="gpt-4o-mini")


async def translate_to_french(text: str) -> str:
    prompt = f"Translate the following text to French: {text}"
    return await llm.generate(prompt)


async def make_formal(text: str) -> str:
    prompt = f"Rewrite this text in a formal tone: {text}"
    return await llm.generate(prompt)


async def translate_and_formalize(text: str) -> str:
    """Composing steps is just function calls."""
    translated = await translate_to_french(text)
    formal = await make_formal(translated)
    return formal


async def main():
    result = await translate_and_formalize("Hey, what's up?")
    print(result)
    # Expected output: Bonjour, comment allez-vous ?

asyncio.run(main())
```

---

## 6. LangGraph → SynapseKit StateGraph

```python
# LangChain (LangGraph)
from langgraph.graph import StateGraph as LangGraph
from typing import TypedDict

class State(TypedDict):
    input: str
    result: str

def process_node(state: State) -> State:
    return {"result": f"processed: {state['input']}"}

builder = LangGraph(State)
builder.add_node("process", process_node)
builder.set_entry_point("process")
builder.set_finish_point("process")
graph = builder.compile()

result = graph.invoke({"input": "hello"})
print(result)
# Expected output: {'input': 'hello', 'result': 'processed: hello'}
```

```python
# SynapseKit StateGraph
import asyncio
from synapsekit.graph import StateGraph


async def process_node(state: dict) -> dict:
    return {"result": f"processed: {state['input']}"}


graph = StateGraph()
graph.add_node("process", process_node)
graph.set_entry_point("process")
compiled = graph.compile()


async def main():
    result = await compiled.ainvoke({"input": "hello"})
    print(result)
    # Expected output: {'input': 'hello', 'result': 'processed: hello'}

asyncio.run(main())
```

### Graph with conditional edges

```python
# LangChain (LangGraph)
from langgraph.graph import StateGraph, END

def router(state):
    return "approved" if state.get("score", 0) > 0.7 else "rejected"

builder = StateGraph(dict)
builder.add_node("evaluate", lambda s: {"score": 0.8})
builder.add_node("approved", lambda s: {"status": "approved"})
builder.add_node("rejected", lambda s: {"status": "rejected"})
builder.set_entry_point("evaluate")
builder.add_conditional_edges("evaluate", router)
graph = builder.compile()
```

```python
# SynapseKit
from synapsekit.graph import StateGraph


async def evaluate(state: dict) -> dict:
    return {"score": 0.8}

async def approved(state: dict) -> dict:
    return {"status": "approved"}

async def rejected(state: dict) -> dict:
    return {"status": "rejected"}

def router(state: dict) -> str:
    return "approved" if state.get("score", 0) > 0.7 else "rejected"

graph = StateGraph()
graph.add_node("evaluate", evaluate)
graph.add_node("approved", approved)
graph.add_node("rejected", rejected)
graph.set_entry_point("evaluate")
graph.add_conditional_edge("evaluate", router)
compiled = graph.compile()
```

---

## 7. LangSmith → CostTracker

```python
# LangChain — LangSmith tracing
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "ls__..."
# All LangChain calls are traced automatically
```

```python
# SynapseKit — built-in cost tracking (no external service needed)
import asyncio
from synapsekit.llms.openai import OpenAILLM
from synapsekit.observability import CostTracker

tracker = CostTracker()
llm = OpenAILLM(model="gpt-4o-mini")
tracked_llm = tracker.wrap(llm)


async def main():
    for i in range(5):
        await tracked_llm.generate(f"Question {i}")

    report = tracker.report()
    print(f"Total calls: {report['total_calls']}")
    print(f"Total cost: ${report['total_cost_usd']:.4f}")
    print(f"Total tokens: {report['total_tokens']}")
    # Expected output:
    # Total calls: 5
    # Total cost: $0.0023
    # Total tokens: 847

asyncio.run(main())
```

---

## 8. LangServe → `synapsekit serve`

```python
# LangChain — LangServe
from fastapi import FastAPI
from langserve import add_routes
from langchain_openai import ChatOpenAI

app = FastAPI()
llm = ChatOpenAI(model="gpt-4o-mini")
add_routes(app, llm, path="/chat")
# Run: uvicorn app:app
```

```bash
# SynapseKit — CLI serve (no boilerplate needed)
synapsekit serve app:rag_pipeline --port 8000 --host 0.0.0.0

# Or with options:
synapsekit serve app:rag_pipeline \
  --port 8000 \
  --workers 4 \
  --reload  # development mode

# Expected output:
# INFO: SynapseKit Serve v1.2.0
# INFO: Serving pipeline at http://0.0.0.0:8000
# INFO: POST /invoke   — synchronous query
# INFO: POST /stream   — streaming query
# INFO: GET  /health   — health check
```

---

## 9. LangChain Hub → PromptHub

```python
# LangChain
from langchain import hub

prompt = hub.pull("hwchase17/react")
print(prompt.template)
```

```python
# SynapseKit
from synapsekit.rag import PromptHub

# Pull a built-in prompt
prompt = PromptHub.get("rag-default")
print(prompt.template)
# Expected output:
# Use the following context to answer the question.
# Context: {context}
# Question: {question}
# Answer:

# Customize and save
custom_prompt = PromptHub.get("rag-default").customize(
    system="You are a helpful assistant. Answer concisely.",
    footer="If you don't know the answer, say 'I don't know'.",
)
PromptHub.save("my-rag-prompt", custom_prompt)
```

---

## 10. Migration checklist

Use this checklist when migrating an existing LangChain project:

- [ ] Replace `langchain-openai` with `synapsekit[openai]` in `requirements.txt`
- [ ] Replace `ChatOpenAI` → `OpenAILLM`, `ChatAnthropic` → `AnthropicLLM`
- [ ] Replace `.invoke({"query": ...})` → `await .aquery(...)` (async)
- [ ] Replace `RetrievalQA.from_chain_type(...)` → `RAG(llm=llm, vector_store=store)`
- [ ] Replace `ConversationBufferMemory` → `ConversationMemory`
- [ ] Replace `SQLChatMessageHistory` → `SQLiteConversationMemory`
- [ ] Replace `AgentExecutor` + `create_react_agent` → `FunctionCallingAgent(llm, tools)`
- [ ] Replace `@tool` decorator from `langchain.tools` with `from synapsekit.tools import tool`
- [ ] Replace LCEL `|` chains → plain `async def` functions calling each other
- [ ] Replace LangGraph `StateGraph` → `synapsekit.graph.StateGraph` (same API, async)
- [ ] Replace LangSmith env vars → `CostTracker` wrapping your LLM
- [ ] Replace LangServe → `synapsekit serve app:pipeline`
- [ ] Remove `LANGCHAIN_TRACING_V2` and `LANGCHAIN_API_KEY` env vars
- [ ] Update tests: replace `chain.invoke(...)` → `await pipeline.aquery(...)`
- [ ] Run `pytest tests/ -q` — fix any remaining import or API shape mismatches

### Checking for remaining LangChain imports

```bash
grep -r "from langchain" . --include="*.py"
grep -r "import langchain" . --include="*.py"
# Expected output: (empty — all references removed)
```
