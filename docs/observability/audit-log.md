---
sidebar_position: 3
---

# Audit Log

Immutable, append-only compliance log for recording every LLM interaction. Supports three storage backends: in-memory, SQLite, and JSONL.

## Quick start

```python
from synapsekit import AuditLog

log = AuditLog(backend="memory")

entry = log.record(
    model="gpt-4o",
    input_text="What is the capital of France?",
    output_text="The capital of France is Paris.",
    user="alice",
)

print(entry.entry_id)   # UUID
print(entry.timestamp)  # ISO 8601
print(len(log))          # 1
```

## Backends

### Memory

Fast, ephemeral storage for development and testing:

```python
log = AuditLog(backend="memory")
```

### SQLite

Persistent, indexed storage for production:

```python
log = AuditLog(backend="sqlite", path="audit.db")
```

Creates an indexed SQLite database with columns for user, model, and timestamp.

### JSONL

Append-only file for log aggregation pipelines:

```python
log = AuditLog(backend="jsonl", path="audit.jsonl")
```

Each entry is written as a single JSON line. Existing entries are loaded on startup.

## Recording entries

```python
entry = log.record(
    model="gpt-4o",
    input_text="Summarize this document",
    output_text="The document discusses...",
    user="alice",           # default: "anonymous"
    cost_usd=0.003,         # optional
    latency_ms=250.0,       # optional
    metadata={"session": "abc123"},  # optional
)
```

### AuditEntry fields

| Field | Type | Description |
|---|---|---|
| `entry_id` | `str` | Unique UUID |
| `timestamp` | `str` | ISO 8601 timestamp |
| `user` | `str` | User identifier |
| `model` | `str` | Model name |
| `input_text` | `str` | Input prompt |
| `output_text` | `str` | Model response |
| `cost_usd` | `float \| None` | Cost in USD |
| `latency_ms` | `float \| None` | Latency in milliseconds |
| `metadata` | `dict` | Arbitrary metadata |

## Querying

```python
# All entries
entries = log.query()

# Filter by user
entries = log.query(user="alice")

# Filter by model
entries = log.query(model="gpt-4o")

# Filter by time range
entries = log.query(since="2026-01-01T00:00:00", until="2026-12-31T23:59:59")

# Limit results
entries = log.query(limit=10)

# Combine filters
entries = log.query(user="alice", model="gpt-4o", limit=5)
```

## Immutability

AuditLog is designed for compliance. There is intentionally no `delete()` or `update()` method. Once recorded, entries cannot be modified or removed.

```python
assert not hasattr(log, "delete")
assert not hasattr(log, "update")
```

## Thread safety

All backends are thread-safe via `threading.Lock`. Safe for concurrent use in multi-threaded applications.

## Integration example

```python
from synapsekit import AuditLog, CostTracker

log = AuditLog(backend="sqlite", path="compliance.db")
tracker = CostTracker()

with tracker.scope("qa"):
    rec = tracker.record("gpt-4o", 1000, 500, 200)

    log.record(
        model="gpt-4o",
        input_text=user_query,
        output_text=response,
        user=current_user,
        cost_usd=rec.cost_usd,
        latency_ms=200.0,
    )
```

## See also

- [Cost Tracker](./cost-tracker) — track and budget LLM spending
- [PIIRedactor](../guardrails/overview#piiredactor) — redact PII before logging
- [Evaluation](../evaluation/overview) — measure quality alongside compliance
