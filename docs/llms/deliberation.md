---
sidebar_position: 41
title: "Parallel deliberation — SynapseKit LLMs"
---

# Parallel-N deliberation

`deliberate` asks a bounded adapter for N independent short answers, then aggregates exact, whitespace-trimmed answer matches using model-reported confidence as vote weight. Confidence is not a calibrated probability. Different wording is treated as a different answer.

## OpenAI adapter example

```python
from openai import AsyncOpenAI
from synapsekit.llm import OpenAIChatAdapter, deliberate

client = AsyncOpenAI(max_retries=0)
adapter = OpenAIChatAdapter(client, model="YOUR_SUPPORTED_MODEL")
try:
    result = await deliberate(
        adapter,
        "What is 2 + 2?",
        n=3,
        max_output_tokens=128,
        total_output_budget=384,
        early_exit_confidence=0.9,
    )
    print(result.answer, result.confidence)
    print(result.total_input_tokens, result.total_output_tokens, result.total_cost)
finally:
    await client.close()
```

Use only a model/provider that honors `max_completion_tokens` for all generated output, including reasoning. The cap is enforced by the adapter at the request; the orchestrator rejects output reported above the cap. It reserves `n * max_output_tokens` before launch, so early exit does not make an undersized budget acceptable. This is an output-token cap, not a total input-token or monetary budget.

The adapter can calculate a cost estimate from caller-supplied input/output per-token rates. The estimate is not an invoice and may omit cached-input discounts, fees or provider-specific pricing. Any unknown usage makes the corresponding total `None`, not zero. Cancellation cannot ensure that a remote provider stopped billing.

## Early exit and limitations

When enabled, early exit requires two matching answers above the confidence threshold and a strict weighted-score lead that no pending vote (at maximum confidence 1.0) can overturn. This is a bound over the requested votes, not a correctness guarantee. All tasks in the observed completion batch are included before the decision. Outstanding tasks are cancelled and drained; an adapter that suppresses cancellation can delay cleanup indefinitely.

Each adapter must implement `complete(prompt, *, max_output_tokens)` and return a `Completion` with per-request usage where available. Do not wrap arbitrary `BaseLLM.generate` implementations as bounded adapters unless the provider honors the cap and usage is accurately per request. Retries must be disabled or fully accounted for.

## Evaluation

The repository provides `benchmarks/deliberation_eval.py`, a paired comparison harness for the pinned short-answer fixture and a separately prompted, bounded reasoning baseline. It uses the same tasks and exact-answer scoring. Configuration and fixture entries are validated before loading an adapter factory or making requests. Early exit is disabled by default; `--early-exit-confidence 0.9` enables its evaluation and reports launched and cancelled traces. Cancellation does not establish provider-side savings, and unknown usage remains unknown.

No real-model quality or cost improvement has been verified; mock-adapter tests demonstrate orchestration, not efficacy. A real run may incur charges and share prompts with the configured provider, so use explicit authorization and non-sensitive tasks.

See [LLM Overview](./overview) and [LLM configuration API](../api/llm).
