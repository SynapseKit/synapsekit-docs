---
sidebar_position: 14
---

# Perplexity AI

[Perplexity AI](https://www.perplexity.ai/) provides search-augmented LLMs with real-time web access. Unlike standard LLMs, Perplexity's Sonar models automatically search the web and include citations in their responses — making them ideal for research, news monitoring, and fact-checking tasks.

## Install

```bash
pip install synapsekit[openai]
```

Perplexity AI uses the OpenAI-compatible API, so it requires the `openai` package.

## Basic usage

```python
from synapsekit import LLMConfig
from synapsekit.llm.perplexity import PerplexityLLM

llm = PerplexityLLM(LLMConfig(
    model="sonar-pro",
    api_key="pplx-...",
))

response = await llm.generate("What are the latest developments in AI safety research?")
print(response)
# Recent AI safety research has focused on... [cites sources]
```

## Streaming

```python
from synapsekit import LLMConfig
from synapsekit.llm.perplexity import PerplexityLLM

llm = PerplexityLLM(LLMConfig(
    model="sonar",
    api_key="pplx-...",
))

async for token in llm.stream("What happened in AI this week?"):
    print(token, end="", flush=True)
# This week in AI: OpenAI announced... Anthropic released... [with citations]
```

## Available Sonar models

| Model | Context | Notes |
|---|---|---|
| `sonar` | 128K | Fast, real-time web search |
| `sonar-pro` | 200K | Higher quality search, deeper research |
| `sonar-reasoning` | 128K | Web search + chain-of-thought reasoning |
| `sonar-reasoning-pro` | 200K | Best quality for complex research questions |
| `sonar-deep-research` | 128K | Multi-step research synthesis |

See the full list at [docs.perplexity.ai](https://docs.perplexity.ai/guides/model-cards).

## Real-time web search

Sonar models automatically search the web for every request. The response includes citations you can access:

```python
from synapsekit import LLMConfig
from synapsekit.llm.perplexity import PerplexityLLM

llm = PerplexityLLM(LLMConfig(model="sonar-pro", api_key="pplx-..."))

# Ask about current events — Perplexity fetches live data
response = await llm.generate("What is the current price of Bitcoin?")
print(response)
# As of March 2026, Bitcoin is trading at approximately $X,XXX...

# Access citations from the raw response
raw = await llm.generate_raw("Latest Python 3.14 release notes")
if hasattr(raw, "citations"):
    for cite in raw.citations:
        print(f"  - {cite}")
```

:::caution
Perplexity models are not suitable for tasks requiring deterministic, reproducible outputs. Because they search the web at inference time, the same prompt may return different answers on different days as news changes.
:::

## Research with Sonar Reasoning

For complex research questions, `sonar-reasoning` combines web search with step-by-step thinking:

```python
llm = PerplexityLLM(LLMConfig(
    model="sonar-reasoning",
    api_key="pplx-...",
))

response = await llm.generate(
    "Compare the performance benchmarks of the latest open-source LLMs released in 2026. "
    "Which ones perform best on coding tasks?"
)
print(response)
# <think>
# Let me search for recent LLM benchmarks...
# </think>
# Based on current benchmarks, the top-performing models for coding in 2026 are...
```

## Combining with RAG

Use Perplexity for freshness and a local vector store for private data:

```python
from synapsekit import RAG
from synapsekit.llm.perplexity import PerplexityLLM
from synapsekit import LLMConfig

# Use Sonar to answer questions that need up-to-date web knowledge
web_llm = PerplexityLLM(LLMConfig(model="sonar-pro", api_key="pplx-..."))

# Use a standard RAG pipeline for your private documents
from synapsekit import RAGPipeline, LLMConfig as RagConfig
private_rag = RAGPipeline(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))
private_rag.add_file("internal_report.pdf")

# Route queries: private docs → RAG, current events → Perplexity
query = "What are the latest regulations for our industry?"
if "latest" in query or "current" in query or "recent" in query:
    answer = await web_llm.generate(query)
else:
    answer = await private_rag.ask(query)
```

## Custom base URL

```python
llm = PerplexityLLM(
    LLMConfig(model="sonar-pro", api_key="pplx-..."),
    base_url="http://localhost:8000/v1",
)
```

## Parameters reference

| Parameter | Description |
|---|---|
| `model` | Perplexity model ID (e.g. `sonar-pro`) |
| `api_key` | Your Perplexity API key (starts with `pplx-`) |
| `temperature` | Sampling temperature (lower = more factual) |
| `max_tokens` | Maximum output tokens |
| `base_url` | Custom API base URL (default: `https://api.perplexity.ai`) |

## Error handling

```python
from synapsekit.exceptions import LLMError, RateLimitError, AuthenticationError

try:
    response = await llm.generate("What's new in machine learning?")
except AuthenticationError:
    print("Invalid API key — get one at perplexity.ai/settings/api")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except LLMError as e:
    print(f"Perplexity error: {e}")
```

:::tip
Use `sonar` for fast lookups and `sonar-pro` for deeper research. If your application needs to verify facts or track current events, Perplexity's search-augmented models are more reliable than asking a static LLM about recent information.
:::
