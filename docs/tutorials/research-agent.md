---
sidebar_position: 4
---

# Tutorial: Research Agent

Build a multi-step research agent that searches the web, Wikipedia, and arXiv, scrapes source pages, writes a structured report to disk, and stays within a per-run cost budget.

**What you'll build:** An autonomous agent that accepts a research question, runs multiple parallel searches, synthesises findings, and saves a Markdown report — all for under $0.50.

**Time:** ~25 minutes
**Prerequisites:** `pip install synapsekit[openai,agents,evaluation]`

## What you'll learn

- Set up `FunctionCallingAgent` with multiple tools
- Enforce per-run cost budgets with `BudgetGuard`
- Retain context across reasoning steps with `HybridMemory`
- Stream the agent's thought process in real time
- Persist the final report with `FileWriteTool`
- Write an `@eval_case` to test output quality
- Run the eval suite with `synapsekit test`

## Step 1: Install and configure

```bash
pip install synapsekit[openai,agents,evaluation]
export OPENAI_API_KEY=sk-...
```

```python
# research_agent.py

import asyncio
from synapsekit.llms.openai import OpenAILLM
from synapsekit import LLMConfig, CostTracker, BudgetGuard, BudgetLimit

# GPT-4o gives the best multi-step reasoning for complex research tasks.
# gpt-4o-mini is acceptable for shorter research questions and lower budgets.
llm = OpenAILLM(
    model="gpt-4o",
    config=LLMConfig(
        temperature=0.3,    # Some creativity for synthesis; not fully deterministic
        max_tokens=4096,    # Long enough for a thorough report
        max_retries=3       # Retry on transient network errors
    )
)

# Shared cost tracker — records every LLM call across all agent steps.
tracker = CostTracker()

# Raise BudgetExceededError if a single research run exceeds $0.50.
# This prevents runaway agents from looping indefinitely.
guard = BudgetGuard(BudgetLimit(per_request=0.50, daily=10.00))
```

## Step 2: Configure the tools

```python
from synapsekit.agents.tools import (
    DuckDuckGoSearchTool,    # Free web search — no API key required
    WikipediaTool,           # Fetches and summarises Wikipedia articles
    ArxivSearchTool,         # Searches arXiv for academic papers
    WebScraperTool,          # Fetches and cleans any URL
    FileWriteTool,           # Writes text to a local file
)

# DuckDuckGoSearchTool: returns titles, snippets, and URLs for a query.
# max_results=8 gives enough diversity without overwhelming the context window.
search_tool = DuckDuckGoSearchTool(max_results=8)

# WikipediaTool: given a topic string, returns the article summary + key sections.
# lang="en" is the default; change for non-English research.
wiki_tool = WikipediaTool(
    lang="en",
    max_chars=4000   # Truncate very long articles to avoid token overflow
)

# ArxivSearchTool: searches arXiv by keyword; returns title, authors, abstract, PDF URL.
arxiv_tool = ArxivSearchTool(
    max_results=5,
    sort_by="relevance"   # Also supports "submittedDate" for the newest papers
)

# WebScraperTool: downloads a URL, strips boilerplate, returns clean text.
# Respects robots.txt by default — set respect_robots=False only for internal URLs.
scraper_tool = WebScraperTool(
    timeout_seconds=10,
    max_chars=8000          # Cap the text per page to control token usage
)

# FileWriteTool: writes the final report to disk.
# allowed_dirs restricts where the agent can write — security best practice.
file_tool = FileWriteTool(
    allowed_dirs=["./reports"],
    overwrite=True
)

# Collect all tools into a list for the agent
tools = [search_tool, wiki_tool, arxiv_tool, scraper_tool, file_tool]
```

## Step 3: Add HybridMemory

```python
from synapsekit.memory import HybridMemory, SQLiteConversationMemory
from synapsekit.vectorstores.inmemory import InMemoryVectorStore
from synapsekit.embeddings.openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# HybridMemory combines two stores:
#   - short_term: recent conversation turns (last N messages)
#   - long_term:  vector store for semantic recall across many steps
#
# This lets the agent "remember" findings from step 1 when writing step 10.
memory = HybridMemory(
    short_term=SQLiteConversationMemory(
        db_path="./research_memory.db",
        max_messages=30     # Keep the last 30 tool calls in the conversation window
    ),
    long_term=InMemoryVectorStore(embeddings),
    similarity_top_k=5      # How many long-term memories to inject per step
)
```

## Step 4: Build the agent

