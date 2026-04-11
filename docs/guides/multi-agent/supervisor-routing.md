---
sidebar_position: 3
title: "Supervisor Agent Routing"
description: "Use SynapseKit's SupervisorAgent to route user queries to the most appropriate specialist agent based on intent classification."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Supervisor Agent Routing

<ColabBadge path="multi-agent/supervisor-routing.ipynb" />

A supervisor agent acts as a dispatcher: it reads the user's query, classifies the intent, and delegates to the right specialist. The supervisor never produces the final answer itself — its only job is routing. This keeps each worker agent's prompt small and its behavior predictable.

**What you'll build:** A supervisor that routes customer support queries to one of three specialists — billing, technical support, or general FAQ — and returns the specialist's response. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit[openai]
```

## What you'll learn

- Configure a `SupervisorAgent` with a set of named worker agents
- Define routing rules and fallback behavior
- Inspect which worker handled a given query
- Chain the supervisor output back to the user

## Step 1: Define worker agents

```python
# supervisor_routing.py

from __future__ import annotations
import asyncio

from synapsekit.agents import Agent, SupervisorAgent
from synapsekit.llms.openai import OpenAILLM
from synapsekit import LLMConfig

llm = OpenAILLM(model="gpt-4o-mini", config=LLMConfig(temperature=0.3))

billing_agent = Agent(
    name="billing",
    instructions=(
        "You handle billing, payment, invoice, and subscription questions. "
        "Be concise and accurate. If you cannot resolve the issue, say so clearly."
    ),
    llm=llm,
)

tech_agent = Agent(
    name="tech_support",
    instructions=(
        "You handle technical issues: bugs, installation problems, API errors, "
        "and performance questions. Ask clarifying questions if needed."
    ),
    llm=llm,
)

faq_agent = Agent(
    name="faq",
    instructions=(
        "You answer general product questions, feature requests, and onboarding queries. "
        "Keep answers friendly and under 150 words."
    ),
    llm=llm,
)
```

## Step 2: Configure the supervisor

```python
supervisor = SupervisorAgent(
    name="support-supervisor",
    workers={
        "billing":      billing_agent,
        "tech_support": tech_agent,
        "faq":          faq_agent,
    },
    # routing_instructions guides the supervisor's classification decision.
    # The supervisor returns one of the keys in `workers` as its routing decision.
    routing_instructions=(
        "Classify the user's query into exactly one of: billing, tech_support, faq.\n"
        "- billing: questions about payments, invoices, subscriptions, refunds\n"
        "- tech_support: questions about errors, bugs, installation, API usage\n"
        "- faq: everything else — features, onboarding, general product questions\n"
        "Return only the category name, nothing else."
    ),
    llm=llm,
    # fallback defines which worker handles queries the supervisor cannot classify
    fallback="faq",
)
```

## Step 3: Run queries through the supervisor

```python
async def handle_query(query: str) -> str:
    result = await supervisor.arun(query)

    # result.routed_to tells you which worker was selected — useful for logging
    print(f"[supervisor] Routed to: {result.routed_to}")
    print(f"[{result.routed_to}] Response: {result.response}")

    return result.response
```

## Complete working example

```python
QUERIES = [
    "I was charged twice for my subscription this month.",
    "The API keeps returning a 429 error even though I'm under my rate limit.",
    "Does SynapseKit support streaming responses?",
    "How do I export my conversation history?",
]

async def main():
    for query in QUERIES:
        print(f"\nQuery: {query}")
        print("-" * 60)
        await handle_query(query)

asyncio.run(main())
```

## Expected output

```
Query: I was charged twice for my subscription this month.
------------------------------------------------------------
[supervisor] Routed to: billing
[billing] I'm sorry to hear that. Duplicate charges are typically...

Query: The API keeps returning a 429 error even though I'm under my rate limit.
------------------------------------------------------------
[supervisor] Routed to: tech_support
[tech_support] A 429 even under your rate limit often means...

Query: Does SynapseKit support streaming responses?
------------------------------------------------------------
[supervisor] Routed to: faq
[faq] Yes! SynapseKit supports streaming via the `astream()` method...
```

## How it works

The supervisor makes two LLM calls per query:

1. **Classification call** — sends the query plus `routing_instructions` to the LLM. The response is a single category name.
2. **Worker call** — the selected worker agent receives the original query (not the classification result) and generates the response.

The supervisor never modifies the user query before passing it to the worker. This ensures the worker sees the original intent without any summarization artifacts.

## Variations

**Add routing confidence scores**

```python
supervisor = SupervisorAgent(
    ...
    routing_instructions=(
        "Classify the query. Respond as JSON: "
        '{"category": "<billing|tech_support|faq>", "confidence": <0.0-1.0>}'
    ),
    # When confidence < 0.6, the supervisor falls back to the faq agent
    confidence_threshold=0.6,
    fallback="faq",
)
```

**Chain supervisor output into a second pass**

```python
result = await supervisor.arun(query)

if result.routed_to == "tech_support" and "error code" in result.response:
    # Run a follow-up diagnostic agent with the tech response as context
    diagnostic = await diagnostic_agent.arun(
        f"Diagnose this support response and suggest a fix:\n{result.response}"
    )
    print(diagnostic.response)
```

**Multi-level routing**

Nest supervisors by assigning a `SupervisorAgent` as a worker in a parent supervisor. This lets you build hierarchical dispatch trees for large support taxonomies.

## Troubleshooting

**Supervisor always routes to the fallback**
Check that `routing_instructions` lists the exact keys used in `workers`. The supervisor's LLM response must match a key exactly; case differences cause fallback.

**Wrong agent handles the query**
Add examples to `routing_instructions`. Few-shot examples in the routing prompt dramatically improve classification accuracy for edge cases.

**Worker ignores the query context**
The worker only receives the original user query. If the worker needs to know it was escalated or which supervisor routed it, prepend a system preamble in the worker's `instructions`.

## Next steps

- [Crew Content Pipeline](./crew-content-pipeline) — coordinate agents with shared task context
- [Agent Handoff Chains](./handoff-chains) — pass accumulated context through a linear pipeline
- [Parallel Agent Execution](./parallel-agent-execution) — fan out to multiple agents simultaneously
