---
sidebar_position: 7
title: "Multi-Tool Orchestration"
description: "Build an agent with five or more tools, teach it when to use each, and execute multiple tools in a single step."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Multi-Tool Orchestration

<ColabBadge path="agents/multi-tool-orchestration.ipynb" />

A single tool is rarely enough for real-world tasks. A research question may require a web search, a Wikipedia lookup, a calculation, and a code execution step — all in one agent run. The challenge is not giving the LLM the tools; it is teaching it when to use each one and how to combine their outputs. **What you'll build:** an agent with six tools covering search, knowledge lookup, calculation, code execution, weather, and news — with a clear system prompt that defines each tool's role. **Time:** ~25 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit
export OPENAI_API_KEY="sk-..."
```

## What you'll learn

- How to assemble a diverse toolset and describe each tool's purpose clearly
- Why `description` quality determines tool selection accuracy
- How `FunctionCallingAgent` handles parallel tool calls in a single LLM response
- How to inspect which tools were used and in what order
- Patterns for grouping related tools into logical sets

## Step 1: Import a diverse tool set

```python
import asyncio
from synapsekit.agents import (
    ArxivSearchTool,
    CalculatorTool,
    CodeInterpreterTool,
    DuckDuckGoSearchTool,
    FunctionCallingAgent,
    NewsTool,
    WeatherTool,
    WikipediaTool,
    ActionEvent,
    FinalAnswerEvent,
    ObservationEvent,
)
from synapsekit.llms.openai import OpenAILLM
```

## Step 2: Configure tools with clear purposes

The description field is the only signal the LLM uses to decide which tool to call. Vague descriptions cause the agent to pick the wrong tool. Precise, exclusive descriptions minimize overlap.

```python
# Each tool description must answer: "Use this tool when the user asks about X"
tools = [
    DuckDuckGoSearchTool(),   # current events, how-to questions, general web facts
    WikipediaTool(),           # definitions, historical facts, stable reference knowledge
    ArxivSearchTool(),         # academic papers, research findings, scientific studies
    NewsTool(),                # news headlines, press releases, current events summaries
    WeatherTool(),             # current weather conditions and forecasts
    CalculatorTool(),          # arithmetic, unit math, percentages, numerical calculations
    CodeInterpreterTool(timeout=10.0),  # data generation, algorithmic computation, data analysis
]
```

## Step 3: Write a system prompt that defines boundaries

A good system prompt for a multi-tool agent has three parts: the agent's role, a mapping of when to use each tool, and explicit fallback rules.

```python
SYSTEM_PROMPT = """
You are a versatile research and analysis assistant with access to seven tools.

Tool selection guide:
- duck_duck_go_search: Use for current events, product info, or any web fact
- wikipedia: Use for definitions, biographies, history, and stable reference facts
- arxiv_search: Use for academic papers and scientific research
- news: Use for news headlines and recent announcements
- weather: Use ONLY for weather-related questions; requires a city name
- calculator: Use for any arithmetic, percentages, or unit conversions
- code_interpreter: Use for generating data, running algorithms, or data analysis

Rules:
1. When a question requires multiple steps, plan all tool calls before executing.
2. Prefer the most specific tool over a general web search.
3. Always cite sources when using search results.
4. If a tool returns an error, report it and try an alternative approach.
"""

agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=tools,
    system_prompt=SYSTEM_PROMPT,
    max_iterations=12,
)
```

## Step 4: Handle parallel tool calls

When `FunctionCallingAgent` receives a response with multiple `tool_calls` in one LLM message, it executes them all before returning observations to the LLM. This halves the number of round-trips for questions that require independent parallel lookups.

```python
async def run_with_trace(question: str) -> None:
    print(f"Q: {question}\n")
    tools_used = []

    async for event in agent.stream_steps(question):
        if isinstance(event, ActionEvent):
            tools_used.append(event.tool)
            print(f"  [{event.tool}] {str(event.tool_input)[:80]}")
        elif isinstance(event, ObservationEvent):
            print(f"  -> {event.observation[:120]}...")
        elif isinstance(event, FinalAnswerEvent):
            print(f"\nAnswer: {event.answer}")
            print(f"\nTools used: {tools_used}")
```

## Step 5: Inspect tool usage patterns

After a run, `agent.memory.steps` tells you the order and frequency of tool calls. This is useful for identifying when the agent over-searches or picks the wrong tool.

```python
def summarize_run(agent: FunctionCallingAgent) -> None:
    from collections import Counter
    tool_counts = Counter(step.action for step in agent.memory.steps)
    print("\nTool usage:")
    for tool_name, count in tool_counts.most_common():
        print(f"  {tool_name}: {count}x")
    print(f"Total steps: {len(agent.memory.steps)}")
```

## Step 6: Handle complex multi-part questions

Some questions naturally decompose into parallel sub-questions. Guide the agent by phrasing questions with explicit structure.

```python
multi_part_questions = [
    # This triggers parallel calls: weather + news simultaneously
    "What is the current weather in Tokyo, and what are today's top tech news headlines?",
    # This triggers sequential calls: wikipedia → calculator
    "What is the population of Brazil? Calculate what percentage it is of the world population of 8.1 billion.",
    # This triggers a code + search chain
    "Generate the first 20 Fibonacci numbers and explain their connection to the golden ratio (search for context).",
]
```

## Complete working example

```python
import asyncio
from collections import Counter
from synapsekit.agents import (
    ActionEvent,
    ArxivSearchTool,
    CalculatorTool,
    CodeInterpreterTool,
    DuckDuckGoSearchTool,
    FinalAnswerEvent,
    FunctionCallingAgent,
    NewsTool,
    ObservationEvent,
    WeatherTool,
    WikipediaTool,
)
from synapsekit.llms.openai import OpenAILLM

