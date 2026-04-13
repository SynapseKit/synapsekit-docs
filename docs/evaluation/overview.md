---
sidebar_position: 1
---

# Evaluation

SynapseKit includes built-in evaluation metrics for measuring the quality of RAG and LLM outputs. Inspired by RAGAS-style evaluation, these metrics help you quantify faithfulness, relevancy, and groundedness.

## Metrics

### FaithfulnessMetric

Measures whether the generated answer is faithful to the source documents (i.e., does not hallucinate):

```python
from synapsekit import FaithfulnessMetric

metric = FaithfulnessMetric(llm=llm)

score = await metric.score(
    question="What is Python?",
    answer="Python is a compiled language created in 1991.",
    contexts=["Python is an interpreted language created by Guido van Rossum in 1991."],
)
# score → 0.5 (partially faithful — creation date correct, but "compiled" is wrong)
```

### RelevancyMetric

Measures how relevant the answer is to the question asked:

```python
from synapsekit import RelevancyMetric

metric = RelevancyMetric(llm=llm)

score = await metric.score(
    question="What is the capital of France?",
    answer="Paris is the capital and largest city of France.",
)
# score → 1.0 (highly relevant)
```

### GroundednessMetric

Measures how well the answer is grounded in the retrieved context:

```python
from synapsekit import GroundednessMetric

metric = GroundednessMetric(llm=llm)

score = await metric.score(
    answer="SynapseKit supports 31 LLM providers.",
    contexts=["SynapseKit supports 31 LLM providers including OpenAI, Anthropic, and Gemini."],
)
# score → 1.0 (fully grounded)
```

## EvaluationPipeline

Run multiple metrics over a dataset in one call:

```python
from synapsekit import EvaluationPipeline, FaithfulnessMetric, RelevancyMetric, GroundednessMetric

pipeline = EvaluationPipeline(
    metrics=[
        FaithfulnessMetric(llm=llm),
        RelevancyMetric(llm=llm),
        GroundednessMetric(llm=llm),
    ],
)

results = await pipeline.evaluate(
    questions=["What is RAG?", "How does SynapseKit work?"],
    answers=["RAG is retrieval-augmented generation.", "SynapseKit is a Python framework."],
    contexts=[
        ["RAG combines retrieval with generation for grounded answers."],
        ["SynapseKit is a Python library for building LLM applications."],
    ],
)

for r in results:
    print(r)
    # EvaluationResult(faithfulness=0.95, relevancy=0.90, groundedness=0.88, mean_score=0.91)
```

## EvaluationResult

Each result contains per-metric scores and a convenience `mean_score`:

```python
result = results[0]

print(result.faithfulness)   # 0.95
print(result.relevancy)      # 0.90
print(result.groundedness)   # 0.88
print(result.mean_score)     # 0.91
```

## @eval_case decorator

Define evaluation test cases with quality, cost, and latency bounds. Works with both `synapsekit test` CLI and pytest.

```python
from synapsekit import eval_case

@eval_case(min_score=0.8, max_cost_usd=0.05, max_latency_ms=2000, tags=["qa", "rag"])
async def eval_summarization():
    # Run your pipeline, measure quality
    return {"score": 0.85, "cost_usd": 0.02, "latency_ms": 1200}

@eval_case(min_score=0.9)
def eval_retrieval():
    return {"score": 0.92}
```

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `min_score` | `float \| None` | `None` | Minimum acceptable score (0.0-1.0) |
| `max_cost_usd` | `float \| None` | `None` | Maximum acceptable cost in USD |
| `max_latency_ms` | `float \| None` | `None` | Maximum acceptable latency in ms |
| `tags` | `list[str]` | `[]` | Tags for filtering and grouping |

### Return value

Decorated functions must return a dict with any of these keys:

| Key | Type | Description |
|---|---|---|
| `score` | `float` | Quality score (checked against `min_score`) |
| `cost_usd` | `float` | Cost (checked against `max_cost_usd`) |
| `latency_ms` | `float` | Latency (auto-measured if omitted, checked against `max_latency_ms`) |

### EvalCaseMeta

The decorator attaches an `EvalCaseMeta` dataclass to the function as `_eval_case_meta`:

```python
meta = eval_summarization._eval_case_meta
print(meta.min_score)      # 0.8
print(meta.max_cost_usd)   # 0.05
print(meta.tags)           # ["qa", "rag"]
```

### Running eval cases

Use the [`synapsekit test`](/docs/cli/test) CLI to discover and run eval cases:

```bash
synapsekit test tests/evals/ --threshold 0.8
```

## EvalRegression

Snapshot-based regression detection for CI pipelines. Save eval results as named snapshots, then compare against baselines to catch regressions.

```python
from synapsekit import EvalRegression

regression = EvalRegression(store_dir=".synapsekit_evals")

# Save a snapshot after running evals
results = [{"name": "qa_test", "score": 0.85, "cost_usd": 0.02, "latency_ms": 1200}]
regression.save_snapshot("v1.0", results)

# Later, compare against baseline
new_results = [{"name": "qa_test", "score": 0.80, "cost_usd": 0.03, "latency_ms": 1500}]
regression.save_snapshot("v1.1", new_results)

report = regression.compare("v1.0", "v1.1")
print(report.has_regressions)  # True — score dropped 5%
for delta in report.deltas:
    if delta.regressed:
        print(f"{delta.case_name}.{delta.metric}: {delta.baseline} → {delta.current}")
```

### Default thresholds

| Metric | Threshold | Description |
|---|---|---|
| `score` | -0.02 (2% drop) | Quality score regression |
| `cost_usd` | +0.10 (10% increase) | Cost regression |
| `latency_ms` | +0.20 (20% increase) | Latency regression |

### Custom thresholds

```python
report = regression.compare("v1.0", "v1.1", thresholds={
    "score": -0.05,       # Allow up to 5% score drop
    "cost_usd": 0.20,     # Allow up to 20% cost increase
    "latency_ms": 0.50,   # Allow up to 50% latency increase
})
```

### CLI integration

Use `synapsekit test` with regression flags for CI gates:

```bash
# Save results as a named snapshot
synapsekit test tests/evals/ --save v1.0

# Compare against baseline and fail on regression
synapsekit test tests/evals/ --compare v1.0 --fail-on-regression

# Custom snapshot directory
synapsekit test tests/evals/ --save v1.0 --snapshot-dir ./my_evals
```

See [`synapsekit test`](../cli/test) for full CLI reference.

### Managing snapshots

```python
# List saved snapshots
snapshots = regression.list_snapshots()
# ["v1.0", "v1.1"]

# Load a specific snapshot
snapshot = regression.load_snapshot("v1.0")
print(snapshot.name, snapshot.timestamp, len(snapshot.results))
```

## See also

- [synapsekit test](../cli/test) — CLI reference for running eval suites
- [Cost Tracker](../observability/cost-tracker) — track cost per eval run
- [RAG Pipeline](../rag/pipeline) — the pipeline you are evaluating
- [Retriever](../rag/retriever) — retrieval strategies that affect faithfulness and groundedness
- [LLM Overview](../llms/overview) — choosing models for evaluation
