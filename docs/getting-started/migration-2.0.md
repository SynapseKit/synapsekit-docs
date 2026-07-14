---
sidebar_position: 4
title: "Migrating to 2.0"
description: "Upgrade SynapseKit to 2.0.0: breaking changes for AgentMemory, audit verify(), bundle schema 1.2, and LLM retries — with before/after code and new hardening defaults."
keywords: [synapsekit 2.0 migration, synapsekit breaking changes, AgentMemory AgentScratchpad, audit verify trusted_keys, LLM max_retries, upgrade synapsekit]
---

# Migrating to 2.0

SynapseKit 2.0.0 ships the v2.0/v2.1 paradigm feature set plus a repo-wide production
hardening pass. Most code upgrades cleanly, but a handful of changes are breaking. This
guide gives you a before/after for each, then walks through new defaults that change
behavior without breaking imports.

Read the full [2.0.0 changelog](/docs/changelog) for the complete list.

## Breaking changes

### 1. `AgentMemory` is now the persistent memory class

`from synapsekit import AgentMemory` used to resolve to the deprecated `AgentScratchpad`
alias (a per-run buffer of ReAct steps) and warned on every use. In 2.0 it returns the
**persistent episodic + semantic memory** class instead. If your code relied on
scratchpad behavior (`add_step`, `format_scratchpad`, `clear`), import `AgentScratchpad`
explicitly.

```python
# Before (1.x) — AgentMemory was the scratchpad
from synapsekit import AgentMemory

scratchpad = AgentMemory(max_steps=20)
scratchpad.add_step(step)
prompt_context = scratchpad.format_scratchpad()
```

```python
# After (2.0) — the scratchpad now has its own name
from synapsekit import AgentScratchpad

scratchpad = AgentScratchpad(max_steps=20)
scratchpad.add_step(step)
prompt_context = scratchpad.format_scratchpad()
```

If you actually wanted persistent memory, the new `AgentMemory` is what you want:

```python
# 2.0 — persistent episodic + semantic memory
from synapsekit import AgentMemory

memory = AgentMemory(backend="sqlite", path="agent.db")
```

`PersistentAgentMemory` remains a working alias for the persistent class if you prefer an
unambiguous name.

### 2. Audit `verify()` without `trusted_keys` returns `UNVERIFIABLE`

An unpinned verify checks signatures only against the public key embedded in the bundle's
own manifest. That proves the bundle wasn't edited after export, but **not** who produced
it — anyone can generate a fully self-consistent bundle from a fresh keypair. So a clean,
unpinned verification is now capped at `UNVERIFIABLE` instead of `MATCH`.

```python
# Before (1.x) — an unpinned verify could report MATCH
from synapsekit import verify_audit_bundle, Verdict

result = verify_audit_bundle("bundle.zip")
assert result.verdict is Verdict.MATCH  # trusted the bundle's own key
```

```python
# After (2.0) — pin the signer's key for a real MATCH
from synapsekit import verify_audit_bundle, Verdict

trusted = {"prod-signer-2026": signer_public_key_bytes}  # obtained out-of-band
result = verify_audit_bundle("bundle.zip", trusted_keys=trusted)
assert result.verdict is Verdict.MATCH
```

Without `trusted_keys` the verdict is `UNVERIFIABLE` and `result.trust_anchor == "none"`.
`DRIFT` (active tampering) is still reported regardless of pinning.

### 3. Audit bundle schema is now 1.2

The verifier only accepts schema version `1.2` (RFC 6962 Merkle construction with leaf
domain separation, plus record-schema changes). Bundles produced by earlier SynapseKit
versions will not verify.

```python
# A pre-1.2 bundle now fails with UNVERIFIABLE:
result = verify_audit_bundle("old_bundle.zip")
# result.verdict is Verdict.UNVERIFIABLE
# "unsupported schema version '1.1'; this verifier supports ['1.2']"
```

Re-export any bundles you need to keep verifiable with 2.0 (`export_audit_bundle`). There
is no in-place upgrade for old bundles — the record layout changed.

### 4. LLM `max_retries` now defaults to 2

