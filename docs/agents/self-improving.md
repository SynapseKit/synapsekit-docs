---
sidebar_position: 12
---

# Self-Improving Agent

Wraps any agent in an eval-gated self-improvement loop. `SelfImprovingAgent` observes production feedback, has a `MetaAnalyzer` propose signed, reversible `AgentConfigPatch` diffs (prompt rewrites, tool changes, routing rules, few-shot examples), validates each candidate against an `EvalSuite` (or `PromptOptimizer`), and only promotes it to a canary rollout through an `AutoRolloutManager` if it clears the eval gate. Every patch is signed, appended to an append-only audit log, and can be rolled back to its recorded `before` snapshot.

**Import:**
```python
from synapsekit.agents import (
    SelfImprovingAgent,
    MetaAnalyzer,
    AgentConfigPatch,
    AgentConfigSnapshot,
    AgentEvolutionAuditLog,
    EvolutionCycleResult,
)
```

No extra dependency beyond the LLM providers and the training/evaluation modules you already use.

---

## Quickstart

```python
import asyncio
from synapsekit import AgentExecutor, AgentConfig, CalculatorTool
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.base import LLMConfig
from synapsekit.agents import SelfImprovingAgent
from synapsekit.evaluation import EvalSuite
from synapsekit.training import RolloutPolicy

async def main():
    llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))
    base = AgentExecutor(AgentConfig(llm=llm, tools=[CalculatorTool()]))

    # Eval suite discovered from @eval_case functions in eval_*.py files
    suite = EvalSuite.from_decorators("evals/", threshold=0.75)

    agent = SelfImprovingAgent(
        base_agent=base,
        eval_suite=suite,
        rollout=RolloutPolicy(),
        agent_id="support-bot",
        audit_path=".synapsekit_agent_evolution.jsonl",
        cadence="manual",
    )

    # Run with feedback signals — negative feedback drives the next cycle
    await agent.arun("What is 12 * 8?", feedback="positive")
    await agent.arun(
        "Explain the refund policy",
        feedback="negative",
        corrected_response="Refunds are processed within 30 days of purchase.",
    )

    # Trigger one observe → propose → validate → canary cycle
    result = await agent.evolve()
    print(result.status)              # e.g. "canary", "blocked", or "rejected"
    if result.patch:
        print(result.patch.patch_id, result.patch.eval_score)

asyncio.run(main())
```

---

## Observing feedback

`SelfImprovingAgent.arun(prompt, **kwargs)` runs the wrapped agent and, when `feedback` is `"positive"` or `"negative"`, records a `FeedbackSample` into the `FeedbackCollector` (latency, cost, and an optional `corrected_response` are captured too). Pass a `FeedbackCollector` explicitly to share traces with the rest of your training pipeline, or let the agent create one.

```python
await agent.arun("...", feedback="negative", corrected_response="...", cost_usd=0.002)
```

`run(prompt, **kwargs)` is the synchronous wrapper around `arun`.

---

## Cadence

`cadence` controls when a cycle fires automatically after `arun`:

- `"manual"` (default) — only when you call `evolve()`
- an `int` N — every N runs
- `"every_N_runs"` — every N runs

---

## Proposing patches

Each cycle calls `MetaAnalyzer.propose(...)`. If a `MetaAnalyzer` is given an LLM, it asks for JSON patch candidates; otherwise (or on parse failure) a conservative heuristic turns recurring negative feedback into a prompt rewrite. Patch candidates are capped by `max_candidates` (default 3).

An `AgentConfigPatch` is a signed, reversible diff:

- `patch_type` — `"prompt_rewrite"`, `"tool_addition"`, `"tool_removal"`, `"routing_rule"`, or `"few_shot_examples"`
- `before` / `after` — full `AgentConfigSnapshot` dicts, enabling exact rollback
- `sign(secret)` / `verify(secret)` — deterministic SHA-256 signature over patch content
- `status` — `"proposed" | "blocked" | "approved" | "canary" | "promoted" | "rolled_back" | "rejected"`

Pass `signature_secret="..."` to the agent to key every signature.

---

## Validating with eval gates

For each candidate the agent computes a baseline score with `eval_suite.score_prompt(...)`, then scores the patched prompt. For `prompt_rewrite` patches a supplied `PromptOptimizer` is used to score the variant. The patch is applied only if it clears `RolloutPolicy.check_eval_gate(...)` against the baseline; otherwise it is marked `blocked` with a `block_reason` and logged.

