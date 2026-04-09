---
sidebar_position: 3
---

# Writing Eval Cases

Eval cases are ordinary Python functions decorated with `@eval_case`. EvalCI discovers and runs them automatically.

---

## Basic structure

```python
from synapsekit import eval_case

@eval_case(min_score=0.80, max_cost_usd=0.01, max_latency_ms=3000)
async def test_my_pipeline():
    # 1. Run your pipeline
    result = await my_pipeline.run("some input")

    # 2. Compute a quality score (0.0–1.0)
    score = compute_score(result)

    # 3. Return a dict
    return {
        "score": score,
        "cost_usd": result.cost_usd,
        "latency_ms": result.latency_ms,
    }
```

### Return value keys

| Key | Type | Required | Description |
|---|---|---|---|
| `score` | `float` | Yes (if `min_score` set) | Quality score from 0.0 to 1.0 |
| `cost_usd` | `float` | No | Cost of the run in USD |
| `latency_ms` | `float` | No | Latency in milliseconds (auto-measured if omitted) |

---

## Decorator parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `min_score` | `float \| None` | `None` | Minimum acceptable score. Case fails if `score < min_score`. |
| `max_cost_usd` | `float \| None` | `None` | Maximum acceptable cost. Case fails if `cost_usd > max_cost_usd`. |
| `max_latency_ms` | `float \| None` | `None` | Maximum acceptable latency. Case fails if `latency_ms > max_latency_ms`. |
| `tags` | `list[str]` | `[]` | Tags for filtering (`synapsekit test --tag rag`) |

---

## Evaluating a RAG pipeline

Use the built-in metrics from `synapsekit` to score relevancy, faithfulness, and groundedness:

```python
from synapsekit import eval_case, RelevancyMetric, FaithfulnessMetric
from myapp.rag import pipeline

llm = pipeline.llm  # reuse your pipeline's LLM

@eval_case(min_score=0.80, max_cost_usd=0.02)
async def test_rag_relevancy():
    result = await pipeline.ask("What is retrieval-augmented generation?")
    metric = RelevancyMetric(llm=llm)
    score = await metric.score(
        question="What is retrieval-augmented generation?",
        answer=result.answer,
    )
    return {"score": score, "cost_usd": result.cost_usd, "latency_ms": result.latency_ms}

@eval_case(min_score=0.75)
async def test_rag_faithfulness():
    result = await pipeline.ask("How many LLM providers does SynapseKit support?")
    metric = FaithfulnessMetric(llm=llm)
    score = await metric.score(
        question="How many LLM providers does SynapseKit support?",
        answer=result.answer,
        contexts=result.source_documents,
    )
    return {"score": score, "cost_usd": result.cost_usd}
```

---

## Evaluating an agent

```python
from synapsekit import eval_case
from myapp.agent import support_agent

@eval_case(min_score=0.85, max_latency_ms=5000, tags=["agent", "support"])
async def test_agent_response_quality():
    response = await support_agent.run("How do I reset my password?")

    # Simple keyword-based scoring (replace with LLM-as-judge for production)
    keywords = ["reset", "password", "email", "link"]
    score = sum(1 for k in keywords if k in response.lower()) / len(keywords)

    return {"score": score, "latency_ms": response.latency_ms}
```

---

## LLM-as-judge scoring

For more reliable scoring, use an LLM to evaluate the output:

```python
from synapsekit import eval_case, OpenAILLM

judge = OpenAILLM(model="gpt-4o-mini", api_key=os.environ["OPENAI_API_KEY"])

@eval_case(min_score=0.80)
async def test_answer_quality():
    answer = await my_pipeline.ask("Explain RAG in one sentence.")

    prompt = f"""Rate the quality of this answer from 0.0 to 1.0.
Answer: {answer}
Criteria: accurate, concise, clear.
Return only a float like: 0.85"""

    rating_str = await judge.generate(prompt)
    score = float(rating_str.strip())

    return {"score": score}
```

---

## Organising eval cases

Structure your eval files by feature area:

```
tests/
└── evals/
    ├── test_rag.py          # RAG pipeline evals
    ├── test_agents.py       # Agent behaviour evals
    ├── test_retrieval.py    # Retrieval quality evals
    └── test_regression.py  # Regression test cases
```

Run all of them with:

```bash
synapsekit test tests/evals/ --threshold 0.80
```

Or a specific tag:

```bash
synapsekit test tests/evals/ --tag rag --threshold 0.85
```

---

## Sync vs async

Both `async def` and `def` functions are supported:

```python
@eval_case(min_score=0.9)
def test_deterministic_case():
    # Sync functions run in a thread pool
    result = my_sync_pipeline("test input")
    return {"score": float(result.quality > 0.9)}
```

---

## See also

- [Evaluation overview](/docs/evaluation/overview) — metrics, `EvaluationPipeline`, regression detection
- [CLI reference — synapsekit test](/docs/cli/test) — running eval cases locally
- [Action reference](/docs/evalci/action-reference) — configuring EvalCI in GitHub Actions
