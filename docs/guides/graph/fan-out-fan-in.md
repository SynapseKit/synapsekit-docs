---
sidebar_position: 4
title: "Fan-Out / Fan-In (Parallel Nodes)"
description: "Run multiple StateGraph nodes concurrently with add_parallel_edges and merge their results in a single join node using state reducers."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Fan-Out / Fan-In (Parallel Nodes)

<ColabBadge path="graph/fan-out-fan-in.ipynb" />

When multiple nodes produce independent results, there is no reason to run them one after another. Fan-out dispatches to several nodes simultaneously; fan-in waits for all of them to finish and merges the results. Total wall time equals the slowest parallel node, not their sum.

**What you'll build:** A document analysis graph that fans out to three simultaneous analyzers (summary, sentiment, keywords), then fans in to a merge node that assembles a structured report. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit[openai,graph]
```

## What you'll learn

- Register parallel branches with `add_parallel_edges()`
- Set a join point with `add_join_edge()`
- Write a merge node that combines results from all branches
- Use state reducers to accumulate list-typed results safely

## Step 1: Define state with reducer fields

```python
# fan_out_fan_in.py

from __future__ import annotations
import asyncio
from dataclasses import dataclass, field
from typing import Annotated

from synapsekit.graph import StateGraph, reducer
from synapsekit.llms.openai import OpenAILLM
from synapsekit import LLMConfig

@dataclass
class AnalysisState:
    document: str                  # Input text to analyze

    # Each parallel branch writes to its own field — no reducer needed
    summary: str   = ""
    sentiment: str = ""
    keywords: str  = ""

    # The merge node assembles this from the three branch results
    report: str = ""

    # Reducer example: if multiple branches append to the same list,
    # the `reducer` annotation tells the graph to concatenate instead of overwrite
    analysis_notes: Annotated[list[str], reducer(list.__add__)] = field(
        default_factory=list
    )
```

## Step 2: Implement parallel branch nodes

```python
llm = OpenAILLM(model="gpt-4o-mini", config=LLMConfig(temperature=0.3))

async def summarize(state: AnalysisState) -> AnalysisState:
    """Produce a 2–3 sentence summary of the document."""
    response = await llm.agenerate(
        f"Summarize the following text in 2–3 sentences:\n\n{state.document}"
    )
    state.summary = response.text
    state.analysis_notes = [f"Summary length: {len(response.text)} chars"]
    print(f"[summarize] Done.")
    return state


async def analyze_sentiment(state: AnalysisState) -> AnalysisState:
    """Classify the overall sentiment and provide a confidence score."""
    response = await llm.agenerate(
        f"Analyze the sentiment of the following text. "
        f"Return: sentiment (positive/neutral/negative), confidence (0.0–1.0), "
        f"and a one-sentence explanation.\n\n{state.document}"
    )
    state.sentiment = response.text
    state.analysis_notes = [f"Sentiment analyzed."]
    print(f"[sentiment] Done.")
    return state


async def extract_keywords(state: AnalysisState) -> AnalysisState:
    """Extract the 5 most important keywords or phrases."""
    response = await llm.agenerate(
        f"Extract the 5 most important keywords or key phrases from the following text. "
        f"Return them as a comma-separated list.\n\n{state.document}"
    )
    state.keywords = response.text
    state.analysis_notes = [f"Keywords: {response.text[:60]}"]
    print(f"[keywords] Done.")
    return state
```

## Step 3: Implement the merge (fan-in) node

```python
async def merge_results(state: AnalysisState) -> AnalysisState:
    """Assemble all branch outputs into a single structured report.

    This node runs only after ALL parallel branches have completed.
    By this point, state.summary, state.sentiment, and state.keywords
    are all populated.
    """
    state.report = (
        f"DOCUMENT ANALYSIS REPORT\n"
        f"{'='*40}\n\n"
        f"SUMMARY\n{state.summary}\n\n"
        f"SENTIMENT\n{state.sentiment}\n\n"
        f"KEYWORDS\n{state.keywords}\n\n"
        f"NOTES\n" + "\n".join(f"  - {n}" for n in state.analysis_notes)
    )
    print(f"[merge] Report assembled. {len(state.analysis_notes)} analysis notes.")
    return state
