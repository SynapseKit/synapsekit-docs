---
sidebar_position: 19
---

# Code Archaeology Agent

Answer "why does this code exist in its current form?" by fusing evidence across sources, not just the current diff. `ArchaeologyAgent` merges git history with local markdown notes and, optionally, Slack and email archives into one chronological timeline, extracts a version-level rationale trail for a file or symbol, asks an LLM to identify cause-to-effect claims across that timeline, and returns a cited markdown narrative you can hand to a teammate instead of re-deriving the history yourself.

It reuses the `timetravel` module's `GitBackend` and `EvolutionIndex` (the same building blocks behind [Time-Travel Codebase](./time-travel.md)), the `SlackLoader` / `EmailLoader` from `synapsekit.loaders`, and `synapsekit.symbolic` for optional claim verification. No new hard dependency is introduced.

**Import:**
```python
from synapsekit.archaeology import (
    ArchaeologyAgent,
    ArchaeologyResult,
    SourceConfig,
    TimelineReconstructor,
    EvolutionDiff,
    CausalLinker,
    TimelineEvent,
    EvolutionSnapshot,
    CausalClaim,
    Citation,
)
```

---

## Quickstart

```python
import asyncio
from synapsekit.archaeology import ArchaeologyAgent, SourceConfig

async def main():
    agent = ArchaeologyAgent(
        sources=SourceConfig(
            repo_path=".",
            markdown_roots=["docs/notes"],   # optional local markdown notes
        ),
        model="gpt-4o-mini",
        api_key="sk-...",
    )

    result = await agent.explain("why was the retry logic added to the HTTP client?")

    print(result.narrative)         # LLM narrative citing specific evidence
    print(len(result.timeline))     # merged chronological events
    print(len(result.causes))       # causal claims (cause -> effect)
    print(len(result.evolution))    # version-level snapshots with rationale
    print(result.to_markdown())     # full report: summary + timeline + causes + citations

asyncio.run(main())
```

`ArchaeologyAgent(sources=None, *, llm=None, model="gpt-4o-mini", api_key="", provider=None, causal_engine=None)` builds an `SourceConfig()` default (git only, no Slack/email/markdown) if `sources` is omitted, and constructs an LLM from `model`/`api_key`/`provider` if `llm` is not passed directly. If LLM construction fails, the agent logs a warning and falls back to timeline-only mode: `explain()` still returns a populated timeline and evolution trace, just with an empty `causes` list and no `narrative`.

---

## The pipeline behind `explain()`

`ArchaeologyAgent.explain(query)` runs four phases:

1. **Timeline reconstruction.** `TimelineReconstructor.reconstruct(query, ...)` fetches events from every configured source concurrently (git, Slack, email, markdown), tags each with a `Citation`, sorts them chronologically, and returns up to `max_events`.
2. **Causal linking and evolution diff, concurrently.** `CausalLinker.link(timeline, query)` and `EvolutionDiff.trace(query)` run together via `asyncio.gather`, since neither depends on the other's output.
3. **Causal linking** asks the LLM to identify cause-to-effect claims from the timeline, matches each claim back to supporting citations, drops claims with fewer than `min_citations_per_claim` citations, and optionally verifies each surviving claim with a `NeuroSymbolicAgent`.
4. **Narrative generation.** If an LLM is available, `_generate_narrative` streams a markdown summary that ties the timeline, causal chain, and evolution trace together into a developer-facing answer.

The result is an `ArchaeologyResult`:

| Field | Type | Description |
|---|---|---|
| `query` | `str` | The original question |
| `timeline` | `list[TimelineEvent]` | Merged chronological events |
| `causes` | `list[CausalClaim]` | Cause → effect claims with citations |
| `evolution` | `list[EvolutionSnapshot]` | Version-level rationale trail |
| `narrative` | `str` | LLM-generated markdown summary |

`result.all_citations` deduplicates citations across timeline, causes, and evolution by `reference`. `result.to_markdown()` renders the full report: a `## Summary` from the narrative, a `## Timeline` with per-event citations, a `## Causal Chain` with confidence and a verified/unverified marker, an `## Evolution History`, and a numbered `## Citations` list.

`ArchaeologyAgent` builds one `EvolutionIndex` and shares it between `TimelineReconstructor` and `EvolutionDiff`, so `explain()` walks git history once per call instead of twice.

---

## Configuring sources

`SourceConfig` controls which sources feed the timeline:

| Field | Type | Default | Description |
|---|---|---|---|
| `repo_path` | `str` | `"."` | Git repo to read |
| `include_git` | `bool` | `True` | Include git history events |
| `markdown_roots` | `list[str]` | `[]` | Directories to search for `*.md` notes |
| `slack_bot_token` | `str \| None` | `None` | Enables Slack events when set together with `slack_channel_ids` |
| `slack_channel_ids` | `list[str]` | `[]` | Channels to search |
| `email_imap_server` / `email_address` / `email_password` | `str \| None` | `None` | Enables email events when all three are set |
| `email_folder` | `str` | `"INBOX"` | IMAP folder to search |
| `mesh` | `Any \| None` | `None` | Optional `KnowledgeMesh` instance |
| `max_events` | `int` | `200` | Cap on merged timeline events |
| `min_citations_per_claim` | `int` | `2` | Minimum citations for a causal claim to survive filtering |

Slack and email are opt-in: each source only activates once its full set of credentials is present, so a bare `SourceConfig(repo_path=".")` produces a git-only (plus markdown, if `markdown_roots` is set) timeline with no external calls.

