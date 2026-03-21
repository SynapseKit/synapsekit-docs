---
sidebar_position: 7
---

# Error Handling

Robust LLM applications handle transient API failures, provider outages, budget limits, and tool errors gracefully. This guide covers every error handling pattern in SynapseKit.

## Prerequisites

```bash
pip install synapsekit[openai,anthropic]
```

---

## 1. LLM retries with exponential backoff

Configure `LLMConfig` to automatically retry on transient errors (rate limits, 5xx responses, timeouts).

```python
from synapsekit.llms.base import LLMConfig
from synapsekit.llms.openai import OpenAILLM


llm = OpenAILLM(
    model="gpt-4o-mini",
    config=LLMConfig(
        max_retries=3,          # Retry up to 3 times
        retry_delay=1.0,        # Start with 1s delay
        retry_backoff=2.0,      # Double each retry: 1s → 2s → 4s
        retry_on_status=[429, 500, 502, 503, 504],  # Status codes to retry
        timeout=30.0,           # Per-request timeout in seconds
    ),
)

import asyncio

async def main():
    # If the first attempt hits a 429, it retries automatically
    answer = await llm.generate("What is RAG?")
    print(answer)
    # Expected output: RAG (Retrieval-Augmented Generation) combines a
    # retrieval system with a language model to answer questions...

asyncio.run(main())
```

### Catching `MaxRetriesExceeded`

```python
from synapsekit.exceptions import MaxRetriesExceededError
import asyncio


async def main():
    try:
        answer = await llm.generate("What is RAG?")
    except MaxRetriesExceededError as e:
        print(f"All {e.attempts} attempts failed. Last error: {e.last_error}")
        # Expected output: All 3 attempts failed. Last error: Rate limit exceeded

asyncio.run(main())
```

---

## 2. Provider fallback pattern

When one provider is down, automatically fail over to the next.

```python
import asyncio
from synapsekit.llms.openai import OpenAILLM
from synapsekit.llms.anthropic import AnthropicLLM
from synapsekit.llms.ollama import OllamaLLM


async def generate_with_fallback(prompt: str) -> str:
    """Try each provider in order; return first successful response."""
    providers = [
        OpenAILLM(model="gpt-4o"),
        AnthropicLLM(model="claude-sonnet-4-6"),
        OllamaLLM(model="llama3"),  # Local fallback — always available
    ]
    last_error = None
    for llm in providers:
        try:
            return await llm.generate(prompt)
        except Exception as e:
            print(f"Provider {llm.__class__.__name__} failed: {e}, trying next...")
            last_error = e
    raise RuntimeError(f"All providers failed. Last error: {last_error}")


async def main():
    answer = await generate_with_fallback("Explain vector databases in one sentence")
    print(answer)
    # Expected output (from whichever provider succeeds):
    # A vector database stores high-dimensional embeddings and enables
    # fast similarity search over them.

asyncio.run(main())
```

### Using the built-in `FallbackLLM`

```python
from synapsekit.llms import FallbackLLM
from synapsekit.llms.openai import OpenAILLM
from synapsekit.llms.anthropic import AnthropicLLM
import asyncio


async def main():
    llm = FallbackLLM(
        providers=[
            OpenAILLM(model="gpt-4o"),
            AnthropicLLM(model="claude-sonnet-4-6"),
        ],
        on_fallback=lambda provider, err: print(f"Fell back from {provider}: {err}"),
    )

    result = await llm.generate("What is the speed of light?")
    print(result)
    # Expected output: The speed of light in a vacuum is approximately
    # 299,792,458 metres per second (about 3 × 10^8 m/s).

asyncio.run(main())
```

---

## 3. BudgetExceededError handling

`BudgetGuard` raises `BudgetExceededError` when spending exceeds a configured threshold.

