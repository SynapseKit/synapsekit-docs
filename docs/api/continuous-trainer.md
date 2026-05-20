---
sidebar_position: 11
---

# Continuous Trainer API Reference

Closed-loop fine-tuning pipeline that collects production feedback, converts it into training data, runs a fine-tuning job, and gradually rolls out the resulting model through A/B testing.

**Import:**
```python
from synapsekit.training import ContinuousTrainer, FeedbackCollector
```

**Install:** `pip install synapsekit[training]`

---

## `FeedbackSample`

Captured data from a single user interaction.

```python
from synapsekit.training.types import FeedbackSample
from dataclasses import dataclass, field

@dataclass
class FeedbackSample:
    query: str
    response: str
    feedback: Literal["positive", "negative"]
    id: str                             # auto-generated UUID
    corrected_response: str | None = None
    context: list[str] | None = None
    metadata: dict | None = None
    timestamp: datetime                 # auto-set to UTC now
    latency_ms: float | None = None
    cost_usd: float | None = None
```

---

## `FeedbackCollector`

Non-blocking production feedback collector. Writes samples to an internal `asyncio.Queue` drained by a background task. The `record()` method never blocks the caller.

```python
from synapsekit.training import FeedbackCollector

collector = FeedbackCollector(
    backend: FeedbackBackend | None = None,
    queue_maxsize: int = 10_000,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `backend` | `FeedbackBackend \| None` | `None` | Storage backend; defaults to `InMemoryFeedbackBackend` |
| `queue_maxsize` | `int` | `10_000` | Maximum unprocessed items in memory; new items are dropped with a warning when full |

### Lifecycle methods

- `start() -> None` — start the background drainer task; requires a running event loop
- `async flush() -> None` — wait until all queued items have been persisted
- `async stop() -> None` — flush all pending items and stop the drainer

### Data methods

- `record(query, response, feedback, *, corrected_response=None, context=None, metadata=None, latency_ms=None, cost_usd=None) -> FeedbackSample` — enqueue a feedback sample; returns immediately
- `async get_samples(since: datetime | None = None) -> list[FeedbackSample]` — retrieve persisted samples, optionally filtered by timestamp
- `async stored_count() -> int` — number of samples persisted to the backend
- `async pending_count() -> int` — number of samples waiting in the in-memory queue

---

## `FeedbackBackend`

Protocol for pluggable storage backends.

```python
class FeedbackBackend(Protocol):
    async def save(self, sample: FeedbackSample) -> None: ...
    async def load_all(self) -> list[FeedbackSample]: ...
    async def load_since(self, since: datetime) -> list[FeedbackSample]: ...
    async def count(self) -> int: ...
```

Built-in implementation: `InMemoryFeedbackBackend` (thread-safe, no persistence).

---

## `TrainingDataGenerator`

Converts `FeedbackSample` records into instruction-tuning JSONL datasets and DPO preference pairs.

```python
from synapsekit.training.dataset import TrainingDataGenerator

