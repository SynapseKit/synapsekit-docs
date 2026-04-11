---
sidebar_position: 2
title: "LLM Provider Comparison"
description: "Compare OpenAI, Anthropic, Groq, and Ollama using SynapseKit's unified LLM interface and switch providers with one line of code."
---

import ColabBadge from '@site/src/components/ColabBadge';

# LLM Provider Comparison

<ColabBadge path="llms/provider-comparison.ipynb" />

SynapseKit wraps every LLM provider behind a single interface. The same `agenerate()`, `astream()`, and `LLMConfig` work identically across OpenAI, Anthropic, Groq, Ollama, and 26 other providers. This guide benchmarks four of the most popular providers on speed, cost, and quality so you can make an informed choice.

**What you'll build:** A benchmark harness that sends the same prompts to OpenAI, Anthropic, Groq, and Ollama, measures latency and token cost, and prints a comparison table. **Time:** ~15 min. **Difficulty:** Beginner

## Prerequisites

```bash
pip install synapsekit[openai,anthropic,groq,ollama]
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GROQ_API_KEY=gsk_...
# Ollama requires a local server: https://ollama.ai
```

## What you'll learn

- Import and configure providers using `synapsekit.llms.*`
- Use `LLMConfig` to set temperature, max tokens, and other shared parameters
- Call `agenerate()` on any provider with identical code
- Measure latency and estimate cost with `CostTracker`
- Switch providers by changing a single variable

## Step 1: Import providers and set up shared config

```python
import asyncio
import time
from synapsekit import LLMConfig, CostTracker
from synapsekit.llms.openai import OpenAILLM
from synapsekit.llms.anthropic import AnthropicLLM
from synapsekit.llms.groq import GroqLLM
from synapsekit.llms.ollama import OllamaLLM

# LLMConfig is provider-agnostic — the same object works for every provider.
# Only set fields that the provider supports; unsupported fields are silently ignored.
config = LLMConfig(
    temperature=0.2,    # Low temperature for consistent, comparable outputs
    max_tokens=256,     # Cap output so benchmarks are fair
)
```

## Step 2: Instantiate each provider

```python
# Each provider class accepts a model name and a shared LLMConfig.
# Credentials are read from environment variables automatically.
providers = {
    "openai/gpt-4o-mini":       OpenAILLM(model="gpt-4o-mini",           config=config),
    "anthropic/claude-haiku":   AnthropicLLM(model="claude-haiku-3-5",    config=config),
    "groq/llama-3.1-8b":        GroqLLM(model="llama-3.1-8b-instant",     config=config),
    "ollama/llama3.2":          OllamaLLM(model="llama3.2",               config=config),
}
```

## Step 3: Write the benchmark harness

```python
async def benchmark(prompt: str, providers: dict) -> list[dict]:
    """Run a single prompt across all providers and record latency + response."""
    results = []
    tracker = CostTracker()

    for name, llm in providers.items():
        start = time.perf_counter()
        response = await llm.agenerate(prompt)
        elapsed = time.perf_counter() - start

        # Approximate token counts from word count; use tiktoken for precision.
        in_tokens  = len(prompt.split()) * 2
        out_tokens = len(response.text.split())
        rec = tracker.record(name, input_tokens=in_tokens, output_tokens=out_tokens)

        results.append({
            "provider": name,
            "latency_s": round(elapsed, 2),
            "output_tokens": out_tokens,
            "cost_usd": rec.cost_usd,
            "answer": response.text[:120],
        })

    return results
```

## Step 4: Run the benchmark across multiple prompts

```python
TEST_PROMPTS = [
    "What is the capital of Australia?",
    "Explain what a hash table is in two sentences.",
    "Write a Python one-liner that reverses a string.",
]

async def run_full_benchmark():
    print(f"{'Provider':<30} {'Latency':>10} {'Tokens':>8} {'Cost USD':>12}")
    print("-" * 65)

    for prompt in TEST_PROMPTS:
        print(f"\nPrompt: {prompt!r}\n")
        results = await benchmark(prompt, providers)

        for r in sorted(results, key=lambda x: x["latency_s"]):
            print(
                f"  {r['provider']:<28} "
                f"{r['latency_s']:>8.2f}s "
                f"{r['output_tokens']:>7} tk "
                f"${r['cost_usd']:>10.7f}"
            )
            print(f"    → {r['answer']}")
```

