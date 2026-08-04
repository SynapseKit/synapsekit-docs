---
sidebar_position: 17
---

# Time-Travel Codebase

Reason across a repository's entire evolution — not just its current state. `TimeTravelAgent` wraps a git repo behind a `GitBackend`, parses commit history into an AST-based `EvolutionIndex` (symbol- and file-level change entries with `#NNN` PR linkage), flags stale abstractions with a `DriftDetector`, and turns diff timelines into readable markdown with a `DiffNarrativeGenerator`. You can scope any query to a point in time with `agent.as_of(date)`, ask natural-language questions about how code got the way it is, and get an LLM (or heuristic) narrative back.

Every git subprocess call is offloaded off the event loop with `asyncio.to_thread`, so the public IO methods stay coroutines and never block your async application.

**Import:**
```python
from synapsekit.timetravel import (
    TimeTravelAgent,
    GitBackend,
    EvolutionIndex,
    EvolutionEntry,
    DriftDetector,
    DriftCandidate,
    DiffNarrativeGenerator,
    CommitInfo,
    AsOf,
)
```

Only the standard git CLI is required at runtime — the backend shells out to `git`. An LLM is optional: without one, narratives fall back to a structured heuristic summary.

---

## Quickstart

```python
import asyncio
from synapsekit.timetravel import TimeTravelAgent

async def main():
    # Point at any git repo. An LLM is optional — omit the key and you get
    # the deterministic heuristic narrative instead.
    agent = TimeTravelAgent(repo=".", model="gpt-4o-mini", api_key="sk-...")

    # 1. Natural-language question about how the code evolved
    narrative = await agent.query("how has AgentRegistry changed over time?")
    print(narrative)

    # 2. Chronological timeline for a file or symbol (oldest → newest)
    for entry in await agent.timeline("AgentRegistry"):
        pr = f" (#{entry.pr_number})" if entry.pr_number else ""
        print(f"{entry.commit.date:%Y-%m-%d} [{entry.commit.hash[:7]}]{pr} "
              f"{entry.change_type} {entry.symbol or entry.file_path}")

    # 3. Which abstractions have drifted from their original justification?
    for cand in await agent.detect_drift(min_age_days=0):
        print(f"{cand.symbol}: confidence={cand.confidence:.2f} "
              f"usage {cand.original_usage_count} → {cand.current_usage_count}")
        print("  →", cand.recommendation)

asyncio.run(main())
```

`TimeTravelAgent(repo, *, llm=None, model="gpt-4o-mini", api_key="", provider=None, world_model=None, memory=None)` resolves `repo` to an absolute path and wires up a `GitBackend`, `EvolutionIndex`, and `DriftDetector` for you. If LLM construction fails (no key, unknown provider), the agent silently sets `llm=None` and every narrative uses the heuristic path — so the quickstart above runs even with `api_key=""`.

---

## Asking questions

`await agent.query(question)` builds (or reuses) the evolution index, matches the question's terms against indexed files and symbols, deduplicates, and hands the resulting `EvolutionEntry` list to the narrative generator. The whole blocking git/index pipeline runs via `asyncio.to_thread`, so `query` never blocks the loop.

```python
answer = await agent.query("why was the retry logic added to the HTTP client?")
```

If a `world_model` (`WorldModelRAG`) or `memory` (`LivingMemory`) is attached, their bitemporal-graph context and matching patch rationales are appended under a **Historical Memory & Knowledge Graph Context** section.

---

## Point-in-time scoping with `as_of(date)`

`agent.as_of(date)` returns an `AsOf` context anchored to the commit at or before `date`. `date` accepts a `datetime` or an ISO / `YYYY-MM-DD` string; a date predating all history resolves to the **earliest** commit (not `HEAD`).

```python
from datetime import datetime, UTC

as_of = agent.as_of("2026-01-15")
print(as_of.commit)   # commit hash in effect on that date

# Query the codebase *as it was* on that date
snapshot = await as_of.query("how did authentication work?")

# Timeline and drift, both scoped up to that date
history = await as_of.timeline("AuthManager")
drift   = await as_of.detect_drift("AuthManager")
```

`AsOf.query` returns a markdown report headed `# Codebase State As Of <date> (<commit>)` — listing the tracked-file count, previews of files relevant to the question at that commit, and a narrative built from the timeline up to that date.

---

## The evolution index

`EvolutionIndex.build(...)` walks commit history via `GitBackend.log` and, for each `.py` file, parses the file content at that commit with Python's `ast` module to attach the class / function / async-function names that changed. Each change becomes an `EvolutionEntry`:

