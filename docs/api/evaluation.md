---
sidebar_position: 8
---

# Evaluation API Reference

SynapseKit's evaluation framework measures RAG and agent quality using LLM-as-judge metrics.

## `EvaluationPipeline`

```python
from synapsekit.evaluation import EvaluationPipeline

pipeline = EvaluationPipeline(
    metrics: list[BaseMetric],
    llm: BaseLLM | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `metrics` | `list[BaseMetric]` | required | Metrics to compute during evaluation |
| `llm` | `BaseLLM \| None` | `None` | Default judge LLM for metrics that do not define their own |

### `async evaluate(question, answer, contexts, ground_truth=None)`

```python
async def evaluate(
    question: str,
    answer: str,
    contexts: list[str],
    ground_truth: str | None = None,
) -> EvaluationResult
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `question` | `str` | required | The user question |
| `answer` | `str` | required | The generated answer to evaluate |
| `contexts` | `list[str]` | required | Retrieved document chunks used to generate the answer |
| `ground_truth` | `str \| None` | `None` | Reference answer (required for some metrics) |

```python
from synapsekit.evaluation import EvaluationPipeline, FaithfulnessMetric, RelevancyMetric

pipeline = EvaluationPipeline(
    metrics=[FaithfulnessMetric(llm=judge_llm), RelevancyMetric(llm=judge_llm)],
)
result = await pipeline.evaluate(
    question="What is SynapseKit?",
    answer="SynapseKit is an async-first Python library.",
    contexts=["SynapseKit is an async-first Python library for building LLM applications."],
)
print(result.scores)         # {"faithfulness": 0.94, "relevancy": 0.88}
print(result.overall_score)  # 0.91
```

### `async evaluate_batch(samples, concurrency=4)`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `samples` | `list[dict]` | required | List of dicts, each with `question`, `answer`, `contexts`, optionally `ground_truth` |
| `concurrency` | `int` | `4` | Number of concurrent evaluation calls |

---

## `EvaluationResult`

```python
@dataclass
class EvaluationResult:
    question: str
    answer: str
    contexts: list[str]
    ground_truth: str | None
    scores: dict[str, float]      # metric_name -> 0.0 to 1.0
    overall_score: float           # mean of all metric scores
    reasoning: dict[str, str]      # metric_name -> LLM explanation
    passed: bool                   # True if overall_score >= threshold
    threshold: float               # default 0.7
```

---

## `FaithfulnessMetric`

Measures whether every claim in the answer is supported by the retrieved contexts. Score = `verified_claims / total_claims`.

```python
FaithfulnessMetric(llm: BaseLLM, threshold: float = 0.7)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM` | required | Judge LLM for claim verification |
| `threshold` | `float` | `0.7` | Minimum passing score |

---

## `RelevancyMetric`

Measures whether the answer addresses the question. The LLM rates on a 1–5 scale, normalized to 0.0–1.0.

```python
RelevancyMetric(llm: BaseLLM, threshold: float = 0.7)
```

---

## `GroundednessMetric`

Compares the answer to a ground-truth reference answer. Requires `ground_truth` in `evaluate()`.

```python
GroundednessMetric(
    llm: BaseLLM,
    threshold: float = 0.7,
    mode: str = "llm",
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM` | required | Judge LLM |
| `threshold` | `float` | `0.7` | Minimum passing score |
| `mode` | `str` | `"llm"` | `"llm"` (semantic) or `"rouge"` (token overlap) |

---

## `ContextRecallMetric`

Measures whether the retrieved contexts contain enough information to answer the question. Score = `attributable_sentences / total_sentences` in the ground truth. Requires `ground_truth`.

```python
ContextRecallMetric(llm: BaseLLM, threshold: float = 0.7)
```

---

## `ContextPrecisionMetric`

Measures what fraction of the retrieved contexts were actually useful. Score = `relevant_chunks / total_chunks`.

```python
ContextPrecisionMetric(llm: BaseLLM, threshold: float = 0.7)
```

---

## `@eval_case` decorator

Marks a test function as an evaluation case for `sk eval` CLI integration.

```python
from synapsekit.evaluation import eval_case, EvalCaseMeta

@eval_case(
    meta=EvalCaseMeta(
        name="rag_basic_factual",
        tags=["rag", "factual"],
        threshold=0.8,
    )
)
async def test_basic_rag(rag_pipeline):
    result = await rag_pipeline.aquery("What is SynapseKit?")
    return {
        "question": "What is SynapseKit?",
        "answer": result,
        "contexts": [],
    }
```

---

## `EvalCaseMeta`

```python
@dataclass
class EvalCaseMeta:
    name: str
    tags: list[str] = field(default_factory=list)
    threshold: float = 0.7
    metrics: list[str] | None = None
    description: str = ""
```

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | `str` | required | Unique test case identifier |
| `tags` | `list[str]` | `[]` | Tags for filtering with `sk eval --tag` |
| `threshold` | `float` | `0.7` | Override pipeline threshold for this case |
| `metrics` | `list[str] \| None` | `None` | Subset of metrics to run; `None` = use pipeline default |
| `description` | `str` | `""` | Human-readable description |

---

## Running evaluations

```python
import asyncio
from synapsekit.evaluation import EvaluationPipeline, FaithfulnessMetric, RelevancyMetric

async def main():
    pipeline = EvaluationPipeline(
        metrics=[FaithfulnessMetric(llm=judge_llm), RelevancyMetric(llm=judge_llm)],
    )
    result = await pipeline.evaluate(
        question="What databases does SynapseKit support?",
        answer="SynapseKit supports Redis, SQLite, PostgreSQL, DynamoDB, and MongoDB.",
        contexts=[
            "SynapseKit's memory backends include Redis, SQLite, and PostgreSQL.",
            "DynamoDB and MongoDB memory backends are also available.",
        ],
    )
    print(f"Overall: {result.overall_score:.2f}, Passed: {result.passed}")

asyncio.run(main())
```

From CLI:

```bash
sk eval --test-dir tests/eval/ --output eval_report.json
sk eval --tag rag --threshold 0.8
```

---

## See also

- [Evaluation overview](../evaluation/overview)
- [Observability API reference](../api/observability)
