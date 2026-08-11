---
sidebar_position: 11
---

# Cost Optimization

This is the long-form cost optimization guide for SynapseKit. The cheapest system is the one that *does fewer expensive calls* — everything else is marginal. The four real levers are:

1. **Cost-quality routing** (always pick the cheapest model that meets your quality bar).
2. **Prompt compression** (send less context per call).
3. **Caching layers** (avoid repeat calls entirely).
4. **Fallback ladders** (fail cheap → expensive, not the other way around).

If you want only one rule: **route + compress + cache.**

---

## Prerequisites

```bash
pip install synapsekit[openai]
# Optional for Redis caching
pip install synapsekit[redis]
```

---

# 1) Know your cost envelope

**Per-request cost** is roughly:

```
(input_tokens * price_in) + (output_tokens * price_out)
```

You don’t need perfect accuracy to make good decisions. A rough estimate is enough to decide when to downgrade or compress.

## 1.1 Use `CostTracker` to measure, not guess

```python
import time
from synapsekit import CostTracker
from synapsekit.observability.tracer import COST_TABLE

tracker = CostTracker()

# Example: record a call
with tracker.scope("pipeline:qa"):
    start = time.perf_counter()
    # ... call an LLM ...
    latency_ms = (time.perf_counter() - start) * 1000

    # Use your real token counts if you have them
    rec = tracker.record(
        model="gpt-4o-mini",
        input_tokens=1200,
        output_tokens=400,
        latency_ms=latency_ms,
    )

print(rec.cost_usd)
print(tracker.summary())
print(COST_TABLE["gpt-4o-mini"])  # price per token (input/output)
```

## 1.2 Enforce hard budgets with `BudgetGuard`

```python
from synapsekit import BudgetGuard, BudgetLimit

# Hard limits in USD
limits = BudgetLimit(per_request=0.02, per_user=1.00, daily=20.00)

guard = BudgetGuard(limits)

# Before call
estimated_cost = 0.015
user_id = "alice"

guard.check_before(estimated_cost=estimated_cost, user_id=user_id)

# After call
actual_cost = 0.012

guard.record_spend(actual_cost, user_id=user_id)
```

**Rule:** If you don’t have budgets, you *will* get a bill shock.

---

# 2) Cost-quality routing

Routing is the biggest cost lever. Use the cheapest model that meets your quality threshold, and only promote when needed.

## 2.1 Static routing with `CostRouter`

`CostRouter` filters out models below a quality threshold, then picks the **cheapest** of the rest.

```python
from synapsekit import CostRouter, CostRouterConfig, RouterModelSpec

router = CostRouter(CostRouterConfig(
    models=[
        RouterModelSpec(model="gpt-4o-mini", api_key="sk-...", provider="openai"),
        RouterModelSpec(model="gpt-4o", api_key="sk-...", provider="openai"),
        RouterModelSpec(model="claude-sonnet-4-6", api_key="sk-ant-...", provider="anthropic"),
    ],
    quality_threshold=0.78,   # Uses built-in QUALITY_TABLE
    fallback_on_error=True,
))

answer = await router.generate("Summarize this doc")
print(router.selected_model)
```

Use this when you already know your minimum acceptable quality.

---

## 2.2 Learning-based routing with `CostQualityRouter`

`CostQualityRouter` explores, learns real cost/quality stats, then exploits the cheapest model that meets your threshold.

```python
from synapsekit import CostQualityRouter
from synapsekit.llm.openai import OpenAILLM
from synapsekit import LLMConfig

cheap = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-...", provider="openai"))
strong = OpenAILLM(LLMConfig(model="gpt-4o", api_key="sk-...", provider="openai"))

router = CostQualityRouter(
    candidates=[cheap, strong],
    eval_suite="my_project.eval:eval_suite",  # Any object with evaluate(question, answer)
    quality_threshold=0.85,
    budget_per_call_usd=0.02,
    explore_n=50,
)

result = await router.generate("Explain transformer attention")
print(router.stats())  # includes Pareto frontier
```

**Pattern:** run the router in exploration for 50–200 calls, then let it exploit. The Pareto frontier will show which models are actually worth paying for.

---

# 3) Prompt compression (send fewer tokens)

You pay for every token you send and receive. Shrink the context first; don’t just downgrade models.

## 3.1 Cut context size with `ContextualCompressionRetriever`

This retrieves **more** documents (fetch_k) and compresses each down to only what is relevant to the question.

```python
from synapsekit import (
    RAGPipeline, RAGConfig, InMemoryVectorStore,
    SynapsekitEmbeddings, ContextualCompressionRetriever,
    Retriever, ConversationMemory,
)
from synapsekit.llm.openai import OpenAILLM
from synapsekit import LLMConfig

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-...", provider="openai"))
store = InMemoryVectorStore(SynapsekitEmbeddings())
base_retriever = Retriever(store)
retriever = ContextualCompressionRetriever(
    retriever=base_retriever,
    llm=llm,
    fetch_k=12,  # pull more docs
)

memory = ConversationMemory(window=5)
rag = RAGPipeline(RAGConfig(
    llm=llm,
    retriever=retriever,
    memory=memory,
    retrieval_top_k=4,  # but only keep top 4 compressed excerpts
))
```

