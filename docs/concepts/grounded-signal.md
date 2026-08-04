---
sidebar_position: 30
---

# GroundedSignal

A small, stateless value type that tags any learning-relevant number — a reward, a quality score, a cost observation — with *who vouched for it*. Either the value came from something other than the agent under evaluation (an independent judge, a human, an `EvalSuite`), or the agent supplied it about itself (a bid estimate, a `output["quality"]` field, a self-graded score). Consumers — reputation stores, routers, eval gates, audit trails — treat a self-reported signal as discounted, filterable evidence rather than silently trusting it as ground truth.

`GroundedSignal` is deliberately a **two-tier split, not a confidence spectrum**. There is no "somewhat trusted" middle tier, because "extracted from the agent's own output" and "the agent's own bid" are not meaningfully different in trustworthiness — both are the agent describing itself, and a middle tier is where "we're mostly sure this is fine" bugs live.

This is complementary to, and distinct from, `VerifiableAgent`: that answers "is this record authentic and unmodified"; `GroundedSignal` answers "is the *content* of this number trustworthy". A self-reported score can be faithfully, cryptographically signed and still be wrong — verifiable and grounded are orthogonal properties.

**Import:**
```python
from synapsekit import GroundedSignal, SignalSource
```

Both symbols are exported at the top level of `synapsekit` (they also live in `synapsekit.provenance`). No extras are required — this is a core primitive.

---

## Quickstart

```python
from synapsekit import GroundedSignal, SignalSource

# An externally-grounded signal: a human reviewer or an independent judge
# supplied this quality score.
external = GroundedSignal(
    value=0.92,
    source=SignalSource.EXTERNAL_OVERRIDE,
    provenance={"evaluator": "human_review", "eval_id": "eval-4471"},
)
print(external.grounded)   # True
print(external.value)      # 0.92

# A self-reported signal: the agent under evaluation supplied this number
# (a bid estimate, a quality field read out of its own output, etc.).
internal = GroundedSignal(
    value=0.86,
    source=SignalSource.SELF_REPORTED,
    provenance={"origin": "output_field"},
)
print(internal.grounded)   # False

# A caller cannot relabel a self-reported signal as grounded: `source` is
# frozen and `grounded` is a derived, read-only property.
assert external.grounded is True
assert internal.grounded is False
```

The two convenience factories pack their keyword arguments straight into `provenance`:

```python
GroundedSignal.external(0.7, evaluator="judge_model", eval_id="e1")   # grounded
GroundedSignal.self_reported(0.7, origin="output_field")             # not grounded
```

---

## The two-tier split

| `SignalSource` | Meaning | `grounded` |
|---|---|---|
| `EXTERNAL_OVERRIDE` | Something *other than* the agent under evaluation supplied the value — an independent judge, a human, an eval harness computed by code that isn't the agent. | `True` |
| `SELF_REPORTED` | The agent under evaluation supplied it, through any code path — a bid, a `quality`/`score` field in its own output, a self-graded number. | `False` |

`grounded` is a **derived, read-only property**: it returns `True` only when `source is EXTERNAL_OVERRIDE`. `GroundedSignal` is a `frozen`, `slots` dataclass with no backing field for `grounded`, so a caller can neither reassign `source` after construction nor set `grounded` directly — a self-reported signal can never be relabelled as grounded.

`source` is coerced on construction, so string aliases work: `"external"`, `"override"`, `"grounded"` → `EXTERNAL_OVERRIDE`; `"self"`, `"self_report"`, `"ungrounded"` → `SELF_REPORTED`. `value` is coerced to `float`, and `provenance` is defensively copied.

:::note `provenance` is documentation, not proof
The `provenance` dict is free-form and unvalidated — it exists for debugging and audit display. The `source` enum is the actual trust boundary; nothing stops a caller from writing a misleading `provenance` dict on a self-reported signal.
:::

---

## How AgentSwarm uses it

`AgentSwarm` runs a market auction over a registry of agents and records a **replayable receipt** for every execution. When it settles a task, it resolves the outcome quality *and where it came from* into a `GroundedSignal`:

- A caller-supplied `quality=` override on `swarm.execute(...)` is the only externally-grounded source → `EXTERNAL_OVERRIDE`.
- A `quality`/`score` field read out of the winning agent's own output, and the bid-estimate fallback used when nothing else is available, are both the agent describing itself → `SELF_REPORTED`.

