---
sidebar_position: 3
title: "Conditional Routing in Graphs"
description: "Add decision branches to your StateGraph using add_conditional_edges and routing functions to direct execution based on state values."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Conditional Routing in Graphs

<ColabBadge path="graph/conditional-routing.ipynb" />

Real workflows rarely execute the same steps for every input. Conditional routing lets your graph inspect the current state after a node completes and choose which node to visit next. A routing function returns a string key; that key maps to the next node name.

**What you'll build:** A question-answering graph that classifies the user's question type, then routes to a specialist node — factual lookup, opinion synthesis, or creative generation — based on the classification. **Time:** ~15 min. **Difficulty:** Beginner

## Prerequisites

```bash
pip install synapsekit[openai,graph]
```

## What you'll learn

- Write a routing function that returns a string based on state
- Register conditional edges with `add_conditional_edges()`
- Map routing function return values to node names
- Handle the "default" / fallback route

## Step 1: Define state and classification

```python
# conditional_routing.py

from __future__ import annotations
import asyncio
from dataclasses import dataclass

from synapsekit.graph import StateGraph
from synapsekit.llms.openai import OpenAILLM
from synapsekit import LLMConfig

@dataclass
class QAState:
    question: str
    question_type: str = ""   # "factual" | "opinion" | "creative" | "unknown"
    answer: str = ""
```

## Step 2: Implement nodes

```python
llm = OpenAILLM(model="gpt-4o-mini", config=LLMConfig(temperature=0.0))

async def classify_question(state: QAState) -> QAState:
    """Determine the question type so the router can pick the right handler."""
    response = await llm.agenerate(
        f"""Classify the following question into exactly one category:
- factual: has a definitive correct answer based on facts or data
- opinion: requires synthesizing multiple viewpoints or perspectives
- creative: calls for imagination, storytelling, or open-ended generation
- unknown: does not fit the above categories

Question: {state.question}

Respond with only the category name."""
    )
    state.question_type = response.text.strip().lower()
    print(f"[classify] Type: {state.question_type}")
    return state


async def handle_factual(state: QAState) -> QAState:
    """Answer factual questions concisely and accurately."""
    response = await llm.agenerate(
        f"Answer this factual question accurately and concisely: {state.question}"
    )
    state.answer = response.text
    print(f"[factual] Answered.")
    return state


async def handle_opinion(state: QAState) -> QAState:
    """Synthesize multiple perspectives for opinion questions."""
    response = await llm.agenerate(
        f"This question calls for multiple perspectives. Present at least two "
        f"distinct viewpoints on: {state.question}"
    )
    state.answer = response.text
    print(f"[opinion] Synthesized perspectives.")
    return state


async def handle_creative(state: QAState) -> QAState:
    """Generate a creative, imaginative response."""
    response = await llm.agenerate(
        f"Respond to this with creativity and imagination: {state.question}"
    )
    state.answer = response.text
    print(f"[creative] Generated response.")
    return state


async def handle_unknown(state: QAState) -> QAState:
    """Fallback for questions that don't fit any category."""
    state.answer = (
        "I'm not sure how to categorize that question. "
        "Could you rephrase it or provide more context?"
    )
    print(f"[unknown] Fell through to default handler.")
    return state
```

## Step 3: Write the routing function

```python
def route_by_type(state: QAState) -> str:
    """Return the name of the next node based on the question type.

    The return value must be one of the keys in the edges map passed to
    add_conditional_edges(). If the value is unexpected, the graph raises.
    """
    if state.question_type == "factual":
        return "factual"
    elif state.question_type == "opinion":
        return "opinion"
    elif state.question_type == "creative":
        return "creative"
    else:
        # Anything unrecognized routes to the fallback handler
        return "unknown"
```

## Step 4: Build the graph with conditional edges