**Effect:** fewer context tokens per call, lower cost, often *higher* relevance.

---

## 3.2 Summarize long conversations with `SummaryBufferMemory`

For chat systems, history grows fast. Summarize the old turns instead of appending everything.

```python
from synapsekit import SummaryBufferMemory

memory = SummaryBufferMemory(llm=llm, max_tokens=1200)

memory.add("user", "long question...")
memory.add("assistant", "long answer...")

messages = await memory.get_messages()
```

---

## 3.3 Tune RAG chunking and top_k

```python
from synapsekit import RAGConfig, ConversationMemory

config = RAGConfig(
    llm=llm,
    retriever=retriever,
    memory=ConversationMemory(window=5),
    chunk_size=400,     # smaller chunks → fewer irrelevant tokens
    chunk_overlap=40,
    retrieval_top_k=3,  # fewer chunks per query
)
```

Smaller chunks + lower `top_k` typically reduce context tokens by 30–60%.

---

# 4) Caching layers (avoid calls entirely)

## 4.1 LLM response caching

Enable the built-in cache — it’s the cheapest optimization you’ll ever make.

```python
from synapsekit import LLMConfig
from synapsekit.llm.openai import OpenAILLM

llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    provider="openai",
    cache=True,
    cache_backend="redis",          # "memory" | "sqlite" | "filesystem" | "redis"
    cache_db_path="redis://localhost:6379",
))

await llm.generate("What is SynapseKit?")
await llm.generate("What is SynapseKit?")  # cache hit

print(llm.cache_stats)  # {"hits": 1, "misses": 1, "size": 1}
```

## 4.2 Persist RAG indexes (skip re-embedding)

```python
from synapsekit import RAG

rag = RAG(model="gpt-4o-mini", api_key="sk-...")

await rag.add_async("doc 1")
await rag.add_async("doc 2")
rag.save("./index.npz")

# Later
rag.load("./index.npz")
```

---

# 5) Model fallback ladders

Always try cheap models first, then escalate only if the answer is too short or fails.

```python
from synapsekit import FallbackChain, FallbackChainConfig
from synapsekit.llm.openai import OpenAILLM
from synapsekit import LLMConfig

cheap = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-...", provider="openai"))
strong = OpenAILLM(LLMConfig(model="gpt-4o", api_key="sk-...", provider="openai"))

chain = FallbackChain(FallbackChainConfig(
    models=[cheap, strong],
    min_response_length=20,
    fallback_on_empty=True,
))

answer = await chain.generate("Explain vector databases")
print(chain.used_model)
```

**Pattern:** Use `FallbackChain` when your main model is cheap but occasionally underperforms.

---

# 6) Savings case studies (illustrative)

These are **example calculations** using published per-token prices. Swap in your real numbers.

## Case 1 — Router + cheap models for 70% of traffic

**Assumptions:**
- 100,000 requests/month
- Average tokens per request: 1,200 input + 400 output
- GPT-4o-mini pricing: $0.15 / 1M input, $0.60 / 1M output
- GPT-4o pricing: $2.50 / 1M input, $10.00 / 1M output
- Routing sends 70% to GPT-4o-mini, 30% to GPT-4o

**Cost per request:**
- GPT-4o-mini: (1200 * 0.15 + 400 * 0.60) / 1e6 = **$0.00033**
- GPT-4o:      (1200 * 2.50 + 400 * 10.00) / 1e6 = **$0.00700**

**Monthly cost (example):**
```
0.70 * 100,000 * 0.00033  =  $23.10
0.30 * 100,000 * 0.00700  = $210.00
TOTAL                      = $233.10
```

If everything ran on GPT-4o, cost would be **$700**. Routing saves **~67%**.

---

## Case 2 — Cache hits on 30% repeated queries

**Assumptions:**
- 50,000 requests/month
- 30% are repeat questions
- Average GPT-4o-mini cost: $0.00033 per request

```
Without cache: 50,000 * 0.00033 = $16.50
With 30% cache hits: 35,000 * 0.00033 = $11.55
Savings: $4.95 (30%)
```

Cache hits scale linearly with savings. If repeat rates are high, caching is the biggest lever after routing.

---

## Case 3 — Context compression reduces input tokens by 50%

If your average prompt includes 2,000 context tokens and you compress it to 1,000, input cost halves. For GPT-4o-mini, that’s a 50% input-cost reduction immediately.

---

# 7) Cost optimization checklist

- [ ] Route requests with **CostRouter** or **CostQualityRouter**
- [ ] Enforce budgets with **BudgetGuard**
- [ ] Trim context (`retrieval_top_k`, `chunk_size`, compression)
- [ ] Summarize long chat history with **SummaryBufferMemory**
- [ ] Enable LLM caching (Redis for multi-worker)
- [ ] Use **FallbackChain** to escalate only when needed
- [ ] Track costs with **CostTracker** and log by scope

---

# Next steps

- [CostRouter & FallbackChain](../llms/cost-router) — static routing + ladders
- [Cost-Aware LLM Router](../guides/llms/cost-router) — full pipeline example
- [Caching & Retries](../llms/caching-retries) — cache backends and knobs
- [Performance tuning](./performance-tuning) — latency + throughput playbook
- [Cost intelligence](../observability/cost-tracker) — CostTracker + BudgetGuard API
