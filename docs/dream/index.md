---
sidebar_position: 1
title: "Dream Mode — Local-First Overnight Self-Reflection"
description: "Opt-in overnight runner that replays signed audit traces, distills lessons, proposes memory patches for review, and emits a signed briefing."
---

# Dream Mode

Dream Mode is an explicit, opt-in runner for overnight self-reflection. While the machine is idle and plugged in, it replays the day's **signed** audit traces, distills durable lessons, proposes (never auto-applies) `LivingMemory` patches, refreshes `KnowledgeMesh` state, flags stale memories for review, and emits a signed audit bundle plus a concise morning briefing. It exists so an agent's memory and knowledge mesh get consolidated between sessions without any cloud round trip and without silently rewriting anything while you're not looking.

Everything about it is gated. Constructing `DreamMode` starts no background task. Memory patches stay pending for human review. Entity consolidation is report-only. The scheduler fails closed when power state is unknown or the machine is unplugged. Token and transcript limits bound how much overnight work happens in one run, and an injectable model backend (for example `EdgeRuntime`) keeps inference local if you want lesson distillation to use a model at all.

**Import:**
```python
from synapsekit.dream import DreamConfig, DreamMode, DreamStateStore, render_briefing
```

---

## Quickstart

```python
import asyncio
from synapsekit.dream import DreamConfig, DreamMode

async def main():
    mode = DreamMode(
        config=DreamConfig(
            schedule="idle_30m or 02:00",
            budget_tokens=100_000,
            stale_after_days=90,
        ),
        memory_paths=["MEMORY.md"],
    )
    try:
        result = await mode.run_once(force=True)
        print(mode.morning_briefing(result))
    finally:
        mode.close()

asyncio.run(main())
```

`run_once` is the one method that does real work: it checks the power/idle gate (unless `force=True`), replays the last `lookback_hours` of local audit traces plus any explicit `trace_bundles`, distills lessons, proposes memory patches, reindexes the mesh if one was passed, scans for stale memories, and writes a signed audit bundle. It returns a `DreamRunResult` whether the run completed, was skipped, or failed. `run_forever()` polls the schedule and calls `run_once` when due, until `stop()` is called.

---

## Safety gating

Dream Mode is designed so nothing happens by surprise:

- **Construction is inert.** Building a `DreamMode` instance never starts a task, spawns a thread, or touches memory files. Work only happens inside an explicit `run_once()`/`run_forever()` call.
- **Memory patches stay pending.** When `memory_paths` are configured (or a `LivingMemory` instance is passed directly), Dream Mode calls `propose_from_session(...)` with `require_approval=True` — patches land in the normal pending-for-review queue, exactly like any other proposal. Dream Mode never approves its own patches.
- **Entity consolidation is report-only.** Mesh duplicate candidates come back as `MeshConsolidation` entries (`left_path`, `right_path`, `score`, `reason`) for you to read. Nothing is merged automatically.
- **Stale memories are flagged, never deleted.** `StaleMemory` entries (`path`, `age_days`, `reason`, last-read/last-modified timestamps) are informational only.
- **The scheduler fails closed.** If `require_plugged_in` is true (the default) and power state can't be determined (`PowerStatus.known=False`) or the machine is on battery, `run_once` returns a `skipped` result instead of running. The same check gates `run_forever`'s poll loop.
- **Work is bounded.** `DreamConfig.budget_tokens` and `max_trace_chars` cap how much transcript gets fed to a model; if the bound would be exceeded, distillation silently falls back to `DeterministicLessonDistiller` (a non-LLM heuristic) instead of skipping the run.

---

## `DreamConfig`

| Field | Default | Description |
|---|---|---|
| `schedule` | `"idle_30m or 02:00"` | `idle_<N>m` / `idle_<N>s` and/or `HH:MM` clock triggers, joined with `or` |
| `budget_tokens` | `100_000` | Token ceiling for one run's lesson distillation |
| `tasks` | all four `DEFAULT_TASKS` | Subset of `distill_lessons`, `propose_memory_patches`, `consolidate_entities`, `prune_stale` |
| `lookback_hours` | `24.0` | How far back to replay local audit traces |
| `stale_after_days` | `90` | Age threshold for flagging a memory file as stale |
| `max_trace_chars` | `120_000` | Character cap on the trace transcript fed to distillation |
| `idle_after_seconds` | `1800` | Default idle threshold used by `idle` (no explicit duration) in `schedule` |
| `poll_seconds` | `60.0` | Poll interval for `run_forever` |
| `require_plugged_in` | `True` | Fail closed unless power state is known and plugged in |
| `state_path` | `~/.synapsekit/dream/state.sqlite3` | SQLite trace/run store |
| `audit_dir` | `~/.synapsekit/dream/audit` | Where signed audit bundles are written |
| `signing_key_path` | `None` | Override for the persisted Ed25519 signing key (defaults to `<state_path parent>/signing_key`) |

