---
sidebar_position: 4
title: "Seeded user simulation — SynapseKit Evaluation"
---

# Seeded multi-turn user simulation

`SimulationHarness` exercises an async user policy and an async agent against the same mutable environment. It is provider-free by default: the harness does not call a model or network service unless a callback does so.

## Run a booking episode

```python
import asyncio
import random

from synapsekit.evaluation import (
    BookingAction,
    BookingEnvironment,
    BookingObservation,
    SimulationHarness,
)

async def simulated_user(obs: BookingObservation, rng: random.Random) -> BookingAction:
    if obs.requested_slot is None:
        return BookingAction("request", slot=rng.choice(obs.available_slots))
    if not obs.consented:
        return BookingAction("consent")
    return BookingAction("wait")

async def support_agent(obs: BookingObservation, rng: random.Random) -> BookingAction:
    if not obs.consented:
        return BookingAction("message", message="May I book this support appointment?")
    if obs.booked_slot is None:
        return BookingAction("book", slot=obs.requested_slot)
    return BookingAction("finish", message="Your appointment is booked.")

async def main() -> None:
    harness = SimulationHarness(BookingEnvironment(), simulated_user, support_agent)
    result = await harness.run(seed=19)
    print(result.reason, result.reward.value, result.reward.violations)

asyncio.run(main())
```

The user can request a slot, consent, cancel or wait; the agent can message, book, finish or wait. Both receive observations of the shared booking state. Reward is calculated from recorded actions and final state: the booking policy returns 1.0 only for a completed, consented matching booking with no violations. The agent cannot set its own score by claiming success.

## Harness contract

- `SimulationHarness(environment, user, agent, *, max_turns=20, error_policy="raise")` alternates from the user. `max_turns` counts individual actions by either participant.
- `await harness.run(seed=...)` calls `environment.reset(seed)` before the episode and supplies separate deterministic `random.Random` streams to the two callbacks.
- An environment implements async `reset(seed)`, `observe(actor)`, `apply(actor, action) -> bool`, and `reward() -> Reward`. Return `True` from `apply` when the episode is complete.
- `InvalidActionError` propagates by default. With `error_policy="terminate"`, the invalid action is recorded and the episode ends with reason `invalid_action`; the environment still supplies the reward.
- Observations and actions are deep-copied for the recorded transcript before being passed to callbacks or `apply`, so mutation by an actor or environment does not rewrite prior turns. Values must support independent `copy.deepcopy`; copy errors propagate.

A seed alone does not guarantee reproducibility if callbacks use unseeded randomness, external state, or nondeterministic services. Reusing a harness resets its environment but not mutable state retained by callbacks. Create separate environments and actors for concurrent runs; the harness does not serialize concurrent episodes. The booking domain is an in-memory example, not a production scheduler or a security boundary.

Run the runnable example from a SynapseKit source checkout with `PYTHONPATH=src python examples/user_simulation.py`. Its deterministic transcript should end with `reason=completed`, reward `1.0`, and no violations. See [Evaluation API Reference](../api/evaluation).
