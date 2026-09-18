---
sidebar_position: 1
title: "Hive Mode — Privacy-First Pooled Memory"
description: "Learn shared conventions across a team or community without sharing raw memory. Differential privacy, Ed25519 signing, and AES-GCM encryption in Python."
---

# Hive Mode

Hive Mode is an opt-in way for a team, or a self-hosted community, to learn shared conventions without sharing raw memory. A local `HiveClient` mines only safe, vocabulary-level pattern keys such as `practice:exponential-backoff` (never filenames, paths, or excerpts), applies differential-privacy noise, Ed25519-signs each contribution, and can optionally AES-GCM-encrypt the payload before it leaves the machine. A self-hostable `HiveAggregator` validates signatures, enforces a `minimum_cohort` suppression threshold, and returns aggregate `Suggestion`s with prevalence and confidence scores.

**Install:** `pip install synapsekit[hive]` (adds `fastapi`, `starlette`, and `uvicorn` for the optional self-hosted service). The `HiveClient` and an in-process `HiveAggregator` work on core alone; the extra is only needed to run `create_hive_app` as a network service.

**Import:**
```python
from synapsekit.hive import (
    HiveClient,
    HiveAggregator,
    InProcessHiveTransport,
    HttpHiveTransport,
    SQLiteHiveStore,
    PrivacyConfig,
    ShareScope,
)
```

---

## Quickstart

### Python

```python
import asyncio
from synapsekit.hive import HiveAggregator, HiveClient, InProcessHiveTransport, SQLiteHiveStore

async def main():
    # Self-hosted (or embedded) aggregator, backed by SQLite
    aggregator = HiveAggregator(SQLiteHiveStore("hive.sqlite3"))
    transport = InProcessHiveTransport(aggregator)

    client = HiveClient(scope=ShareScope.TEAM, team_id="platform-team", transport=transport)

    # Mine local markdown for safe, vocabulary-level patterns and contribute them
    contribution_id = await client.contribute(roots=["."])
    print(contribution_id)

    # Read back aggregate suggestions for this scope
    for suggestion in await client.suggestions_for(limit=10):
        print(suggestion.statement, suggestion.prevalence, suggestion.confidence)

asyncio.run(main())
```

Contributions never leave the process with anything beyond a `ShareScope`, a bounded set of `PatternObservation` keys/values, and DP parameters. `HiveClient.contribute` reserves privacy budget before mining, mines with `PatternMiner`, applies Laplace noise via `DifferentialPrivacy`, signs the payload with an `Ed25519SigningProvider`, and hands the resulting `ContributionEnvelope` to the transport.

---

## Privacy and transparency

**Bounded vocabulary.** `PatternMiner` only ever emits keys from a fixed, versioned `PATTERN_VOCABULARY` (frameworks like `fastapi`/`django`, tooling like `pytest`/`redis`, practices like `oauth`/`jwt`/`exponential-backoff`) plus two coarse structural buckets (`memory:uses-headings`, `memory:includes-code-examples`). A project name, class name, URL, or arbitrary text can never become a pattern key.

**Differential privacy.** `DifferentialPrivacy.privatize` adds bounded Laplace noise to each pattern count before it is signed, controlled by `PrivacyConfig.epsilon`, `delta`, and `noise_scale`. A `PrivacyBudgetLedger` tracks cumulative epsilon spend against `budget_limit` and enforces `max_contributions_per_day`, resetting daily.

**Signing and encryption.** Every `ContributionEnvelope` is Ed25519-signed via a `SigningProvider` (`Ed25519SigningProvider` by default). Passing `encryption_key` (16, 24, or 32 bytes) to `HiveClient` additionally AES-GCM-encrypts the payload before it is signed, so a transport-layer observer sees only ciphertext.

**Suppression threshold.** `HiveAggregator.suggestions` refuses to return anything unless at least `minimum_cohort` distinct contributors are present in that scope, and `Suggestion.contributor_count` reflects distinct contributors, not raw observation counts.

**Pseudonymization.** `Pseudonymizer` derives a non-reversible, scope-specific `contributor_id` via HMAC-SHA256 from a local secret cached in the Hive cache file, so the same machine gets a stable but unlinkable identity per scope.

**Full transparency and withdrawal.** `await client.transparency()` returns a `TransparencyReport` (contribution count, epsilon spent/remaining, which pattern keys were selected or excluded). `await client.withdraw()` revokes every stored contribution for this contributor and scope; a withdrawn contributor's report reflects `withdrawn=True`.