---

## CLI

```bash
# Run one bounded cycle now (bypasses the schedule; power policy still applies).
synapsekit dream run --force

# Run respecting the configured schedule, with a knowledge mesh attached.
synapsekit dream run --mesh-root . --memory-path MEMORY.md --schedule "idle_30m or 02:00"

# Print the most recent briefing (read-only; never generates a signing key).
synapsekit dream status
```

| Command | Key options | Description |
|---|---|---|
| `run` | `--state-path`, `--audit-dir`, `--trace-bundle` (repeatable), `--memory-path` (repeatable), `--mesh-root` (repeatable), `--schedule`, `--budget-tokens`, `--stale-after-days`, `--force`, `--json` | Run one bounded Dream Mode cycle |
| `status` | `--state-path`, `--json` | Show the latest local briefing without running anything |

`dream status` reads through `DreamStateStore` directly rather than constructing a `DreamMode`, so checking status never generates a signing key or otherwise touches the write path.

---

## Attestation

Dream Mode persists a per-install Ed25519 signing key (mode `0600`) at `<state dir>/signing_key`, or wherever `DreamConfig.signing_key_path` points. Because every night's audit bundle is signed by the *same* key, you can pin it once and get real non-repudiation on later verification:

```python
from synapsekit.audit import verify

trusted = mode.trusted_keys()          # {key_id: public_key_bytes}
result = verify(result.audit_path, trusted_keys=trusted)
print(result.verdict)                  # MATCH once the key is pinned
```

Without `trusted_keys`, `verify()` caps the outcome at `UNVERIFIABLE` by design — a self-signed bundle proves internal consistency, not authenticity. `DreamRunResult.audit_key_id` and `audit_attestable` record whether the bundle came from a persisted (attestable) key or an ephemeral fallback, and `morning_briefing`/`render_briefing` surface that directly: an attestable run prints the key id to verify with, a non-attestable one prints a warning to set `signing_key_path`. Pass your own `signing_policy=` to `DreamMode(...)` to bring your own key (BYOK/KMS) instead of the default persisted-ephemeral-key behavior.

---

## SynapseKit Live

Every `run_once` call publishes a `dream.run` event to [SynapseKit Live](../observability/live.md) with the outcome (`completed`/`skipped`/`failed`), trace/lesson/patch counts, whether the mesh was reindexed, how many stale memories were flagged, and the audit bundle path — or the skip reason when the run didn't happen. This is how overnight reflection shows up in the glass-box dashboard even though it runs unattended.

---

## API reference

| Symbol | Kind | Purpose |
|---|---|---|
| `DreamMode` | class | Orchestrates one bounded reflection cycle or a polling loop |
| `DreamConfig` | dataclass | Resource and policy settings |
| `DreamRunResult` | dataclass | Serializable result of one run (status, lessons, patch ids, audit path, ...) |
| `DreamStateStore` | class | Local SQLite store for traces and past run results |
| `DreamSchedule` / `DreamScheduler` | class | Parses and evaluates `idle_30m or 02:00`-style schedules |
| `SystemPowerMonitor` / `SystemIdleMonitor` | class | Standard-library power/idle providers (injectable) |
| `Lesson` | dataclass | A distilled, evidence-linked lesson (`text`, `theme`, `confidence`, `evidence_event_ids`) |
| `StaleMemory` | dataclass | A memory file flagged for review (never deleted) |
| `MeshConsolidation` | dataclass | A duplicate/entity candidate surfaced for review |
| `PowerStatus` | dataclass | `plugged_in`, `battery_percent`, `known` |
| `TraceWindow` | dataclass | The bounded local time window replayed by a run |
| `render_briefing(result)` | function | Render a `DreamRunResult` (or `None`) as a terminal briefing |
| `load_dream_report(path)` | function | Load a JSON report from a local path |

---

## See also

- [Living Memory](../memory/living-memory.md) — the pending-patch review queue Dream Mode proposes into
- [Personal Knowledge Mesh](../mesh/index.md) — the mesh Dream Mode reindexes and flags duplicates in
- [Audit & verification](../audit/index.md) — `AuditTracer`, `ReplayEngine`, and `verify()`
