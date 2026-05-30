---
sidebar_position: 10
---

# Production Checklist

This is a **production-ready, one‑page checklist** for SynapseKit apps. It focuses on the six things that actually break in production: observability, eval gates, rate limits, secrets, cost alerts, and failure modes. The rest is noise.

If you only do one thing: **ship with budgets + fallbacks + traces**.

---

## 1) Observability (traces, latency, tokens)

**Goal:** You can answer “what happened, where, and how expensive?” for every request.

### 1.1 Enable tracing with `OTelExporter`

```python
from synapsekit import OTelExporter, TracingMiddleware
from synapsekit.llm.openai import OpenAILLM
from synapsekit import LLMConfig

exporter = OTelExporter(
    service_name="synapsekit-prod",
    endpoint="http://localhost:4317",  # OTLP endpoint (optional)
    export_format="otlp",              # "json" or "otlp"
)

middleware = TracingMiddleware(exporter)

llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    provider="openai",
))

traced_llm = middleware.trace_llm(llm)

# LLM calls now emit spans
result = await traced_llm.generate("Health check")

# Export traces (JSON or OTLP depending on export_format)
exporter.export()
```

### 1.2 Log tokens + cost per request

Use `CostTracker` (or your own metrics) to record cost by scope. This is your **baseline cost telemetry**.

```python
import time
from synapsekit import CostTracker

tracker = CostTracker()

with tracker.scope("pipeline:qa"):
    start = time.perf_counter()
    # ... call an LLM ...
    latency_ms = (time.perf_counter() - start) * 1000
    tracker.record("gpt-4o-mini", input_tokens=900, output_tokens=300, latency_ms=latency_ms)

print(tracker.summary())
```

---

## 2) Eval gates (quality before deploy)

**Goal:** Every release passes automatic quality checks. If it fails, the build fails.

```python
from synapsekit.evaluation import EvaluationPipeline, FaithfulnessMetric, RelevancyMetric
from synapsekit.llm.openai import OpenAILLM
from synapsekit import LLMConfig

judge = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-...", provider="openai"))

pipeline = EvaluationPipeline(
    metrics=[FaithfulnessMetric(judge), RelevancyMetric(judge)]
)

samples = [
    {
        "question": "What is SynapseKit?",
        "answer": "SynapseKit is an async-first Python LLM framework.",
        "contexts": ["SynapseKit is an async-first Python library for LLM apps."],
    }
]

results = await pipeline.evaluate_batch(samples, concurrency=4)

# Fail the build if any sample dips below threshold
if any(r.mean_score < 0.7 for r in results):
    raise SystemExit("Eval gate failed: mean_score < 0.7")
```

**Rule:** No manual deploys if evals fail. This is non‑negotiable.

---

## 3) Rate‑limiting + retries

**Goal:** Prevent 429 storms and control downstream load.

```python
from synapsekit.llm.openai import OpenAILLM
from synapsekit import LLMConfig

llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    provider="openai",
    max_retries=3,          # exponential backoff
    retry_delay=0.5,
    requests_per_minute=60, # token bucket limiter
))
```

Set `requests_per_minute` lower than the provider’s quota so your app fails gracefully instead of melting.

---

## 4) Secret rotation

**Goal:** Keys can rotate without downtime.

Checklist:
- Load secrets from env vars (never hard‑code).
- Centralize config so you can swap keys at runtime.
- If your platform supports it, **hot‑reload** secrets without restarts.
- Always test a rotation flow **before** you need it.

Example (environment‑driven config):

```python
import os
from synapsekit import LLMConfig
from synapsekit.llm.openai import OpenAILLM

llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key=os.getenv("OPENAI_API_KEY", ""),
    provider="openai",
))
```

---

## 5) Cost alerts + budgets

**Goal:** You *never* discover cost overruns after the invoice.

```python
from synapsekit import BudgetGuard, BudgetLimit

limits = BudgetLimit(per_request=0.05, per_user=1.00, daily=20.00)

guard = BudgetGuard(limits)

# Before call
estimated_cost = 0.03
user_id = "alice"

guard.check_before(estimated_cost=estimated_cost, user_id=user_id)

# After call
actual_cost = 0.02

guard.record_spend(actual_cost, user_id=user_id)
```

**Alerting pattern:** When `BudgetExceededError` is raised, emit a Slack/PagerDuty alert and short‑circuit the request.

---

## 6) Failure modes + fallbacks

**Goal:** cheap‑to‑expensive escalation; no single provider is a hard dependency.

### 6.1 Fallback ladders with `FallbackChain`

```python
from synapsekit import FallbackChain, FallbackChainConfig
from synapsekit.llm.openai import OpenAILLM
from synapsekit import LLMConfig

cheap = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-...", provider="openai"))
strong = OpenAILLM(LLMConfig(model="gpt-4o", api_key="sk-...", provider="openai"))

chain = FallbackChain(FallbackChainConfig(
    models=[cheap, strong],
    min_response_length=20,   # escalate if output is too short
    fallback_on_empty=True,
))

answer = await chain.generate("Explain vector databases")
print(chain.used_model)
```

### 6.2 CostRouter fallback on error

`CostRouter` tries the cheapest viable model first, then falls back if it errors.

```python
from synapsekit import CostRouter, CostRouterConfig, RouterModelSpec

router = CostRouter(CostRouterConfig(
    models=[
        RouterModelSpec(model="gpt-4o-mini", api_key="sk-...", provider="openai"),
        RouterModelSpec(model="gpt-4o", api_key="sk-...", provider="openai"),
    ],
    quality_threshold=0.75,
    fallback_on_error=True,
))

answer = await router.generate("Summarize the report")
print(router.selected_model)
```

**Rule:** Always have a cheap fallback. Even a degraded answer beats a 500.

---

# One‑page printable checklist

Print this section and stick it in your deploy runbook.

**Observability**
- [ ] Tracing enabled (OTelExporter + TracingMiddleware)
- [ ] Token + cost logging per request
- [ ] Latency metrics at P50/P95/P99

**Eval gates**
- [ ] CI evals run on every release
- [ ] Failing evals block deploy
- [ ] Thresholds documented and versioned

**Rate‑limiting**
- [ ] `requests_per_minute` set below provider quota
- [ ] `max_retries` + `retry_delay` configured

**Secrets**
- [ ] API keys only from env/config
- [ ] Rotation runbook tested

**Cost alerts**
- [ ] `BudgetGuard` per‑request + daily limits
- [ ] Alerts on `BudgetExceededError`

**Failure modes**
- [ ] FallbackChain or CostRouter enabled
- [ ] Short/empty responses trigger escalation
- [ ] Provider outage doesn’t 500
