---
sidebar_position: 13
---

# Fireworks AI

[Fireworks AI](https://fireworks.ai/) provides optimized inference for open-source models with an OpenAI-compatible API. It offers some of the lowest latency for popular models like Llama and Mixtral, with their FireFunction models purpose-built for reliable tool use.

## Install

```bash
pip install synapsekit[openai]
```

Fireworks AI uses the OpenAI-compatible API, so it requires the `openai` package.

## Basic usage

```python
from synapsekit import LLMConfig
from synapsekit.llm.fireworks import FireworksLLM

llm = FireworksLLM(LLMConfig(
    model="accounts/fireworks/models/llama-v3p3-70b-instruct",
    api_key="fw_...",
))

response = await llm.generate("Explain the difference between RAG and fine-tuning.")
print(response)
# RAG retrieves relevant context at inference time, while fine-tuning...
```

## Streaming

```python
from synapsekit import LLMConfig
from synapsekit.llm.fireworks import FireworksLLM

llm = FireworksLLM(LLMConfig(
    model="accounts/fireworks/models/llama-v3p3-70b-instruct",
    api_key="fw_...",
    temperature=0.6,
))

async for token in llm.stream("Write a Python function to parse JSON safely."):
    print(token, end="", flush=True)
# def safe_json_parse(text: str) -> dict | None:
#     try:
#         return json.loads(text)
#     except json.JSONDecodeError:
#         return None
```

## Available models

| Model | ID | Context | Notes |
|---|---|---|---|
| Llama 3.3 70B | `accounts/fireworks/models/llama-v3p3-70b-instruct` | 131K | Best quality |
| Llama 3.1 8B | `accounts/fireworks/models/llama-v3p1-8b-instruct` | 131K | Fast, cheap |
| Mixtral 8x7B | `accounts/fireworks/models/mixtral-8x7b-instruct` | 32K | Strong reasoning |
| Qwen 2.5 72B | `accounts/fireworks/models/qwen2p5-72b-instruct` | 131K | Multilingual |
| FireFunction v2 | `accounts/fireworks/models/firefunction-v2` | 8K | Optimized for tool use |
| Llama 3.1 405B | `accounts/fireworks/models/llama-v3p1-405b-instruct` | 131K | Largest open model |

See the full list at [fireworks.ai/models](https://fireworks.ai/models).

## Function calling

Fireworks offers `FireFunction-v2`, a model specifically optimized for reliable function calling:

```python
from synapsekit import FunctionCallingAgent, tool
from synapsekit import LLMConfig
from synapsekit.llm.fireworks import FireworksLLM

@tool
def search_documentation(query: str, max_results: int = 3) -> list:
    """Search the SynapseKit documentation for a query."""
    # In practice, run a vector search
    return [
        {"title": f"Result {i}: {query}", "url": f"https://docs.example.com/{i}"}
        for i in range(1, max_results + 1)
    ]

@tool
def create_github_issue(title: str, body: str, labels: list[str] = None) -> dict:
    """Create a GitHub issue in the SynapseKit repository."""
    return {
        "number": 42,
        "title": title,
        "url": "https://github.com/SynapseKit/SynapseKit/issues/42",
        "labels": labels or [],
    }

# Use FireFunction-v2 for most reliable tool calling
llm = FireworksLLM(LLMConfig(
    model="accounts/fireworks/models/firefunction-v2",
    api_key="fw_...",
))

agent = FunctionCallingAgent(llm=llm, tools=[search_documentation, create_github_issue])
answer = await agent.run(
    "Search for 'streaming' in the docs and create an issue to improve those docs."
)
print(answer)
# Found 3 results for 'streaming'. Created issue #42: 'Improve streaming documentation'.
```

### Raw `call_with_tools`

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "classify_text",
            "description": "Classify text into a category",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "categories": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": ["text", "categories"],
            },
        },
    }
]

result = await llm.call_with_tools(
    messages=[{"role": "user", "content": "Is 'I love this product!' positive or negative?"}],
    tools=tools,
)
# result["tool_calls"] → [{"name": "classify_text", "arguments": {"text": "I love this product!", "categories": ["positive", "negative", "neutral"]}}]
```

## FireFunction models

Fireworks' FireFunction models are fine-tuned versions of Llama specifically for tool use:

| Model | Best for |
|---|---|
| `accounts/fireworks/models/firefunction-v2` | Reliable single and parallel tool calls |

FireFunction-v2 is recommended over general-purpose models when your agent makes many tool calls, as it produces cleaner JSON arguments and fewer hallucinated tool names.

## Custom base URL

```python
llm = FireworksLLM(
    LLMConfig(model="accounts/fireworks/models/llama-v3p3-70b-instruct", api_key="fw_..."),
    base_url="http://localhost:8000/v1",
)
```

## Cost tracking

```python
from synapsekit.observability import CostTracker

tracker = CostTracker()
llm = FireworksLLM(LLMConfig(
    model="accounts/fireworks/models/llama-v3p1-8b-instruct",
    api_key="fw_...",
))
llm.attach_tracker(tracker)

for i in range(10):
    await llm.generate(f"Summarize paragraph {i}.")

print(f"Total cost: ${tracker.total_cost_usd:.6f}")
```

## Parameters reference

| Parameter | Description |
|---|---|
| `model` | Fireworks model ID (full `accounts/fireworks/models/...` path) |
| `api_key` | Your Fireworks API key (starts with `fw_`) |
| `temperature` | Sampling temperature (0.0–1.0) |
| `max_tokens` | Maximum output tokens |
| `base_url` | Custom API base URL (default: `https://api.fireworks.ai/inference/v1`) |

## Error handling

```python
from synapsekit.exceptions import LLMError, RateLimitError, AuthenticationError

try:
    response = await llm.generate("Hello")
except AuthenticationError:
    print("Invalid API key — get one at fireworks.ai")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except LLMError as e:
    print(f"Fireworks error: {e}")
```

:::tip
Use `firefunction-v2` when building production agents that need reliable tool calling. For general Q&A workloads, `llama-v3p3-70b-instruct` offers the best quality-to-cost ratio.
:::