```python
sources = SourceConfig(
    repo_path=".",
    markdown_roots=["docs/decisions"],
    slack_bot_token="xoxb-...",
    slack_channel_ids=["C0123ABC"],
    email_imap_server="imap.example.com",
    email_address="eng-team@example.com",
    email_password="...",
)
```

---

## Tracing a symbol's evolution directly

`EvolutionDiff.trace(file_or_symbol, *, since=None, until=None, llm=None)` can be used standalone, without the full `explain()` pipeline:

```python
from synapsekit.archaeology import EvolutionDiff

diff = EvolutionDiff(repo_path=".")
snapshots = await diff.trace("AgentRegistry")
for s in snapshots:
    print(s.date, s.version_hash[:8], s.diff_summary)
    print("  why:", s.reason)
```

It resolves search terms against an `EvolutionIndex` (matching file paths or symbols case-sensitively), deduplicates entries by `(commit.hash, file_path, symbol)`, and sorts chronologically. If a query matches nothing, `trace()` returns an empty list rather than silently falling back to the full unfiltered repo history. This matters because `explain()`'s natural-language queries are the common path into this method, and a silent fallback would have buried the real history under every commit in the repo.

---

## Causal claims are a best-effort signal, not a proof

`CausalLinker.link(events, query)` asks the LLM to identify cause-to-effect relationships in the timeline, then optionally passes each surviving claim to a `NeuroSymbolicAgent` via `causal_engine`:

```python
from synapsekit.symbolic import NeuroSymbolicAgent
from synapsekit.archaeology import ArchaeologyAgent, SourceConfig

agent = ArchaeologyAgent(
    sources=SourceConfig(repo_path="."),
    causal_engine=NeuroSymbolicAgent(),
)
result = await agent.explain("why did we switch to connection pooling?")
for claim in result.causes:
    print(claim.cause, "->", claim.effect, claim.confidence, claim.verified)
```

`NeuroSymbolicAgent.solve()` formalizes a problem into an SMT/Prolog/MiniZinc/Sympy constraint program and checks it with a solver, which fits decidable formal problems. Free-text causal claims about code history have no reliable formalization, so `CausalClaim.verified` is a best-effort plausibility signal, not a formal proof. Treat it as informational, not authoritative. Claim verification runs concurrently across all surviving claims via `asyncio.gather`, and a failed verification for one claim does not affect the others; it just leaves that claim's `verified` at its unverified default.

---

## Hardening notes (post-merge fixes)

A handful of correctness issues were fixed after the initial merge (#744):

- **Email timestamps** are now parsed from the real RFC 2822 `Date` header via `email.utils.parsedate_to_datetime` instead of being treated as ISO strings, which had silently corrupted every email-sourced event's timestamp to "now."
- **`EvolutionDiff.trace()`** no longer falls back to the entire unfiltered repo history when a natural-language query doesn't match any file or symbol (the common path via `explain()`), and instead returns an honest empty result.
- **Git history is walked once per `explain()` call**, not twice: `TimelineReconstructor` and `EvolutionDiff` now share a single `EvolutionIndex` instance.
- **Causal-claim verification runs concurrently** via `asyncio.gather` instead of sequentially awaiting each claim.

---

## API reference

### `ArchaeologyAgent(sources=None, *, llm=None, model="gpt-4o-mini", api_key="", provider=None, causal_engine=None)`

| Method | Description |
|---|---|
| `async explain(query) -> ArchaeologyResult` | Full pipeline: timeline, causal chain, evolution trace, narrative |

### `TimelineReconstructor(repo_path=".", *, evolution_index=None)`

| Method | Description |
|---|---|
| `async reconstruct(query, *, include_git=True, slack_bot_token=None, slack_channel_ids=None, email_imap_server=None, email_address=None, email_password=None, email_folder="INBOX", markdown_roots=None, max_events=200) -> list[TimelineEvent]` | Merge events from all configured sources, sorted chronologically |

### `EvolutionDiff(repo_path=".", *, evolution_index=None)`

| Method | Description |
|---|---|
| `async trace(file_or_symbol, *, since=None, until=None, llm=None) -> list[EvolutionSnapshot]` | Version-level rationale trail for a file or symbol |

### `CausalLinker(llm, *, verifier=None, min_citations=2)`

| Method | Description |
|---|---|
| `async link(events, query) -> list[CausalClaim]` | Extract and (optionally) verify cause → effect claims from a timeline |

### `Citation`

Frozen dataclass: `source_type` (`"git" \| "markdown" \| "slack" \| "email" \| "mesh"`), `reference`, `content_preview`, `timestamp`, `metadata`.

### `TimelineEvent`

Frozen dataclass: `timestamp`, `source_type`, `summary`, `citations`, `metadata`.

### `CausalClaim`

Frozen dataclass: `cause`, `effect`, `confidence` (`0.0`-`1.0`), `citations`, `verified` (`bool`), `reasoning`.

### `EvolutionSnapshot`

Frozen dataclass: `version_hash`, `date`, `diff_summary`, `reason`, `citations`.

### `ArchaeologyResult`

| Field | Type | Description |
|---|---|---|
| `query` | `str` | Original question |
| `timeline` | `list[TimelineEvent]` | Merged chronological events |
| `causes` | `list[CausalClaim]` | Cause → effect claims |
| `evolution` | `list[EvolutionSnapshot]` | Version-level rationale trail |
| `narrative` | `str` | LLM-generated markdown summary |

Properties/methods: `all_citations` (deduplicated by `reference`), `to_markdown()` (full report).

---

## See also

- [Time-Travel Codebase](./time-travel.md)
- [Neuro-symbolic agent](./neuro-symbolic)
- [Agents overview](./overview)
