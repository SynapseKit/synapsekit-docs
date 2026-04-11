---
sidebar_position: 2
title: "ReAct Research Assistant"
description: "Build a multi-source research agent with DuckDuckGo, Wikipedia, and arXiv using SynapseKit's ReActAgent."
---

import ColabBadge from '@site/src/components/ColabBadge';

# ReAct Research Assistant

<ColabBadge path="agents/react-research-assistant.ipynb" />

The ReAct (Reasoning + Acting) loop is the workhorse pattern behind most research agents. The LLM alternates between forming a thought, choosing a tool, observing the result, and repeating — until it can write a final answer grounded in real sources. **What you'll build:** a research assistant that searches DuckDuckGo for current news, Wikipedia for background knowledge, and arXiv for academic papers — with a step budget and conversation memory so it stays on topic. **Time:** ~25 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit
export OPENAI_API_KEY="sk-..."
```

## What you'll learn

- How the Thought → Action → Observation loop works internally
- When to use `ReActAgent` vs `FunctionCallingAgent`
- How to combine `DuckDuckGoSearchTool`, `WikipediaTool`, and `ArxivSearchTool`
- How to cap token spend with `max_iterations`
- How to inspect the reasoning trace via `agent.memory`

## Step 1: Install and import

```python
import asyncio
from synapsekit.agents import (
    ReActAgent,
    ArxivSearchTool,
    DuckDuckGoSearchTool,
    WikipediaTool,
    AgentMemory,
)
from synapsekit.llms.openai import OpenAILLM
```

## Step 2: Create the tools

Each tool has a single `run(input: str)` method. The agent selects which tool to call based on the tool's `name` and `description` — those strings appear verbatim in the system prompt, so make them precise.

```python
tools = [
    DuckDuckGoSearchTool(),   # current events, news
    WikipediaTool(),           # encyclopedic background
    ArxivSearchTool(),         # academic papers
]
```

## Step 3: Configure the agent

`max_iterations` acts as a step budget. Each Thought/Action/Observation cycle counts as one iteration. Setting it to 8 means the agent can call up to 8 tools before being forced to answer.

```python
memory = AgentMemory(max_steps=8)

agent = ReActAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=tools,
    max_iterations=8,
    memory=memory,
)
```

## Step 4: Run a research query

```python
async def research(question: str) -> str:
    return await agent.run(question)
```

## Step 5: Inspect the reasoning trace

After `agent.run()` completes, `agent.memory.steps` contains every Thought, Action, and Observation the agent produced. This is useful for debugging why the agent chose a particular path.

```python
def print_trace(agent: ReActAgent) -> None:
    for i, step in enumerate(agent.memory.steps, start=1):
        print(f"Step {i}")
        print(f"  Thought:     {step.thought}")
        print(f"  Action:      {step.action}")
        print(f"  Input:       {step.action_input[:80]}...")
        print(f"  Observation: {step.observation[:120]}...")
        print()
```

## Step 6: Reuse memory across turns

Clearing memory between unrelated questions prevents the scratchpad from bleeding context across sessions. For a multi-turn research session on the same topic, skip the clear so the agent retains prior observations.

```python
async def research_session(questions: list[str]) -> None:
    for question in questions:
        # Clear between unrelated questions; remove this line for follow-up questions
        agent.memory.clear()
        answer = await agent.run(question)
        print(f"Q: {question}")
        print(f"A: {answer}\n")
```

## Step 7: Stream step events for interactive display

Instead of waiting for the full answer, stream each step event so users see the agent "thinking" in real time.

```python
from synapsekit.agents import ThoughtEvent, ActionEvent, ObservationEvent, FinalAnswerEvent

async def stream_research(question: str) -> None:
    async for event in agent.stream_steps(question):
        if isinstance(event, ThoughtEvent):
            print(f"Thinking: {event.thought}")
        elif isinstance(event, ActionEvent):
            print(f"Calling:  {event.tool}({event.tool_input!r})")
        elif isinstance(event, ObservationEvent):
            print(f"Result:   {event.observation[:100]}...")
        elif isinstance(event, FinalAnswerEvent):
            print(f"\nFinal answer:\n{event.answer}")
```

## Complete working example

```python
import asyncio
from synapsekit.agents import (
    ReActAgent,
    ArxivSearchTool,
    DuckDuckGoSearchTool,
    WikipediaTool,
    AgentMemory,
    ThoughtEvent,
    ActionEvent,
    ObservationEvent,
    FinalAnswerEvent,
)
from synapsekit.llms.openai import OpenAILLM


def build_agent() -> ReActAgent:
    return ReActAgent(
        llm=OpenAILLM(model="gpt-4o-mini"),
        tools=[
            DuckDuckGoSearchTool(),
            WikipediaTool(),
            ArxivSearchTool(),
        ],
        max_iterations=8,
        memory=AgentMemory(max_steps=8),
    )