**Offline suggestion cache.** `HiveClient` caches the last `suggestions_for` response (and pseudonymizer secret and privacy ledger) at `~/.synapsekit/hive.json` (mode `0600`). If the transport is unavailable, `suggestions_for` falls back to the cached suggestions instead of failing.

---

## Self-hosting an aggregator

`HiveAggregator` is the validation and aggregation core; it works entirely in-process (via `InProcessHiveTransport`) or behind the optional FastAPI service:

```python
from synapsekit.hive import HiveAggregator, SQLiteHiveStore, create_hive_app

aggregator = HiveAggregator(SQLiteHiveStore("hive.sqlite3"), trusted_keys={})
app = create_hive_app(aggregator, api_keys={"team-shared-key"})
# uvicorn app --host 0.0.0.0 --port 8000
```

The service exposes `POST /v1/contributions`, `GET /v1/suggestions`, `POST /v1/withdraw`, `GET /v1/transparency`, plus `/healthz` and a read-only `/dashboard`. `HiveClient` talks to it via `HttpHiveTransport(base_url, api_key=...)`, a dependency-free `urllib`-based JSON transport.

---

## CLI reference

Run subcommands as `synapsekit hive <command> [options]`.

| Command | Description |
|---|---|
| `contribute [roots...]` | Mine, privatize, sign, and upload local patterns (default root `.`) |
| `suggestions` | Read aggregate suggestions, with offline cache fallback (`--query`, `--limit`) |
| `status` | Show local Hive budget and contribution transparency |
| `withdraw` | Revoke this contributor's stored contributions |

**Common options:** `--scope {local,team,community}`, `--team-id`, `--contributor-id`, `--cache PATH`, `--aggregator-db PATH`, `--service-url URL`, `--api-key KEY`, `--epsilon FLOAT`, `--budget-limit FLOAT`, `--minimum-cohort N`.

```bash
# Contribute patterns from the current repo's docs, scoped to a team
synapsekit hive --scope team --team-id platform-team contribute .

# Check aggregate suggestions
synapsekit hive --scope team --team-id platform-team suggestions --query oauth

# Inspect what was contributed, and withdraw it
synapsekit hive --scope team --team-id platform-team status
synapsekit hive --scope team --team-id platform-team withdraw
```

With no `--service-url`, the CLI runs a local, self-hosted `HiveAggregator` backed by SQLite at `--aggregator-db` (default: beside `--cache`, suffixed `.sqlite3`).

---

## SynapseKit Live

Hive Mode is wired into [SynapseKit Live](../observability/live.md). `HiveClient.contribute`, `HiveClient.withdraw`, and `HiveClient.suggestions_for` each publish a Live event (`hive.contribute`, `hive.withdraw`, `hive.suggestions`) carrying the scope, so pooled-memory activity shows up in the glass-box dashboard alongside everything else. Event payloads never include pattern keys, memory text, or signatures, only scope and outcome.

---

## API reference

| Symbol | Kind | Purpose |
|---|---|---|
| `HiveClient` | class | Mines, privatizes, signs, and (optionally) uploads contributions; reads suggestions |
| `HiveAggregator` | class | Validates signatures, persists contributions, computes aggregate suggestions |
| `SQLiteHiveStore` | class | Stdlib SQLite reference store for `HiveAggregator` |
| `InProcessHiveTransport` | class | In-process transport wrapping a local `HiveAggregator` |
| `HttpHiveTransport` | class | Dependency-free `urllib` JSON transport for a remote Hive service |
| `create_hive_app` | function | Build the optional FastAPI service around a `HiveAggregator` |
| `PrivacyConfig` | dataclass | Epsilon, delta, budget limit, minimum cohort, pattern/contribution caps |
| `ShareScope` | enum | `local` \| `team` \| `community` |
| `PatternObservation` | dataclass | A single DP-noised, bounded-vocabulary pattern key/value |
| `Suggestion` | dataclass | Aggregate-only recommendation: key, statement, prevalence, confidence |
| `TransparencyReport` | dataclass | What was contributed, epsilon spent/remaining, withdrawal state |
| `PatternMiner` | class | Extracts bounded vocabulary matches from local markdown |
| `DifferentialPrivacy` | class | Bounded Laplace noise mechanism |
| `PrivacyBudgetLedger` | class | Per-day epsilon budget and contribution-count accounting |
| `Pseudonymizer` | class | Non-reversible, scope-specific contributor IDs |
| `AllowAllAuthorizer` | class | Local-only authorizer suitable for an in-process client |

---

## See also

- [Personal Knowledge Mesh](../mesh/index.md) — the local markdown loader and privacy filter Hive reuses
- [Edge Runtime](../edge/index.md) — local-first inference, the same design philosophy applied to LLM calls