If the patch's type requires human approval (`RolloutPolicy.requires_human_approval`), the cycle returns `status="approved"` and waits — call `approve(patch_id)` to apply it.

```python
result = await agent.evolve()
if result.status == "approved":
    agent.approve(result.patch.patch_id, approved_by="alice")
```

---

## Canarying and rollback

An approved patch is applied to the live agent config, marked `"canary"` at `RolloutPolicy.initial_rollout_pct()`, and `AutoRolloutManager.activate()` begins the staged rollout. To revert:

```python
rollback_patch = agent.rollback(patch_id, reason="quality dip")
```

`rollback` restores the patch's recorded `before` snapshot, calls `AutoRolloutManager.rollback(...)`, and appends a new `rolled_back` patch to the audit log.

---

## Inspecting evolution history

```python
for patch in agent.evolution_history(status="canary", limit=10):
    print(patch.patch_id, patch.status, patch.eval_score)

rows = agent.inspect_evolution(limit=20)   # compact dict rows for dashboards
```

The audit log persists to JSONL when `audit_path` is set. Inspect it from the CLI:

```bash
synapsekit agent inspect-evolution support-bot \
    --audit-path .synapsekit_agent_evolution.jsonl --limit 20

# JSON output, or inspect every agent
synapsekit agent inspect-evolution all --format json
```

---

## API reference

### `SelfImprovingAgent(base_agent, eval_suite=None, *, ...)`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `base_agent` | `AgentExecutor \| SimpleAgent \| Any` | required | Agent to wrap; must expose `run`/`arun` |
| `eval_suite` | `EvalSuite \| str \| None` | `None` | Suite or path; string loads via `from_decorators` |
| `rollout` | `RolloutPolicy \| AutoRolloutManager \| None` | `None` | Rollout policy or manager |
| `feedback_collector` | `FeedbackCollector \| None` | `None` | Feedback store (created if omitted) |
| `optimizer` | `PromptOptimizer \| None` | `None` | Used to score prompt-rewrite patches |
| `meta_analyzer` | `MetaAnalyzerProtocol \| None` | `None` | Patch proposer (default `MetaAnalyzer()`) |
| `improvement_targets` | `list[str] \| None` | `None` | e.g. `["prompt", "tool_selection", "routing"]` |
| `cadence` | `str \| int` | `"manual"` | Auto-evolve schedule |
| `agent_id` | `str` | `"default"` | Identifier used in metadata and audit rows |
| `audit_log` | `AgentEvolutionAuditLog \| None` | `None` | Explicit audit log |
| `audit_path` | `str \| Path \| None` | `None` | JSONL path for the audit log |
| `metrics` | `Any \| None` | `None` | Optional metrics recorder |
| `signature_secret` | `str` | `""` | Secret keyed into patch signatures |

### Methods

- `async arun(prompt, **kwargs) -> str` — run, record feedback, and trigger cadence
- `run(prompt, **kwargs) -> str` — synchronous wrapper
- `async evolve(*, require_approval=None) -> EvolutionCycleResult` — one improvement cycle
- `approve(patch_id, *, approved_by="human") -> AgentConfigPatch` — apply an approved patch
- `rollback(patch_id, *, reason="manual") -> AgentConfigPatch` — revert to `before` snapshot
- `evolution_history(*, status=None, limit=None) -> list[AgentConfigPatch]`
- `inspect_evolution(*, limit=20) -> list[dict]`

### `AgentConfigPatch`

Key fields: `patch_type`, `description`, `changes`, `patch_id`, `before`, `after`, `eval_score`, `baseline_score`, `status`, `requires_human_approval`, `rollout_pct`, `rollback_of`, `signature`. Methods: `sign(secret="")`, `verify(secret="")`, `to_dict()`, `from_dict()`.

### `EvolutionCycleResult`

| Field | Type | Description |
|---|---|---|
| `patch` | `AgentConfigPatch \| None` | The candidate that was acted on |
| `status` | `PatchStatus` | Outcome of the cycle |
| `reason` | `str \| None` | Explanation when blocked/rejected |
| `eval_result` | `EvalSuiteResult \| None` | Candidate eval scores |

---

## See also

- [Agents overview](overview)
- [Agent federation](federation)
- [Reasoning agent](reasoning-agent)
