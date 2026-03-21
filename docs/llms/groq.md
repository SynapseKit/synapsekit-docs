---
sidebar_position: 9
---

# Groq

Ultra-fast inference with Groq's LPU (Language Processing Unit) hardware. Supports Llama, Mixtral, Gemma, and other open models.

## Install

```bash
pip install synapsekit[groq]
```

## Usage

```python
from synapsekit.llm.groq import GroqLLM
from synapsekit import LLMConfig

config = LLMConfig(
    model="llama-3.3-70b-versatile",
    api_key="gsk_...",
    provider="groq",
)

llm = GroqLLM(config)

# Streaming
async for token in llm.stream("Explain quantum computing"):
    print(token, end="")

# Generate
response = await llm.generate("What is Rust?")
```

## Available models

| Model | Context | Speed (tok/s) | Notes |
|---|---|---|---|
| `llama-3.3-70b-versatile` | 128K | ~500 | Best quality |
| `llama-3.1-8b-instant` | 128K | ~800 | Fastest |
| `llama-3.2-90b-vision-preview` | 128K | ~300 | Multimodal (preview) |
| `mixtral-8x7b-32768` | 32K | ~600 | Good balance |
| `gemma2-9b-it` | 8K | ~700 | Google Gemma |
| `llama-guard-3-8b` | 8K | ~800 | Safety classifier |

## Function calling

Groq supports native function calling on most Llama and Gemma models:

```python
from synapsekit import FunctionCallingAgent, tool
from synapsekit.llm.groq import GroqLLM
from synapsekit import LLMConfig

@tool
def get_latest_news(topic: str, count: int = 3) -> list:
    """Get the latest news headlines for a topic."""
    # In practice, call a news API
    return [
        {"title": f"Breaking: {topic} update #{i}", "source": "Reuters"}
        for i in range(1, count + 1)
    ]

@tool
def calculate(expression: str) -> float:
    """Safely evaluate a mathematical expression."""
    import ast
    return float(ast.literal_eval(expression))

llm = GroqLLM(LLMConfig(
    model="llama-3.3-70b-versatile",
    api_key="gsk_...",
))

agent = FunctionCallingAgent(llm=llm, tools=[get_latest_news, calculate])
answer = await agent.run("What are the latest AI news? Also, what is 2**10?")
print(answer)
```

### Raw call_with_tools

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "lookup_product",
            "description": "Look up product details by SKU",
            "parameters": {
                "type": "object",
                "properties": {
                    "sku": {"type": "string"},
                    "include_inventory": {"type": "boolean", "default": False},
                },
                "required": ["sku"],
            },
        },
    }
]

result = await llm.call_with_tools(
    messages=[{"role": "user", "content": "What's in stock for SKU-12345?"}],
    tools=tools,
)
```

## Auto-detection

The RAG facade auto-detects Groq for `llama`, `mixtral`, and `gemma` model prefixes:

```python
from synapsekit import RAG

rag = RAG(model="llama-3.3-70b-versatile", api_key="gsk_...")
rag.add("Your document text here")
answer = rag.ask_sync("Summarize this.")
```

## Rate limits

| Tier | Requests/min | Tokens/min | Tokens/day |
|---|---|---|---|
| Free | 30 | 14,400 | 500,000 |
| Dev ($0/mo) | 30 | 14,400 | 500,000 |
| Paid | 3,500 | 500,000 | Unlimited |

For high-throughput workloads, use `requests_per_minute` to throttle:

```python
llm = GroqLLM(LLMConfig(
    model="llama-3.1-8b-instant",
    api_key="gsk_...",
    requests_per_minute=28,  # stay under free tier limit
))
```

## Latency benchmarks

Groq is the fastest cloud inference option for open models:

| Provider | Model | Median latency | Throughput |
|---|---|---|---|
| Groq | Llama 3.1 8B | ~0.2s | ~800 tok/s |
| Groq | Llama 3.3 70B | ~0.5s | ~500 tok/s |
| Together AI | Llama 3.1 8B | ~0.8s | ~200 tok/s |
| OpenAI | gpt-4o-mini | ~1.2s | ~120 tok/s |

## Cost tracking

```python
from synapsekit.observability import CostTracker

tracker = CostTracker()
llm = GroqLLM(LLMConfig(model="llama-3.3-70b-versatile", api_key="gsk_..."))
llm.attach_tracker(tracker)

for i in range(10):
    await llm.generate(f"Translate to French: message {i}")

print(f"Total cost: ${tracker.total_cost_usd:.6f}")
```

## Error handling

```python
from synapsekit.exceptions import LLMError, RateLimitError, AuthenticationError

try:
    response = await llm.generate("Hello")
except AuthenticationError:
    print("Invalid API key — get one at console.groq.com")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except LLMError as e:
    print(f"Groq error: {e}")
```

:::tip
Groq is ideal for latency-sensitive applications. Most models respond in under 500ms for short prompts. Use `llama-3.1-8b-instant` when you need the absolute fastest responses.
:::
