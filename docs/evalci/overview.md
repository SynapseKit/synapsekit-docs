---
sidebar_position: 1
---

# EvalCI — LLM Quality Gates

EvalCI is a GitHub Action that runs your [`@eval_case`](/docs/evaluation/overview#eval_case-decorator) suites on every pull request and blocks merge if quality drops below threshold.

**No infrastructure. No backend. 2-minute setup.**

```yaml
- uses: SynapseKit/evalci@v1
  with:
    path: tests/evals
    threshold: "0.80"
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

That's it. EvalCI installs SynapseKit into the runner, discovers your eval cases, runs them, posts a results table as a PR comment, and fails the check if any case falls below threshold.

---

## Why EvalCI

LLM applications degrade silently. A prompt change, a model update, a retrieval tweak — any of these can drop quality by 10–20% without a single test failure. EvalCI gives you a quality gate that catches this before it ships.

| Without EvalCI | With EvalCI |
|---|---|
| Quality regressions ship to production | Blocked at PR review |
| Manual eval runs, inconsistent | Automatic on every PR |
| No visibility into cost/latency trends | Score, cost, latency per case on every PR |
| Requires external tooling (LangSmith, etc.) | Works in your existing GitHub Actions |

---

## How it works

```
Your PR opens
     │
     ▼
EvalCI Action runs
     │
     ├─ pip install synapsekit[{extras}]
     │
     ├─ synapsekit test {path} --format json --threshold {threshold}
     │        │
     │        ├─ Discovers all @eval_case functions
     │        ├─ Runs each case, measures score / cost / latency
     │        └─ Outputs JSON results
     │
     ├─ Parses results
     │
     ├─ Posts PR comment with results table
     │
     ├─ Sets Action outputs: passed, failed, total, mean-score
     │
     └─ Exit 0 (all pass) or 1 (any failure)
```

---

## PR comment

On every PR, EvalCI posts a comment like this:

> ## EvalCI Results
>
> | | Test | Score | Cost | Latency |
> |---|---|---|---|---|
> | ✅ | test_rag_relevancy | 0.850 | $0.0050 | 1200ms |
> | ❌ | test_rag_faithfulness | 0.650 | $0.0120 | 2500ms |
>
> **1/2 passed** · Threshold: `0.80` · [SynapseKit EvalCI](https://synapsekit.github.io/synapsekit-docs/)

---

## Next steps

- [Quickstart](/docs/evalci/quickstart) — set up EvalCI in 5 minutes
- [Writing eval cases](/docs/evalci/writing-evals) — how to write good `@eval_case` tests
- [Action reference](/docs/evalci/action-reference) — all inputs, outputs, and configuration
- [Examples](/docs/evalci/examples) — real-world workflows for RAG, agents, and more
- [`@eval_case` decorator](/docs/evaluation/overview#eval_case-decorator) — the underlying decorator
- [GitHub repository](https://github.com/SynapseKit/evalci) — source code and issues
