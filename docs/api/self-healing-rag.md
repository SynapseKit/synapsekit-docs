---
sidebar_position: 11
title: "SelfHealingRAG API Reference"
description: "SelfHealingRAG retries RAG retrieval with alternate strategies when answer faithfulness falls below a quality threshold."
---

# SelfHealingRAG API Reference

`SelfHealingRAG` wraps a list of retrieval strategies and automatically retries with the next strategy when an answer's faithfulness score falls below a threshold. Each attempt is scored with `FaithfulnessMetric`; the first attempt to clear the threshold is returned immediately, otherwise the highest-scoring answer from the exhausted attempts is returned.

**Import:**
```python
from synapsekit import SelfHealingRAG
```

---

## `SelfHealingRAG`

```python
from synapsekit import SelfHealingRAG

rag = SelfHealingRAG(
    llm: BaseLLM,
    strategies: Sequence[RetrievalStrategy],
    *,
    quality_threshold: float = 0.75,
    max_retries: int = 2,
    system_prompt: str = "Answer using only the provided context. If the context does not contain the answer, say so.",
    retrieval_top_k: int = 5,
    memory: ConversationMemory | None = None,
    tracer: TokenTracer | None = None,
    metric: FaithfulnessMetric | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM` | required | LLM used to generate answers from retrieved context |
| `strategies` | `Sequence[RetrievalStrategy]` | required | Ordered retrieval strategies to try, e.g. `HybridSearchRetriever`, `CRAGRetriever`. Must be non-empty |
| `quality_threshold` | `float` | `0.75` | Minimum faithfulness score (0–1) to accept an answer without retrying |
| `max_retries` | `int` | `2` | Maximum additional strategies to try after the first attempt |
| `system_prompt` | `str` | see above | System prompt used when generating the answer from context |
| `retrieval_top_k` | `int` | `5` | Default number of chunks to retrieve per attempt |
| `memory` | `ConversationMemory \| None` | `None` | Conversation history; created automatically if omitted |
| `tracer` | `TokenTracer \| None` | `None` | Optional token/cost tracer |
| `metric` | `FaithfulnessMetric \| None` | `None` | Custom faithfulness metric; defaults to `FaithfulnessMetric(llm)` |

A strategy is any object with an `async retrieve(query, top_k=..., metadata_filter=...) -> list[str]` method — this matches `HybridSearchRetriever`, `CRAGRetriever`, and any custom retriever with a compatible signature. Strategies that don't accept `metadata_filter` are called without it automatically.

### Methods

- `async ask(query: str, *, top_k: int | None = None, metadata_filter: dict | None = None) -> str` — try each strategy in order until one clears `quality_threshold`; returns the best answer found. Re-raises the last exception if every attempt raises.
- `ask_sync(query: str, **kwargs) -> str` — sync wrapper around `ask()`
- `last_report` — (property) the `SelfHealingReport` from the most recent `ask()` call, or `None`
- `memory` — (property) the underlying `ConversationMemory` instance

### `SelfHealingReport`

```python
@dataclass
class SelfHealingReport:
    success: bool
    attempts: int
    retries: int
    strategy: str | None
    scores: list[float] = field(default_factory=list)
    threshold: float = 0.0
```

| Field | Type | Description |
|---|---|---|
| `success` | `bool` | Whether an attempt cleared `quality_threshold` |
| `attempts` | `int` | Total attempts made |
| `retries` | `int` | Attempts beyond the first |
| `strategy` | `str \| None` | Class name of the strategy that produced the returned answer |
| `scores` | `list[float]` | Faithfulness score per attempt, in order |
| `threshold` | `float` | The `quality_threshold` used for this call |

---

## Example — retry with escalating retrieval strategies

```python
import asyncio
from synapsekit import (
    OpenAILLM,
    LLMConfig,
    RAG,
    SelfHealingRAG,
    HybridSearchRetriever,
    CRAGRetriever,
)

async def main():
    llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

    base_rag = RAG(model="gpt-4o-mini", api_key="sk-...")
    base_rag.add("./docs")

    rag = SelfHealingRAG(
        llm=llm,
        strategies=[
            HybridSearchRetriever(vectorstore=base_rag.vectorstore),
            CRAGRetriever(retriever=base_rag.retriever, llm=llm),
        ],
        quality_threshold=0.75,
        max_retries=2,
    )

    answer = await rag.ask("What does the SLA say about uptime guarantees?")
    print(answer)

    report = rag.last_report
    print(f"Succeeded: {report.success} after {report.retries} retries via {report.strategy}")
    print(f"Scores per attempt: {report.scores}")

asyncio.run(main())
```

---

## See also

- [RAG Pipeline API reference](rag-pipeline)
- [Retriever API reference](retriever)
- [Evaluation API reference](evaluation)
