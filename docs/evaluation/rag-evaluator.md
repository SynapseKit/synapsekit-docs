---
sidebar_position: 2
---

# RAG Evaluator

Sampled, LLM-judge-based evaluation for production RAG pipelines. The evaluator scores a fraction of live queries on recall, precision, relevance, and answer quality, fires alerts when scores drop below thresholds, and tracks ROI of the evaluation itself.

The evaluator never blocks the main RAG response path.

**Import:**
```python
from synapsekit.evaluation import RAGEvaluator, RAGEvaluationThresholds
```

No extra dependency beyond the LLM you are already using.

---

## `RAGEvaluator`

```python
from synapsekit.evaluation import RAGEvaluator

evaluator = RAGEvaluator(
    judge_llm: BaseLLM,
    sample_rate: float = 0.1,
    thresholds: RAGEvaluationThresholds | None = None,
    alert_sinks: Sequence[RAGAlertSink] | None = None,
    cost_tracker: CostTracker | None = None,
    max_context_chars: int = 12_000,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `judge_llm` | `BaseLLM` | required | LLM used as the evaluation judge |
| `sample_rate` | `float` | `0.1` | Fraction of queries to evaluate (0.01–1.0) |
| `thresholds` | `RAGEvaluationThresholds \| None` | `None` | Score thresholds that trigger alerts |
| `alert_sinks` | `Sequence[RAGAlertSink] \| None` | `None` | Destinations for alert notifications |
| `cost_tracker` | `CostTracker \| None` | `None` | Optional cost tracker for eval calls |
| `max_context_chars` | `int` | `12_000` | Maximum characters of retrieved context included in the judge prompt |

### Methods

- `async evaluate(question: str, answer: str, contexts: Sequence[str], *, sample_key: str | None = None) -> RAGEvaluationResult` — evaluate a single RAG response; returns immediately for non-sampled queries with `sampled=False`
- `should_sample(question: str, sample_key: str | None = None) -> bool` — deterministic check whether this query will be evaluated
- `summary() -> dict` — aggregate statistics over all sampled evaluations

### Properties

- `sample_rate` — configured sampling fraction
- `last_result` — `RAGEvaluationResult` for the most recent call
- `history` — list of all `RAGEvaluationResult` objects accumulated this session

---

## `RAGEvaluationThresholds`

```python
from synapsekit.evaluation import RAGEvaluationThresholds

@dataclass
class RAGEvaluationThresholds:
    recall: float = 0.65
    precision: float = 0.65
    relevance: float = 0.65
    answer_quality: float = 0.70
    benefit_to_cost: float = 1.0
```

| Field | Type | Default | Description |
|---|---|---|---|
| `recall` | `float` | `0.65` | Minimum acceptable recall score |
| `precision` | `float` | `0.65` | Minimum acceptable precision score |
| `relevance` | `float` | `0.65` | Minimum acceptable relevance score |
| `answer_quality` | `float` | `0.70` | Minimum acceptable answer quality score |
| `benefit_to_cost` | `float` | `1.0` | Minimum benefit-to-cost ratio; below this the eval cost may outweigh the signal |

All scores are floats in [0.0, 1.0].

---

## `RAGEvaluationResult`

```python
@dataclass
class RAGEvaluationResult:
    sampled: bool
    sample_key: str
    question: str | None
    recall: float | None
    precision: float | None
    relevance: float | None
    answer_quality: float | None
    retrieval_benefit: float | None
    benefit_to_cost: float | None
    eval_cost_usd: float
    eval_latency_ms: float
    prompt_tokens: int
    completion_tokens: int
    alerts: list[RAGAlert]
    suggestions: list[RAGERemediationSuggestion]
    notes: str | None
    raw_response: str | None
```

When `sampled=False` all score fields are `None` and `alerts` is empty.

---

## `RAGAlert`

```python
@dataclass(slots=True)
class RAGAlert:
    metric: str
    severity: Literal["info", "warning", "critical"]
    message: str
    recommendation: str
    value: float | None
    threshold: float | None
