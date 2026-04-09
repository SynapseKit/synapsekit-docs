---
sidebar_position: 6
---

# Troubleshooting

Common EvalCI errors and how to fix them.

---

## No eval files found

**Error:** `No eval files found in 'tests/evals'`

EvalCI only discovers files matching `eval_*.py` or `*_eval.py`. Rename your files:

```
test_rag.py    ❌  →  eval_rag.py    ✅
test_agent.py  ❌  →  eval_agent.py  ✅
```

---

## TypeError: float() argument must be a string or a real number, not 'coroutine'

**Cause:** Bug in synapsekit < 1.5.2 — async `@eval_case` functions were not awaited correctly.

**Fix:** Pin to synapsekit 1.5.2 or later:

```yaml
- uses: SynapseKit/evalci@v1
  with:
    synapsekit-version: "1.5.2"
```

---

## PR comment not posted

- Check that `github-token` is set (the default `${{ github.token }}` works for most repos)
- The workflow must be triggered by a `pull_request` event — push events don't post comments
- Check Actions permissions: repo **Settings → Actions → General → Workflow permissions → Read and write**

---

## Import error for LLM provider

**Error:** `ModuleNotFoundError: No module named 'openai'`

Set the correct `extras` for your provider:

```yaml
- uses: SynapseKit/evalci@v1
  with:
    extras: "openai"        # for OpenAI
    # extras: "anthropic"   # for Anthropic
    # extras: "openai,anthropic"  # for both
```

Full provider extras table → [Action Reference](/docs/evalci/action-reference#provider-extras)

---

## Action exits 1 but all cases pass

Check if `fail-on-regression` is set and you have a baseline snapshot being compared. Either remove the flag or update your baseline:

```yaml
- uses: SynapseKit/evalci@v1
  with:
    fail-on-regression: "false"   # disable regression check
```

---

## Eval cases not discovered

Make sure your functions use the `@eval_case` decorator and are in a file EvalCI can discover:

```python
from synapsekit import eval_case   # ← must import from synapsekit

@eval_case(min_score=0.80)         # ← decorator required
async def eval_my_pipeline():
    ...
```

Plain `async def` functions without `@eval_case` are ignored.

---

## Still stuck?

- [Open an issue](https://github.com/SynapseKit/evalci/issues/new?template=bug_report.yml)
- [Start a discussion](https://github.com/SynapseKit/evalci/discussions)
- [Action reference](/docs/evalci/action-reference)
- [Examples](/docs/evalci/examples)