## Complete working example

```python
import asyncio
import time
from synapsekit import LLMConfig, CostTracker
from synapsekit.llms.openai import OpenAILLM
from synapsekit.llms.anthropic import AnthropicLLM
from synapsekit.llms.groq import GroqLLM
from synapsekit.llms.ollama import OllamaLLM

async def main():
    config = LLMConfig(temperature=0.2, max_tokens=256)

    providers = {
        "openai/gpt-4o-mini":     OpenAILLM(model="gpt-4o-mini",        config=config),
        "anthropic/claude-haiku": AnthropicLLM(model="claude-haiku-3-5", config=config),
        "groq/llama-3.1-8b":      GroqLLM(model="llama-3.1-8b-instant",  config=config),
        "ollama/llama3.2":        OllamaLLM(model="llama3.2",            config=config),
    }

    prompt = "What is the difference between a process and a thread?"
    tracker = CostTracker()

    print(f"Prompt: {prompt!r}\n")
    print(f"{'Provider':<30} {'Latency':>10} {'Tokens':>8} {'Cost':>12}")
    print("-" * 65)

    for name, llm in providers.items():
        start = time.perf_counter()
        response = await llm.agenerate(prompt)
        elapsed = time.perf_counter() - start

        in_tok  = len(prompt.split()) * 2
        out_tok = len(response.text.split())
        rec = tracker.record(name, input_tokens=in_tok, output_tokens=out_tok)

        print(
            f"{name:<30} "
            f"{elapsed:>8.2f}s "
            f"{out_tok:>7} tk "
            f"${rec.cost_usd:>10.7f}"
        )
        print(f"  {response.text[:100]}...\n")

    print(f"\nTotal estimated cost: ${tracker.total_cost_usd:.7f}")

asyncio.run(main())
```

## Expected output

```
Prompt: 'What is the difference between a process and a thread?'

Provider                        Latency   Tokens         Cost
-----------------------------------------------------------------
groq/llama-3.1-8b                  0.38s     89 tk  $0.0000041
ollama/llama3.2                    1.12s     95 tk  $0.0000000
openai/gpt-4o-mini                 1.47s    102 tk  $0.0000765
anthropic/claude-haiku             1.89s     97 tk  $0.0000388

Total estimated cost: $0.0001194
```

## How it works

SynapseKit's LLM base class defines a protocol: every provider implements `agenerate(prompt)` and returns a `LLMResponse` with a `.text` field. The `LLMConfig` is deserialized into provider-specific API parameters at call time — so `temperature=0.2` becomes `temperature: 0.2` in the OpenAI request body and `temperature: 0.2` in the Anthropic one, but the application code never changes.

`CostTracker.record()` stores a `CostRecord` per call. It looks up per-token prices from an internal pricing table keyed by model name, so `tracker.total_cost_usd` always reflects the running sum.

## Variations

**Switch providers with one variable:**
```python
# Change this one line to route all traffic to a different provider
active_llm = providers["groq/llama-3.1-8b"]
response = await active_llm.agenerate("Your prompt here")
```

**Streaming responses:**
```python
async for chunk in llm.astream("Tell me a story"):
    print(chunk.text, end="", flush=True)
```

**Run providers concurrently to reduce wall-clock time:**
```python
import asyncio

responses = await asyncio.gather(*[
    llm.agenerate(prompt) for llm in providers.values()
])
```

## Troubleshooting

**`OllamaLLM` raises `ConnectionRefusedError`**
Ollama requires a local server running on port 11434. Start it with `ollama serve`, then pull your model: `ollama pull llama3.2`.

**`AnthropicLLM` raises `AuthenticationError`**
Make sure `ANTHROPIC_API_KEY` is exported in your shell. Anthropic keys start with `sk-ant-`.

**Cost shows `$0.0000000` for Ollama**
This is expected — Ollama runs locally so there is no per-token charge. `CostTracker` records zero cost for local models.

## Next steps

- [Cost-Aware LLM Router](./cost-router) — automatically route queries to the cheapest suitable model
- [LLM Fallback Chains](./fallback-chain) — handle provider outages with automatic failover
- [Semantic Response Caching](./semantic-caching) — cache responses to eliminate redundant API calls
