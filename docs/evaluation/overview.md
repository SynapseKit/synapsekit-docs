---
sidebar_position: 1
---

# Evaluation

SynapseKit includes built-in evaluation metrics for measuring the quality of RAG and LLM outputs. Inspired by RAGAS-style evaluation, these metrics help you quantify faithfulness, relevancy, and groundedness.

## Metrics

### FaithfulnessMetric

Measures whether the generated answer is faithful to the source documents (i.e., does not hallucinate):

```python
from synapsekit import FaithfulnessMetric

metric = FaithfulnessMetric(llm=llm)

score = await metric.score(
    question="What is Python?",
    answer="Python is a compiled language created in 1991.",
    contexts=["Python is an interpreted language created by Guido van Rossum in 1991."],
)
# score → 0.5 (partially faithful — creation date correct, but "compiled" is wrong)
```

### RelevancyMetric

Measures how relevant the answer is to the question asked:

```python
from synapsekit import RelevancyMetric

metric = RelevancyMetric(llm=llm)

score = await metric.score(
    question="What is the capital of France?",
    answer="Paris is the capital and largest city of France.",
)
# score → 1.0 (highly relevant)
```

### GroundednessMetric

Measures how well the answer is grounded in the retrieved context:

```python
from synapsekit import GroundednessMetric

metric = GroundednessMetric(llm=llm)

score = await metric.score(
    answer="SynapseKit supports 15 LLM providers.",
    contexts=["SynapseKit supports 15 LLM providers including OpenAI, Anthropic, and Gemini."],
)
# score → 1.0 (fully grounded)
```

## EvaluationPipeline

Run multiple metrics over a dataset in one call:

```python
from synapsekit import EvaluationPipeline, FaithfulnessMetric, RelevancyMetric, GroundednessMetric

pipeline = EvaluationPipeline(
    metrics=[
        FaithfulnessMetric(llm=llm),
        RelevancyMetric(llm=llm),
        GroundednessMetric(llm=llm),
    ],
)

results = await pipeline.evaluate(
    questions=["What is RAG?", "How does SynapseKit work?"],
    answers=["RAG is retrieval-augmented generation.", "SynapseKit is a Python framework."],
    contexts=[
        ["RAG combines retrieval with generation for grounded answers."],
        ["SynapseKit is a Python library for building LLM applications."],
    ],
)

for r in results:
    print(r)
    # EvaluationResult(faithfulness=0.95, relevancy=0.90, groundedness=0.88, mean_score=0.91)
```

## EvaluationResult

Each result contains per-metric scores and a convenience `mean_score`:

```python
result = results[0]

print(result.faithfulness)   # 0.95
print(result.relevancy)      # 0.90
print(result.groundedness)   # 0.88
print(result.mean_score)     # 0.91
```
