---
sidebar_position: 4
title: "LLM Fallback Chains"
description: "Build resilient LLM pipelines with automatic primary-to-secondary-to-tertiary failover using CircuitBreaker and fallback_chain()."
---

import ColabBadge from '@site/src/components/ColabBadge';

# LLM Fallback Chains

<ColabBadge path="llms/fallback-chain.ipynb" />

Production LLM services go down. Rate limits get hit. Network timeouts happen. A fallback chain ensures your application keeps responding even when your primary provider is unavailable, by automatically trying a sequence of providers in priority order.

**What you'll build:** A three-tier fallback chain (GPT-4o → Claude Haiku → Groq Llama) with per-provider circuit breakers, configurable retry logic, and transparent logging of which provider answered each request. **Time:** ~15 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit[openai,anthropic,groq]
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GROQ_API_KEY=gsk_...
```

## What you'll learn

- Use `fallback_chain()` to declare provider priority order
- Attach `CircuitBreaker` instances to each provider in the chain
- Configure per-provider retry counts and timeouts
- Handle `AllProvidersFailedError` when the entire chain is exhausted
- Inspect `FallbackResult.provider_used` to track which provider answered

## Step 1: Import and configure providers

```python
import asyncio
from synapsekit import LLMConfig
from synapsekit.llms.openai import OpenAILLM
from synapsekit.llms.anthropic import AnthropicLLM
from synapsekit.llms.groq import GroqLLM
from synapsekit.resilience import CircuitBreaker, fallback_chain, AllProvidersFailedError

# Use a shared config so all providers in the chain behave consistently.
# Fallback providers should use cheaper/faster models since they are the safety net.
primary_llm   = OpenAILLM(
    model="gpt-4o",
    config=LLMConfig(temperature=0.2, max_tokens=1024)
)

secondary_llm = AnthropicLLM(
    model="claude-haiku-3-5",
    config=LLMConfig(temperature=0.2, max_tokens=1024)
)

tertiary_llm  = GroqLLM(
    model="llama-3.1-8b-instant",    # Fastest and cheapest — last line of defence
    config=LLMConfig(temperature=0.2, max_tokens=512)
)
```

## Step 2: Attach circuit breakers to each provider

```python
# Each provider gets its own circuit breaker with settings tuned to that provider's
# SLA characteristics. Groq recovers quickly so its timeout is shorter.
openai_breaker = CircuitBreaker(
    name="openai-gpt4o",
    failure_threshold=3,
    window_seconds=60,
    recovery_timeout=60,
)

anthropic_breaker = CircuitBreaker(
    name="anthropic-haiku",
    failure_threshold=3,
    window_seconds=60,
    recovery_timeout=45,
)

groq_breaker = CircuitBreaker(
    name="groq-llama",
    failure_threshold=5,
    window_seconds=60,
    recovery_timeout=20,
)
```

## Step 3: Build the fallback chain

```python
# fallback_chain() accepts a list of (llm, circuit_breaker) pairs in priority order.
# SynapseKit tries each in sequence: if the first provider raises an exception or
# its breaker is OPEN, it moves to the next, and so on.
chain = fallback_chain(
    providers=[
        (primary_llm,   openai_breaker),
        (secondary_llm, anthropic_breaker),
        (tertiary_llm,  groq_breaker),
    ],
    # Optional: retry each provider this many times before moving to the next.
    # Useful for transient network errors that aren't provider outages.
    retries_per_provider=1,
)
```

## Step 4: Generate with automatic failover

```python
async def generate_with_fallback(prompt: str) -> str:
    """Send a prompt through the fallback chain and return the first successful response."""
    try:
        result = await chain.agenerate(prompt)

        # FallbackResult exposes which provider actually answered,
        # so you can log, alert, or adjust routing dynamically.
        if result.provider_used != "openai-gpt4o":
            print(f"  [fallback] Primary unavailable — answered by {result.provider_used}")

        return result.text

    except AllProvidersFailedError as e:
        # All three providers failed — surface a user-friendly error
        print(f"  [fallback] All providers failed: {e.errors}")
        return "Service temporarily unavailable. Please try again shortly."
```

## Step 5: Simulate failures to observe fallback behaviour

```python
async def demo_fallback():
    """Show the chain falling through providers as each one is artificially failed."""
    print("=== Fallback Chain Demo ===\n")

    # Normal operation — primary handles the request
    prompt = "What is idempotency in REST APIs?"
    print(f"Prompt: {prompt!r}")
    answer = await generate_with_fallback(prompt)
    print(f"Answer: {answer[:100]}...\n")

    # Simulate primary failure: trip the OpenAI breaker manually
    for _ in range(openai_breaker.failure_threshold):
        openai_breaker._record_failure()   # Internal method for testing only

    print("(OpenAI breaker now OPEN — next call will fall through to Anthropic)\n")
    print(f"Prompt: {prompt!r}")
    answer = await generate_with_fallback(prompt)
    print(f"Answer: {answer[:100]}...\n")

    # Simulate both primary and secondary failing
    for _ in range(anthropic_breaker.failure_threshold):
        anthropic_breaker._record_failure()

    print("(Anthropic breaker now OPEN — next call will fall through to Groq)\n")
    print(f"Prompt: {prompt!r}")
    answer = await generate_with_fallback(prompt)
    print(f"Answer: {answer[:100]}...\n")