In 1.x retries were off by default (`max_retries=0`). In 2.0 the default is `2`, and
retries are scoped to transient failures only: timeouts, connection errors, and HTTP
`429`/`5xx`. Other `4xx` responses (auth, bad request, not found) are never retried.
Backoff adds jitter and honors `Retry-After`.

```python
# Before (1.x) — no retries unless you asked for them
from synapsekit import LLMConfig

config = LLMConfig(model="gpt-4o-mini", api_key="sk-...", provider="openai")
# a transient 503 propagated immediately
```

```python
# After (2.0) — 2 retries on transient failures by default
from synapsekit import LLMConfig

config = LLMConfig(model="gpt-4o-mini", api_key="sk-...", provider="openai")
# a transient 503 is retried twice with jitter before raising

# Opt back out if you want 1.x behavior:
config = LLMConfig(
    model="gpt-4o-mini", api_key="sk-...", provider="openai", max_retries=0
)
```

## New defaults & hardening you should know about

These are not breaking imports, but they change runtime behavior. Review them before you
upgrade a production deployment.

### `LLMConfig` gained a `timeout` field and validates at construction

`LLMConfig` now validates its fields in `__post_init__`, so bad settings fail immediately
rather than at the first API call. Ranges: `temperature` in `[0.0, 2.0]`, `top_p` in
`[0.0, 1.0]`, `max_tokens > 0`, `max_retries >= 0`, and the new `timeout > 0` (seconds,
`None` = provider default).

```python
from synapsekit import LLMConfig

# New per-request timeout knob:
config = LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    provider="openai",
    timeout=30.0,
)

# This now raises ValueError at construction, not later:
LLMConfig(model="m", api_key="k", provider="openai", temperature=5.0)
# ValueError: temperature must be between 0.0 and 2.0, got 5.0
```

### SSRF guards on web-facing loaders and tools

`WebLoader`, `SitemapLoader`, and `BrowserTool` now block private, loopback, link-local,
reserved, and cloud-metadata (`169.254.169.254`) addresses by default, re-validate on
redirects, and **fail closed** on DNS-resolution failure (`WebLoader` previously failed
open). `SitemapLoader` validates every discovered and nested-index URL.

`BrowserTool` applies the private-IP guard regardless of any `allowed_domains` allowlist.
If you genuinely need to reach private hosts (internal testing), opt out explicitly:

```python
from synapsekit import BrowserTool

tool = BrowserTool(allow_private_ips=True)  # opt out of the SSRF guard
```

### `ShellTool` rejects shell metacharacters when an allowlist is set

`ShellTool` previously checked `argv[0]` against its allowlist but ran the raw string via
a shell, so `echo hi & curl evil` bypassed it. It now always runs parsed argv without a
shell and rejects shell-metacharacter / chained commands when an allowlist is configured.

### `CalculatorTool` uses an AST allowlist

The default `CalculatorTool` no longer calls `eval()`. It parses expressions against an
AST allowlist (with an exponent bound), closing the `().__class__.__bases__...` sandbox
escape and the `9**9**9` DoS. Ordinary arithmetic is unaffected.

### Response cache key now includes `system_prompt` and provider

The LLM response cache key now folds in `provider` and `system_prompt`, so two instances
that share a cache backend but differ in system prompt or provider no longer return each
other's cached answers. If you relied on cross-instance cache hits with differing prompts,
those keys now diverge (correctly).

## Upgrading

```bash
pip install --upgrade synapsekit   # 2.0.0
```

Optional extras are unchanged — install only what you need, e.g.
`pip install --upgrade "synapsekit[openai,chroma]"`. See
[Installation](/docs/getting-started/installation) for the full extras table.

After upgrading:

1. Replace any `AgentMemory` usage that expected scratchpad behavior with `AgentScratchpad`.
2. Pass `trusted_keys` to `verify_audit_bundle` (or `synapsekit audit verify`) for a real `MATCH`.
3. Re-export audit bundles you need to keep verifiable (schema 1.2).
4. Set `max_retries=0` on `LLMConfig` if you want to keep 1.x no-retry behavior.
