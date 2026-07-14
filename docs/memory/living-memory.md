---
sidebar_position: 5
title: "Living Memory"
description: "File-routed agent memory that proposes signed, reviewable diffs instead of silently overwriting."
---

# Living Memory

Living Memory manages an agent's persistent memory files (e.g. `CLAUDE.md`, project notes, user preferences) as **signed, diffable patches** rather than blind overwrites. After a session, a proposer LLM analyzes the transcript, extracts durable facts, and produces `MemoryPatch` objects — each a full before/after diff with a rationale, evidence, category, and a SHA-256 signature. Patches default to a `pending` state for human review, are routed to the right file by content, and are PII-filtered before anything touches disk. Every change is auditable, reversible, and never silently applied.

**Install:** no extra needed — Living Memory uses only the standard library and SynapseKit's core guardrails.

**Import:**
```python
from synapsekit.memory import (
    LivingMemory,
    MemoryPatch,
    MemoryFileRouter,
    MemoryPIIFilter,
    OccurrenceTracker,
    PatchStore,
    FileDiffEngine,
)
```

---

## Quickstart

```python
import asyncio
from synapsekit import OpenAILLM, LLMConfig
from synapsekit.memory import LivingMemory

async def main():
    memory = LivingMemory(
        paths=["./CLAUDE.md", "./memory/*.md"],
        proposer=OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-...")),
        require_approval=True,          # patches land as "pending"
        occurrence_threshold=3,         # a fact must recur 3× before proposing
    )

    # 1. Propose patches from a finished session's transcript.
    patches = await memory.propose_from_session(
        session_id="sess-42",
        transcript="user: I always deploy with uv, never poetry.\n...",
    )

    # 2. Review each proposed diff.
    for patch in memory.pending_patches():
        review = memory.review(patch)
        print(review["diff"], review["rationale"])

    # 3. Apply the ones you trust; revert later if needed.
    if patches:
        applied = memory.apply(patches[0])
        # memory.revert(applied.patch_id)

asyncio.run(main())
```

---

## The patch lifecycle

Living Memory never edits a memory file directly. A proposal flows through a fixed lifecycle, and each transition re-signs the patch and appends it to the store:

```
propose ──▶ pending ──▶ (apply) ──▶ applied ──▶ (revert) ──▶ reverted
                │
                └──▶ conflict   (file changed since the patch was proposed)
```

`MemoryPatch.status` is one of `pending`, `approved`, `applied`, `rejected`, `reverted`, or `conflict`.

- **propose** — `propose_from_session()` runs the proposer LLM, applies the occurrence threshold and PII filter, and stores a `MemoryPatch`. With `require_approval=True` (default) the status is `pending`; with `require_approval=False` it is applied immediately.
- **review** — `review(patch)` returns a dict with the unified diff, rationale, evidence, category, line-change stats, and whether the signature is valid — ready to render in a CLI or editor.
- **apply** — `apply(patch)` first checks the target file hasn't diverged since the patch was proposed. If it has, the patch is marked `conflict` and nothing is written; otherwise the `after` content is written and the status becomes `applied`.
- **revert** — `revert(patch_id)` restores the file to the patch's `before` content and marks it `reverted`.

```python
memory.apply("a1b2c3d4e5f6")            # by patch_id or MemoryPatch
history = memory.patch_history(limit=20)
memory.revert("a1b2c3d4e5f6")
```

Patches are persisted to an append-only JSONL `PatchStore` (default `.synapsekit_memory_patches.jsonl`); status changes append a new line and queries return the latest version per `patch_id`.

---

## File routing

`MemoryFileRouter` decides *which* memory file a new fact belongs in by scoring its content against keyword signals, then resolving that category to a concrete path.

| Category | Signals (examples) |
|---|---|
| `user` | "prefers", "always use", "my workflow", "I like/want" |
| `feedback` | "correction", "fixed", "wrong", "mistake", "better to" |
| `project` | "architecture", "stack", "dependency", "convention", "codebase" |
| `general` | fallback when nothing else matches |

```python
from synapsekit.memory import MemoryFileRouter

router = MemoryFileRouter(
    path_map={"user": "./memory/user_prefs.md", "project": "./memory/project.md"},
    primary_path="./CLAUDE.md",
)
category = router.categorize("I always deploy with uv")          # "user"
target = router.resolve_target_path(category, managed_paths)     # resolved file
```

Resolution order: an explicit `path_map` entry, then a managed file whose basename starts with the category name (e.g. `user_prefs.md`), then the `primary_path` fallback.

---

## PII filtering before disk