```python
import asyncio
from synapsekit.llms.openai import OpenAILLM
from synapsekit.observability import CostTracker
from synapsekit.guardrails import BudgetGuard
from synapsekit.exceptions import BudgetExceededError


async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    tracker = CostTracker()

    # Raise BudgetExceededError when spend exceeds $0.10
    guard = BudgetGuard(tracker=tracker, budget_usd=0.10)
    guarded_llm = guard.wrap(llm)

    questions = [
        "Explain quantum computing in detail",
        "Write a 500-word essay on climate change",
        "List 50 Python best practices with examples",
    ]

    total_spent = 0.0
    for question in questions:
        try:
            answer = await guarded_llm.generate(question)
            cost = tracker.last_call_cost_usd
            total_spent += cost
            print(f"Cost: ${cost:.4f} | {question[:40]}...")
        except BudgetExceededError as e:
            print(f"Budget exceeded! Spent ${e.spent_usd:.4f} of ${e.budget_usd:.4f}")
            print("Switching to cheaper model...")
            # Fall back to a cheaper model for remaining questions
            cheap_llm = OpenAILLM(model="gpt-4o-mini")
            answer = await cheap_llm.generate(question)

    print(f"\nTotal spent: ${total_spent:.4f}")
    # Expected output:
    # Cost: $0.0012 | Explain quantum computing in detail...
    # Cost: $0.0034 | Write a 500-word essay on climate change...
    # Budget exceeded! Spent $0.1003 of $0.1000
    # Switching to cheaper model...

asyncio.run(main())
```

---

## 4. GraphInterrupt handling and resume

`StateGraph` supports human-in-the-loop interrupts. Handle `GraphInterruptError` to pause, collect input, and resume.

```python
import asyncio
from synapsekit.graph import StateGraph
from synapsekit.graph.exceptions import GraphInterruptError


async def draft_content(state: dict) -> dict:
    return {"draft": f"Draft response for: {state['input']}"}


async def review_gate(state: dict) -> dict:
    """Interrupt here for human review."""
    from synapsekit.graph import interrupt
    approved = await interrupt(
        state,
        message=f"Please review this draft:\n\n{state['draft']}\n\nApprove? (yes/no)",
    )
    return {"approved": approved, "review_done": True}


async def publish(state: dict) -> dict:
    if state.get("approved"):
        return {"status": "published", "content": state["draft"]}
    return {"status": "rejected"}


async def main():
    graph = StateGraph()
    graph.add_node("draft", draft_content)
    graph.add_node("review", review_gate)
    graph.add_node("publish", publish)
    graph.add_edge("draft", "review")
    graph.add_edge("review", "publish")
    graph.set_entry_point("draft")
    compiled = graph.compile(checkpointer="sqlite")  # Persist state for resume

    thread_id = "content-review-001"

    # First run — will pause at the interrupt node
    try:
        result = await compiled.ainvoke(
            {"input": "Write a blog post about RAG"},
            config={"thread_id": thread_id},
        )
    except GraphInterruptError as e:
        print(f"Paused: {e.message}")
        # Expected output: Paused: Please review this draft: ...

        # Simulate human review
        human_input = "yes"
        print(f"Human input: {human_input}")

        # Resume from the interrupt point
        result = await compiled.ainvoke(
            {"input": human_input},
            config={"thread_id": thread_id},
        )
        print(f"Final status: {result['status']}")
        # Expected output: Final status: published

asyncio.run(main())
```

---

## 5. Rate limiting

Protect against hitting provider rate limits by throttling requests.

```python
import asyncio
from synapsekit.llms.openai import OpenAILLM
from synapsekit.utils import RateLimiter


async def main():
    llm = OpenAILLM(model="gpt-4o-mini")

    # Allow at most 10 requests per minute
    limiter = RateLimiter(requests_per_minute=10)

    questions = [f"Question {i}: What is {i} + {i}?" for i in range(20)]

    async def ask_with_limit(question: str) -> str:
        async with limiter:
            return await llm.generate(question)

    # Process in batches with concurrency limit
    semaphore = asyncio.Semaphore(3)  # Max 3 concurrent requests

    async def ask_bounded(question: str) -> str:
        async with semaphore:
            return await ask_with_limit(question)

    results = await asyncio.gather(*[ask_bounded(q) for q in questions[:5]])
    for q, r in zip(questions[:5], results):
        print(f"{q} -> {r[:40]}")

asyncio.run(main())
```

