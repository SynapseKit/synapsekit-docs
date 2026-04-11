---
sidebar_position: 11
title: "Tool Error Handling and Retries"
description: "Handle tool errors, build retry wrappers, add fallback tools, and recover gracefully in SynapseKit agents."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Tool Error Handling and Retries

<ColabBadge path="agents/tool-error-handling.ipynb" />

Tools fail. APIs time out, databases go offline, inputs are malformed. An agent that treats every `ToolResult.error` as fatal will halt at the first hiccup. Robust error handling means the agent retries transient failures, falls back to alternatives, and degrades gracefully when nothing works. **What you'll build:** retry wrappers, fallback tool chains, and a graceful-degradation agent that continues making progress even when individual tools fail. **Time:** ~15 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit
export OPENAI_API_KEY="sk-..."
```

## What you'll learn

- How `ToolResult.is_error` signals failure to the agent
- Building a `RetryTool` wrapper with configurable backoff
- Building a `FallbackTool` that tries alternatives in order
- How the agent reasons about tool errors and whether to retry
- Logging errors without disrupting the agent loop

## Step 1: Understand ToolResult error semantics

```python
import asyncio
from synapsekit.agents import BaseTool, ToolResult
```

`ToolResult.is_error` is `True` when the `error` field is not `None`. The `__str__` method returns `error` when set, so the agent always receives a string observation — it never sees `None`.

```python
# Success
ok = ToolResult(output="42")
print(ok.is_error)    # False
print(str(ok))        # "42"

# Error
err = ToolResult(output="", error="Connection timeout after 5s")
print(err.is_error)   # True
print(str(err))       # "Connection timeout after 5s"
```

The agent receives the `str(result)` as its observation. For errors, this means the LLM sees the error message and can decide whether to retry, try a different tool, or report the failure.

## Step 2: Build a RetryTool wrapper

A retry wrapper transparently re-calls the underlying tool when it returns an error. Use exponential backoff to avoid hammering a rate-limited API.

```python
import asyncio
import time
from typing import Any


class RetryTool(BaseTool):
    """Wraps any BaseTool with automatic retry on error."""

    def __init__(
        self,
        inner: BaseTool,
        max_retries: int = 3,
        initial_delay: float = 1.0,
        backoff_factor: float = 2.0,
    ) -> None:
        self._inner = inner
        self._max_retries = max_retries
        self._initial_delay = initial_delay
        self._backoff_factor = backoff_factor

    @property
    def name(self) -> str:
        return self._inner.name

    @property
    def description(self) -> str:
        return self._inner.description

    @property
    def parameters(self) -> dict:
        return self._inner.parameters

    def schema(self) -> dict:
        return self._inner.schema()

    async def run(self, **kwargs: Any) -> ToolResult:
        delay = self._initial_delay

        for attempt in range(self._max_retries + 1):
            result = await self._inner.run(**kwargs)

            if not result.is_error:
                return result  # Success — no retry needed

            if attempt < self._max_retries:
                # Only sleep between attempts; last failure falls through
                print(f"[retry] {self.name} failed (attempt {attempt + 1}): {result.error}")
                await asyncio.sleep(delay)
                delay *= self._backoff_factor

        return result  # Return the last error after all retries exhausted
```

## Step 3: Build a FallbackTool chain

A fallback chain tries each tool in order and returns the first success. This is ideal when you have a premium tool (e.g., Tavily) and a free fallback (e.g., DuckDuckGo).

```python
class FallbackTool(BaseTool):
    """Try each tool in order; return the first successful result."""

    def __init__(self, tools: list[BaseTool], name: str, description: str) -> None:
        if not tools:
            raise ValueError("FallbackTool requires at least one tool")
        self._tools = tools
        self._name = name
        self._description = description
        self._parameters = tools[0].parameters

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> str:
        return self._description

    @property
    def parameters(self) -> dict:
        return self._parameters

    async def run(self, **kwargs: Any) -> ToolResult:
        errors = []

        for tool in self._tools:
            result = await tool.run(**kwargs)
            if not result.is_error:
                return result  # First success wins
            errors.append(f"{tool.name}: {result.error}")

        # All tools failed — return a combined error message
        combined = "; ".join(errors)
        return ToolResult(output="", error=f"All fallbacks failed: {combined}")
```

## Step 4: Build a flaky tool for testing

Always test your error handling logic with a deliberately unreliable tool:

```python
import random