`MemoryPIIFilter` redacts sensitive data from proposed content **before** it is written to a memory file — so persisted memory never contains raw PII. It builds on the guardrails `PIIDetector` and adds active redaction with placeholder tokens.

```python
from synapsekit.memory import MemoryPIIFilter

pii = MemoryPIIFilter()   # email, phone, ssn, credit_card, ip_address, api_key
result = pii.filter_content("ping me at ada@corp.com or 555-123-4567")
print(result.is_clean)          # False
print(result.filtered_content)  # "ping me at [REDACTED_EMAIL] or [REDACTED_PHONE]"
print(result.redaction_types)   # ["email", "phone"]
```

`LivingMemory` runs this filter on every proposal automatically; `filter_content` returns a `PIIFilterResult` with `is_clean`, `filtered_content`, `redacted_count`, and `redaction_types`. Pass `redact=False` to report findings without modifying the text.

---

## Occurrence tracking

To avoid polluting memory from a single stray remark, `OccurrenceTracker` requires a fact to be observed at least `occurrence_threshold` times (across sessions) before a patch is proposed. Each fact is keyed by a stable `fact_key` and its count, first/last-seen timestamps, and sample evidence are persisted.

```python
from synapsekit.memory import OccurrenceTracker

tracker = OccurrenceTracker(".synapsekit_memory_occurrences.json")
tracker.record_occurrence("deploy_tool_uv", session_id="sess-42", evidence="uses uv")
tracker.has_reached_threshold("deploy_tool_uv", threshold=3)   # False until seen 3×
```

`LivingMemory` wires this in for you — a proposal below threshold is deferred, not dropped, so it can mature over future sessions.

---

## CLI

Manage the patch store from the terminal. All commands accept `--store-path` (default `.synapsekit_memory_patches.jsonl`).

```bash
# List pending patches (or one in detail with --patch-id)
synapsekit memory review
synapsekit memory review --patch-id a1b2c3d4e5f6

# Apply a pending patch to its target file
synapsekit memory apply a1b2c3d4e5f6

# Revert a previously applied patch
synapsekit memory revert a1b2c3d4e5f6

# View patch history (filter by status, JSON output for CI)
synapsekit memory log --status applied --limit 20
synapsekit memory log --format json
```

`memory apply` re-validates that the file hasn't diverged before writing, re-signs the patch, and records the new status. `memory revert` only works on a patch whose status is `applied`.

---

## API reference

| Symbol | Kind | Purpose |
|---|---|---|
| `LivingMemory(paths, proposer=None, *, require_approval=True, sign=True, signature_secret="", store_path=..., occurrence_path=..., occurrence_threshold=3, pii_filter=None, file_router=None)` | class | Orchestrates the propose/review/apply/revert lifecycle |
| `LivingMemory.propose_from_session(session_id, *, transcript=None, session_records=None)` | async method | Analyze a session and store proposed patches |
| `LivingMemory.review(patch)` | method | Return a diff + metadata dict for a patch (by id or object) |
| `LivingMemory.apply(patch)` | method | Apply a `pending`/`approved` patch after a conflict check |
| `LivingMemory.revert(patch_id)` | method | Restore the file to a patch's `before` content |
| `LivingMemory.pending_patches()` / `patch_history(*, status=None, limit=None)` | method | Query stored patches |
| `MemoryPatch` | dataclass | A proposed diff with `file_path`, `unified_diff`, `rationale`, `category`, `status`, `signature`; `.sign(secret)`, `.verify(secret)` |
| `PatchStatus` | type | `pending`/`approved`/`applied`/`rejected`/`reverted`/`conflict` |
| `MemoryFileRouter(path_map=None, *, primary_path="./CLAUDE.md", allow_new_files=False)` | class | `.categorize(text)`, `.resolve_target_path(category, managed_paths)` |
| `MemoryPIIFilter(detect=None, *, redact=True)` | class | `.filter_content(text) -> PIIFilterResult`, `.check(text)` |
| `OccurrenceTracker(path=None)` | class | `.record_occurrence(...)`, `.has_reached_threshold(...)`, `.get_count(...)` |
| `PatchStore(path)` | class | Append-only JSONL patch store; `.save`, `.update`, `.get`, `.list_by_status`, `.pending_patches` |
| `FileDiffEngine` | class | Static helpers: `.generate_unified_diff`, `.validate_patch_applicable`, `.apply_patch`, `.revert_to_content`, `.count_changed_lines` |

---

## See also

- [Verifiable Agents](../audit/) — cryptographically signed audit trails
- [Conversation memory](conversation)
- [Guardrails](../guardrails/overview)