```

Severity is `"warning"` when `value >= threshold * 0.5`, and `"critical"` below that.

---

## `RAGERemediationSuggestion`

```python
@dataclass(slots=True)
class RAGERemediationSuggestion:
    metric: str
    action: str
    reason: str
```

---

## Alert sinks

### `SlackWebhookAlertSink`

```python
from synapsekit.evaluation import SlackWebhookAlertSink

sink = SlackWebhookAlertSink(
    webhook_url: str,
    channel: str | None = None,
    username: str | None = None,
    icon_emoji: str | None = None,
    timeout: float = 10.0,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `webhook_url` | `str` | required | Slack Incoming Webhook URL |
| `channel` | `str \| None` | `None` | Override the webhook's default channel |
| `username` | `str \| None` | `None` | Bot display name |
| `icon_emoji` | `str \| None` | `None` | Bot icon emoji |
| `timeout` | `float` | `10.0` | HTTP request timeout in seconds |

### `PagerDutyAlertSink`

```python
from synapsekit.evaluation import PagerDutyAlertSink

sink = PagerDutyAlertSink(
    routing_key: str,
    source: str = "synapsekit",
    timeout: float = 10.0,
)
```

### `EmailAlertSink`

```python
from synapsekit.evaluation import EmailAlertSink

sink = EmailAlertSink(
    host: str,
    from_addr: str,
    to_addrs: list[str],
    port: int = 587,
    username: str | None = None,
    password: str | None = None,
    use_tls: bool = True,
    use_ssl: bool = False,
    timeout: float = 10.0,
    subject_prefix: str = "[SynapseKit RAG]",
)
```

---

## Example

```python
import asyncio
from synapsekit import RAG, RAGConfig, OpenAILLM, InMemoryVectorStore, SynapsekitEmbeddings, LLMConfig
from synapsekit.evaluation import RAGEvaluator, RAGEvaluationThresholds
from synapsekit.evaluation.rag_evaluator import SlackWebhookAlertSink

async def main():
    llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))
    judge_llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

    store = InMemoryVectorStore(SynapsekitEmbeddings())
    rag = RAG(RAGConfig(llm=llm, vector_store=store))
    await rag.aadd([
        "SynapseKit is an async-first Python library for building LLM applications.",
        "It supports RAG, agents, graphs, and multi-agent workflows.",
    ])

    slack_sink = SlackWebhookAlertSink(webhook_url="https://hooks.slack.com/services/...")
    evaluator = RAGEvaluator(
        judge_llm=judge_llm,
        sample_rate=0.2,
        thresholds=RAGEvaluationThresholds(
            recall=0.70,
            precision=0.70,
            relevance=0.70,
            answer_quality=0.75,
        ),
        alert_sinks=[slack_sink],
    )

    questions = [
        "What is SynapseKit?",
        "Does SynapseKit support agents?",
        "How does RAG work?",
    ]

    for question in questions:
        # Run the RAG query
        result = await rag.aquery(question)

        # Evaluate asynchronously — does not block the response
        eval_result = await evaluator.evaluate(
            question=question,
            answer=result.answer,
            contexts=result.source_documents,
        )

        if eval_result.sampled:
            print(f"Q: {question}")
            print(f"  recall={eval_result.recall:.2f}  precision={eval_result.precision:.2f}"
                  f"  answer_quality={eval_result.answer_quality:.2f}")
            if eval_result.alerts:
                for alert in eval_result.alerts:
                    print(f"  [{alert.severity.upper()}] {alert.metric}: {alert.recommendation}")

    print(evaluator.summary())

asyncio.run(main())
```

---

## See also

- [Evaluation overview](overview)
- [Observability API reference](../api/observability)
- [RAG pipeline](../rag/pipeline)
