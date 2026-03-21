---
sidebar_position: 9
---

# Observability API Reference

SynapseKit provides token tracing, cost tracking, budget enforcement, OpenTelemetry export, and distributed tracing.

## `TokenTracer`

Tracks token usage across all LLM calls in a session.

```python
from synapsekit.observability import TokenTracer

tracer = TokenTracer(llm: BaseLLM)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM` | required | The LLM to wrap with token tracking |

### Properties and methods

- `tokens_used` — `{"input": int, "output": int, "total": int}`
- `reset()` — reset token counters to zero
- `async generate(prompt, **kwargs)` — proxies `llm.generate()` and records usage
- `async stream(prompt, **kwargs)` — proxies `llm.stream()` and records usage

```python
tracer = TokenTracer(llm=my_llm)
response = await tracer.generate("Explain RAG in one sentence.")
print(tracer.tokens_used)  # {"input": 12, "output": 38, "total": 50}
```

---

## `CostTracker`

Tracks estimated cost of LLM calls based on published pricing tables.

```python
from synapsekit.observability import CostTracker

tracker = CostTracker(llm: BaseLLM, currency: str = "USD")
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM` | required | The LLM to wrap |
| `currency` | `str` | `"USD"` | Display currency |

- `cost_so_far` — estimated cost in USD (property)
- `records` — list of `CostRecord` instances (property)
- `reset()` — reset cost to zero and clear records
- `async generate(...)` / `async stream(...)` — proxy methods that record a `CostRecord`

```python
tracker = CostTracker(llm=openai_llm)
for _ in range(10):
    await tracker.generate("Short prompt")
print(f"Total cost: ${tracker.cost_so_far:.4f}")
```

---

## `CostRecord`

```python
@dataclass
class CostRecord:
    model: str
    provider: str
    input_tokens: int
    output_tokens: int
    input_cost_usd: float
    output_cost_usd: float
    total_cost_usd: float
    timestamp: datetime
    prompt_preview: str    # first 100 chars
```

---

## `BudgetGuard`

Enforces a cost budget, raising `BudgetExceeded` when the limit is hit.

```python
from synapsekit.observability import BudgetGuard, BudgetLimit

guard = BudgetGuard(llm: BaseLLM, limit: BudgetLimit, on_exceeded: str = "raise")
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM` | required | The LLM to wrap |
| `limit` | `BudgetLimit` | required | Budget configuration |
| `on_exceeded` | `str` | `"raise"` | Action: `"raise"` or `"warn"` |

```python
guard = BudgetGuard(
    llm=llm,
    limit=BudgetLimit(max_cost_usd=1.00, window="day"),
)
try:
    result = await guard.generate("My prompt")
except BudgetExceeded as e:
    print(f"Budget exceeded: {e.spent:.4f} / {e.limit:.4f}")
```

---

## `BudgetLimit`

```python
@dataclass
class BudgetLimit:
    max_cost_usd: float
    window: str = "session"    # "session", "hour", "day", "month"
    max_tokens: int | None = None
```

| Field | Type | Default | Description |
|---|---|---|---|
| `max_cost_usd` | `float` | required | Maximum allowed cost in USD |
| `window` | `str` | `"session"` | Time window for budget reset |
| `max_tokens` | `int \| None` | `None` | Optional hard token limit |

---

## `CircuitState`

Enum representing the state of a circuit breaker used by `BudgetGuard`.

```python
class CircuitState(Enum):
    CLOSED = "closed"        # Normal operation
    OPEN = "open"            # Failing, rejecting calls
    HALF_OPEN = "half_open"  # Testing recovery
```

Access via `guard.circuit_state`.

---

## `OTelExporter`

Exports traces to any OpenTelemetry-compatible backend.

