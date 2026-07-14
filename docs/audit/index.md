---
sidebar_position: 0
title: "Verifiable Agents"
description: "Cryptographically signed, hash-chained audit trails with independent, offline verification."
---

# Verifiable Agents

`synapsekit.audit` turns any agent run into a **tamper-evident provenance record**. Every LLM call, tool invocation, retrieval, memory access, and decision can be recorded into a hash-chained trace, batch-signed with Ed25519 (or a pluggable KMS/BYOK key), exported as a portable `.zip` bundle, and then verified *without SynapseKit installed* — an auditor only needs Python's standard library plus `cryptography`. Verification is deliberately three-valued: `MATCH`, `DRIFT` (evidence contradicts the claim — tampering), or `UNVERIFIABLE` (not enough evidence to decide).

**Install:** no extra needed — the audit system relies only on `cryptography`, which is a core dependency of SynapseKit.

**Import:**
```python
from synapsekit.audit import (
    AuditTracer,
    EventKind,
    SigningPolicy,
    VerifiableAgent,
    audited,
    export_audit_bundle,
    verify,
)
```

---

## Quickstart

Wrap an agent, run it, export a signed bundle, then verify it against a key you pin independently.

```python
import asyncio
from synapsekit.audit import (
    AuditTracer,
    SigningPolicy,
    VerifiableAgent,
    export_audit_bundle,
    verify,
)

async def main():
    # 1. Record every call the agent makes through the proxy.
    tracer = AuditTracer()
    verifiable = VerifiableAgent(my_agent, tracer=tracer)
    await verifiable.run("summarize Q3 revenue")

    # 2. Sign and export a portable bundle.
    policy = SigningPolicy.ed25519()
    export_audit_bundle(tracer.drain(), policy, "run.audit.zip")

    # 3. Verify. Pin the signer's public key (obtained out-of-band)
    #    for a real MATCH — see "Trust anchor" below.
    public_key = policy.provider.public_key_bytes()
    result = verify("run.audit.zip", trusted_keys={policy.provider.key_id: public_key})
    print(result.verdict)          # Verdict.MATCH
    print(result.trust_anchor)     # "pinned"

asyncio.run(main())
```

---

## Recording a trace

An `AuditTracer` is an append-only, thread-safe, hash-chained recorder for a single run. Each `record()` links to the previous record's hash, so retroactively editing any record changes its hash and breaks the chain for everything after it.

```python
from synapsekit.audit import AuditTracer, EventKind

tracer = AuditTracer()
tracer.record(EventKind.LLM_CALL, {"model": "gpt-4o-mini", "prompt": "hi"})
tracer.record(EventKind.TOOL_CALL, {"tool": "search", "query": "revenue"})

records = tracer.drain()   # atomically pop the buffer for export
```

Event kinds come from the stable, closed `EventKind` taxonomy — arbitrary strings are coerced but not part of the public spec:

`USER_INPUT`, `LLM_CALL`, `LLM_RESPONSE`, `TOOL_CALL`, `TOOL_RESULT`, `RETRIEVAL`, `MEMORY_READ`, `MEMORY_WRITE`, `STATE_CHANGE`, `DECISION`, `SYSTEM_EVENT`, `ERROR`.

---

## `VerifiableAgent` — wrap an existing agent

`VerifiableAgent` is a transparent proxy. Attribute access forwards to the wrapped agent, and callables are instrumented on the fly to emit records around every call made *through the proxy*. Method names are mapped onto the `EventKind` taxonomy automatically — e.g. `generate`/`chat` → `LLM_CALL`/`LLM_RESPONSE`, `run`/`execute` → `TOOL_CALL`/`TOOL_RESULT`, `retrieve`/`search` → `RETRIEVAL`. Paired kinds emit two linked records (call, then response as a child); single kinds emit one after completion. Exceptions record an `ERROR`.

```python
from synapsekit.audit import AuditTracer, VerifiableAgent

tracer = AuditTracer()
verifiable = VerifiableAgent(
    my_agent,
    tracer=tracer,
    instrument_attrs=["llm", "retriever"],  # also patch named sub-components in place
)
result = await verifiable.run("do the thing")
records = tracer.drain()
```

Nested calls made through the proxy while another proxied call is in flight are linked with the right `parent_id` automatically via a `contextvars` stack. Because it is an external proxy, an agent's *own* internal calls on `self` are invisible by default — pass `instrument_attrs=[...]` to monkey-patch named sub-components (e.g. `self.llm`) in place, or compose the agent out of `@audited` helpers.

### `@audited` decorator

