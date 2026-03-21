---
sidebar_position: 3
---

# Anthropic

Use Anthropic's Claude models with streaming, tool use, vision, and large context windows.

## Install

```bash
pip install synapsekit[anthropic]
```

## Usage

```python
from synapsekit.llms import AnthropicLLM, LLMConfig

llm = AnthropicLLM(LLMConfig(
    model="claude-sonnet-4-6",
    api_key="sk-ant-...",
    temperature=0.7,
    max_tokens=1024,
))

# Streaming
async for token in llm.stream("Explain RAG in simple terms."):
    print(token, end="", flush=True)

# Full response
response = await llm.generate("Explain RAG in simple terms.")
print(response)
```

## Available models

| Model | Context | Input (per 1M) | Output (per 1M) | Notes |
|---|---|---|---|---|
| `claude-opus-4-6` | 200K | $15.00 | $75.00 | Most capable |
| `claude-sonnet-4-6` | 200K | $3.00 | $15.00 | Best balance |
| `claude-haiku-4-5-20251001` | 200K | $0.25 | $1.25 | Fastest, cheapest |

:::note
`max_tokens` is **required** for Anthropic models. The API will reject requests without it.
:::

## Function calling (tool use)

Anthropic uses a `tool_use` flow. SynapseKit handles the multi-step protocol automatically:

1. Send user message + tool schemas
2. Receive `tool_use` block from Claude
3. Execute the tool and collect results
4. Send `tool_result` back in the next message
5. Receive final text response

```python
from synapsekit import tool, FunctionCallingAgent
from synapsekit.llms import AnthropicLLM, LLMConfig

@tool
def get_stock_price(ticker: str) -> dict:
    """Get current stock price for a ticker symbol."""
    prices = {"AAPL": 185.20, "GOOG": 142.50, "MSFT": 415.30}
    return {"ticker": ticker, "price": prices.get(ticker, 0), "currency": "USD"}

@tool
def calculate_portfolio_value(holdings: dict) -> float:
    """Calculate total portfolio value given ticker to shares mapping."""
    return sum(shares * 100 for shares in holdings.values())

llm = AnthropicLLM(LLMConfig(
    model="claude-sonnet-4-6",
    api_key="sk-ant-...",
    max_tokens=2048,
))

agent = FunctionCallingAgent(llm=llm, tools=[get_stock_price, calculate_portfolio_value])
answer = await agent.run("What's the current price of AAPL and MSFT?")
print(answer)
```

### Raw call_with_tools

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "run_sql",
            "description": "Run a SQL SELECT query",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "database": {"type": "string", "default": "main"},
                },
                "required": ["query"],
            },
        },
    }
]

result = await llm.call_with_tools(
    messages=[{"role": "user", "content": "How many users signed up last week?"}],
    tools=tools,
)
# {"content": None, "tool_calls": [{"id": "toolu_01...", "name": "run_sql", "arguments": {...}}]}
```

## Vision

Claude models support image inputs via `MultimodalMessage`:

```python
from synapsekit.multimodal import MultimodalMessage, ImageContent

# From URL
message = MultimodalMessage(
    role="user",
    content=[
        ImageContent.from_url("https://example.com/diagram.png"),
        "Explain what this architecture diagram shows.",
    ],
)

response = await llm.generate(message)
```

```python
# From file bytes
with open("screenshot.png", "rb") as f:
    image_bytes = f.read()

message = MultimodalMessage(
    role="user",
    content=[
        ImageContent.from_bytes(image_bytes, media_type="image/png"),
        "Describe this UI and identify any accessibility issues.",
    ],
)
response = await llm.generate(message)
```

## Large context (200K tokens)

Claude's 200K context window lets you load entire codebases or documents:

```python
import os

# Load all Python files in a project
code_files = []
for root, _, files in os.walk("./myproject"):
    for f in files:
        if f.endswith(".py"):
            with open(os.path.join(root, f)) as fh:
                code_files.append(f"# {f}\n{fh.read()}")

full_codebase = "\n\n".join(code_files)

llm = AnthropicLLM(LLMConfig(
    model="claude-opus-4-6",
    api_key="sk-ant-...",
    max_tokens=4096,
))

response = await llm.generate(
    f"Here is the full codebase:\n\n{full_codebase}\n\nIdentify any security vulnerabilities."
)
```

## LLMConfig options

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | str | required | Claude model name |
| `api_key` | str | required | Your Anthropic API key |
| `max_tokens` | int | **required** | Max output tokens |
| `temperature` | float | `1.0` | Sampling temperature (0-1) |
| `seed` | int | None | For reproducible outputs |
| `max_retries` | int | `3` | Auto-retry on transient errors |
| `requests_per_minute` | int | None | Rate throttle |
| `cache_backend` | str | None | `"sqlite"` or `"lru"` |

## Cost tracking

```python
from synapsekit.observability import CostTracker

tracker = CostTracker()
llm = AnthropicLLM(LLMConfig(
    model="claude-sonnet-4-6",
    api_key="sk-ant-...",
    max_tokens=2048,
))
llm.attach_tracker(tracker)

await llm.generate("Summarize the French Revolution in 3 bullet points.")
print(f"Cost: ${tracker.total_cost_usd:.6f}")
```

## Error handling

```python
from synapsekit.exceptions import LLMError, RateLimitError, AuthenticationError

try:
    response = await llm.generate("Hello")
except AuthenticationError:
    print("Invalid API key -- check sk-ant-...")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except LLMError as e:
    print(f"Anthropic error: {e}")
```

## Using the RAG facade

```python
from synapsekit import RAG

rag = RAG(
    model="claude-sonnet-4-6",
    api_key="sk-ant-...",
    provider="anthropic",
)
rag.add("SynapseKit documentation goes here.")

answer = rag.ask_sync("What is SynapseKit?")
```

:::tip
Set `ANTHROPIC_API_KEY` in your environment to avoid passing `api_key` in code.
:::