```

## Step 4: Build the graph with parallel edges

```python
def build_graph():
    graph = StateGraph(AnalysisState)

    # One entry node kicks things off
    # (In this example the document is provided at run time, so we can go
    # directly to the parallel branches. A real graph might have a preprocessing
    # node here.)
    graph.add_node("summarize",        summarize)
    graph.add_node("analyze_sentiment", analyze_sentiment)
    graph.add_node("extract_keywords", extract_keywords)
    graph.add_node("merge_results",    merge_results)

    graph.set_entry_point("summarize")   # Fan-out starts here by convention;
                                          # the parallel edges launch the other two

    # add_parallel_edges(source, [targets])
    # All three nodes receive the SAME state snapshot and run concurrently.
    # Their return values are merged field-by-field before merge_results runs.
    graph.add_parallel_edges("summarize", ["analyze_sentiment", "extract_keywords"])

    # add_join_edge([sources], target)
    # merge_results runs only after all three parallel nodes have returned.
    graph.add_join_edge(
        ["summarize", "analyze_sentiment", "extract_keywords"],
        "merge_results"
    )

    return graph.compile()
```

## Complete working example

```python
DOCUMENT = """
Artificial intelligence is transforming the way scientists conduct research.
Machine learning models can now predict protein structures with near-experimental
accuracy, identify patterns in genomic data at scale, and accelerate drug
discovery by screening millions of compounds in silico. Critics argue that over-
reliance on AI may introduce opaque biases into scientific conclusions, while
proponents point to the speed and scale advantages that would be impossible
with manual methods alone.
"""

async def main():
    compiled = build_graph()
    initial = AnalysisState(document=DOCUMENT.strip())

    import time
    t0 = time.perf_counter()
    final = await compiled.arun(initial)
    elapsed = time.perf_counter() - t0

    print(f"\nCompleted in {elapsed:.2f}s\n")
    print(final.report)

asyncio.run(main())
```

## Expected output

```
[summarize] Done.
[sentiment] Done.
[keywords] Done.
[merge] Report assembled. 3 analysis notes.

Completed in 2.14s

DOCUMENT ANALYSIS REPORT
========================================

SUMMARY
Artificial intelligence is accelerating scientific research across protein
structure prediction, genomics, and drug discovery...

SENTIMENT
Sentiment: neutral, Confidence: 0.72
The text presents both positive applications and legitimate concerns about AI...

KEYWORDS
machine learning, protein structures, drug discovery, genomic data, scientific bias

NOTES
  - Summary length: 187 chars
  - Sentiment analyzed.
  - Keywords: machine learning, protein structures, drug discovery...
```

## How it works

When the graph engine encounters parallel edges from `summarize`, it:

1. Takes a snapshot of the current state.
2. Dispatches copies of the snapshot to `summarize`, `analyze_sentiment`, and `extract_keywords` concurrently via `asyncio.gather()`.
3. Waits for all three to complete.
4. Merges the returned states field-by-field: for plain fields, the last writer wins; for reducer-annotated fields, the reducer function is applied across all branch values.
5. Passes the merged state to `merge_results`.

The `reducer` annotation on `analysis_notes` is why all three notes appear in the final report rather than just the last branch's note.

## Variations

**Add a preprocessing node before the fan-out**

```python
async def preprocess(state: AnalysisState) -> AnalysisState:
    # Clean up the document before sending it to the parallel branches
    state.document = state.document.strip().replace("\n\n\n", "\n\n")
    return state

graph.add_node("preprocess", preprocess)
graph.set_entry_point("preprocess")
graph.add_parallel_edges("preprocess", ["summarize", "analyze_sentiment", "extract_keywords"])
graph.add_join_edge(["summarize", "analyze_sentiment", "extract_keywords"], "merge_results")
```

**Dynamic fan-out based on document length**

```python
def get_parallel_targets(state: AnalysisState) -> list[str]:
    targets = ["summarize", "analyze_sentiment"]
    if len(state.document) > 500:
        targets.append("extract_keywords")
    return targets

# Pass a callable instead of a list to add_parallel_edges
graph.add_parallel_edges("preprocess", get_parallel_targets)
```

**Nested fan-out / fan-in**

Compile a subgraph that does its own fan-out, then use it as a node in the parent graph. See [Subgraph Composition](./subgraph-composition) for details.

## Troubleshooting

**Reducer field is missing some branch results**
Verify that every parallel branch actually modifies the reducer field and returns a non-empty list. Branches that return an empty list contribute nothing to the merged value.

**Merge node runs before all branches complete**
This should not happen with `add_join_edge`. If it does, confirm you listed ALL parallel branch node names in the `add_join_edge` sources list.

**Race condition on a non-reducer field**
If two parallel branches write to the same non-reducer field, only one value survives the merge (last writer wins). Use a reducer or give each branch its own distinct field.

## Next steps

- [Subgraph Composition](./subgraph-composition) — package a fan-out / fan-in as a reusable subgraph
- [Conditional Routing](./conditional-routing) — branch to one of several paths instead of all simultaneously
- [Parallel Agent Execution](../multi-agent/parallel-agent-execution) — the same pattern without a graph
