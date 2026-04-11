---
sidebar_position: 1
title: "Agents & Tools"
description: "Step-by-step guides for building agents, custom tools, and multi-tool orchestration with SynapseKit."
---

# Agents & Tools

Agents turn an LLM into an autonomous problem-solver. Instead of answering in a single shot, an agent can reason, call tools, observe results, and iterate until it reaches a final answer. These guides walk you from a minimal agent loop all the way to streaming, structured outputs, safety guardrails, and code execution.

Every guide is self-contained, includes a Google Colab notebook, and ends with a complete runnable example.

## Guides in this section

| Guide | Time | Difficulty | What you'll build |
|---|---|---|---|
| [ReAct Research Assistant](./react-research-assistant) | ~25 min | Intermediate | A research agent that searches the web, Wikipedia, and arXiv with budget controls |
| [Creating Custom Tools](./custom-tool-creation) | ~20 min | Intermediate | Tools from the `@tool` decorator, `BaseTool` subclasses, and async tools with validation |
| [Web Search Agent](./web-search-agent) | ~15 min | Beginner | An agent that combines DuckDuckGo, web scraping, and Tavily for deep research |
| [Code Execution Agent](./code-execution-agent) | ~20 min | Intermediate | An agent that writes and runs Python in a sandboxed subprocess |
| [SQL Database Agent](./sql-database-agent) | ~20 min | Intermediate | Natural language to SQL with read-only access and schema introspection |
| [Multi-Tool Orchestration](./multi-tool-orchestration) | ~25 min | Intermediate | An agent with five or more tools and parallel tool-call execution |
| [Agent with Safety Guardrails](./agent-with-guardrails) | ~15 min | Intermediate | Input/output validation with `ContentFilter`, `PIIDetector`, and `TopicRestrictor` |
| [Streaming Agent Responses](./streaming-agent) | ~15 min | Beginner | Real-time thought-process display using `stream_steps()` and typed step events |
| [Structured Output with Function Calling](./structured-output-function-calling) | ~20 min | Intermediate | Pydantic models as output schemas enforced through the function-calling loop |
| [Tool Error Handling and Retries](./tool-error-handling) | ~15 min | Intermediate | `ToolResult.is_error`, retry wrappers, fallback tools, and error recovery patterns |

## How agents work in SynapseKit

SynapseKit provides two agent classes that cover the vast majority of use cases:

```
ReActAgent          — works with any LLM, uses text-format Thought/Action/Observation loops
FunctionCallingAgent — uses native tool-call JSON (OpenAI, Anthropic, Gemini, Mistral)
```

Both share the same interface:

```
User query → agent.run(query) → final answer string
           → agent.stream_steps(query) → AsyncGenerator[StepEvent]
```

And both store their reasoning trace in `agent.memory` for inspection after a run.

## Quickstart

```python
import asyncio
from synapsekit.agents import FunctionCallingAgent, DuckDuckGoSearchTool
from synapsekit.llms.openai import OpenAILLM

agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=[DuckDuckGoSearchTool()],
)

async def main():
    answer = await agent.run("What are the latest developments in quantum computing?")
    print(answer)

asyncio.run(main())
```

## Prerequisites for all guides

```bash
pip install synapsekit
export OPENAI_API_KEY="sk-..."
```

Ready to start? Begin with [Streaming Agent Responses](./streaming-agent) if you are new to agents, or jump directly to the guide that matches your use case.