SYSTEM_PROMPT = """
You are a versatile assistant with seven specialized tools.
Always use the most specific tool for each part of a question.
For multi-part questions, plan all tool calls upfront and execute them efficiently.
Cite sources when using search or news results.
"""


def build_agent() -> FunctionCallingAgent:
    return FunctionCallingAgent(
        llm=OpenAILLM(model="gpt-4o-mini"),
        tools=[
            DuckDuckGoSearchTool(),
            WikipediaTool(),
            ArxivSearchTool(),
            NewsTool(),
            WeatherTool(),
            CalculatorTool(),
            CodeInterpreterTool(timeout=10.0),
        ],
        system_prompt=SYSTEM_PROMPT,
        max_iterations=12,
    )


async def run_question(agent: FunctionCallingAgent, question: str) -> None:
    print(f"\n{'='*60}")
    print(f"Q: {question}")
    print("=" * 60)
    tools_used = []

    async for event in agent.stream_steps(question):
        if isinstance(event, ActionEvent):
            tools_used.append(event.tool)
            print(f"  [{event.tool}]  {str(event.tool_input)[:90]}")
        elif isinstance(event, ObservationEvent):
            print(f"    {event.observation[:150]}...")
        elif isinstance(event, FinalAnswerEvent):
            print(f"\nAnswer:\n{event.answer}")

    counts = Counter(tools_used)
    print(f"\nTools used: {dict(counts)}")


async def main() -> None:
    agent = build_agent()

    questions = [
        "What is 15% of 847 + 23% of 1200?",
        "Summarize what Wikipedia says about the Fibonacci sequence, then generate the first 15 numbers in code.",
        "What is the current weather in London, and are there any related climate news stories today?",
    ]

    for question in questions:
        await run_question(agent, question)


asyncio.run(main())
```

## Expected output

```
============================================================
Q: What is 15% of 847 + 23% of 1200?
============================================================
  [calculator]  847 * 0.15 + 1200 * 0.23
    396.05

Answer: 15% of 847 is 127.05, and 23% of 1200 is 276.00. The total is 403.05.
Tools used: {'calculator': 1}

============================================================
Q: Summarize what Wikipedia says about the Fibonacci sequence...
============================================================
  [wikipedia]  Fibonacci sequence
    In mathematics, the Fibonacci sequence is a sequence in which each element...
  [code_interpreter]  nums = [0, 1]\nfor _ in range(13):\n    nums.append(nums[-1]+nums[-2])...
    stdout: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377]

Answer: The Fibonacci sequence starts with 0 and 1...
Tools used: {'wikipedia': 1, 'code_interpreter': 1}
```

## How it works

When `FunctionCallingAgent` sends tool schemas to the LLM, the LLM may respond with a `tool_calls` array containing multiple entries in a single message. The agent iterates over all entries, executing each tool and collecting observations, before sending the full batch of tool results back in a single round-trip. This means "parallel" here refers to batching within one LLM call — actual concurrent Python execution within a single batch is sequential, but the number of LLM API round-trips is minimized.

Tool selection is driven entirely by the LLM comparing the user's question to each tool's `description`. Investing time in clear, exclusive, trigger-phrased descriptions is the highest-leverage improvement you can make to a multi-tool agent.

## Variations

**Create tool groups** for agents that serve multiple domains:

```python
RESEARCH_TOOLS = [DuckDuckGoSearchTool(), WikipediaTool(), ArxivSearchTool()]
DATA_TOOLS = [CalculatorTool(), CodeInterpreterTool()]
REALTIME_TOOLS = [WeatherTool(), NewsTool()]

all_tools = RESEARCH_TOOLS + DATA_TOOLS + REALTIME_TOOLS
```

**Limit tool access per query type** by building specialized sub-agents and routing between them:

```python
research_agent = FunctionCallingAgent(llm=llm, tools=RESEARCH_TOOLS, max_iterations=6)
data_agent = FunctionCallingAgent(llm=llm, tools=DATA_TOOLS, max_iterations=4)
```

**Add a ToolRegistry for dynamic tool loading:**

```python
from synapsekit.agents import ToolRegistry
registry = ToolRegistry(tools)
# List all registered tool names
print(registry.describe())
```

## Troubleshooting

**Agent keeps calling the same tool repeatedly** — the tool's description is too broad. Narrow it to exclude topics covered by other tools.

**Agent calls a tool with wrong parameter names** — check `tool.parameters` in the schema. The LLM reads the `properties` keys as argument names; they must match the `run()` signature exactly.

**`max_iterations` reached before final answer** — for complex multi-part questions, increase `max_iterations`. A good rule of thumb is `(number of tools likely needed × 2) + 2`.

**Parallel tool calls are not batching** — parallel batching only happens with `FunctionCallingAgent`. `ReActAgent` executes one tool per iteration by design because it parses text responses.

## Next steps

- [Agent with Safety Guardrails](./agent-with-guardrails) — add input/output validation before running a multi-tool agent in production
- [Streaming Agent Responses](./streaming-agent) — display each tool call in real time as it happens
- [ReAct Research Assistant](./react-research-assistant) — use `ReActAgent` when your LLM does not support native function calling