For a single tool or LLM helper rather than a whole agent, use the decorator form. It emits one record per call (`kind` on success, always `EventKind.ERROR` on any exception, including cancellation).

```python
from synapsekit.audit import AuditTracer, EventKind, audited

tracer = AuditTracer()

@audited(EventKind.TOOL_CALL, tracer=tracer)
async def search_web(query: str) -> str:
    ...
```

---

## Signing and exporting a bundle

Records are never signed individually. At export time they are grouped into batches; each batch's record hashes become the leaves of an **RFC 6962 Merkle tree**, and the single Merkle root is signed once. This is what makes signing cheap at scale. The bundle manifest metadata (record count, run ids, key registry) is itself hashed and signed.

```python
from synapsekit.audit import SigningPolicy, export_audit_bundle

policy = SigningPolicy.ed25519()          # generates a fresh keypair by default
export_audit_bundle(records, policy, "run.audit.zip", batch_size=100)
```

A bundle is a portable zip with an open specification:

| Entry | Contents |
|---|---|
| `manifest.json` | Schema version, run metadata, key registry — hashed and signed |
| `trace.jsonl` | One canonical-JSON `AuditRecord` per line, in order |
| `hashes.merkle` | Per-batch leaf hash lists and computed Merkle roots |
| `signatures.json` | One `Signature` per batch |

### Signing providers

Ed25519 is the default, but nothing downstream hardcodes it — everything signs through the `SigningProvider` interface, so you can plug in a KMS or your own key material:

```python
# Ed25519 (default) — optionally reuse a stored raw private key
SigningPolicy.ed25519(private_key=raw_key_bytes, key_id="prod-2026")

# Cloud KMS (AWS shipped; Azure/GCP interfaces reserved)
SigningPolicy.kms("aws", key_id="arn:aws:kms:...:key/abc")

# Bring your own key (HSM, enclave, custom signer)
SigningPolicy.byok(sign_fn=my_hsm_sign, public_key=pub_bytes, key_id="hsm-1")
```

---

## Verifying a bundle

`verify()` checks the bundle end to end: schema version, per-record payload and chain hashes, `prev_hash` linkage, `parent_id` references, per-batch Merkle roots, per-batch signatures, and the signed manifest. It returns a `VerificationResult` whose `verdict` is `MATCH`, `DRIFT`, or `UNVERIFIABLE`.

```python
from synapsekit.audit import verify, Verdict

result = verify("run.audit.zip", trusted_keys={"prod-2026": public_key_bytes})
if result.verdict is Verdict.DRIFT:
    for err in result.errors:
        print("TAMPERED:", err)
result.raise_if_invalid()   # raises AuditVerificationError unless MATCH
```

The standalone verifier depends only on the standard library plus `cryptography`. A compliance auditor with no SynapseKit installation can verify a bundle produced months or years earlier.

### Trust anchor — pinning is required for `MATCH`

:::caution v2.0 behavior — `verify()` without `trusted_keys` returns `UNVERIFIABLE`, not `MATCH`.
By default, `verify()` checks each signature against the public key **embedded in the bundle's own manifest**. That proves the bundle wasn't edited after export, but *not who produced it* — anyone can generate a fully self-consistent bundle from scratch with a fresh keypair. So an otherwise-clean, unpinned verification is deliberately capped at `UNVERIFIABLE`.

For real non-repudiation, pass `trusted_keys={key_id: public_key_bytes}` with the signer's public key obtained **independently of the bundle** (published out-of-band, pinned in your config). Signatures from any other key are then rejected outright, regardless of what the manifest claims, and a clean result is reported as `MATCH` (`trust_anchor == "pinned"`).
:::

```python
# Unpinned — internal self-consistency only.
verify("run.audit.zip").verdict            # Verdict.UNVERIFIABLE

# Pinned — real authenticity.
verify("run.audit.zip", trusted_keys={"prod-2026": pub}).verdict   # Verdict.MATCH
```

Why three values and not a bool: `DRIFT` means the evidence actively contradicts a claim (broken chain, invalid signature, tampered Merkle root); `UNVERIFIABLE` means the verifier couldn't reach a conclusion (corrupted bundle, unsupported schema, unpinned or unknown key). Collapsing these would make "we couldn't check" indistinguishable from "we checked and it's wrong."

---

## PII redaction before hashing

Redaction is a lossy, irreversible rewrite that **must** run before hashing — the hash chain commits to whatever payload it was given. Attach a `PIIRedactor` to the tracer (or to a `VerifiableAgent`/`@audited`) and PII is redacted before `compute_record_hash` runs. Once a record is hashed on the redacted payload, the original content is gone forever, so choose your detectors up front.

