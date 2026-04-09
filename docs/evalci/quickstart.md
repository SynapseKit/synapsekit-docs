---
sidebar_position: 2
---

# Quickstart

Get EvalCI running on your repo in under 5 minutes.

:::info Prerequisites
- A GitHub repository
- At least one `@eval_case`-decorated function in your codebase (see [Writing eval cases](/docs/evalci/writing-evals))
- An LLM provider API key stored as a GitHub secret
:::

---

## Step 1 — Write an eval case

Create a file in your test directory (e.g. `tests/evals/test_rag.py`):

```python
from synapsekit import eval_case
from myapp.pipeline import rag_pipeline  # your actual pipeline

@eval_case(min_score=0.80, max_cost_usd=0.01, max_latency_ms=3000)
async def test_rag_relevancy():
    result = await rag_pipeline.ask("What is SynapseKit?")
    score = await result.score_relevancy(
        reference="SynapseKit is a Python framework for building LLM applications."
    )
    return {"score": score, "cost_usd": result.cost_usd, "latency_ms": result.latency_ms}
```

---

## Step 2 — Add the workflow

Create `.github/workflows/eval.yml` in your repo:

```yaml
name: EvalCI

on:
  pull_request:

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: SynapseKit/evalci@v1
        with:
          path: tests/evals
          threshold: "0.80"
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

---

## Step 3 — Add your API key as a secret

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `OPENAI_API_KEY`, Value: your key
4. Click **Add secret**

---

## Step 4 — Open a PR

Push the workflow file and open a pull request. EvalCI will run automatically and post a comment with your results.

---

## Verifying it works

You should see:
1. A new check called **EvalCI** in your PR's checks section
2. A comment posted by `github-actions[bot]` with the results table
3. The check passes (green) if all cases scored ≥ threshold, fails (red) if any case fell below

---

## Next steps

- [Writing eval cases](/docs/evalci/writing-evals) — write better, more useful eval cases
- [Action reference](/docs/evalci/action-reference) — configure threshold, extras, versioning
- [Examples](/docs/evalci/examples) — RAG, agents, multi-provider setups
