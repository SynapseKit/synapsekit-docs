---
sidebar_position: 15
---

# Cerebras

[Cerebras](https://cerebras.ai/) provides ultra-fast inference on their custom Wafer-Scale Engine (WSE) hardware. With speeds exceeding 2,100 tokens/second, Cerebras is the fastest cloud inference option available for supported models.

## Install

```bash
pip install synapsekit[openai]
```

Cerebras uses the OpenAI-compatible API, so it requires the `openai` package.

## Basic usage

```python
from synapsekit import LLMConfig
from synapsekit.llm.cerebras import CerebrasLLM

llm = CerebrasLLM(LLMConfig(
    model="llama3.1-70b",
    api_key="csk-...",
))

response = await llm.generate("Explain large language models in three sentences.")
print(response)
# Large language models are trained on vast text datasets...
```

## Streaming

```python
from synapsekit import LLMConfig
from synapsekit.llm.cerebras import CerebrasLLM

llm = CerebrasLLM(LLMConfig(
    model="llama3.1-8b",
    api_key="csk-...",
))

async for token in llm.stream("Write a quicksort implementation in Python."):
    print(token, end="", flush=True)
# def quicksort(arr):
#     if len(arr) <= 1:
#         return arr
#     ...
```

## Available models

| Model | Context | Speed (tok/s) | Best for |
|---|---|---|---|
| `llama3.1-8b` | 128K | ~2,100 | Ultra-fast, interactive tasks |
| `llama3.1-70b` | 128K | ~450 | High quality, still very fast |
| `llama-3.3-70b` | 128K | ~450 | Latest Llama 3.3 weights |

:::tip
`llama3.1-8b` on Cerebras is typically 10x faster than the same model on GPU-based providers, making it ideal for chatbots and real-time applications.
:::

## Speed comparison

| Provider | Model | Median speed (tok/s) |
|---|---|---|
| Cerebras | Llama 3.1 8B | ~2,100 |
| Cerebras | Llama 3.1 70B | ~450 |
| Groq | Llama 3.1 8B | ~800 |
| Together AI | Llama 3.1 8B | ~200 |
| OpenAI | gpt-4o-mini | ~120 |

## Function calling

Cerebras supports OpenAI-compatible function calling on Llama models:

```python
from synapsekit import FunctionCallingAgent, tool
from synapsekit import LLMConfig
from synapsekit.llm.cerebras import CerebrasLLM

@tool
def get_stock_price(ticker: str) -> dict:
    """Get the current stock price for a ticker symbol."""
    # In practice, call a real market data API
    prices = {"AAPL": 189.30, "GOOG": 175.20, "MSFT": 415.50}
    return {"ticker": ticker, "price": prices.get(ticker, 0.0), "currency": "USD"}

@tool
def calculate_portfolio_value(holdings: dict) -> float:
    """Calculate total portfolio value given a dict of {ticker: shares}."""
    # Simplified calculation
    prices = {"AAPL": 189.30, "GOOG": 175.20, "MSFT": 415.50}
    total = sum(shares * prices.get(ticker, 0) for ticker, shares in holdings.items())
    return round(total, 2)

llm = CerebrasLLM(LLMConfig(model="llama3.1-70b", api_key="csk-..."))
agent = FunctionCallingAgent(llm=llm, tools=[get_stock_price, calculate_portfolio_value])

answer = await agent.run("What is AAPL's price and what is my portfolio worth if I have 10 AAPL and 5 MSFT?")
print(answer)
# AAPL is trading at $189.30. Your portfolio (10 AAPL + 5 MSFT) is worth $3,970.50.
```

### Raw `call_with_tools`

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "run_sql_query",
            "description": "Execute a SQL query and return results",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "SQL SELECT query"},
                    "limit": {"type": "integer", "default": 10},
                },
                "required": ["query"],
            },
        },
    }
]

result = await llm.call_with_tools(
    messages=[{"role": "user", "content": "Show me the top 5 users by order count"}],
    tools=tools,
)
# result["tool_calls"] → [{"name": "run_sql_query", "arguments": {"query": "SELECT user_id, COUNT(*) FROM orders GROUP BY user_id ORDER BY COUNT(*) DESC LIMIT 5"}}]
```

## Batch processing

For high-throughput workloads, run multiple concurrent requests:

```python
import asyncio
from synapsekit import LLMConfig
from synapsekit.llm.cerebras import CerebrasLLM

llm = CerebrasLLM(LLMConfig(model="llama3.1-8b", api_key="csk-..."))

prompts = [
    "Translate to Spanish: Hello world",
    "Translate to French: Hello world",
    "Translate to German: Hello world",
    "Translate to Japanese: Hello world",
    "Translate to Arabic: Hello world",
]

# Fire all requests concurrently
results = await asyncio.gather(*[llm.generate(p) for p in prompts])
for prompt, result in zip(prompts, results):
    print(f"{prompt[:30]} → {result}")
# Translate to Spanish: Hello w → Hola mundo
# Translate to French: Hello wo → Bonjour le monde
# ...
```

## Cost tracking

```python
from synapsekit.observability import CostTracker

tracker = CostTracker()
llm = CerebrasLLM(LLMConfig(model="llama3.1-70b", api_key="csk-..."))
llm.attach_tracker(tracker)

await llm.generate("Summarize the history of computing in 200 words.")
print(f"Cost: ${tracker.total_cost_usd:.6f}")
```

## Custom base URL

```python
llm = CerebrasLLM(
    LLMConfig(model="llama3.1-70b", api_key="csk-..."),
    base_url="http://localhost:8000/v1",
)
```

## Parameters reference

| Parameter | Description |
|---|---|
| `model` | Cerebras model ID (e.g. `llama3.1-70b`) |
| `api_key` | Your Cerebras API key (starts with `csk-`) |
| `temperature` | Sampling temperature (0.0–1.0) |
| `max_tokens` | Maximum output tokens |
| `base_url` | Custom API base URL (default: `https://api.cerebras.ai/v1`) |

## Error handling

```python
from synapsekit.exceptions import LLMError, RateLimitError, AuthenticationError

try:
    response = await llm.generate("Hello")
except AuthenticationError:
    print("Invalid API key — get one at cloud.cerebras.ai")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except LLMError as e:
    print(f"Cerebras error: {e}")
```

:::tip
Cerebras is ideal for latency-sensitive use cases like streaming chatbots, real-time code completion, and interactive agents. The extreme token throughput means users see meaningful output almost instantly.
:::
