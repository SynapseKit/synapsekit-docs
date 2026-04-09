---
sidebar_position: 5
---

# Examples

Real-world EvalCI workflow configurations and eval case patterns.

---

## RAG pipeline quality gate

The most common use case — gate on relevancy and faithfulness scores for a RAG pipeline.

```yaml
# .github/workflows/eval.yml
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

```python
# tests/evals/test_rag.py
from synapsekit import eval_case, RelevancyMetric, FaithfulnessMetric
from myapp.rag import pipeline, llm

@eval_case(min_score=0.80, max_cost_usd=0.02, tags=["rag"])
async def test_rag_relevancy():
    result = await pipeline.ask("What is the return policy?")
    metric = RelevancyMetric(llm=llm)
    score = await metric.score(
        question="What is the return policy?",
        answer=result.answer,
    )
    return {"score": score, "cost_usd": result.cost_usd, "latency_ms": result.latency_ms}

@eval_case(min_score=0.75, tags=["rag"])
async def test_rag_faithfulness():
    result = await pipeline.ask("What are the shipping options?")
    metric = FaithfulnessMetric(llm=llm)
    score = await metric.score(
        question="What are the shipping options?",
        answer=result.answer,
        contexts=result.source_documents,
    )
    return {"score": score, "cost_usd": result.cost_usd}
```

---

## Multi-provider setup

Run evals across OpenAI and Anthropic in one workflow:

```yaml
- uses: SynapseKit/evalci@v1
  with:
    path: tests/evals
    threshold: "0.75"
    extras: "openai,anthropic"
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

```python
# tests/evals/test_multi_provider.py
import os
from synapsekit import eval_case, OpenAILLM, AnthropicLLM, RelevancyMetric

question = "Summarise the benefits of retrieval-augmented generation."

@eval_case(min_score=0.80, tags=["openai"])
async def test_openai_summary():
    llm = OpenAILLM(model="gpt-4o-mini", api_key=os.environ["OPENAI_API_KEY"])
    answer = await llm.generate(question)
    metric = RelevancyMetric(llm=llm)
    score = await metric.score(question=question, answer=answer)
    return {"score": score}

@eval_case(min_score=0.80, tags=["anthropic"])
async def test_anthropic_summary():
    llm = AnthropicLLM(model="claude-haiku-4-5-20251001", api_key=os.environ["ANTHROPIC_API_KEY"])
    answer = await llm.generate(question)
    metric = RelevancyMetric(llm=llm)
    score = await metric.score(question=question, answer=answer)
    return {"score": score}
```

---

## Using outputs in downstream steps

Fail the job with a custom message, or use scores to trigger notifications:

```yaml
jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: SynapseKit/evalci@v1
        id: eval
        with:
          path: tests/evals
          threshold: "0.80"
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      - name: Fail with summary
        if: failure()
        run: |
          echo "EvalCI failed: ${{ steps.eval.outputs.passed }}/${{ steps.eval.outputs.total }} passed"
          echo "Mean score: ${{ steps.eval.outputs.mean-score }}"
          exit 1

      - name: Post to Slack on pass
        if: success()
        run: |
          curl -s -X POST "${{ secrets.SLACK_WEBHOOK }}" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"✅ EvalCI passed: ${{ steps.eval.outputs.passed }}/${{ steps.eval.outputs.total }} cases, mean score ${{ steps.eval.outputs.mean-score }}\"}"
```

---

## Pinned version + strict threshold

For production branches, pin the synapsekit version and tighten the threshold:

```yaml
name: EvalCI (strict)

on:
  pull_request:
    branches: [main]

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: SynapseKit/evalci@v1
        with:
          path: tests/evals
          threshold: "0.90"
          synapsekit-version: "1.5.2"
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

---

## Local run before pushing

Test your eval cases locally before opening a PR:

```bash
# Install synapsekit
pip install synapsekit[openai]

# Run all eval cases
synapsekit test tests/evals/ --threshold 0.80

# Run only RAG evals
synapsekit test tests/evals/ --tag rag --threshold 0.80

# Output as JSON
synapsekit test tests/evals/ --format json --threshold 0.80
```

---

## Agent evaluation

```yaml
- uses: SynapseKit/evalci@v1
  with:
    path: tests/evals/agents
    threshold: "0.75"
    extras: "openai"
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

```python
# tests/evals/agents/test_support_agent.py
from synapsekit import eval_case
from myapp.agents import support_agent

@eval_case(min_score=0.85, max_latency_ms=8000, tags=["agent"])
async def test_password_reset_response():
    response = await support_agent.run("How do I reset my password?")
    keywords = ["reset", "password", "email", "link", "account"]
    score = sum(1 for k in keywords if k in response.content.lower()) / len(keywords)
    return {"score": score, "latency_ms": response.latency_ms}

@eval_case(min_score=0.80, tags=["agent"])
async def test_refund_policy_response():
    response = await support_agent.run("What is your refund policy?")
    keywords = ["refund", "days", "policy", "contact", "eligible"]
    score = sum(1 for k in keywords if k in response.content.lower()) / len(keywords)
    return {"score": score, "cost_usd": response.cost_usd}
```

---

## See also

- [Quickstart](/docs/evalci/quickstart) — set up in 5 minutes
- [Writing eval cases](/docs/evalci/writing-evals) — writing better evals
- [Action reference](/docs/evalci/action-reference) — all inputs and outputs
- [Evaluation overview](/docs/evaluation/overview) — built-in metrics
- [CLI reference — synapsekit test](/docs/cli/test) — local eval runs
