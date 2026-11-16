---
sidebar_position: 3
title: "Relative trajectory rewards — SynapseKit Evaluation"
---

# Relative trajectory rewards

`RulerScorer` compares several rollouts for the same task in one judge call. It returns one validated 0–1 score per trajectory. The API is RULER-style, inspired by [OpenPipe RULER](https://art.openpipe.ai/fundamentals/ruler/); it does not implement ART's API or guarantee training improvements.

## Score a group

```python
from synapsekit.evaluation import (
    LLMRulerJudge,
    RulerGroup,
    RulerMessage,
    RulerScorer,
    RulerTrajectory,
)

# llm is a configured async synapsekit BaseLLM instance.
shared = RulerMessage("user", "Explain 2 + 2.")
group = RulerGroup(
    task="Answer accurately and explain briefly",
    trajectories=(
        RulerTrajectory("attempt-1", (shared, RulerMessage("assistant", "4: two pairs."))),
        RulerTrajectory("attempt-2", (shared, RulerMessage("assistant", "5"))),
    ),
)
scores = await RulerScorer(LLMRulerJudge(llm)).score(group)
for score in scores:
    print(score.id, score.score)
```

A group contains 2–16 unique trajectory IDs from one task. Messages are immutable `RulerMessage` values with `system`, `user`, `assistant`, or `tool` roles. Limits are 100 messages per trajectory, 20,000 characters per task or message, 128 characters per ID, and 200,000 total task-plus-message characters per group. The shared leading message prefix is sent once; distinct suffixes and IDs are preserved. These are character limits, not model token limits; the provider context limit may be lower.

`LLMRulerJudge` uses the existing async `BaseLLM.generate` interface. A custom async judge callable can be injected for tests or other judge providers. The response must contain exactly one finite numeric score in [0, 1] for every trajectory ID; missing, duplicate, unknown or malformed entries raise `ValueError`. Provider errors propagate; no score is fabricated on failure.

Task and trajectory contents are untrusted input. The prompt labels them as data, but that is not a security boundary—an LLM judge may still follow instructions embedded in a rollout. Do not send secrets or sensitive traces to a provider without authorization. Validate the judge on adversarial examples before relying on the score.

## Diagnose and fit calibration

`calibrate(scores, gold)` reports mean absolute error and pairwise accuracy against a matching labeled set. Ties in gold are excluded; a predicted tie on a non-tied gold pair counts as incorrect. This function is diagnostic, not a fitted transform.

For an optional isotonic transform, fit on one labeled calibration split and measure on independent held-out tasks:

```python
from synapsekit.evaluation import calibrate, fit_calibration

calibration = fit_calibration(calibration_scores, calibration_gold)
calibrated = calibration.apply(held_out_scores)
report = calibrate(calibrated, held_out_gold)
print(calibration.metadata, report)
```

A fitted transform can overfit small samples and does not turn relative scores into calibrated probabilities or guarantee comparability across task groups. Data-split independence, label quality, repeated-run variability and model/prompt versioning are caller responsibilities.

## Ablation and evidence

The repository's `benchmarks/ruler_ablation.py` has a deterministic offline fixture with manually supplied scores. It exercises the scorer and baseline wiring only; its result is **not** evidence that an LLM judge beats a handcrafted reward.

An opt-in `--real` mode runs one labeled group with a pinned OpenAI model and requires an API key. It may incur charges and sends the task and rollouts to the provider. Only run it with explicit authorization and suitable data. A meaningful conclusion requires representative groups, separate calibration and held-out tasks, repeated runs, a strong baseline, model/prompt metadata, uncertainty, and costs. No real-model performance or training benefit is claimed by the offline fixture.

See [Evaluation API Reference](../api/evaluation) and [Evaluation overview](./overview).
