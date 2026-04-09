---
sidebar_position: 4
---

# Action Reference

Complete reference for all EvalCI inputs, outputs, and configuration options.

---

## Usage

```yaml
- uses: SynapseKit/evalci@v1
  with:
    path: tests/evals
    threshold: "0.80"
    extras: "openai"
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

---

## Inputs

| Input | Default | Description |
|---|---|---|
| `path` | `.` | Path to eval files or directory. EvalCI discovers all `@eval_case` functions recursively. |
| `threshold` | `0.7` | Global minimum score (0.0–1.0). Cases scoring below this fail. |
| `extras` | `openai` | pip extras to install with synapsekit. Use comma-separated values for multiple providers. |
| `synapsekit-version` | `latest` | Pin a specific synapsekit version (e.g. `1.5.2`) or `latest`. |
| `github-token` | `${{ github.token }}` | GitHub token used to post PR comments. The default works for most repos. |
| `fail-on-regression` | `false` | Set to `true` to also fail if scores regress compared to a saved baseline. |
| `token` | _(empty)_ | Reserved for future EvalCI backend API token. Leave blank for now. |

---

## Outputs

Access outputs in subsequent steps using `steps.<id>.outputs.<name>`:

| Output | Type | Description |
|---|---|---|
| `passed` | `string` | Number of eval cases that passed |
| `failed` | `string` | Number of eval cases that failed |
| `total` | `string` | Total number of eval cases run |
| `mean-score` | `string` | Mean score across all eval cases (4 decimal places) |

```yaml
- uses: SynapseKit/evalci@v1
  id: eval
  with:
    path: tests/evals

- name: Print results
  run: |
    echo "Passed: ${{ steps.eval.outputs.passed }}/${{ steps.eval.outputs.total }}"
    echo "Mean score: ${{ steps.eval.outputs.mean-score }}"
```

---

## Exit codes

| Code | Meaning |
|---|---|
| `0` | All eval cases passed (score ≥ threshold, cost ≤ max, latency ≤ max) |
| `1` | One or more cases failed, or regression detected (if `fail-on-regression: true`) |

---

## Provider extras

The `extras` input controls which LLM provider packages are installed alongside `synapsekit`.

| Provider | `extras` value |
|---|---|
| OpenAI | `openai` |
| Anthropic | `anthropic` |
| Google Gemini | `google-generativeai` |
| Ollama (local) | `ollama` |
| Cohere | `cohere` |
| Groq | `groq` |
| Multiple providers | `openai,anthropic` |

```yaml
- uses: SynapseKit/evalci@v1
  with:
    extras: "openai,anthropic"
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

---

## Pinning a version

By default EvalCI always installs the latest `synapsekit`. To pin:

```yaml
- uses: SynapseKit/evalci@v1
  with:
    synapsekit-version: "1.5.2"
```

---

## Custom threshold per case

The `threshold` input sets a global floor. You can override it per case using the `min_score` parameter on `@eval_case`:

```python
# This case needs 0.90, regardless of the global threshold
@eval_case(min_score=0.90)
async def test_critical_path():
    ...

# This case only needs 0.60
@eval_case(min_score=0.60)
async def test_experimental_feature():
    ...
```

A case fails if its score is below **either** its own `min_score` **or** the global `threshold` — whichever is stricter.

---

## Disabling PR comments

To run evals without posting a comment (e.g. on a branch that has no PR):

```yaml
- uses: SynapseKit/evalci@v1
  with:
    github-token: ""   # empty token disables comment posting
    path: tests/evals
```

---

## Running on push as well as PRs

```yaml
on:
  pull_request:
  push:
    branches: [main]
```

On `push` events (not a PR), EvalCI still runs the evals and sets outputs, but skips the PR comment since there is no PR to comment on.

---

## See also

- [Quickstart](/docs/evalci/quickstart) — get set up in 5 minutes
- [Writing eval cases](/docs/evalci/writing-evals) — how to write `@eval_case` functions
- [Examples](/docs/evalci/examples) — complete workflow examples
- [GitHub repository](https://github.com/SynapseKit/evalci) — source code