---

## 6. Tool error handling

Agents recover gracefully when tools return errors.

```python
import asyncio
from synapsekit.agents import FunctionCallingAgent
from synapsekit.llms.openai import OpenAILLM
from synapsekit.tools import tool


@tool
async def risky_api_call(endpoint: str) -> str:
    """Call an external API endpoint.

    Args:
        endpoint: The API endpoint URL to call
    """
    import aiohttp
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(endpoint, timeout=aiohttp.ClientTimeout(total=5)) as r:
                if r.status != 200:
                    # Return error as string — agent will handle it
                    return f"Error: API returned HTTP {r.status}"
                return await r.text()
    except aiohttp.ClientConnectorError:
        return f"Error: Could not connect to {endpoint}"
    except TimeoutError:
        return f"Error: Request timed out after 5 seconds"


async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    agent = FunctionCallingAgent(
        llm=llm,
        tools=[risky_api_call],
        max_iterations=5,
        on_tool_error="continue",  # Continue on tool errors (default: "raise")
    )

    result = await agent.run("Fetch data from https://nonexistent-api.example.com")
    print(result)
    # Expected output: I tried to fetch the data from that URL, but received
    # an error: Could not connect to https://nonexistent-api.example.com.
    # The service may be unavailable. Please check the URL or try again later.

asyncio.run(main())
```

---

## 7. Common exceptions reference

| Exception | When raised | How to handle |
|---|---|---|
| `MaxRetriesExceededError` | All retry attempts failed | Fallback to another provider |
| `BudgetExceededError` | Spend exceeds `BudgetGuard` limit | Switch to cheaper model or stop |
| `GraphInterruptError` | `interrupt()` called in a node | Collect human input and resume |
| `RateLimitError` | Provider rate limit hit | `RateLimiter` or exponential backoff |
| `AuthenticationError` | Invalid API key | Check environment variable |
| `ContextLengthExceededError` | Prompt too long for model | Truncate context or use larger model |
| `ToolExecutionError` | Unhandled exception in tool | Wrap tool body in try/except |
| `EmbeddingError` | Embeddings API failed | Retry or fallback embeddings provider |

### Catching all SynapseKit errors

```python
from synapsekit.exceptions import SynapseKitError
import asyncio


async def safe_generate(llm, prompt: str) -> str | None:
    """Return None instead of raising on any SynapseKit error."""
    try:
        return await llm.generate(prompt)
    except SynapseKitError as e:
        print(f"SynapseKit error ({type(e).__name__}): {e}")
        return None
    except Exception as e:
        print(f"Unexpected error: {type(e).__name__}: {e}")
        return None
```

---

## 8. Structured error logging

```python
import asyncio
import logging
from synapsekit.llms.openai import OpenAILLM
from synapsekit.exceptions import MaxRetriesExceededError, BudgetExceededError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("my_app")


async def robust_query(llm, prompt: str) -> str:
    try:
        result = await llm.generate(prompt)
        logger.info("LLM call succeeded", extra={"prompt_len": len(prompt)})
        return result
    except MaxRetriesExceededError as e:
        logger.error(
            "LLM retries exhausted",
            extra={"attempts": e.attempts, "last_error": str(e.last_error)},
        )
        raise
    except BudgetExceededError as e:
        logger.warning(
            "Budget exceeded",
            extra={"spent": e.spent_usd, "budget": e.budget_usd},
        )
        raise
    except Exception as e:
        logger.exception("Unexpected error in LLM call")
        raise
```

---

## Summary

| Pattern | Recommended for |
|---|---|
| `LLMConfig(max_retries=3)` | Every production LLM call |
| `FallbackLLM` | High-availability requirements |
| `BudgetGuard` | Any cost-sensitive application |
| `GraphInterruptError` + resume | Human-in-the-loop workflows |
| `RateLimiter` | Batch processing jobs |
| Return error strings from tools | Agent self-correction |
