---
sidebar_position: 11
---

# OpenRouter

[OpenRouter](https://openrouter.ai/) is a unified API that provides access to 200+ models from OpenAI, Anthropic, Meta, Mistral, Google, and more -- with automatic fallback and load balancing.

## Install

```bash
pip install synapsekit[openai]
```

OpenRouter uses the OpenAI-compatible API, so it requires the `openai` package.

## Usage

```python
from synapsekit import LLMConfig
from synapsekit.llm.openrouter import OpenRouterLLM

llm = OpenRouterLLM(LLMConfig(
    model="openai/gpt-4o",
    api_key="sk-or-...",
))

async for token in llm.stream("What is RAG?"):
    print(token, end="", flush=True)
```

## Available models

OpenRouter supports 200+ models. Model IDs follow the `provider/model-name` format:

| Model | ID | Input (per 1M) | Output (per 1M) |
|---|---|---|---|
| GPT-4o | `openai/gpt-4o` | $2.50 | $10.00 |
| GPT-4o Mini | `openai/gpt-4o-mini` | $0.15 | $0.60 |
| Claude Sonnet 4.6 | `anthropic/claude-sonnet-4-6` | $3.00 | $15.00 |
| Llama 3.3 70B | `meta-llama/llama-3.3-70b-instruct` | $0.12 | $0.40 |
| Mixtral 8x7B | `mistralai/mixtral-8x7b-instruct` | $0.24 | $0.24 |
| Gemini Pro | `google/gemini-pro` | $0.50 | $1.50 |
| DeepSeek V3 | `deepseek/deepseek-chat` | $0.07 | $1.10 |
| Qwen 2.5 72B | `qwen/qwen-2.5-72b-instruct` | $0.13 | $0.40 |

See the full list at [openrouter.ai/models](https://openrouter.ai/models).

## Function calling

```python
result = await llm.call_with_tools(messages, tools)
```

Function calling support depends on the underlying model.

```python
from synapsekit import FunctionCallingAgent, tool
from synapsekit.llm.openrouter import OpenRouterLLM

@tool
def get_news(topic: str, count: int = 5) -> list:
    """Get recent news headlines about a topic."""
    return [{"title": f"News about {topic} #{i}"} for i in range(count)]

llm = OpenRouterLLM(LLMConfig(
    model="anthropic/claude-sonnet-4-6",
    api_key="sk-or-...",
))

agent = FunctionCallingAgent(llm=llm, tools=[get_news])
answer = await agent.run("What's happening in AI today?")
```

## Auto-detection

Models with a `/` in the name are auto-detected as OpenRouter:

```python
from synapsekit import RAG

rag = RAG(model="openai/gpt-4o", api_key="sk-or-...")
rag.add("Your document text here")
answer = rag.ask_sync("Summarize this.")
```

## Model routing by complexity

Use OpenRouter to route simple queries to cheap models and complex ones to powerful models:

```python
from synapsekit.llm.openrouter import OpenRouterLLM
from synapsekit import LLMConfig

async def route_by_complexity(query: str, api_key: str) -> str:
    """Use cheap model for simple queries, expensive for complex ones."""
    word_count = len(query.split())

    if word_count < 20:
        # Simple query: use cheapest option
        model = "meta-llama/llama-3.3-70b-instruct"
    elif word_count < 100:
        # Medium complexity
        model = "openai/gpt-4o-mini"
    else:
        # Complex query: use best model
        model = "anthropic/claude-sonnet-4-6"

    llm = OpenRouterLLM(LLMConfig(model=model, api_key=api_key))
    return await llm.generate(query)

result = await route_by_complexity(
    "Explain quantum entanglement and its implications for computing.",
    api_key="sk-or-..."
)
```

## Custom base URL

```python
llm = OpenRouterLLM(config, base_url="http://localhost:8000/v1")
```

## Parameters

| Parameter | Description |
|---|---|
| `model` | Any model ID from OpenRouter (e.g. `openai/gpt-4o`) |
| `api_key` | Your OpenRouter API key |
| `base_url` | Custom API base URL (default: `https://openrouter.ai/api/v1`) |

## LLMConfig options

| Parameter | Type | Default | Description |
|---|---|---|---|
| `temperature` | float | `1.0` | Sampling temperature |
| `max_tokens` | int | None | Maximum output tokens |
| `max_retries` | int | `3` | Auto-retry on transient errors |
| `requests_per_minute` | int | None | Rate throttle |
| `cache_backend` | str | None | `"sqlite"` or `"lru"` |

## Error handling

```python
from synapsekit.exceptions import LLMError, RateLimitError, AuthenticationError

try:
    response = await llm.generate("Hello")
except AuthenticationError:
    print("Invalid API key -- get one at openrouter.ai/keys")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except LLMError as e:
    print(f"OpenRouter error: {e}")
```

:::tip
OpenRouter is ideal for experimenting with many models using a single API key, or for building systems that need automatic model fallback when a provider is down.
:::