```python
from synapsekit.observability import OTelExporter

exporter = OTelExporter(
    endpoint: str,
    service_name: str = "synapsekit",
    headers: dict | None = None,
    insecure: bool = False,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `endpoint` | `str` | required | OTLP gRPC or HTTP endpoint |
| `service_name` | `str` | `"synapsekit"` | Service name in traces |
| `headers` | `dict \| None` | `None` | Auth headers |
| `insecure` | `bool` | `False` | Allow plaintext OTLP (no TLS) |

**Dependency:** `pip install synapsekit[otel]`

```python
OTelExporter(endpoint="http://localhost:4317", insecure=True).install()
```

---

## `Span`

```python
@dataclass
class Span:
    span_id: str
    trace_id: str
    parent_span_id: str | None
    name: str
    start_time: datetime
    end_time: datetime | None
    duration_ms: float | None
    attributes: dict
    events: list[dict]
    status: str    # "ok", "error", "unset"
    error: str | None
```

---

## `TracingMiddleware`

Wraps an LLM or RAG pipeline to automatically create spans for every call.

```python
from synapsekit.observability import TracingMiddleware

middleware = TracingMiddleware(
    component: BaseLLM | RAGPipeline,
    tracer_name: str = "synapsekit",
    record_inputs: bool = True,
    record_outputs: bool = True,
    max_input_length: int = 500,
    max_output_length: int = 500,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `component` | `BaseLLM \| RAGPipeline` | required | The component to trace |
| `tracer_name` | `str` | `"synapsekit"` | OTLP tracer name |
| `record_inputs` | `bool` | `True` | Include prompt/query in span attributes |
| `record_outputs` | `bool` | `True` | Include response in span attributes |
| `max_input_length` | `int` | `500` | Truncate input attribute at N characters |
| `max_output_length` | `int` | `500` | Truncate output attribute at N characters |

```python
OTelExporter(endpoint="http://localhost:4317", insecure=True).install()
traced_rag = TracingMiddleware(rag_pipeline)
answer = await traced_rag.aquery("What is SynapseKit?")
```

---

## `DistributedTracer`

Propagates trace context across service boundaries.

```python
from synapsekit.observability import DistributedTracer

tracer = DistributedTracer(
    service_name: str,
    propagation_format: str = "w3c",
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `service_name` | `str` | required | Name of this service in the trace |
| `propagation_format` | `str` | `"w3c"` | Trace context format: `"w3c"` or `"b3"` |

### Methods

- `start_span(name, parent_context=None) -> TraceSpan`
- `inject_context(headers: dict) -> dict` — inject trace context into outgoing headers
- `extract_context(headers: dict) -> dict | None` — extract from incoming headers

```python
tracer = DistributedTracer(service_name="rag-service")
parent = tracer.extract_context(request.headers)

with tracer.start_span("rag.query", parent_context=parent) as span:
    answer = await rag.aquery(question)
    span.set_attribute("answer_length", len(answer))
```

---

## `TraceSpan`

Context manager returned by `DistributedTracer.start_span()`.

```python
class TraceSpan:
    span_id: str
    trace_id: str

    def set_attribute(self, key: str, value: Any) -> None: ...
    def add_event(self, name: str, attributes: dict | None = None) -> None: ...
    def record_exception(self, exc: Exception) -> None: ...
    def set_status(self, status: str) -> None: ...  # "ok" or "error"
    def end(self) -> None: ...
```

---

## Full observability setup example

```python
import asyncio
from synapsekit import RAG, RAGConfig, OpenAILLM, InMemoryVectorStore, SynapsekitEmbeddings, LLMConfig
from synapsekit.observability import OTelExporter, TracingMiddleware, CostTracker, BudgetGuard, BudgetLimit

async def main():
    llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))
    guarded_llm = BudgetGuard(
        llm=CostTracker(llm),
        limit=BudgetLimit(max_cost_usd=5.00, window="day"),
    )
    OTelExporter(endpoint="http://localhost:4317", insecure=True).install()

    store = InMemoryVectorStore(SynapsekitEmbeddings())
    config = RAGConfig(llm=guarded_llm, vector_store=store)
    rag = RAG(config)

    traced_rag = TracingMiddleware(rag)
    await traced_rag.aadd(["SynapseKit is an async-first Python library."])
    answer = await traced_rag.aquery("What is SynapseKit?")
    print(answer)

asyncio.run(main())
```

---

## See also

- [Observability overview](../observability/overview)
- [Cost tracker guide](../observability/cost-tracker)
- [Evaluation API reference](../api/evaluation)
