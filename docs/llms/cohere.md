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
| `command-light` | 4K | Legacy, fastest | $0.30 / $0.60 |

### Embedding models

| Model | Dimensions | Max tokens | Best for |
|---|---|---|---|
| `embed-english-v3.0` | 1024 | 512 | English text |
| `embed-multilingual-v3.0` | 1024 | 512 | 100+ languages |
| `embed-english-light-v3.0` | 384 | 512 | Fast English |
| `embed-multilingual-light-v3.0` | 384 | 512 | Fast multilingual |

### Reranking models

| Model | Languages | Best for |
|---|---|---|
| `rerank-english-v3.0` | English | High-accuracy English reranking |
| `rerank-multilingual-v3.0` | 100+ | Multilingual reranking |
| `rerank-english-v2.0` | English | Legacy |

## Basic usage

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
# Expected output: RAG combines a retrieval system with a language model...
```

## Streaming

```python
async for token in llm.stream("Write a Python function to compute cosine similarity"):
    print(token, end="", flush=True)
# Streams a full function definition
```

## Function calling / tool use

Command R and Command R+ support native tool use with structured outputs:

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

result = await agent.arun("Find articles about RAG and give me the full content of the top result")
print(result)
```

### Direct `call_with_tools`

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
        },
    }
]

result = await llm.call_with_tools(
    messages=[{"role": "user", "content": "Weather in London?"}],
    tools=tools,
)
```

## Embedding models

Generate embeddings for semantic search and clustering:

```python
import cohere
from synapsekit.embeddings.cohere import CohereEmbedder

embedder = CohereEmbedder(
    model="embed-english-v3.0",
    api_key="...",
)

# Single text
embedding = await embedder.embed("What is retrieval-augmented generation?")
print(len(embedding))  # 1024

# Batch
texts = ["RAG combines retrieval with generation", "Vector databases store embeddings"]
embeddings = await embedder.embed_batch(texts)
print(len(embeddings))  # 2
```

## Reranking

Rerank retrieval results for higher precision:

```python
from synapsekit.retrievers.cohere_reranker import CohereReranker

reranker = CohereReranker(
    model="rerank-english-v3.0",
    api_key="...",
)

query = "What is RAG?"
documents = [
    "RAG stands for Retrieval-Augmented Generation",
    "Python is a programming language",
    "Vector search enables semantic similarity",
    "RAG combines LLMs with document retrieval for accurate answers",
]

results = await reranker.rerank(query=query, documents=documents, top_n=2)
for r in results:
    print(f"Score: {r.relevance_score:.3f} — {r.document}")
# Score: 0.998 — RAG combines LLMs with document retrieval for accurate answers
# Score: 0.987 — RAG stands for Retrieval-Augmented Generation
```

## RAG with Cohere Command R

Command R is specifically optimized for RAG. Use the `documents` parameter for grounded generation:

```python
from synapsekit import RAG

rag = RAG(model="command-r-08-2024", api_key="...")
rag.add("SynapseKit is an async-first Python library for building LLM applications.")
rag.add("It supports OpenAI, Anthropic, Gemini, Cohere, and 10+ other providers.")

answer = rag.ask_sync("What providers does SynapseKit support?")
print(answer)
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
except cohere.CohereAPIError as e:
    print(f"Cohere error: {e}")
```

## Environment variables

| Variable | Description |
|---|---|
| `CO_API_KEY` | Cohere API key |
| `COHERE_API_KEY` | Alternative environment variable name |

## See also

- [Vector stores overview](../rag/vector-stores)
- [RAG pipeline](../rag/pipeline)
- [Cohere docs](https://docs.cohere.com/docs/models)