Each auction receipt (available via `swarm.trace`) carries the provenance so a track record can be replayed and audited:

```python
receipt = swarm.trace[-1]
receipt["outcome_score_source"]     # e.g. "caller_override" or "output_field"
receipt["outcome_signal_grounded"]  # True only when quality came from outside the agent
receipt["reputation_updated"]       # whether this outcome folded into reputation
```

The per-bid `reputation_prior` in each receipt also includes a `grounded_fraction`, so you can tell a track record built on independent evaluation from one built on self-report.

---

## `Reputation.record_outcome(quality_signal=...)`

The reputation store folds each outcome into a per-agent, per-category running snapshot. `cost`/`quality`/`reward` are plain floats and are unchanged. The optional `quality_signal` carries the *provenance* of the `quality` number — it only labels the update, it never changes the maths:

```python
from synapsekit import GroundedSignal
from synapsekit.agents.agent_registry import Reputation

reputation = Reputation()
reputation.record_outcome(
    "agent-1",
    "summarization",
    cost=120.0,
    quality=0.9,
    reward=3.4,
    won=True,
    quality_signal=GroundedSignal.external(0.9, evaluator="eval_suite"),
)

snapshot = reputation.get("agent-1", "summarization")
snapshot.grounded            # True — the most recent outcome was externally grounded
snapshot.grounded_attempts   # count of grounded outcomes
snapshot.grounded_fraction   # grounded_attempts / attempts, in [0, 1]
```

Callers that pass only floats (no `quality_signal`) are unaffected — the outcome simply counts as ungrounded. `grounded_fraction` is `0.0` before any attempt.

---

## Opt-in strict mode: `require_grounded_reward`

By default `AgentSwarm` is **skeptical-by-default but permissive**: an ungrounded (self-reported) outcome still updates reputation exactly as it always has. The opt-in strict mode makes the swarm refuse to learn from self-report — it *no-ops the reputation update* whenever the outcome signal isn't externally grounded:

```python
from synapsekit.agents.agent_swarm import AgentSwarm, MarketPolicy

swarm = AgentSwarm(
    agents=[...],
    market=MarketPolicy(require_grounded_reward=True),
)

# Reputation updates only when an external quality signal is present, e.g. by
# passing an override that an independent judge/eval produced:
await swarm.execute("Summarize the filing.", quality=0.94)
```

Concretely, the swarm updates reputation when `quality_signal.grounded or not require_grounded_reward`. With the flag off (default), every outcome updates reputation; with it on, only externally-grounded outcomes do, and each receipt's `reputation_updated` field records the decision.

---

## API reference

### `SignalSource`

A `str` enum with a strict two-way split.

| Member | Value | `grounded` |
|---|---|---|
| `EXTERNAL_OVERRIDE` | `"external_override"` | `True` |
| `SELF_REPORTED` | `"self_reported"` | `False` |

Classmethod `SignalSource.coerce(value)` accepts a `SignalSource` or a string alias (`"external"`/`"override"`/`"grounded"`, `"self"`/`"self_report"`/`"ungrounded"`) and raises `ValueError` on an unknown value.

### `GroundedSignal`

A `frozen`, `slots` dataclass.

| Field / member | Type | Description |
|---|---|---|
| `value` | `float` | The number itself (reward, quality, cost, confidence — the primitive is agnostic). Coerced to `float`. |
| `source` | `SignalSource` | The two-tier trust boundary. Coerced via `SignalSource.coerce`. |
| `provenance` | `dict[str, Any]` | Free-form, unvalidated audit/debug metadata. Defensively copied. Defaults to `{}`. |
| `grounded` | `bool` (property) | **Derived, read-only.** `True` only when `source is EXTERNAL_OVERRIDE`. |

| Method | Description |
|---|---|
| `GroundedSignal.external(value, **provenance)` | Classmethod: build an `EXTERNAL_OVERRIDE` signal; kwargs become `provenance`. |
| `GroundedSignal.self_reported(value, **provenance)` | Classmethod: build a `SELF_REPORTED` signal; kwargs become `provenance`. |
| `to_dict()` | Returns `{"value", "source", "grounded", "provenance"}`. |

---

## See also

- [Agents overview](../agents/overview)
- [Neuro-Symbolic Agent](../agents/neuro-symbolic)
