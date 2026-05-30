---
sidebar_position: 4
---

**Tutorial Progress: Step 3 of 5**  
[← Previous: Your First RAG Pipeline](./first-rag-pipeline) | [Next: Building a Graph Workflow →](./building-graph-workflow)

# Step 3: Adding an Agent with Tools

In this step you will turn your RAG pipeline into an intelligent agent that can use tools, make decisions, and call external functions.

## Why agents?

RAG is great for question answering. Agents add reasoning, tool use, and multi-step planning on top of retrieval.

## 1. The FunctionCallingAgent

SynapseKit's `FunctionCallingAgent` is a typed, async-first agent that supports multiple LLM providers and automatic tool schema generation.

```python
from synapsekit import FunctionCallingAgent
from synapsekit.tools import Tool

agent = FunctionCallingAgent(
    model="gpt-4o",
    tools=[...],           # list of Tool objects
    memory=...,            # optional
    guardrails=...,        # optional
)
```

## 2. Creating a custom tool

The easiest way is using the `@tool` decorator or the `Tool` class.

```python
from synapsekit.tools import tool
from pydantic import BaseModel

class WebSearchInput(BaseModel):
    query: str
    max_results: int = 5

@tool("web_search", "Search the web for current information")
async def web_search(input: WebSearchInput) -> list[str]:
    # In real code you would call Tavily, SerpAPI, etc.
    return [
        f"Result 1 for {input.query}",
        f"Result 2 for {input.query}",
    ]
```

You can also wrap existing functions:

```python
def calculate(expression: str) -> float:
    return eval(expression)  # demo only

calc_tool = Tool.from_function(
    calculate,
    name="calculator",
    description="Evaluate a math expression"
)
```

## 3. Full agent example with RAG + tools

```python
import asyncio
from synapsekit import FunctionCallingAgent, RAGPipeline
from synapsekit.tools import tool
from pydantic import BaseModel

class SearchInput(BaseModel):
    query: str

@tool("company_search", "Search internal company knowledge base")
async def company_search(input: SearchInput):
    rag = RAGPipeline(model="gpt-4o-mini", vector_store="chroma")
    rag.add_directory("company_docs/")
    return rag.ask_sync(input.query)

agent = FunctionCallingAgent(
    model="gpt-4o",
    tools=[company_search],
    system_prompt="You are a helpful company assistant. Use tools when needed.",
)

async def main():
    result = await agent.run("What is our Q3 revenue target?")
    print(result)

asyncio.run(main())
```

## 4. Adding guardrails and budget control

Production agents need safety.

```python
from synapsekit.guardrails import ContentFilter, BudgetGuard

agent = FunctionCallingAgent(
    model="gpt-4o",
    tools=[...],
    guardrails=[
        ContentFilter(block_categories=["hate", "violence"]),
        BudgetGuard(max_tokens_per_turn=4000, max_cost_usd=0.05),
    ],
)
```

## 5. Streaming agent steps (advanced)

Agents can stream intermediate reasoning steps.

```python
async for event in agent.stream_events("Research SynapseKit competitors"):
    if event.type == "tool_call":
        print(f"Calling tool: {event.tool_name}")
    elif event.type == "final_answer":
        print(event.content)
```

## 6. Complete runnable agent tutorial code

```python
import asyncio
from synapsekit import FunctionCallingAgent
from synapsekit.tools import tool
from pydantic import BaseModel, Field

class WeatherInput(BaseModel):
    city: str = Field(..., description="City name")

@tool("get_weather", "Get current weather for a city")
async def get_weather(input: WeatherInput) -> str:
    # Mock implementation
    return f"The weather in {input.city} is sunny, 24°C"

agent = FunctionCallingAgent(
    model="gpt-4o-mini",
    tools=[get_weather],
    system_prompt="You are a friendly weather assistant.",
)

async def chat():
    print("Weather Agent ready. Type 'exit' to quit.\n")
    while True:
        user_input = input("You: ")
        if user_input.lower() == "exit":
            break
        response = await agent.run(user_input)
        print(f"Agent: {response}\n")

if __name__ == "__main__":
    asyncio.run(chat())
```

## Key concepts covered

- Tool schema generation from Pydantic models
- Automatic function calling loop
- Guardrails & budget protection
- Streaming intermediate steps
- Memory integration (agent remembers previous turns)

**You now have a capable agent!**

**Tutorial Progress: Step 3 of 5**  
[← Previous: Your First RAG Pipeline](./first-rag-pipeline) | [Next: Building a Graph Workflow →](./building-graph-workflow)