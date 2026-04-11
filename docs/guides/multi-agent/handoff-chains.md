---
sidebar_position: 4
title: "Agent Handoff Chains"
description: "Build a sequential researcher-writer-editor pipeline using SynapseKit's HandoffChain to pass enriched context between agents."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Agent Handoff Chains

<ColabBadge path="multi-agent/handoff-chains.ipynb" />

A handoff chain is a linear pipeline where each agent enriches a shared context object and passes it forward to the next. Unlike a `Crew`, the handoff is explicit — each agent receives a structured `Handoff` object containing the original input plus everything previous agents produced.

**What you'll build:** A three-stage pipeline where a researcher gathers facts, a writer drafts an article, and an editor polishes it — each stage building directly on the previous one's output. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit[openai]
```

## What you'll learn

- Create a `HandoffChain` with ordered agents
- Understand the `Handoff` context object each agent receives
- Add custom fields to the handoff for structured inter-agent communication
- Inspect intermediate results at each stage

## Step 1: Define the shared handoff context

```python
# handoff_chains.py

from __future__ import annotations
import asyncio
from dataclasses import dataclass, field

from synapsekit.agents import Agent, HandoffChain, Handoff
from synapsekit.llms.openai import OpenAILLM
from synapsekit import LLMConfig

# The context dataclass accumulates results across all stages.
# Each agent reads the fields set by its predecessors and adds its own.
@dataclass
class ArticleContext:
    topic: str
    target_word_count: int = 500

    # Populated by the researcher
    research_notes: str = ""
    key_claims: list[str] = field(default_factory=list)

    # Populated by the writer
    draft: str = ""
    word_count: int = 0

    # Populated by the editor
    final_article: str = ""
    edits_summary: str = ""
```

## Step 2: Define agents with handoff-aware instructions

```python
llm = OpenAILLM(model="gpt-4o-mini", config=LLMConfig(temperature=0.6))

researcher = Agent(
    name="researcher",
    instructions=(
        "You are a research analyst. You will receive a topic. "
        "Respond with 5 concise bullet points covering the most important facts, "
        "statistics, or insights. Keep each bullet under 25 words."
    ),
    llm=llm,
)

writer = Agent(
    name="writer",
    instructions=(
        "You are a content writer. You will receive research notes. "
        "Write an article of approximately {target_word_count} words. "
        "Use an engaging introduction, three substantive body paragraphs, and a conclusion. "
        "Do not pad — every sentence should add value."
    ),
    llm=llm,
)

editor = Agent(
    name="editor",
    instructions=(
        "You are a senior editor. You will receive a draft article. "
        "Improve clarity, fix awkward phrasing, tighten verbose sentences, "
        "and ensure consistent tone. Return the polished article followed by "
        "a one-sentence summary of the changes you made."
    ),
    llm=llm,
)
```

## Step 3: Define node functions for each stage

```python
async def research_node(handoff: Handoff[ArticleContext]) -> ArticleContext:
    ctx = handoff.context
    response = await researcher.arun(f"Topic: {ctx.topic}")

    # Store the raw text and parse out individual bullets
    ctx.research_notes = response.text
    ctx.key_claims = [
        line.strip("•- ").strip()
        for line in response.text.splitlines()
        if line.strip().startswith(("•", "-", "*"))
    ]
    print(f"[researcher] Produced {len(ctx.key_claims)} key claims.")
    return ctx


async def write_node(handoff: Handoff[ArticleContext]) -> ArticleContext:
    ctx = handoff.context
    prompt = (
        f"Write a {ctx.target_word_count}-word article on '{ctx.topic}'.\n\n"
        f"Use these research notes:\n{ctx.research_notes}"
    )
    response = await writer.arun(prompt)

    ctx.draft = response.text
    ctx.word_count = len(response.text.split())
    print(f"[writer] Draft is {ctx.word_count} words.")
    return ctx