generator = TrainingDataGenerator(
    system_prompt: str | None = None,
    max_pairs_per_query: int = 500,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `system_prompt` | `str \| None` | `None` | System message prepended to every training example |
| `max_pairs_per_query` | `int` | `500` | Cap on preference pairs per unique query to avoid combinatorial blow-up |

### Methods

- `generate_examples(samples: list[FeedbackSample]) -> list[TrainingExample]` — convert samples to chat-format training examples
- `generate_jsonl(samples: list[FeedbackSample]) -> list[str]` — return JSONL lines compatible with the OpenAI fine-tuning API
- `generate_preference_pairs(samples: list[FeedbackSample]) -> list[PreferencePair]` — build DPO / RLHF chosen/rejected pairs
- `write_jsonl(samples: list[FeedbackSample], path: str) -> int` — write instruction-tuning JSONL to file; returns number of examples written
- `write_preference_jsonl(samples: list[FeedbackSample], path: str) -> int` — write DPO pairs to file; returns number of pairs written

---

## `BaseFineTuneProvider`

Abstract base for fine-tuning provider adapters.

```python
class BaseFineTuneProvider(ABC):
    async def upload_dataset(self, jsonl_path: str) -> str: ...
    async def start_job(self, file_id: str, base_model: str, *, hyperparams=None, suffix=None) -> FineTuneJob: ...
    async def status(self, job_id: str) -> FineTuneJob: ...
    async def list_jobs(self, limit: int = 20) -> list[FineTuneJob]: ...
    async def cancel_job(self, job_id: str) -> bool: ...
    async def wait_for_completion(self, job_id: str, poll_interval_s: float = 60.0, timeout_s: float | None = None) -> FineTuneJob: ...
```

### `OpenAIFineTuneProvider`

```python
from synapsekit.training.finetune import OpenAIFineTuneProvider

provider = OpenAIFineTuneProvider(
    api_key: str | None = None,
    organization: str | None = None,
)
```

Falls back to the `OPENAI_API_KEY` environment variable if `api_key` is not set.

### `AnthropicFineTuneProvider`

```python
from synapsekit.training.finetune import AnthropicFineTuneProvider

provider = AnthropicFineTuneProvider(api_key: str | None = None)
```

For enterprise Anthropic fine-tuning. Implements the full `BaseFineTuneProvider` interface.

---

## `FineTuneJob`

Lifecycle descriptor for a provider fine-tuning job.

```python
@dataclass
class FineTuneJob:
    job_id: str
    provider: str
    base_model: str
    status: Literal["queued", "running", "succeeded", "failed", "cancelled"]
    created_at: datetime
    finished_at: datetime | None
    fine_tuned_model: str | None
    error: str | None
    training_file_id: str | None
    metadata: dict | None
```

---

## `ABTestRouter`

Routes production traffic between a base model and a fine-tuned variant using deterministic sticky assignment.

```python
from synapsekit.training.ab_testing import ABTestRouter

router = ABTestRouter(
    base_model: str,
    finetuned_model: str,
    rollout_pct: float = 10.0,
    experiment_id: str = "default",
    max_results: int = 100_000,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `base_model` | `str` | required | Production model identifier |
| `finetuned_model` | `str` | required | Candidate fine-tuned model identifier |
| `rollout_pct` | `float` | `10.0` | Percentage of traffic (0–100) sent to the fine-tuned model |
| `experiment_id` | `str` | `"default"` | Salt for the sticky hash; change to reset all assignments |
| `max_results` | `int` | `100_000` | Maximum A/B result records retained in memory |

### Methods

- `route(user_id: str) -> tuple[str, Literal["base", "finetuned"]]` — deterministic assignment; returns `(model_id, variant_name)`
- `record_result(result: ABTestResult) -> None` — store an observed result for metric aggregation
- `get_metrics(since: datetime | None = None) -> ABTestMetrics` — compute aggregate metrics for both variants
- `result_count() -> int` — number of results currently retained
- `finetuned_count() -> int` — number of fine-tuned variant results retained
- `clear_results() -> None` — purge all stored results
- `rollout_pct` — (settable property) adjust traffic split at runtime

---

## `ABTestMetrics`

```python
@dataclass
class ABTestMetrics:
    base_sample_count: int
    finetuned_sample_count: int
    base_latency_ms: float
    finetuned_latency_ms: float
    base_cost_usd: float
    finetuned_cost_usd: float
    base_positive_rate: float
    finetuned_positive_rate: float
    base_eval_score: float | None
    finetuned_eval_score: float | None
    # Computed properties:
    # latency_delta_pct  — positive = fine-tuned is slower
    # quality_delta_pct  — positive = fine-tuned has higher user approval
    # cost_delta_pct     — positive = fine-tuned costs more per request
```

---

## `RolloutPolicy`

```python
from synapsekit.training.types import RolloutPolicy
from dataclasses import dataclass, field

@dataclass
class RolloutPolicy:
    stages: list[float] = field(default_factory=lambda: [5.0, 25.0, 50.0, 100.0])
    min_samples_per_stage: int = 100
    improvement_threshold_pct: float = 2.0
    latency_regression_pct: float = 20.0
    cost_regression_pct: float = 15.0
```

| Field | Type | Default | Description |
|---|---|---|---|
| `stages` | `list[float]` | `[5, 25, 50, 100]` | Traffic percentages at each rollout stage |
| `min_samples_per_stage` | `int` | `100` | New fine-tuned samples required before advancing or rolling back |
| `improvement_threshold_pct` | `float` | `2.0` | Minimum quality gain (%) required to advance |
| `latency_regression_pct` | `float` | `20.0` | Latency increase (%) that triggers automatic rollback |
| `cost_regression_pct` | `float` | `15.0` | Cost increase (%) that triggers automatic rollback |

---

## `AutoRolloutManager`

Manages gradual rollout through configurable traffic stages with automatic advancement and safety rollback.

```python
from synapsekit.training.rollout import AutoRolloutManager

manager = AutoRolloutManager(
    router: ABTestRouter,
    policy: RolloutPolicy | None = None,
)
```

### Methods

- `activate(initial_finetuned_count: int = 0) -> None` — start rollout at the first stage percentage
- `evaluate_and_advance(metrics: ABTestMetrics) -> Literal["advanced", "held", "rolled_back", "completed"]` — evaluate current metrics and decide next action
- `rollback(reason: str = "manual") -> None` — immediately reset fine-tuned traffic to 0%
- `state` — (property) current `RolloutState`
- `policy` — (property) current `RolloutPolicy`

---

## `InferenceProfile`

Describes production traffic for monthly cost projection.

```python
from synapsekit.training.cost_analysis import InferenceProfile
from dataclasses import dataclass

@dataclass
class InferenceProfile:
    monthly_requests: int
    avg_input_tokens: int
    avg_output_tokens: int
    base_model: str
    finetuned_model: str | None = None
```

---

## `CostBenefitAnalyzer`

Computes training cost, inference savings, quality gain, and payback period.

```python
from synapsekit.training.cost_analysis import CostBenefitAnalyzer

analyzer = CostBenefitAnalyzer(
    custom_pricing: dict[str, dict[str, float]] | None = None,
)
```

### Methods

- `analyze(training_cost_usd: float, metrics: ABTestMetrics, profile: InferenceProfile) -> CostBenefitReport` — compute the full cost-benefit report
- `estimate_training_cost(n_examples: int, avg_tokens_per_example: int, n_epochs: int = 3, model: str = "gpt-4o-mini", provider: str = "openai") -> float` — estimate fine-tuning cost in USD
- `token_cost(model: str, input_tokens: int, output_tokens: int) -> float` — USD cost of a single inference call

---

## `ContinuousTrainer`

High-level orchestrator coordinating the full pipeline: feedback → dataset → fine-tuning → evaluation → rollout.

```python
from synapsekit.training import ContinuousTrainer

trainer = ContinuousTrainer(
    collector: FeedbackCollector,
    generator: TrainingDataGenerator,
    provider: BaseFineTuneProvider,
    router: ABTestRouter,
    rollout_manager: AutoRolloutManager,
    analyzer: CostBenefitAnalyzer,
    base_model: str,
    min_feedback_before_train: int = 100,
    dataset_path: str = "synapsekit_training.jsonl",
    inference_profile: InferenceProfile | None = None,
    eval_fn: Callable[[str], Awaitable[float]] | None = None,
    min_eval_score: float | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `collector` | `FeedbackCollector` | required | Must be started before use |
| `generator` | `TrainingDataGenerator` | required | Converts feedback to JSONL |
| `provider` | `BaseFineTuneProvider` | required | Fine-tuning API adapter |
| `router` | `ABTestRouter` | required | Traffic splitter |
| `rollout_manager` | `AutoRolloutManager` | required | Gradual rollout controller |
| `analyzer` | `CostBenefitAnalyzer` | required | ROI calculator |
| `base_model` | `str` | required | Base model identifier for fine-tuning |
| `min_feedback_before_train` | `int` | `100` | Minimum new samples since last training run to trigger a new job |
| `dataset_path` | `str` | `"synapsekit_training.jsonl"` | Local path for the JSONL dataset before upload |
| `inference_profile` | `InferenceProfile \| None` | `None` | Default production traffic profile for cost analysis |
| `eval_fn` | `Callable[[str], Awaitable[float]] \| None` | `None` | Evaluation gate; called with fine-tuned model ID before rollout |
| `min_eval_score` | `float \| None` | `None` | Minimum eval score required to activate rollout |

### Methods

- `record_feedback(query, response, feedback, **kwargs) -> FeedbackSample` — synchronous; delegates to `collector.record()`
- `async maybe_trigger_training() -> FineTuneJob | None` — start a training job if enough new feedback has accumulated
- `async check_job_status() -> FineTuneJob | None` — poll the current fine-tune job
- `async activate_ab_test(model_id: str | None = None) -> bool` — activate rollout; optionally gate on `eval_fn`
- `async run_evaluation_cycle(profile=None, training_cost_usd=None) -> tuple[ABTestMetrics, CostBenefitReport | None]` — evaluate A/B metrics and optionally compute ROI
- `set_training_cost(cost_usd: float) -> None` — store the training cost for cost-benefit analysis
- `pending_job` — (property) the current `FineTuneJob | None`

---

## End-to-end example

```python
import asyncio
from synapsekit import OpenAILLM, LLMConfig
from synapsekit.training import ContinuousTrainer, FeedbackCollector
from synapsekit.training.dataset import TrainingDataGenerator
from synapsekit.training.finetune import OpenAIFineTuneProvider
from synapsekit.training.ab_testing import ABTestRouter
from synapsekit.training.rollout import AutoRolloutManager
from synapsekit.training.cost_analysis import CostBenefitAnalyzer, InferenceProfile
from synapsekit.training.types import ABTestResult, RolloutPolicy

async def main():
    llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

    # 1. Create and start the feedback collector
    collector = FeedbackCollector()
    collector.start()

    # 2. Record some feedback after LLM calls
    response = await llm.generate("What is RAG?")
    collector.record(
        query="What is RAG?",
        response=response,
        feedback="positive",
        latency_ms=340.0,
        cost_usd=0.0002,
    )
    collector.record(
        query="Summarize this 50-page PDF",
        response="I cannot do that.",
        feedback="negative",
        corrected_response="Here is a structured summary of the PDF...",
    )

    # 3. Wire up the full pipeline
    base_model = "gpt-4o-mini"
    finetuned_model = "ft:gpt-4o-mini:myorg:v1:abc123"

    router = ABTestRouter(
        base_model=base_model,
        finetuned_model=finetuned_model,
        rollout_pct=5.0,
    )
    rollout_manager = AutoRolloutManager(
        router=router,
        policy=RolloutPolicy(
            stages=[5.0, 25.0, 50.0, 100.0],
            min_samples_per_stage=50,
            improvement_threshold_pct=3.0,
        ),
    )

    trainer = ContinuousTrainer(
        collector=collector,
        generator=TrainingDataGenerator(system_prompt="You are a helpful AI assistant."),
        provider=OpenAIFineTuneProvider(api_key="sk-..."),
        router=router,
        rollout_manager=rollout_manager,
        analyzer=CostBenefitAnalyzer(),
        base_model=base_model,
        min_feedback_before_train=100,
        inference_profile=InferenceProfile(
            monthly_requests=50_000,
            avg_input_tokens=800,
            avg_output_tokens=200,
            base_model=base_model,
            finetuned_model=finetuned_model,
        ),
    )

    # 4. Check whether to trigger training (requires 100 new samples)
    job = await trainer.maybe_trigger_training()
    if job:
        print(f"Training job started: {job.job_id}")

    # 5. Route production traffic with ABTestRouter
    user_id = "user-42"
    model_id, variant = router.route(user_id)
    response = await llm.generate("What is prompt caching?")  # use model_id in production

    router.record_result(ABTestResult(
        user_id=user_id,
        model_variant=variant,
        latency_ms=280.0,
        cost_usd=0.00015,
        feedback="positive",
    ))

    # 6. Run an evaluation cycle
    metrics, report = await trainer.run_evaluation_cycle()
    print(f"Quality delta: {metrics.quality_delta_pct:.1f}%")
    if report:
        print(f"Monthly savings: ${report.monthly_inference_savings_usd:.2f}")
        print(f"Payback period: {report.estimated_payback_days:.0f} days")

    await collector.stop()

asyncio.run(main())
```

---

## See also

- [Evaluation API reference](evaluation)
- [Observability API reference](observability)
- [RAG Evaluator](../evaluation/rag-evaluator)
