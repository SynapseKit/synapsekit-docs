---
sidebar_position: 6
---

# Mistral AI

[Mistral AI](https://mistral.ai/) provides high-quality European AI models via an OpenAI-compatible API. Mistral models are known for their strong reasoning, code generation, and function calling capabilities at competitive pricing.

## Install

```bash
pip install synapsekit[mistral]
```

## Basic usage

```python
from synapsekit.llm.mistral import MistralLLM
from synapsekit.llm.base import LLMConfig

llm = MistralLLM(LLMConfig(
    model="mistral-large-latest",
    api_key="your-mistral-key",
    provider="mistral",
    temperature=0.3,
    max_tokens=1024,
))

response = await llm.generate("Explain the difference between RAG and fine-tuning.")
print(response)
# RAG (Retrieval-Augmented Generation) retrieves relevant context at inference time...
```

## Via the RAG facade

```python
from synapsekit import RAG

rag = RAG(model="mistral-large-latest", api_key="your-mistral-key")
rag.add("Your document text here")

answer = rag.ask_sync("Summarize the document.")
print(answer)
```

## Streaming

```python
from synapsekit.llm.mistral import MistralLLM
from synapsekit.llm.base import LLMConfig

llm = MistralLLM(LLMConfig(
    model="mistral-small-latest",
    api_key="your-mistral-key",
    provider="mistral",
))

async for token in llm.stream("Write a Python function to check if a number is prime."):
    print(token, end="", flush=True)
# def is_prime(n: int) -> bool:
#     if n < 2: return False
#     ...
```

## Supported models

| Model | Context | Input (per 1M) | Output (per 1M) | Best for |
|---|---|---|---|---|
| `mistral-large-latest` | 131K | $2.00 | $6.00 | Best quality, complex tasks |
| `mistral-small-latest` | 32K | $0.20 | $0.60 | Fast, cost-efficient |
| `open-mistral-nemo` | 128K | $0.15 | $0.15 | Open-weight, great value |
| `open-mistral-7b` | 32K | $0.25 | $0.25 | Open-weight, self-hostable |
| `open-mixtral-8x7b` | 32K | $0.70 | $0.70 | MoE, strong at reasoning |
| `open-mixtral-8x22b` | 65K | $2.00 | $6.00 | Largest open MoE model |
| `codestral-latest` | 32K | $0.20 | $0.60 | Code generation optimized |
| `mistral-embed` | 8K | $0.10 | — | Text embeddings |

See the [Mistral model docs](https://docs.mistral.ai/getting-started/models/) for the full list.

## Function calling

MistralLLM supports native function calling via `call_with_tools()`. Mistral's API is OpenAI-compatible, so tool schemas work without conversion:

```python
from synapsekit import FunctionCallingAgent, tool
from synapsekit.llm.mistral import MistralLLM
from synapsekit.llm.base import LLMConfig

@tool
def search_web(query: str, num_results: int = 5) -> list:
    """Search the web for current information."""
    return [{"title": f"Result {i}: {query}", "url": f"https://example.com/{i}"}
            for i in range(1, num_results + 1)]

@tool
def calculate(expression: str) -> float:
    """Evaluate a mathematical expression safely."""
    import ast
    return float(ast.literal_eval(expression))

llm = MistralLLM(LLMConfig(
    model="mistral-large-latest",
    api_key="your-mistral-key",
    provider="mistral",
))

agent = FunctionCallingAgent(
    llm=llm,
    tools=[search_web, calculate],
)

answer = await agent.run("Search for the population of France and calculate its square root.")
print(answer)
# The population of France is approximately 68 million. The square root is ~8,246.
```

### Direct `call_with_tools` usage

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "City name"},
                },
                "required": ["city"],
            },
        },
    }
]

messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What's the weather in Paris?"},
]

result = await llm.call_with_tools(messages, tools)
# {"content": None, "tool_calls": [{"id": "...", "name": "get_weather", "arguments": {"city": "Paris"}}]}
```

## JSON mode

Force the model to output valid JSON:

```python
llm = MistralLLM(LLMConfig(
    model="mistral-large-latest",
    api_key="your-mistral-key",
    extra_params={"response_format": {"type": "json_object"}},
))

response = await llm.generate(
    "Extract the name, email, and phone from this text: "
    "Contact John Smith at john@example.com or 555-1234."
)
import json
data = json.loads(response)
print(data)
# {"name": "John Smith", "email": "john@example.com", "phone": "555-1234"}
```

## Codestral for code generation

Use `codestral-latest` for code-specific tasks — it's fine-tuned on code and supports fill-in-the-middle:

```python
llm = MistralLLM(LLMConfig(
    model="codestral-latest",
    api_key="your-mistral-key",
    provider="mistral",
    temperature=0.1,  # Low temp for deterministic code
))

response = await llm.generate(
    "Write a Python decorator that caches function results with a TTL."
)
print(response)
# import time
# from functools import wraps
# ...
```

## Cost tracking

```python
from synapsekit.observability import CostTracker

tracker = CostTracker()
llm = MistralLLM(LLMConfig(
    model="mistral-small-latest",
    api_key="your-mistral-key",
))
llm.attach_tracker(tracker)

for i in range(10):
    await llm.generate(f"Translate to French: message {i}")

print(f"Total cost: ${tracker.total_cost_usd:.4f}")
```

## Error handling

```python
from synapsekit.exceptions import LLMError, RateLimitError, AuthenticationError

try:
    response = await llm.generate("Hello")
except AuthenticationError:
    print("Invalid API key — get one at console.mistral.ai")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except LLMError as e:
    print(f"Mistral error: {e}")
```

:::tip
`mistral-small-latest` offers an excellent balance of quality and cost for most tasks. Use `mistral-large-latest` for complex reasoning, coding, or when you need the best output quality.
:::
