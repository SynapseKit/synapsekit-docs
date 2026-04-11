---
sidebar_position: 4
title: "Web Search Agent"
description: "Build a web search agent using DuckDuckGoSearchTool, WebScraperTool, and TavilySearchTool with SynapseKit."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Web Search Agent

<ColabBadge path="agents/web-search-agent.ipynb" />

A web search agent closes the knowledge gap between an LLM's training cutoff and today's world. By combining a fast search tool with a scraper that reads full page content, the agent can answer questions about current events, prices, documentation, and anything else that lives on the web. **What you'll build:** an agent that uses DuckDuckGo for quick searches, scrapes full page content when it needs more detail, and optionally upgrades to Tavily for richer structured results. **Time:** ~15 min. **Difficulty:** Beginner

## Prerequisites

```bash
pip install synapsekit
export OPENAI_API_KEY="sk-..."
# Optional, for Tavily:
export TAVILY_API_KEY="tvly-..."
```

## What you'll learn

- `DuckDuckGoSearchTool` — zero-API-key web search
- `WebScraperTool` — follow URLs and extract page text
- `TavilySearchTool` — structured search results with AI-optimized excerpts
- How to compose search + scraping for deeper research
- Switching between free and paid search providers

## Step 1: Import tools

```python
import asyncio
from synapsekit.agents import (
    FunctionCallingAgent,
    DuckDuckGoSearchTool,
    WebScraperTool,
    TavilySearchTool,
)
from synapsekit.llms.openai import OpenAILLM
```

## Step 2: Build the agent with free search

`DuckDuckGoSearchTool` requires no API key and is sufficient for most general queries. Pair it with `WebScraperTool` so the agent can follow links from search results and read the full page when a snippet is not enough.

```python
agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=[
        DuckDuckGoSearchTool(),
        WebScraperTool(),
    ],
    system_prompt=(
        "You are a research assistant. When answering questions about current events "
        "or facts that may have changed recently, always search the web first. "
        "If a search snippet is insufficient, scrape the full page for detail."
    ),
    max_iterations=6,
)
```

## Step 3: Run a current-events query

```python
async def search(question: str) -> str:
    return await agent.run(question)
```

## Step 4: Upgrade to Tavily for richer results

Tavily returns AI-curated excerpts, source URLs, and relevance scores. Use it when you need cleaner, more structured search results — especially for technical topics where DuckDuckGo may surface low-quality pages.

```python
import os

# Use Tavily when the API key is available, fall back to DuckDuckGo otherwise
if os.getenv("TAVILY_API_KEY"):
    search_tool = TavilySearchTool()
else:
    search_tool = DuckDuckGoSearchTool()

premium_agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=[search_tool, WebScraperTool()],
    system_prompt="You are a research assistant with access to web search.",
    max_iterations=6,
)
```

## Step 5: Stream the agent's search process

Seeing which URLs the agent decides to visit and which it skips helps you understand whether your system prompt is steering it correctly.

```python
from synapsekit.agents import ActionEvent, FinalAnswerEvent, ObservationEvent

async def stream_search(question: str) -> None:
    async for event in agent.stream_steps(question):
        if isinstance(event, ActionEvent):
            tool_input = str(event.tool_input)
            print(f"[{event.tool}] {tool_input[:100]}")
        elif isinstance(event, ObservationEvent):
            print(f"  -> {event.observation[:150]}...")
        elif isinstance(event, FinalAnswerEvent):
            print(f"\nAnswer:\n{event.answer}")
```

## Step 6: Batch multiple queries

For research tasks that require answering several related questions, run them sequentially and collect answers into a report.

```python
async def batch_research(questions: list[str]) -> dict[str, str]:
    results = {}
    for question in questions:
        results[question] = await agent.run(question)
    return results
```

## Complete working example

