---
sidebar_position: 16
---

# Digital Twin Agent

Learns your authentic writing voice and drafts commit messages, PR descriptions, and code reviews that sound like you — never auto-sending anything you have not gated as safe. `DigitalTwinAgent` distills your text samples into a versioned `StyleProfile` (tone, structure, vocabulary, review style), generates drafts through your LLM, and scores every candidate with a `VoiceMatcher` (n-gram overlap, vocabulary match, structure match, plus an optional LLM judge). An enforced `DelegationPolicy` gates dispatch: `never_send_auto` channels are hard-blocked, and `draft_with_approval` channels refuse to send without an explicit human approval token.

**Import:**
```python
from synapsekit.twin import (
    DigitalTwinAgent,
    StyleProfile,
    LearnedPatterns,
    VoiceMatcher,
    VoiceMatchResult,
    DelegationPolicy,
    DelegationLevel,
    DraftResult,
    ApprovalRequiredError,
    AutoSendForbiddenError,
)
```

No extra dependency beyond the LLM providers you already use. The style profile is a plain, human-editable Markdown file.

---

## Quickstart

The example below is fully offline and deterministic — it uses a hand-written fake LLM (mirroring the pattern in the test suite), so no API keys are required.

```python
import asyncio
from collections.abc import AsyncGenerator
from typing import Any

from synapsekit.llm.base import BaseLLM, LLMConfig
from synapsekit.twin import DigitalTwinAgent, AutoSendForbiddenError


class FakeLLM(BaseLLM):
    """Deterministic stand-in for a real LLM provider."""

    def __init__(self, response: str) -> None:
        super().__init__(LLMConfig(model="fake", api_key="", provider="fake"))
        self.response = response

    async def stream(self, prompt: str, **kw: Any) -> AsyncGenerator[str, None]:
        yield self.response


async def main() -> None:
    agent = DigitalTwinAgent(
        profile_path="/tmp/twin_style.md",
        llm=FakeLLM(response="feat: add digital twin agent"),
        reference_samples=["feat: add cool feature", "fix: squash flaky test"],
    )

    # 1. Learn a versioned StyleProfile from your writing samples.
    patterns = await agent.learn(["pls ship this change thx", "- item one\n- item two"])
    print(patterns.tone)                 # "casual"
    print(agent.profile.version)         # 2  (version bumps on every save)

    # 2. Draft a commit message in your voice.
    result = await agent.draft_commit_message("diff --git a/file.py b/file.py")
    print(result.content)                # "feat: add digital twin agent"
    print(result.channel)                # "commit_messages"
    print(result.delegation_level)       # "draft"
    print(result.requires_approval)      # False
    print(round(result.confidence, 3))   # voice-match score in [0.0, 1.0]
    print(result.attribution)            # "drafted by twin v2"

    # 3. commit_messages is a 'draft' channel — sending is allowed.
    await agent.send(result)

    # 4. An 'emails' channel is never_send_auto — even approved=True is refused.
    email_draft = await agent.draft("emails", "Draft a status email")
    try:
        await agent.send(email_draft, approved=True)
    except AutoSendForbiddenError as err:
        print("blocked:", err)


asyncio.run(main())
```

For production use, pass a real provider instead of the fake LLM — either an explicit `llm=` instance or a `model` / `provider` / `api_key` for the built-in factory:

```python
agent = DigitalTwinAgent(
    profile_path="~/.synapsekit/twin/style.md",
    model="gpt-4o-mini",
    api_key="sk-...",
)
```

If no LLM is available (or a stream fails), the agent falls back to a deterministic template draft so drafting never hard-crashes.

---

## Learning a style profile

`StyleProfile` manages a versioned, human-editable Markdown file (`style.md` by default at `~/.synapsekit/twin/style.md`). Calling `agent.learn(samples)` appends the samples to the agent's reference set and runs `StyleProfile.update_from_samples`, which extracts a `LearnedPatterns` snapshot and saves it:

```python
patterns = await agent.learn([
    "pls ship this change thx!",
    "- item 1\n- item 2\n- item 3",
])
# patterns.tone == "casual"; patterns.structure == "bulleted"
```

`LearnedPatterns` captures:

- `tone` — e.g. `"neutral"`, `"casual"`, `"formal"` (heuristic detection from markers like `pls`/`lgtm` vs `furthermore`/`hereby`)
- `structure` — `"bulleted"` or `"prose"`
- `vocabulary` — a `dict` of avoided → preferred word mappings (e.g. `{"deploy": "ship"}`)
- `code_conventions` — a list of coding preferences (e.g. `"prefers explicit types"`)
- `review_style` — e.g. `"holistic"`