```python
from synapsekit.agents import FunctionCallingAgent

# FunctionCallingAgent uses the OpenAI function-calling API.
# At each step it decides which tool to call, calls it, observes the result,
# and continues until it reaches a final answer or max_steps.
agent = FunctionCallingAgent(
    llm=llm,
    tools=tools,
    memory=memory,
    max_steps=15,           # Maximum number of tool calls before the agent gives up
    verbose=True,           # Print each reasoning step to stdout
    system_prompt="""You are a meticulous research assistant. For every research question:
1. Search the web for recent information.
2. Check Wikipedia for background context.
3. Search arXiv for academic papers if the topic is scientific.
4. Scrape 2-3 primary sources for details.
5. Synthesise all findings into a structured Markdown report.
6. Write the report to ./reports/<topic>.md using the file_write tool.
Always cite your sources with URLs. Be precise about dates and numbers."""
)
```

## Step 5: Stream the agent's reasoning

```python
import sys

async def run_research(topic: str):
    """Run a full research task with streaming output and cost tracking."""

    print(f"\n{'='*60}")
    print(f"Research topic: {topic}")
    print(f"{'='*60}\n")

    guard.check_before(0)   # Abort early if daily budget is already exhausted

    # astream_steps() yields ReasoningStep objects as the agent thinks.
    # Each step has: .type ("thought" | "tool_call" | "tool_result" | "final"),
    #                .content (the text), .tool_name, .tool_input, .tool_output
    step_count = 0
    async for step in agent.astream_steps(topic):
        step_count += 1

        if step.type == "thought":
            # The agent's internal reasoning — shown in grey in supported terminals
            print(f"[Thought {step_count}] {step.content}")
            # Expected output: [Thought 1] I'll start by searching for recent news on this topic.

        elif step.type == "tool_call":
            # Which tool the agent decided to call and with what arguments
            print(f"[Tool call] {step.tool_name}({step.tool_input})")
            # Expected output: [Tool call] duckduckgo_search(query='quantum computing 2025 breakthroughs')

        elif step.type == "tool_result":
            # The raw result returned by the tool (truncated for readability)
            preview = str(step.tool_output)[:200]
            print(f"[Result]    {preview}...")

        elif step.type == "final":
            # The agent's synthesised final answer
            print(f"\n{'='*60}")
            print("FINAL REPORT WRITTEN")
            print(f"{'='*60}")
            print(step.content[:500] + "...")  # Preview the first 500 chars

    # Record cost after the run completes
    rec = tracker.record("gpt-4o", input_tokens=4000, output_tokens=1000)
    guard.check_after(rec.cost_usd)

    print(f"\nSteps taken:  {step_count}")
    print(f"Cost this run: ${rec.cost_usd:.6f}")
    # Expected output:
    # Steps taken:  11
    # Cost this run: $0.023400
    return step.content
```

## Step 6: Run the agent

```python
async def main():
    import os
    os.makedirs("./reports", exist_ok=True)

    # Run research on a topic
    topic = "Recent advances in large language model reasoning (2024-2025)"
    report = await run_research(topic)

    # The file_write tool will have written: ./reports/recent-advances-llm-reasoning.md
    print("\nReport saved. Cost summary:")
    print(tracker.summary())
    # Expected output:
    # Report saved. Cost summary:
    # {
    #   "total_usd": 0.023400,
    #   "by_scope": {},
    #   "by_model": {"gpt-4o": 0.023400}
    # }

asyncio.run(main())
```

## Step 7: Write an eval case

Use `@eval_case` to define automated quality checks that run with `synapsekit test`.

```python
# tests/test_research_agent.py
from synapsekit.evaluation import eval_case, EvalSuite
from synapsekit.evaluation.metrics import ContainsKeywords, MaxCostUSD, MinWordCount

# eval_case marks a coroutine as a test case.
# The decorator records the function name, input, and expected outcome.
@eval_case(
    description="Research agent produces a report with required sections",
    max_cost_usd=0.50,   # The entire run must cost less than $0.50
)
async def test_research_report_quality():
    from research_agent import run_research, tracker

    initial_cost = tracker.total_cost_usd
    report = await run_research("Impact of transformer architecture on NLP benchmarks")
    run_cost = tracker.total_cost_usd - initial_cost

    return {
        "output": report,
        "cost_usd": run_cost,
    }

# EvalSuite aggregates eval_case functions and runs them with shared metrics.
suite = EvalSuite(
    cases=[test_research_report_quality],
    metrics=[
        # The report must mention all of these keywords
        ContainsKeywords(["transformer", "BERT", "GPT", "benchmark", "accuracy"]),
        # The report must be at least 500 words
        MinWordCount(500),
        # The total cost must be under $0.50
        MaxCostUSD(threshold=0.50),
    ]
)
```