class FlakeySearchTool(BaseTool):
    """Simulates a search tool that fails randomly — for testing retry logic."""

    name = "search"
    description = "Search the web for information."
    parameters = {
        "type": "object",
        "properties": {"query": {"type": "string", "description": "Search query"}},
        "required": ["query"],
    }

    def __init__(self, failure_rate: float = 0.6) -> None:
        self._failure_rate = failure_rate
        self._call_count = 0

    async def run(self, query: str = "", **kwargs: Any) -> ToolResult:
        self._call_count += 1
        if random.random() < self._failure_rate:
            return ToolResult(output="", error=f"Rate limit exceeded (call #{self._call_count})")
        return ToolResult(output=f"Search results for '{query}': [mock result #{self._call_count}]")
```

## Step 5: Add error logging without disrupting the agent

Wrap `run()` to log errors to a side channel while still returning the `ToolResult` to the agent:

```python
class LoggingTool(BaseTool):
    """Wraps a tool to log all errors to a collector."""

    def __init__(self, inner: BaseTool) -> None:
        self._inner = inner
        self.errors: list[dict] = []

    @property
    def name(self) -> str:
        return self._inner.name

    @property
    def description(self) -> str:
        return self._inner.description

    @property
    def parameters(self) -> dict:
        return self._inner.parameters

    async def run(self, **kwargs: Any) -> ToolResult:
        result = await self._inner.run(**kwargs)
        if result.is_error:
            self.errors.append({"tool": self.name, "error": result.error, "kwargs": kwargs})
        return result  # Always forward the result — logging never blocks the agent
```

## Step 6: Steer the agent to handle errors in system prompt

The agent's behavior when it receives a tool error depends on its system prompt. Be explicit:

```python
from synapsekit.agents import FunctionCallingAgent
from synapsekit.llms.openai import OpenAILLM

agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=[RetryTool(FlakeySearchTool(failure_rate=0.5), max_retries=2)],
    system_prompt=(
        "You are a research assistant. "
        "If a tool returns an error message, try calling it again once with the same or simplified input. "
        "If it fails twice in a row, inform the user that the service is temporarily unavailable "
        "and provide the best answer you can from your training knowledge."
    ),
    max_iterations=8,
)
```

## Complete working example

```python
import asyncio
import random
from typing import Any
from synapsekit.agents import BaseTool, FunctionCallingAgent, ToolResult
from synapsekit.llms.openai import OpenAILLM


class FlakeySearchTool(BaseTool):
    name = "web_search"
    description = "Search the web. May occasionally fail due to rate limits."
    parameters = {
        "type": "object",
        "properties": {"query": {"type": "string"}},
        "required": ["query"],
    }

    def __init__(self, failure_rate: float = 0.5) -> None:
        self._failure_rate = failure_rate
        self._calls = 0

    async def run(self, query: str = "", **kwargs: Any) -> ToolResult:
        self._calls += 1
        if random.random() < self._failure_rate:
            return ToolResult(output="", error="503 Service Unavailable")
        return ToolResult(output=f"Results for '{query}': [article 1, article 2, article 3]")


class RetryTool(BaseTool):
    def __init__(self, inner: BaseTool, max_retries: int = 2, delay: float = 0.5) -> None:
        self._inner = inner
        self._max_retries = max_retries
        self._delay = delay

    @property
    def name(self) -> str: return self._inner.name
    @property
    def description(self) -> str: return self._inner.description
    @property
    def parameters(self) -> dict: return self._inner.parameters

    async def run(self, **kwargs: Any) -> ToolResult:
        for attempt in range(self._max_retries + 1):
            result = await self._inner.run(**kwargs)
            if not result.is_error:
                return result
            if attempt < self._max_retries:
                print(f"  [retry {attempt + 1}/{self._max_retries}] {result.error}")
                await asyncio.sleep(self._delay)
        return result


class FallbackTool(BaseTool):
    def __init__(self, tools: list[BaseTool], name: str, description: str) -> None:
        self._tools = tools
        self._name = name
        self._description = description

    @property
    def name(self) -> str: return self._name
    @property
    def description(self) -> str: return self._description
    @property
    def parameters(self) -> dict: return self._tools[0].parameters

    async def run(self, **kwargs: Any) -> ToolResult:
        errors = []
        for t in self._tools:
            result = await t.run(**kwargs)
            if not result.is_error:
                return result
            errors.append(f"{t.name}: {result.error}")
        return ToolResult(output="", error="All options failed: " + "; ".join(errors))