Every `save` (including via `update_from_samples`) **increments the version** — a fresh profile starts at version 1, and its first saved update is version 2. The profile round-trips through Markdown, so you can hand-edit `style.md` and reload it:

```python
from synapsekit.twin import StyleProfile, LearnedPatterns

profile = StyleProfile("/tmp/style.md")
await profile.save(LearnedPatterns(tone="formal", structure="prose"))
assert profile.version == 2

reloaded = StyleProfile("/tmp/style.md")
loaded = await reloaded.load()
assert loaded.tone == "formal"
```

All file IO is async and offloaded off-thread (`load`, `save`, `update_from_samples` are coroutines), keeping the framework async-first.

---

## Drafting in your voice

Three channel-specific helpers wrap the generic `draft(channel, prompt)` method:

```python
commit = await agent.draft_commit_message(diff)
pr     = await agent.draft_pr_description(diff, title="Digital Twin Feature")
review = await agent.draft_review(diff, context="focus on the delegation gate")
```

Each builds a style-aware prompt from the current `LearnedPatterns`, streams the LLM response (or falls back to a template), scores the result with the `VoiceMatcher`, and returns a `DraftResult`:

| Field | Meaning |
|---|---|
| `content` | The generated draft text |
| `channel` | The logical channel (e.g. `"commit_messages"`, `"pr_descriptions"`, `"pr_reviews"`) |
| `delegation_level` | The gate level for this channel |
| `requires_approval` | `True` unless the channel is a free `"draft"` level |
| `twin_version` | The `StyleProfile` version used |
| `attribution` | Provenance string, e.g. `"drafted by twin v2"` |
| `confidence` | The `VoiceMatcher` score in `[0.0, 1.0]` |
| `reference_samples_used` | How many reference samples informed the match |

`DraftResult.to_dict()` returns a JSON-friendly dict for logging or dashboards.

---

## Scoring voice match

`VoiceMatcher` scores how closely a candidate draft matches your reference samples and learned patterns. It combines three heuristic signals — **n-gram (bigram) overlap** (40%), **vocabulary match** (30%), and **structure match** (30%) — and, when an LLM is provided, averages the heuristic score with an **LLM judge** score:

```python
from synapsekit.twin import VoiceMatcher, LearnedPatterns

matcher = VoiceMatcher(llm=None)   # heuristics only
res = await matcher.evaluate(
    candidate="- ship the feature now",
    reference_samples=["ship the feature now thx"],
    patterns=LearnedPatterns(tone="casual", structure="bulleted", vocabulary={"deploy": "ship"}),
)
print(res.score)             # composite score in [0.0, 1.0]
print(res.ngram_overlap)     # bigram overlap with references
print(res.vocabulary_match)  # fraction of preferred terms used
print(res.structure_match)   # 1.0 when structure matches the profile
```

`VoiceMatchResult` fields: `score`, `ngram_overlap`, `vocabulary_match`, `structure_match`, and a `details` dict (`heuristic_score`, `llm_score`). A genuinely empty candidate scores a hard `0.0` (not a misleading mid-confidence value). An out-of-range LLM judge score is clamped into `[0.0, 1.0]`, and a non-numeric judge response falls back to `0.8`.

From an agent, use the convenience wrapper:

```python
match = await agent.evaluate_voice_match("- ship feature thx")
print(match.score)
```

---

## Delegation policy and the send gate

`DelegationPolicy` maps each channel to one of three `DelegationLevel` values, and `agent.send(...)` enforces them. This is the safety boundary that prevents the twin from ever auto-sending something you did not authorize.

| Level | `send` behavior |
|---|---|
| `"draft"` | May be sent freely |
| `"draft_with_approval"` | Refuses unless `approved=True` is passed (raises `ApprovalRequiredError`) |
| `"never_send_auto"` | Always refuses — even with `approved=True` (raises `AutoSendForbiddenError`) |

The default policy:

```python
from synapsekit.twin import DelegationPolicy

policy = DelegationPolicy()   # defaults below
# commit_messages = "draft"
# pr_descriptions = "draft"
# pr_reviews      = "draft_with_approval"
# emails          = "never_send_auto"
```

Enforcement in practice — the default (`approved=False`) is safe, so any gated channel refuses:

