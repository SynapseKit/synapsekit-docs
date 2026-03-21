---
sidebar_position: 7
---

# PromptHub

PromptHub is a local filesystem prompt registry that lets you version, push, pull, and share prompt templates across your team — without any external service.

Prompts are stored at `~/.synapsekit/prompts/{org}/{name}/{version}.json`.

## Installation

```bash
pip install synapsekit
```

PromptHub has no additional dependencies — it uses the standard library only.

## Quick start

```python
from synapsekit import PromptHub

hub = PromptHub()

# Push a prompt
hub.push("acme/summarize", "Summarize the following text in {style} style:\n\n{text}", version="v1")

# Pull and use it
tpl = hub.pull("acme/summarize:v1")
print(tpl.format(style="bullet points", text="SynapseKit is a Python framework..."))
# Expected output:
# Summarize the following text in bullet points style:
#
# SynapseKit is a Python framework...
```

## push()

Store a prompt template at a versioned path.

```python
hub.push(name, template, version="latest")
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `name` | `str` | required | Ref in `"org/name"` format |
| `template` | `str` | required | The prompt template string |
| `version` | `str` | `"latest"` | Version tag (e.g. `"v1"`, `"v2"`, `"prod"`) |

```python
hub = PromptHub()

# Basic push
hub.push("acme/classify", "Classify this text: {text}", version="v1")

# Push a new version
hub.push("acme/classify", "Classify the following into {categories}: {text}", version="v2")

# Push with custom hub directory
hub = PromptHub(hub_dir="/shared/prompts")
hub.push("team/rag-query", "Answer based on context:\n\nContext: {context}\n\nQuestion: {question}", version="v1")
```

## pull()

Retrieve a prompt template by ref.

```python
tpl = hub.pull(ref)
```

| Parameter | Type | Description |
|---|---|---|
| `ref` | `str` | Ref in `"org/name:version"` or `"org/name"` (defaults to `"latest"`) |

```python
hub = PromptHub()

# Pull a specific version
tpl = hub.pull("acme/classify:v2")
result = tpl.format(categories="sports, politics, tech", text="The new iPhone was announced today")
print(result)
# Expected output:
# Classify the following into sports, politics, tech: The new iPhone was announced today

# Pull latest (omit version)
tpl = hub.pull("acme/classify")

# Use with RAGPipeline
from synapsekit import RAG, PromptHub
from synapsekit.llms.openai import OpenAILLM

hub = PromptHub()
tpl = hub.pull("acme/rag-query:v1")
llm = OpenAILLM(model="gpt-4o-mini")
rag = RAG(llm=llm, prompt_template=tpl)
```

## list()

List all available prompts, optionally filtered by org.

```python
names = hub.list()          # all prompts
names = hub.list("acme")    # only acme org
```

```python
hub = PromptHub()
hub.push("acme/summarize", "Summarize: {text}", version="v1")
hub.push("acme/classify", "Classify: {text}", version="v1")
hub.push("team/qa", "Answer: {question}", version="v1")

print(hub.list())
# Expected output:
# ['acme/classify', 'acme/summarize', 'team/qa']

print(hub.list("acme"))
# Expected output:
# ['acme/classify', 'acme/summarize']
```

## versions()

List all available versions of a prompt.

```python
versions = hub.versions("acme/summarize")
```

```python
hub = PromptHub()
hub.push("acme/summarize", "Summarize: {text}", version="v1")
hub.push("acme/summarize", "Summarize in {style}: {text}", version="v2")
hub.push("acme/summarize", "Summarize in {style} using {tone} tone: {text}", version="v3")

print(hub.versions("acme/summarize"))
# Expected output:
# ['v1', 'v2', 'v3']
```

## Storage layout

Prompts are stored as JSON files:

```
~/.synapsekit/prompts/
└── acme/
    ├── summarize/
    │   ├── v1.json
    │   ├── v2.json
    │   └── latest.json
    └── classify/
        └── v1.json
```

Each `.json` file contains:
```json
{"template": "Summarize the following text in {style} style:\n\n{text}"}
```

## Custom hub directory

```python
# Use a shared directory for team collaboration
hub = PromptHub(hub_dir="/shared/team-prompts")

# Or set per environment
import os
hub = PromptHub(hub_dir=os.getenv("PROMPT_HUB_DIR", "~/.synapsekit/prompts"))
```

## Team workflow: commit prompts to git

Store prompts in your repo and load them at runtime:

```python
# scripts/push_prompts.py — run once to populate the hub
from synapsekit import PromptHub

hub = PromptHub(hub_dir="./prompts")  # repo-local directory

hub.push("acme/rag-query", open("prompts/rag-query-v2.txt").read(), version="v2")
hub.push("acme/summarize", open("prompts/summarize-v1.txt").read(), version="v1")
```

```python
# In your application
hub = PromptHub(hub_dir="./prompts")
tpl = hub.pull("acme/rag-query:v2")
```

## Integration with RAGPipeline

```python
from synapsekit import RAG, PromptHub, LLMConfig
from synapsekit.llms.openai import OpenAILLM

hub = PromptHub()
hub.push(
    "acme/rag",
    "Use the following context to answer the question.\n\nContext:\n{context}\n\nQuestion: {question}\n\nAnswer:",
    version="v1"
)

llm = OpenAILLM(model="gpt-4o-mini")
tpl = hub.pull("acme/rag:v1")
rag = RAG(llm=llm, prompt_template=tpl)

result = await rag.aquery("What is retrieval-augmented generation?")
```

## A/B testing prompts

```python
import random
from synapsekit import PromptHub, RAG
from synapsekit.llms.openai import OpenAILLM

hub = PromptHub()
llm = OpenAILLM(model="gpt-4o-mini")

async def query_with_ab(question: str) -> str:
    # 50/50 split between prompt versions
    version = random.choice(["v1", "v2"])
    tpl = hub.pull(f"acme/rag:{version}")
    rag = RAG(llm=llm, prompt_template=tpl)
    result = await rag.aquery(question)
    return result, version
```

## See also

- [PromptTemplate](./prompts) — the template class returned by `pull()`
- [RAGPipeline](./pipeline) — using prompt templates in RAG
- [CostTracker](../observability/cost-tracker) — track cost per prompt version
