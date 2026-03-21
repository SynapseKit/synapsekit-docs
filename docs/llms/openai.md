---
sidebar_position: 2
---

# OpenAI

Use OpenAI's GPT models with streaming, function calling, vision, and structured output.

## Install

```bash
pip install synapsekit[openai]
```

## Usage

```python
from synapsekit.llms import OpenAILLM, LLMConfig

llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    temperature=0.7,
))

# Streaming
async for token in llm.stream("Tell me about async Python."):
    print(token, end="", flush=True)

# Full response
response = await llm.generate("Tell me about async Python.")
print(response)
```

## Available models

| Model | Context | Input (per 1M tokens) | Output (per 1M tokens) | Notes |
|---|---|---|---|---|
| `gpt-4o` | 128K | $2.50 | $10.00 | Best quality, multimodal |
| `gpt-4o-mini` | 128K | $0.15 | $0.60 | Fast and cheap |
| `gpt-4-turbo` | 128K | $10.00 | $30.00 | Legacy high-quality |
| `gpt-3.5-turbo` | 16K | $0.50 | $1.50 | Legacy, cheapest |
| `o1` | 200K | $15.00 | $60.00 | Reasoning, no streaming |
| `o1-mini` | 128K | $3.00 | $12.00 | Reasoning, fast |
| `o3-mini` | 200K | $1.10 | $4.40 | Latest reasoning |

Any model supported by the OpenAI API works.

## Function calling

Use the `@tool` decorator or pass raw JSON Schema. SynapseKit auto-generates schemas from Python type hints.

```python
from synapsekit import tool, FunctionCallingAgent
from synapsekit.llms import OpenAILLM, LLMConfig

@tool
def get_weather(city: str, unit: str = "celsius") -> str:
    """Get current weather for a city."""
    return f"Weather in {city}: 22 degrees {unit}, sunny"

@tool
def calculate(expression: str) -> float:
    """Evaluate a math expression."""
    return eval(expression)

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))
agent = FunctionCallingAgent(llm=llm, tools=[get_weather, calculate])

answer = await agent.run("What's the weather in Paris? Also, what's 144 / 12?")
print(answer)
```

### Raw tool schema

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "Search the web for information",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "num_results": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
        },
    }
]

result = await llm.call_with_tools(
    messages=[{"role": "user", "content": "What happened in AI this week?"}],
    tools=tools,
)
# {"content": None, "tool_calls": [{"id": "call_abc123", "name": "search_web", "arguments": {"query": "AI news this week"}}]}
```

## Vision

Pass images alongside text using `ImageContent`:

```python
from synapsekit.multimodal import ImageContent

message = {
    "role": "user",
    "content": [
        ImageContent.from_url("https://example.com/chart.png"),
        {"type": "text", "text": "Describe this chart."},
    ],
}

response = await llm.generate(message)
```

```python
# From local file
from synapsekit.multimodal import ImageContent

with open("screenshot.png", "rb") as f:
    image = ImageContent.from_bytes(f.read(), media_type="image/png")

response = await llm.generate([image, "What's in this image?"])
```

## LLMConfig options

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | str | required | OpenAI model name |
| `api_key` | str | required | Your OpenAI API key |
| `temperature` | float | `1.0` | Sampling temperature (0-2) |
| `max_tokens` | int | None | Maximum output tokens |
| `seed` | int | None | For deterministic outputs |
| `max_retries` | int | `3` | Auto-retry on transient errors |
| `requests_per_minute` | int | None | Rate limit (RPM) throttle |
| `cache_backend` | str | None | `"sqlite"` or `"lru"` |

## Response caching

Enable caching to avoid re-requesting the same prompt:

```python
llm = OpenAILLM(LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    cache_backend="sqlite",
    cache_path="~/.synapsekit/cache.db",
))

# First call hits the API
response1 = await llm.generate("What is Python?")

# Second call is served from cache
response2 = await llm.generate("What is Python?")
```

## Cost tracking

```python
from synapsekit.observability import CostTracker

tracker = CostTracker()
llm = OpenAILLM(LLMConfig(model="gpt-4o", api_key="sk-..."))
llm.attach_tracker(tracker)

await llm.generate("Summarize the Python docs.")
await llm.generate("Write a haiku about async.")

print(tracker.total_cost_usd)
print(tracker.summary())
```

## Reasoning models (o1, o3)

The `o1` and `o3` series have different constraints:

```python
# o1 does not support streaming or system messages
llm = OpenAILLM(LLMConfig(
    model="o1",
    api_key="sk-...",
    # Do not set temperature -- unsupported for o1
))

response = await llm.generate("Solve this logic puzzle: ...")
```

:::caution
`o1` and `o3-mini` do not support `stream()`, system messages, or `temperature`. Use `generate()` only.
:::

## Error handling

```python
from synapsekit.exceptions import LLMError, RateLimitError, AuthenticationError

try:
    response = await llm.generate("Hello")
except AuthenticationError:
    print("Invalid API key")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except LLMError as e:
    print(f"LLM error: {e}")
```

SynapseKit automatically retries on `429 Too Many Requests` and `5xx` errors up to `max_retries` times with exponential backoff.

## Using the RAG facade

```python
from synapsekit import RAG

rag = RAG(model="gpt-4o-mini", api_key="sk-...")
rag.add("SynapseKit is a Python library for building LLM applications.")
rag.add_file("docs/readme.txt")

answer = rag.ask_sync("What is SynapseKit?")
print(answer)
```

:::tip
Set `OPENAI_API_KEY` in your environment and omit `api_key` from `LLMConfig` -- SynapseKit will pick it up automatically.
:::