```python
import asyncio
import os
from synapsekit.agents import (
    ActionEvent,
    DuckDuckGoSearchTool,
    FinalAnswerEvent,
    FunctionCallingAgent,
    ObservationEvent,
    TavilySearchTool,
    WebScraperTool,
)
from synapsekit.llms.openai import OpenAILLM


def build_agent() -> FunctionCallingAgent:
    # Prefer Tavily for richer results; DuckDuckGo requires no key
    search_tool = (
        TavilySearchTool() if os.getenv("TAVILY_API_KEY") else DuckDuckGoSearchTool()
    )
    return FunctionCallingAgent(
        llm=OpenAILLM(model="gpt-4o-mini"),
        tools=[search_tool, WebScraperTool()],
        system_prompt=(
            "You are a concise research assistant. Search the web for up-to-date information. "
            "Cite at least one source URL in every answer."
        ),
        max_iterations=6,
    )


async def main() -> None:
    agent = build_agent()

    questions = [
        "What is the current version of Python and when was it released?",
        "What are the top AI announcements from the past month?",
    ]

    for question in questions:
        print(f"\nQ: {question}")
        print("-" * 60)

        async for event in agent.stream_steps(question):
            if isinstance(event, ActionEvent):
                print(f"  Calling {event.tool}: {str(event.tool_input)[:80]}")
            elif isinstance(event, ObservationEvent):
                print(f"  Got: {event.observation[:120]}...")
            elif isinstance(event, FinalAnswerEvent):
                print(f"\n{event.answer}")


asyncio.run(main())
```

## Expected output

```
Q: What is the current version of Python and when was it released?
------------------------------------------------------------
  Calling duck_duck_go_search: current Python version 2025
  Got: Python 3.13 was released in October 2024...
  Calling web_scraper: https://www.python.org/downloads/
  Got: Python 3.13.2 - Feb. 4, 2025...

Python 3.13.2 is the latest stable release, published on February 4, 2025.
Source: https://www.python.org/downloads/
```

## How it works

`DuckDuckGoSearchTool` uses the DuckDuckGo HTML API to return a list of result titles, URLs, and snippets. `WebScraperTool` takes a URL and returns the visible text content of the page after stripping HTML tags. The agent decides when to scrape by evaluating whether a snippet answers the question — this decision is made by the LLM based on your `system_prompt` instructions.

`TavilySearchTool` calls the Tavily API, which runs its own AI-powered extraction layer to return cleaner, more relevant excerpts. It reduces the need to follow up with `WebScraperTool` on individual pages.

## Variations

**Restrict to specific domains** by post-processing search results in a wrapper tool:

```python
from synapsekit.agents import BaseTool, ToolResult
from synapsekit.agents import DuckDuckGoSearchTool

class RestrictedSearchTool(BaseTool):
    name = "search"
    description = "Search for information on trusted sources only."
    parameters = DuckDuckGoSearchTool.parameters  # reuse schema

    def __init__(self, allowed_domains: list[str]) -> None:
        self._inner = DuckDuckGoSearchTool()
        self._allowed = allowed_domains

    async def run(self, **kwargs) -> ToolResult:
        result = await self._inner.run(**kwargs)
        # Filter lines containing disallowed domains
        filtered = "\n".join(
            line for line in result.output.splitlines()
            if any(d in line for d in self._allowed)
        )
        return ToolResult(output=filtered or result.output)
```

**Add a cache** to avoid repeating identical searches within a session:

```python
from synapsekit.agents import BaseTool, DuckDuckGoSearchTool, ToolResult

class CachedSearchTool(BaseTool):
    name = "search"
    description = "Search the web with result caching."
    parameters = {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}

    def __init__(self) -> None:
        self._inner = DuckDuckGoSearchTool()
        self._cache: dict[str, ToolResult] = {}

    async def run(self, query: str = "", **kwargs) -> ToolResult:
        if query in self._cache:
            return self._cache[query]
        result = await self._inner.run(query=query)
        self._cache[query] = result
        return result
```

## Troubleshooting

**DuckDuckGo returns empty results** — DuckDuckGo rate-limits aggressive automated queries. Add a short `asyncio.sleep(1)` between searches or switch to `TavilySearchTool`.

**WebScraperTool returns garbled text** — some sites return JavaScript-only content that the scraper cannot execute. The observation will contain minimal text; the agent should fall back to the search snippet.

**Agent scrapes too many pages and hits `max_iterations`** — add "Do not scrape more than two pages per question" to `system_prompt`.

**Tavily key not recognized** — ensure the environment variable is exported before starting the Python process: `export TAVILY_API_KEY="tvly-..."`.

## Next steps

- [ReAct Research Assistant](./react-research-assistant) — add Wikipedia and arXiv alongside web search
- [Multi-Tool Orchestration](./multi-tool-orchestration) — combine search with calculators, databases, and code execution
- [Agent with Safety Guardrails](./agent-with-guardrails) — validate that output does not contain PII or blocked topics