```python
# draft_with_approval: refused without a token, allowed with one
review = await agent.draft("pr_reviews", "Draft a review")
try:
    await agent.send(review)                # raises ApprovalRequiredError
except ApprovalRequiredError:
    ...
await agent.send(review, approved=True)     # explicit human approval -> OK

# never_send_auto: hard block, no override
email = await agent.draft("emails", "Draft an email")
try:
    await agent.send(email, approved=True)  # still raises AutoSendForbiddenError
except AutoSendForbiddenError:
    ...
```

You can inspect a channel's gating without sending:

```python
policy.can_auto_send("commit")          # True   (draft level)
policy.requires_human_approval("pr_review")  # True   (draft_with_approval)
policy.is_send_forbidden("email")       # True   (never_send_auto)
```

Pass a custom policy to tighten or relax the defaults:

```python
agent = DigitalTwinAgent(
    profile_path="~/.synapsekit/twin/style.md",
    delegation=DelegationPolicy(pr_descriptions="draft_with_approval"),
)
```

---

## API reference

### `DigitalTwinAgent(profile_path="~/.synapsekit/twin/style.md", delegation=None, reference_samples=None, *, llm=None, model="gpt-4o-mini", api_key="", provider=None)`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `profile_path` | `str` | `"~/.synapsekit/twin/style.md"` | Path to the versioned `style.md` profile |
| `delegation` | `DelegationPolicy \| None` | `None` | Send-gate policy (defaults to `DelegationPolicy()`) |
| `reference_samples` | `Sequence[str] \| None` | `None` | Initial writing samples for voice matching |
| `llm` | `BaseLLM \| None` | `None` | Explicit LLM; if omitted, one is built from `model`/`api_key`/`provider` |
| `model` | `str` | `"gpt-4o-mini"` | Model id for the default LLM factory |
| `api_key` | `str` | `""` | API key for the default LLM factory |
| `provider` | `str \| None` | `None` | Provider hint for the default LLM factory |

### `DigitalTwinAgent` methods

- `async learn(samples) -> LearnedPatterns` — append samples and update the versioned profile
- `async draft_commit_message(diff) -> DraftResult`
- `async draft_pr_description(diff, title="") -> DraftResult`
- `async draft_review(diff, context="") -> DraftResult`
- `async draft(channel, prompt_or_content) -> DraftResult` — generic drafting with voice matching
- `async evaluate_voice_match(candidate) -> VoiceMatchResult`
- `async send(draft_result, channel=None, *, approved=False) -> DraftResult` — enforce the delegation gate; returns the draft unchanged on success

### `StyleProfile(profile_path="~/.synapsekit/twin/style.md")`

Properties: `version` (`int`), `patterns` (`LearnedPatterns`). Methods:

- `async load() -> LearnedPatterns` — read patterns and version from disk (off-thread)
- `async save(patterns=None) -> None` — write and **increment** the version (off-thread)
- `async update_from_samples(samples) -> LearnedPatterns` — extract patterns from samples and save

### `LearnedPatterns`

Fields: `tone="neutral"`, `structure="bulleted"`, `vocabulary` (`dict[str, str]`), `code_conventions` (`list[str]`), `review_style="holistic"`. Methods: `to_dict()`, `from_dict(data)`.

### `VoiceMatcher(llm=None)`

- `async evaluate(candidate, reference_samples, patterns=None) -> VoiceMatchResult`

### `VoiceMatchResult`

Fields: `score` (`float`), `ngram_overlap` (`float`), `vocabulary_match` (`float`), `structure_match` (`float`), `details` (`dict`).

### `DelegationPolicy`

Fields (all `DelegationLevel`): `commit_messages="draft"`, `pr_descriptions="draft"`, `pr_reviews="draft_with_approval"`, `emails="never_send_auto"`. Methods:

- `get_level(channel) -> DelegationLevel`
- `can_auto_send(channel) -> bool` — `True` only for `"draft"`
- `requires_human_approval(channel) -> bool` — `True` for `"draft_with_approval"`
- `is_send_forbidden(channel) -> bool` — `True` for `"never_send_auto"`

`DelegationLevel` is `Literal["draft", "draft_with_approval", "never_send_auto"]`.

### `DraftResult`

Fields: `content`, `channel`, `delegation_level`, `requires_approval`, `twin_version`, `attribution`, `confidence=0.0`, `reference_samples_used=0`. Method: `to_dict()`.

### Exceptions

- `AutoSendForbiddenError` (`PermissionError`) — raised by `send` on a `never_send_auto` channel
- `ApprovalRequiredError` (`PermissionError`) — raised by `send` on a `draft_with_approval` channel without `approved=True`

---

## See also

- [Agents overview](overview)
- [Self-improving agent](self-improving)