async def main() -> None:
    agent = build_agent()
    question = (
        "What are the most recent breakthroughs in large language model alignment? "
        "Include at least one academic paper and one news item."
    )

    print(f"Question: {question}\n")
    print("=" * 60)

    async for event in agent.stream_steps(question):
        if isinstance(event, ThoughtEvent):
            print(f"[Thought]      {event.thought}")
        elif isinstance(event, ActionEvent):
            print(f"[Action]       {event.tool} <- {str(event.tool_input)[:80]}")
        elif isinstance(event, ObservationEvent):
            print(f"[Observation]  {event.observation[:120]}")
        elif isinstance(event, FinalAnswerEvent):
            print("\n" + "=" * 60)
            print("FINAL ANSWER")
            print("=" * 60)
            print(event.answer)

    print("\n--- Reasoning trace ---")
    for i, step in enumerate(agent.memory.steps, start=1):
        print(f"Step {i}: {step.action}({step.action_input[:60]})")


asyncio.run(main())
```

## Expected output

```
Question: What are the most recent breakthroughs in large language model alignment?...

============================================================
[Thought]      I should search for recent LLM alignment news first, then look for academic papers.
[Action]       duck_duck_go_search <- LLM alignment breakthroughs 2025
[Observation]  ... Constitutional AI, RLHF improvements, scalable oversight ...
[Thought]      I found news results. Now let me search arXiv for recent papers.
[Action]       arxiv_search <- large language model alignment 2025
[Observation]  ... "Scalable Oversight via Debate" (2025) ...
[Thought]      I have enough information to write a comprehensive answer.

============================================================
FINAL ANSWER
============================================================
Recent LLM alignment breakthroughs include...

--- Reasoning trace ---
Step 1: duck_duck_go_search(LLM alignment breakthroughs 2025)
Step 2: arxiv_search(large language model alignment 2025)
```

## How it works

The ReAct loop works entirely through the system prompt. SynapseKit injects a formatted list of tool names and descriptions, then parses the LLM's output with regex to extract `Action:` and `Action Input:` lines. Because parsing happens in Python rather than relying on JSON tool-call responses, `ReActAgent` works with any LLM — even those without native function-calling support.

The three tools complement each other by design:
- `DuckDuckGoSearchTool` returns snippets from current web results, ideal for news and recent events
- `WikipediaTool` returns a Wikipedia article summary, ideal for stable background knowledge
- `ArxivSearchTool` returns paper titles, authors, and abstracts from arXiv, ideal for academic citations

## Variations

**Swap to FunctionCallingAgent** for more reliable tool-call parsing with OpenAI/Anthropic/Gemini:

```python
from synapsekit.agents import FunctionCallingAgent

agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=[DuckDuckGoSearchTool(), WikipediaTool(), ArxivSearchTool()],
    max_iterations=8,
    system_prompt="You are a thorough research assistant. Always cite sources.",
)
```

**Add a custom budget guard** that aborts early if a token counter exceeds a threshold:

```python
from synapsekit.agents import AgentMemory

class BudgetGuard(AgentMemory):
    """Stop the agent if more than N steps have been taken."""
    def __init__(self, max_steps: int = 5) -> None:
        super().__init__(max_steps=max_steps)

    def is_full(self) -> bool:
        # Calling the parent check means the agent loop stops at max_steps
        return len(self) >= self._max_steps
```

**Use a different search provider** by swapping `DuckDuckGoSearchTool` for `TavilySearchTool` (requires `TAVILY_API_KEY`):

```python
from synapsekit.agents import TavilySearchTool
tools = [TavilySearchTool(), WikipediaTool(), ArxivSearchTool()]
```

## Troubleshooting

**Agent loops without finishing** — increase `max_iterations` or add explicit instructions in the question like "answer in at most 3 tool calls."

**Tool not found error** — tool names in the ReAct prompt are taken from `tool.name`. Check that the string the LLM produces in `Action:` exactly matches the tool's `name` attribute.

**Wikipedia returns truncated summaries** — `WikipediaTool` returns the first section by default. For full articles, follow up with a `WebScraperTool` on the Wikipedia URL returned in the observation.

**arXiv returns no results** — arXiv full-text search has stricter rate limits. Try narrowing the query to title keywords only.

## Next steps

- [Streaming Agent Responses](./streaming-agent) — display thought events in a terminal UI or WebSocket
- [Multi-Tool Orchestration](./multi-tool-orchestration) — add five or more tools and handle parallel calls
- [Agent with Safety Guardrails](./agent-with-guardrails) — validate inputs and outputs before and after each run