async def edit_node(handoff: Handoff[ArticleContext]) -> ArticleContext:
    ctx = handoff.context
    prompt = f"Edit the following article:\n\n{ctx.draft}"
    response = await editor.arun(prompt)

    # The editor returns the polished article + a one-sentence summary
    parts = response.text.rsplit("\n\n", 1)
    ctx.final_article = parts[0]
    ctx.edits_summary = parts[1] if len(parts) > 1 else ""
    print(f"[editor] Edits summary: {ctx.edits_summary}")
    return ctx
```

## Step 4: Build and run the chain

```python
async def run_pipeline(topic: str) -> ArticleContext:
    initial_context = ArticleContext(topic=topic, target_word_count=500)

    chain = HandoffChain(
        name="article-pipeline",
        # Nodes execute left-to-right; each receives the context returned by its predecessor
        nodes=[research_node, write_node, edit_node],
    )

    final_context = await chain.arun(initial_context)
    return final_context
```

## Complete working example

```python
async def main():
    topic = "How renewable energy is reshaping global electricity markets"
    result = await run_pipeline(topic)

    print("\n--- KEY CLAIMS ---")
    for i, claim in enumerate(result.key_claims, 1):
        print(f"  {i}. {claim}")

    print("\n--- FINAL ARTICLE ---")
    print(result.final_article)

    print(f"\n--- STATS ---")
    print(f"  Draft word count:  {result.word_count}")
    print(f"  Editor notes:      {result.edits_summary}")

asyncio.run(main())
```

## Expected output

```
[researcher] Produced 5 key claims.
[writer] Draft is 498 words.
[editor] Edits summary: Tightened three verbose sentences and improved transitions between paragraphs.

--- KEY CLAIMS ---
  1. Solar and wind capacity additions outpaced fossil fuels globally in 2023.
  ...

--- FINAL ARTICLE ---
Renewable energy is no longer a niche supplement to fossil fuels...
```

## How it works

`HandoffChain.arun()` calls each node function in order. Each node receives a `Handoff[C]` object with two attributes:

- `handoff.context` — the mutable context object, pre-populated with results from all previous nodes
- `handoff.previous_outputs` — a list of raw text outputs from preceding agents, for cases where you want unstructured access to earlier results

The context object is passed by reference between nodes. Any field set in `research_node` is visible in `write_node` and `edit_node` without any extra wiring.

## Variations

**Short-circuit on low-quality research**

```python
async def write_node(handoff: Handoff[ArticleContext]) -> ArticleContext:
    ctx = handoff.context
    # If the researcher found fewer than 3 claims, the draft will be thin.
    # Flag it early rather than producing a weak article.
    if len(ctx.key_claims) < 3:
        raise ValueError(
            f"Insufficient research: only {len(ctx.key_claims)} claims found. "
            "Broaden the topic or retry with a different model."
        )
    ...
```

**Insert a quality-gate node**

Add a node between writer and editor that scores the draft. If the score is too low, it revises the prompt and re-runs the writer node before continuing.

**Persist the context between runs**

Serialize `ArticleContext` to JSON after `chain.arun()` and reload it later. Because the context is a plain dataclass, serialization is straightforward with `dataclasses.asdict()`.

## Troubleshooting

**A node receives an empty context field**
Confirm the previous node is actually setting that field before returning. Add a `print(ctx)` at the start of each node during development.

**The writer ignores the research notes**
Make the research notes more prominent in the prompt — move them above the instruction, or format them as a numbered list rather than bullet points.

**The chain stops mid-way**
Any exception raised inside a node propagates out of `chain.arun()`. Wrap risky operations in try/except inside the node and set an error flag on the context rather than letting the exception escape.

## Next steps

- [Agent-to-Agent Communication](./a2a-communication) — agents that message each other directly
- [Parallel Agent Execution](./parallel-agent-execution) — run independent pipeline stages concurrently
- [Crew Content Pipeline](./crew-content-pipeline) — let the `Crew` manage task assignment automatically