```python
def build_graph():
    graph = StateGraph(QAState)

    graph.add_node("classify",       classify_question)
    graph.add_node("handle_factual", handle_factual)
    graph.add_node("handle_opinion", handle_opinion)
    graph.add_node("handle_creative", handle_creative)
    graph.add_node("handle_unknown", handle_unknown)

    graph.set_entry_point("classify")

    # add_conditional_edges(source, routing_fn, route_map)
    # After `classify` runs, call route_by_type(state).
    # The return value is looked up in the route_map to find the next node.
    graph.add_conditional_edges(
        "classify",
        route_by_type,
        {
            "factual":  "handle_factual",
            "opinion":  "handle_opinion",
            "creative": "handle_creative",
            "unknown":  "handle_unknown",
        }
    )

    # All handlers are terminal nodes — no outgoing edges needed
    return graph.compile()
```

## Complete working example

```python
async def answer(question: str) -> str:
    compiled = build_graph()
    initial_state = QAState(question=question)
    final_state = await compiled.arun(initial_state)
    return final_state.answer


async def main():
    questions = [
        "What is the speed of light in a vacuum?",
        "Should companies prioritize profit over environmental sustainability?",
        "Write a short poem about a robot who dreams of being a gardener.",
        "Blorg florp snizzle wumph?",
    ]

    for q in questions:
        print(f"\nQ: {q}")
        answer_text = await answer(q)
        print(f"A: {answer_text[:200]}")

asyncio.run(main())
```

## Expected output

```
Q: What is the speed of light in a vacuum?
[classify] Type: factual
[factual] Answered.
A: The speed of light in a vacuum is approximately 299,792,458 metres per second...

Q: Should companies prioritize profit over environmental sustainability?
[classify] Type: opinion
[opinion] Synthesized perspectives.
A: Perspective 1 (profit-first): Companies exist to generate returns...

Q: Write a short poem about a robot who dreams of being a gardener.
[classify] Type: creative
[creative] Generated response.
A: In circuits bright and silicon dreams...

Q: Blorg florp snizzle wumph?
[classify] Type: unknown
[unknown] Fell through to default handler.
A: I'm not sure how to categorize that question...
```

## How it works

After `classify_question` returns, the graph calls `route_by_type(state)`. The return value (`"factual"`, `"opinion"`, etc.) is looked up as a key in the route map. The corresponding value (`"handle_factual"`, etc.) is the name of the next node to execute.

If the routing function returns a value not present in the route map, the graph raises a `RoutingError`. Always include a fallback key in both the routing function and the route map.

## Variations

**Two-level routing**

```python
def route_complexity(state: QAState) -> str:
    # After the type handler finishes, route to a short or long formatter
    return "short_answer" if len(state.answer) < 200 else "long_answer"

graph.add_conditional_edges("handle_factual", route_complexity, {
    "short_answer": "format_short",
    "long_answer":  "format_long",
})
```

**Route based on a numeric threshold**

```python
def route_by_confidence(state) -> str:
    return "high_confidence" if state.confidence >= 0.8 else "low_confidence"
```

**Reuse the same node from multiple routes**

Multiple routes can point to the same destination node name. The route map values are just node names — duplicates are fine.

## Troubleshooting

**`RoutingError: unexpected route key 'None'`**
Your routing function returned `None` instead of a string. Add a final `else` branch that returns the fallback key.

**Graph always takes the same route**
Print `state.question_type` inside the routing function. The classifier may be returning a value with extra whitespace or mixed case — use `.strip().lower()` when setting it.

**Route map has a key that matches no node**
Each value in the route map must be a node name registered with `add_node()`. A typo in either the map value or the node name will cause `compile()` to raise.

## Next steps

- [Fan-Out / Fan-In](./fan-out-fan-in) — run multiple branches in parallel instead of choosing one
- [Linear Workflow](./linear-workflow) — start here if you haven't yet
- [Human-in-the-Loop](./human-in-the-loop) — pause the graph at a decision point and wait for human input