```bash
# Run the eval suite — outputs a table of pass/fail + cost per case
synapsekit test tests/test_research_agent.py

# Expected output:
# Running 1 eval case(s)...
#
# test_research_report_quality ✓
#   ContainsKeywords ... PASS (5/5 keywords found)
#   MinWordCount     ... PASS (742 words)
#   MaxCostUSD       ... PASS ($0.023 < $0.50)
#
# 1 passed, 0 failed  |  total cost: $0.023
```

## Complete working example

```python
# complete_research_agent.py — minimal version that runs without a file system
import asyncio
import os
from synapsekit.llms.openai import OpenAILLM
from synapsekit import LLMConfig, CostTracker, BudgetGuard, BudgetLimit
from synapsekit.agents import FunctionCallingAgent
from synapsekit.agents.tools import DuckDuckGoSearchTool, WikipediaTool, ArxivSearchTool
from synapsekit.memory import HybridMemory, SQLiteConversationMemory
from synapsekit.vectorstores.inmemory import InMemoryVectorStore
from synapsekit.embeddings.openai import OpenAIEmbeddings

async def main():
    llm        = OpenAILLM(model="gpt-4o-mini", config=LLMConfig(temperature=0.3))
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    tracker    = CostTracker()
    guard      = BudgetGuard(BudgetLimit(per_request=0.50))

    memory = HybridMemory(
        short_term=SQLiteConversationMemory(db_path=":memory:", max_messages=20),
        long_term=InMemoryVectorStore(embeddings),
        similarity_top_k=3
    )

    agent = FunctionCallingAgent(
        llm=llm,
        tools=[
            DuckDuckGoSearchTool(max_results=5),
            WikipediaTool(max_chars=2000),
            ArxivSearchTool(max_results=3),
        ],
        memory=memory,
        max_steps=10,
        verbose=True,
        system_prompt=(
            "You are a research assistant. Search for information on the given topic "
            "and produce a concise summary with key findings and sources."
        )
    )

    topic = "Retrieval-augmented generation (RAG) — key papers and results"
    print(f"Researching: {topic}\n")

    guard.check_before(0)
    result = await agent.arun(topic)

    rec = tracker.record("gpt-4o-mini", input_tokens=3000, output_tokens=800)
    guard.check_after(rec.cost_usd)

    print("\n=== Research Summary ===")
    print(result)
    print(f"\nCost: ${rec.cost_usd:.6f}")
    # Expected output:
    # Researching: Retrieval-augmented generation (RAG) — key papers and results
    #
    # [Thought 1] I'll search for RAG papers and recent benchmarks.
    # [Tool call]  duckduckgo_search(query='retrieval augmented generation key papers 2024')
    # [Result]     1. "RAG Survey 2024" — arxiv.org/abs/2404.xxxxx ...
    # ...
    # === Research Summary ===
    # # Retrieval-Augmented Generation: Key Papers and Results
    # ## Overview
    # RAG was introduced by Lewis et al. (2020) and has since become a standard...

asyncio.run(main())
```

## Troubleshooting

**Agent exceeds `max_steps` without finishing**
The agent may be looping between tools. Add a `stop_sequences` list to the LLM config, or reduce `max_steps` and add more specific instructions in `system_prompt` to prioritise synthesis over search.

**`BudgetExceededError` mid-run**
The agent made more LLM calls than expected. Lower the model to `gpt-4o-mini`, set `max_tokens=2048`, or reduce `max_results` on each tool to keep context windows smaller.

**DuckDuckGo rate limiting**
DuckDuckGo's unofficial API has rate limits. Add `asyncio.sleep(1)` between searches, or switch to a paid search API by replacing `DuckDuckGoSearchTool` with `BraveSearchTool` or `TavilySearchTool`.

## Next steps

- [FunctionCallingAgent reference](../agents/function-calling) — all agent options
- [Tools reference](../agents/tools) — all built-in tools and custom tool guide
- [Evaluation overview](../evaluation/overview) — `@eval_case`, `EvalSuite`, all metrics
- [Budget guard reference](../observability/cost-tracker) — limits and circuit breakers