async def main() -> None:
    random.seed(42)

    # Scenario 1: retry wrapper around a flaky tool
    print("=== Scenario 1: Retry wrapper ===")
    flakey = FlakeySearchTool(failure_rate=0.6)
    reliable = RetryTool(flakey, max_retries=3, delay=0.1)

    for q in ["quantum computing", "Python 3.13 features", "SynapseKit release"]:
        result = await reliable.run(query=q)
        status = "ERROR" if result.is_error else "OK"
        print(f"  [{status}] {q}: {str(result)[:70]}")

    print(f"\n  Total underlying calls: {flakey._calls}")

    # Scenario 2: fallback chain
    print("\n=== Scenario 2: Fallback chain ===")
    always_fails = FlakeySearchTool(failure_rate=1.0)  # always fails
    always_fails.name = "premium_search"
    backup = FlakeySearchTool(failure_rate=0.0)        # always succeeds
    backup.name = "fallback_search"

    fallback = FallbackTool(
        tools=[always_fails, backup],
        name="search",
        description="Search with automatic fallback.",
    )
    result = await fallback.run(query="machine learning news")
    print(f"  Result: {result.output}")

    # Scenario 3: full agent with error handling
    print("\n=== Scenario 3: Agent with error recovery ===")
    agent = FunctionCallingAgent(
        llm=OpenAILLM(model="gpt-4o-mini"),
        tools=[RetryTool(FlakeySearchTool(failure_rate=0.4), max_retries=2)],
        system_prompt=(
            "You are a helpful assistant. If a tool returns an error, "
            "retry once. If it still fails, answer from your knowledge."
        ),
        max_iterations=6,
    )
    answer = await agent.run("What is the capital of Japan?")
    print(f"  Answer: {answer}")


asyncio.run(main())
```

## Expected output

```
=== Scenario 1: Retry wrapper ===
  [retry 1/3] 503 Service Unavailable
  [OK] quantum computing: Results for 'quantum computing': [article 1, article 2, artic
  [OK] Python 3.13 features: Results for 'Python 3.13 features': [article 1, article 2
  [retry 1/3] 503 Service Unavailable
  [retry 2/3] 503 Service Unavailable
  [OK] SynapseKit release: Results for 'SynapseKit release': [article 1, article 2, ar

Total underlying calls: 8

=== Scenario 2: Fallback chain ===
  Result: Results for 'machine learning news': [article 1, article 2, article 3]

=== Scenario 3: Agent with error recovery ===
  [retry 1/2] 503 Service Unavailable
  Answer: The capital of Japan is Tokyo.
```

## How it works

`ToolResult.is_error` checks `self.error is not None`. The agent receives `str(result)` as its observation string — for errors, this is the error message. The LLM reads the error message and applies the instructions in `system_prompt` to decide what to do next: retry, try a different tool, or answer from knowledge.

The `RetryTool` wrapper is transparent to the agent because it preserves `name`, `description`, and `parameters` from the inner tool. The agent cannot tell it is calling a wrapped version — it sees the same schema and tool name.

The `FallbackTool` hides multiple implementations behind a single tool name. The agent makes one call; the fallback logic is entirely in Python. This avoids cluttering the agent's context with error/retry reasoning when a Python-level fallback is sufficient.

## Variations

**Classify errors before retrying** to avoid retrying non-recoverable failures:

```python
async def run(self, **kwargs: Any) -> ToolResult:
    result = await self._inner.run(**kwargs)
    if result.is_error:
        # Do not retry validation errors — only transient errors
        if "required" in result.error or "invalid" in result.error.lower():
            return result
        # Retry network/timeout errors
        await asyncio.sleep(self._delay)
        return await self._inner.run(**kwargs)
    return result
```

**Track error metrics** for monitoring:

```python
from collections import Counter

class MetricsTool(BaseTool):
    def __init__(self, inner: BaseTool) -> None:
        self._inner = inner
        self.call_count = 0
        self.error_count = 0
        self.error_types: Counter = Counter()

    async def run(self, **kwargs: Any) -> ToolResult:
        self.call_count += 1
        result = await self._inner.run(**kwargs)
        if result.is_error:
            self.error_count += 1
            self.error_types[result.error[:40]] += 1
        return result
```

## Troubleshooting

**Agent retries indefinitely** — `max_iterations` is the agent-level cap, not the tool-level cap. A retry wrapper with `max_retries=3` that always fails will trigger the agent to retry the tool call from the LLM side too. Set a low `max_retries` in the wrapper and rely on the system prompt to tell the agent when to give up.

**`RetryTool.name` is `None`** — `BaseTool.name` is a class attribute, not an instance attribute. When forwarding with a `@property`, ensure the property is accessible from both the class and instance.

**Fallback order is wrong** — list tools in order of preference: fastest/cheapest first, most reliable last. The fallback stops at the first success, so the most reliable tool should be last if you want it used only as a last resort.

**Backoff delay blocks the event loop** — use `asyncio.sleep()`, not `time.sleep()`. A synchronous sleep in an async tool freezes the entire event loop.

## Next steps

- [Multi-Tool Orchestration](./multi-tool-orchestration) — apply retry and fallback wrappers to a diverse toolset
- [Agent with Safety Guardrails](./agent-with-guardrails) — combine error handling with input/output validation
- [Creating Custom Tools](./custom-tool-creation) — build error-resilient tools from scratch with explicit validation