```

## Complete working example

```python
import asyncio
from synapsekit import LLMConfig
from synapsekit.llms.openai import OpenAILLM
from synapsekit.llms.anthropic import AnthropicLLM
from synapsekit.llms.groq import GroqLLM
from synapsekit.resilience import CircuitBreaker, fallback_chain, AllProvidersFailedError

async def main():
    config = LLMConfig(temperature=0.2, max_tokens=512)

    chain = fallback_chain(
        providers=[
            (
                OpenAILLM(model="gpt-4o-mini", config=config),
                CircuitBreaker("openai", failure_threshold=3, recovery_timeout=30),
            ),
            (
                AnthropicLLM(model="claude-haiku-3-5", config=config),
                CircuitBreaker("anthropic", failure_threshold=3, recovery_timeout=30),
            ),
            (
                GroqLLM(model="llama-3.1-8b-instant", config=config),
                CircuitBreaker("groq", failure_threshold=5, recovery_timeout=15),
            ),
        ],
        retries_per_provider=1,
    )

    prompts = [
        "Explain the difference between authentication and authorisation.",
        "What is a deadlock and how do you prevent one?",
        "Summarise the CAP theorem in three bullet points.",
    ]

    for prompt in prompts:
        print(f"\nPrompt: {prompt!r}")
        try:
            result = await chain.agenerate(prompt)
            print(f"Provider: {result.provider_used}")
            print(f"Answer:   {result.text[:120]}...")
        except AllProvidersFailedError:
            print("All providers failed — check your API keys and network.")

asyncio.run(main())
```

## Expected output

```
Prompt: 'Explain the difference between authentication and authorisation.'
Provider: openai
Answer:   Authentication verifies who you are — it answers the question "are you who you
          claim to be?" using credentials such as passwords or tokens. Authorisation ...

Prompt: 'What is a deadlock and how do you prevent one?'
Provider: openai
Answer:   A deadlock occurs when two or more processes are each waiting for a resource ...

Prompt: 'Summarise the CAP theorem in three bullet points.'
Provider: openai
Answer:   • Consistency: Every read receives the most recent write or an error...
```

## How it works

`fallback_chain()` returns a `FallbackChain` object that wraps each `(llm, breaker)` pair. When `agenerate()` is called, it iterates the pairs in order. For each pair it first checks the breaker state: if OPEN it skips immediately to the next provider without making a network call. If CLOSED or HALF_OPEN it attempts generation, wrapping any exception as a breaker failure. After `retries_per_provider` failed attempts it moves on. If all pairs are exhausted it raises `AllProvidersFailedError` with a list of the individual errors from each provider.

## Variations

**Streaming with fallback:**
```python
# FallbackChain.astream() streams from the first available provider
async for chunk in chain.astream("Tell me about neural networks"):
    print(chunk.text, end="", flush=True)
```

**Weighted random selection instead of strict priority:**
```python
from synapsekit.resilience import weighted_fallback_chain

chain = weighted_fallback_chain(
    providers=[
        (primary_llm,   openai_breaker,   weight=0.7),
        (secondary_llm, anthropic_breaker, weight=0.3),
    ]
)
```

**Per-request timeout:**
```python
import asyncio

async def generate_with_timeout(prompt: str, timeout: float = 5.0) -> str:
    try:
        result = await asyncio.wait_for(chain.agenerate(prompt), timeout=timeout)
        return result.text
    except asyncio.TimeoutError:
        # Timeout counts as a failure for circuit breaker purposes
        return "Request timed out."
```

## Troubleshooting

**Chain always falls through to the tertiary provider**
Check that your API keys are correct and that you have not accidentally tripped all breakers in a previous test run. Each `CircuitBreaker` instance is stateful — create fresh instances per test.

**`AllProvidersFailedError` in development**
This usually means all API keys are missing or invalid. Verify each key with a direct `curl` to the provider's health endpoint before testing the chain.

**`retries_per_provider` causes slow fallover**
Each retry adds latency. For latency-sensitive applications, set `retries_per_provider=0` to fall through immediately on any error.

## Next steps

- [Cost-Aware LLM Router](./cost-router) — route by query complexity, not just availability
- [Semantic Response Caching](./semantic-caching) — reduce calls to all providers with a cache layer
- [LLM Provider Comparison](./provider-comparison) — benchmark providers to choose the right fallback order
