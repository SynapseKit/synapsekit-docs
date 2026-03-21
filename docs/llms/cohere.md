---
sidebar_position: 5
---

# Cohere

Cohere provides Command R and Command R+ models optimized for retrieval-augmented generation, along with best-in-class embedding and reranking models.

## Installation

```bash
pip install synapsekit[cohere]
export CO_API_KEY=...
```

## Models

### Chat / generation models

| Model | Context window | Best for | Cost (input / output per 1M tokens) |
|---|---|---|---|
| `command-r-plus-08-2024` | 128K | Complex reasoning, tool use | $2.50 / $10.00 |
| `command-r-08-2024` | 128K | RAG, fast responses | $0.15 / $0.60 |
| `command-r-plus` | 128K | Previous generation flagship | $3.00 / $15.00 |
| `command-r` | 128K | Previous generation balanced | $0.50 / $1.50 |
| `command` | 4K | Legacy, short tasks | $1.00 / $2.00 |

### Embedding models

| Model | Dimensions | Best for |
|---|---|---|
| `embed-english-v3.0` | 1024 | English text |
| `embed-multilingual-v3.0` | 1024 | 100+ languages |
| `embed-english-light-v3.0` | 384 | Fast English |

### Reranking models

| Model | Best for |
|---|---|
| `rerank-english-v3.0` | High-accuracy English reranking |
| `rerank-multilingual-v3.0` | Multilingual reranking |

## Via the RAG facade

```python
from synapsekit import RAG

rag = RAG(model="command-r-08-2024", api_key="...")
rag.add("Your document text here")

answer = rag.ask_sync("Summarize the document.")
```

## Direct usage

```python
from synapsekit.llm.cohere import CohereLLM
from synapsekit.llm.base import LLMConfig

llm = CohereLLM(LLMConfig(
    model="command-r-08-2024",
    api_key="...",
    provider="cohere",
    temperature=0.3,
    max_tokens=1024,
))

response = await llm.generate("Explain retrieval-augmented generation in three sentences")
print(response)
```

## Streaming

```python
async for token in llm.stream("Write a Python function to compute cosine similarity"):
    print(token, end="", flush=True)
```

## Function calling / tool use

Command R and Command R+ support native tool use:

```python
from synapsekit.tools import tool
from synapsekit.agents import FunctionCallingAgent
from synapsekit.llm.cohere import CohereLLM

@tool
def search_documents(query: str, top_k: int = 5) -> list[dict]:
    """Search the document store for relevant passages."""
    return [
        {"id": 1, "text": "Vector embeddings represent semantic meaning...", "score": 0.92},
        {"id": 2, "text": "RAG retrieves context before generation...", "score": 0.87},
    ]

@tool
def get_document(doc_id: int) -> str:
    """Retrieve the full text of a document by ID."""
    docs = {1: "Full article on vector embeddings...", 2: "Full article on RAG..."}
    return docs.get(doc_id, "Not found")

llm = CohereLLM(LLMConfig(model="command-r-plus-08-2024", api_key="...", provider="cohere"))
agent = FunctionCallingAgent(llm=llm, tools=[search_documents, get_document])

result = await agent.arun("Find articles about RAG and get the full content of the top result")
print(result)
```

## Reranking

Rerank retrieval results for higher precision:

```python
from synapsekit.retrievers.cohere_reranker import CohereReranker

reranker = CohereReranker(model="rerank-english-v3.0", api_key="...")

query = "What is RAG?"
documents = [
    "RAG stands for Retrieval-Augmented Generation",
    "Python is a programming language",
    "RAG combines LLMs with document retrieval for accurate answers",
]

results = await reranker.rerank(query=query, documents=documents, top_n=2)
for r in results:
    print(f"Score: {r.relevance_score:.3f} — {r.document}")
```

## Cost tracking

```python
from synapsekit import CostTracker
from synapsekit.llm.cohere import CohereLLM

tracker = CostTracker()
llm = CohereLLM(LLMConfig(model="command-r-08-2024", api_key="...", provider="cohere"))

with tracker.scope("rag-query"):
    response = await llm.generate("Summarize the benefits of RAG")
    rec = tracker.record("command-r-08-2024", input_tokens=100, output_tokens=150)

print(f"Cost: ${rec.cost_usd:.6f}")
```

## Error handling

```python
import cohere
from synapsekit.llm.cohere import CohereLLM

llm = CohereLLM(LLMConfig(
    model="command-r-08-2024",
    api_key="...",
    provider="cohere",
    max_retries=3,
))

try:
    response = await llm.generate("Hello")
except cohere.TooManyRequestsError:
    print("Rate limit exceeded — reduce request frequency")
except cohere.UnauthorizedError:
    print("Invalid API key — check CO_API_KEY")
```

## Environment variables

| Variable | Description |
|---|---|
| `CO_API_KEY` | Cohere API key |
| `COHERE_API_KEY` | Alternative environment variable name |

## Supported models

- `command-r-plus-08-2024` — most capable
- `command-r-08-2024` — faster, cheaper, RAG-optimized
- `command-r-plus` — previous generation
- `command-r` — previous generation balanced
- `command` — legacy

See [Cohere docs](https://docs.cohere.com/docs/models) for the full list.

## See also

- [RAG pipeline](../rag/pipeline)
- [Cohere docs](https://docs.cohere.com/docs/models)
