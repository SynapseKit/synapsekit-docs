---
sidebar_position: 3
---

# synapsekit test

Discover and run `@eval_case`-decorated evaluation functions. CI-friendly with exit code 1 on any failure.

## Quick start

```bash
synapsekit test tests/evals/ --threshold 0.8 --format table
```

## CLI options

| Option | Default | Description |
|---|---|---|
| `path` | `.` | Directory or file to scan for eval files |
| `--threshold` | `0.7` | Global minimum score threshold |
| `--format` | `table` | Output format: `table` or `json` |

## File discovery

The CLI discovers evaluation files matching these patterns:

- `eval_*.py`
- `*_eval.py`

All `@eval_case`-decorated functions in discovered files are collected and executed.

## Writing eval cases

Use the `@eval_case` decorator to define evaluation functions:

```python
# eval_qa.py
from synapsekit import eval_case

@eval_case(min_score=0.8, max_cost_usd=0.05, tags=["qa"])
async def eval_summarization():
    # Run your pipeline, measure quality
    score = 0.85
    cost = 0.02
    return {"score": score, "cost_usd": cost, "latency_ms": 1200}

@eval_case(min_score=0.9, max_latency_ms=2000)
def eval_retrieval():
    return {"score": 0.92, "latency_ms": 800}
```

Each function must return a dict with any of these keys:

| Key | Type | Description |
|---|---|---|
| `score` | `float` | Quality score (0.0-1.0) |
| `cost_usd` | `float` | Cost in USD |
| `latency_ms` | `float` | Latency in milliseconds (auto-measured if omitted) |

## Threshold checking

Thresholds are checked in this order:

1. **`min_score`** from the decorator (falls back to `--threshold` CLI arg)
2. **`max_cost_usd`** from the decorator (skipped if not set)
3. **`max_latency_ms`** from the decorator (skipped if not set)

## Output formats

### Table (default)

```
Status   Name                                     Score      Cost         Latency
----------------------------------------------------------------------------------
PASS     eval_summarization                        0.850      $0.0200      1200ms
FAIL     eval_retrieval                            0.700      N/A          800ms
         -> score 0.700 < min 0.900
----------------------------------------------------------------------------------
1/2 passed
```

### JSON

```bash
synapsekit test --format json
```

```json
[
  {
    "file": "eval_qa.py",
    "name": "eval_summarization",
    "passed": true,
    "score": 0.85,
    "cost_usd": 0.02,
    "latency_ms": 1200,
    "failures": [],
    "tags": ["qa"]
  }
]
```

## CI integration

The command exits with code 1 if any eval case fails, making it suitable for CI pipelines:

```yaml
# GitHub Actions example
- name: Run evals
  run: synapsekit test tests/evals/ --threshold 0.8
```

## See also

- [`@eval_case` decorator](/docs/evaluation/overview#eval_case-decorator)
- [CostTracker](/docs/observability/cost-tracker) for cost tracking in eval cases