| Field | Type | Description |
|---|---|---|
| `file_path` | `str` | File that changed |
| `symbol` | `str \| None` | Class / function name (Python files) or `None` |
| `commit` | `CommitInfo` | `hash`, `author`, `date`, `subject`, `body`, `files_changed` |
| `diff_snippet` | `str` | First ~15 added/removed lines of the diff |
| `change_type` | `"added" \| "modified" \| "deleted" \| "renamed"` | Inferred change kind |
| `lines_added` / `lines_removed` | `int` | Diff line counts |
| `pr_number` | `int \| None` | Parsed from a `#NNN` reference in the commit subject or body |

You can drive the index directly without the agent:

```python
from synapsekit.timetravel import GitBackend, EvolutionIndex

index = EvolutionIndex(GitBackend("."))
index.build()                          # optionally: paths=[...], since=..., until=..., max_count=...
entries  = index.query("AgentRegistry")   # match by symbol or file substring
timeline = index.timeline("agent.py")     # same, sorted oldest → newest
```

---

## Detecting drift

`DriftDetector.detect(...)` groups indexed entries by symbol and, for each, compares how many times the symbol is referenced across the repo at its **first** commit versus at `HEAD` (`GitBackend.list_files` + regex counting per Python file). It scores a confidence from heuristics — few or zero remaining callers, usage dropping below its original count, rationale words like *temporary / workaround / interim / deprecated / todo*, and age over 180 days — and emits a `DriftCandidate` when confidence clears the threshold (or when you name a specific `symbol`).

```python
candidates = await agent.detect_drift(symbol=None, min_age_days=30)
for c in candidates:
    print(c.symbol, c.confidence, c.original_rationale)
    print(c.recommendation)
```

Each `DriftCandidate` carries `symbol`, `file_path`, `original_rationale` (extracted from the introducing commit's subject + body), `current_usage_count`, `original_usage_count`, `first_introduced`, `last_modified`, `confidence`, and a human-readable `recommendation`. Results are sorted by descending confidence.

---

## Generating evolution narratives

`DiffNarrativeGenerator.generate(entries, query, llm=None)` produces the markdown timeline. With an LLM it streams a developer-facing summary (how the code evolved, why, any architectural shift); without one — or on any LLM error — it falls back to `_heuristic_narrative`, a structured markdown block with a timeframe header, a per-commit **Evolution Timeline** (date, short hash, `#PR`, symbol, subject, author, diff preview), and a **Key Changes & Rationale** rollup.

```python
from synapsekit.timetravel import DiffNarrativeGenerator, EvolutionIndex, GitBackend

index = EvolutionIndex(GitBackend("."))
entries = index.query("AgentRegistry")

gen = DiffNarrativeGenerator()          # no LLM → heuristic markdown
print(await gen.generate(entries, "AgentRegistry evolution"))
```

---

## The git backend

`GitBackend(repo_path)` is a thin async-safe wrapper over the `git` CLI. It is what makes everything above point-in-time aware:

- `log(path=None, follow=True, since=None, until=None, max_count=None) -> list[CommitInfo]`
- `diff(commit_a, commit_b="HEAD", path=None) -> str`
- `show(commit, path) -> str` / `file_at(commit, path) -> str` (alias) — file content at a commit
- `find_commit_at(date) -> str` — commit hash at or before a date (earliest commit for pre-history dates)
- `blame(path, commit=None) -> list[dict]` — structured line ownership
- `list_files(commit=None) -> list[str]` — tracked files at a commit or `HEAD`

The backend's methods are synchronous; the agent wraps them in `asyncio.to_thread` from its coroutine methods so nothing blocks the event loop.

---

## API reference

### `TimeTravelAgent(repo=".", *, llm=None, model="gpt-4o-mini", api_key="", provider=None, world_model=None, memory=None)`

| Method | Description |
|---|---|
| `as_of(date) -> AsOf` | Point-in-time context anchored to the commit at/before `date` |
| `async query(question) -> str` | NL question about the repo's evolution → markdown narrative |
| `async timeline(file_or_symbol, since=None, until=None) -> list[EvolutionEntry]` | Chronological change timeline |
| `async detect_drift(symbol=None, min_age_days=0, as_of_date=None) -> list[DriftCandidate]` | Flag drifted abstractions |

### `AsOf`

Dataclass with `agent`, `date`, `commit`. Methods: `async query(question)`, `async detect_drift(symbol)`, `async timeline(file_or_symbol)` — each scoped to `date`.

### `CommitInfo`

Frozen dataclass: `hash`, `author`, `date`, `subject`, `body`, `files_changed`.

---

## See also

- [Self-Improving Agent](self-improving)
- [Agents overview](overview)
- [Reasoning agent](reasoning-agent)