```python
from synapsekit.audit import AuditTracer, PIIRedactor, DEFAULT_DETECTORS

redactor = PIIRedactor(DEFAULT_DETECTORS)   # email, phone, SSN, credit-card, IP
tracer = AuditTracer(redactor=redactor)
tracer.record(EventKind.USER_INPUT, {"text": "email me at a@b.com"})
# stored payload → "email me at [REDACTED:EMAIL]"
```

The credit-card detector additionally requires a valid Luhn checksum so it doesn't over-redact ordinary numeric IDs. Pass a custom `ml_detector` callable to layer in an NER/statistical detector without adding an ML dependency to the base package.

---

## Replay

Replay confirms a recorded run is *reproducible in the parts that matter for audit*: the same inputs reached each step, tool outputs match when a live executor is supplied, retrieval references still resolve, and any recorded policy hash matches its payload. Identical LLM output is explicitly **not** required — `LLM_CALL` records are checked for structural completeness only, never output equality.

```python
from synapsekit.audit import ReplayEngine

engine = ReplayEngine(
    tool_executors={"search": lambda inp: run_search(inp)},
    retrieval_resolver=lambda doc_id: corpus.get(doc_id),
)
report = engine.replay("run.audit.zip")
print(report.ok, report.mismatches)
```

---

## CLI

```bash
# Verify a bundle. Pin a key for a MATCH; without --trusted-key you get UNVERIFIABLE.
synapsekit audit verify run.audit.zip \
    --trusted-key prod-2026:BASE64_PUBLIC_KEY

# JSON output for CI gates
synapsekit audit verify run.audit.zip --format json

# Replay provenance (verifies first, then replays)
synapsekit audit replay run.audit.zip --trusted-key prod-2026:BASE64_PUBLIC_KEY
```

`--trusted-key` is repeatable and takes `KEY_ID:BASE64_PUBLIC_KEY`. Both commands exit non-zero unless the verdict is `MATCH` (verify) or replay had no mismatches.

---

## API reference

| Symbol | Kind | Purpose |
|---|---|---|
| `AuditTracer(run_id=None, *, redactor=None)` | class | Append-only, hash-chained recorder. `.record(kind, payload, ...)`, `.records`, `.drain()`, `.verify_chain(records)` |
| `EventKind` | enum | Stable event taxonomy (`LLM_CALL`, `TOOL_CALL`, `RETRIEVAL`, …) |
| `AuditRecord` | dataclass | One immutable, hash-chained event; `.to_dict()` / `.from_dict()` |
| `VerifiableAgent(agent, *, tracer=None, redactor=None, actor=None, kind_overrides=None, instrument_attrs=None)` | class | Transparent proxy that records every call; `.wrapped` for the raw agent |
| `audited(kind, *, tracer, redactor=None, actor="system", name=None)` | decorator | Audit a single function/tool (sync or async) |
| `SigningPolicy` | class | Batch-signing policy. `.ed25519(...)`, `.byok(...)`, `.kms(provider, ...)`, `.sign_batch(...)` |
| `Ed25519SigningProvider` | class | Default provider; `.public_key_bytes()`, `.export_encrypted_private_key(passphrase)` |
| `BYOKSigningProvider` / `AWSKMSSigningProvider` | class | Bring-your-own-key and cloud KMS signing |
| `PIIRedactor(detectors=None, *, ml_detector=None, replacement=...)` | class | Redacts payloads before hashing; `.redact_payload(payload)` |
| `DEFAULT_DETECTORS` | list | Email, phone, SSN, credit-card (Luhn), IP detectors |
| `export_audit_bundle(records, signing_policy, output_path, *, batch_size=None)` | function | Write a signed, portable bundle |
| `export_selective_bundle(source, output, *, kinds=None, run_ids=None)` | function | Re-export a subset with per-record Merkle inclusion proofs |
| `verify(bundle_path, *, trusted_keys=None, metrics=None)` | function | Verify end to end; returns `VerificationResult` |
| `VerificationResult` | dataclass | `.verdict`, `.errors`, `.trust_anchor`, `.ok`, `.raise_if_invalid()` |
| `Verdict` | enum | `MATCH` / `DRIFT` / `UNVERIFIABLE` |
| `ReplayEngine(*, tool_executors=None, retrieval_resolver=None)` | class | `.replay(bundle_path) -> ReplayReport` |
| `load_bundle(path) -> LoadedBundle` | function | Parse a bundle's entries with no cryptographic checks |

---

## See also

- [Living Memory](../memory/living-memory) — signed, diffable agent memory patches
- [Guardrails](../guardrails/overview)
- [Observability](../observability/)
