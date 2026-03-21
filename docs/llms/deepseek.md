---
sidebar_position: 10
---

# DeepSeek

DeepSeek models via their OpenAI-compatible API. Excellent cost-to-performance ratio with strong reasoning capabilities.

## Install

```bash
pip install synapsekit[openai]
```

Uses the `openai` SDK with a custom base URL.

## Usage

```python
from synapsekit.llm.deepseek import DeepSeekLLM
from synapsekit import LLMConfig

config = LLMConfig(
    model="deepseek-chat",
    api_key="sk-...",
    provider="deepseek",
)

llm = DeepSeekLLM(config)

# Streaming
async for token in llm.stream("Explain async/await in Python"):
    print(token, end="")

# Generate
response = await llm.generate("What is DeepSeek?")
```

## Available models

| Model | Context | Input (per 1M) | Output (per 1M) | Notes |
|---|---|---|---|---|
| `deepseek-chat` | 64K | $0.07 | $1.10 | General chat, V3 architecture |
| `deepseek-reasoner` | 64K | $0.55 | $2.19 | Chain-of-thought reasoning (R1) |

DeepSeek-V3 and R1 offer competitive performance at a fraction of GPT-4o pricing.

## DeepSeek-R1: reasoning model

The `deepseek-reasoner` (R1) model outputs its thinking process before the answer:

```python
llm = DeepSeekLLM(LLMConfig(
    model="deepseek-reasoner",
    api_key="sk-...",
))

# R1 streams reasoning tokens wrapped in <think>...</think>
async for token in llm.stream("Solve: if 3x + 7 = 22, what is x?"):
    print(token, end="")

# Output includes reasoning steps then answer:
# <think>
# We need to solve for x: 3x + 7 = 22
# 3x = 15
# x = 5
# </think>
# The answer is x = 5.
```

To strip reasoning and get only the final answer:

```python
response = await llm.generate("Solve: if 3x + 7 = 22, what is x?")
# Strip <think>...</think> block
import re
answer = re.sub(r"<think>.*?</think>", "", response, flags=re.DOTALL).strip()
print(answer)  # "The answer is x = 5."
```

## Function calling

```python
from synapsekit import FunctionCallingAgent, tool

@tool
def search_pypi(package_name: str) -> dict:
    """Search PyPI for a Python package."""
    import urllib.request, json
    url = f"https://pypi.org/pypi/{package_name}/json"
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read())
    return {
        "name": data["info"]["name"],
        "version": data["info"]["version"],
        "summary": data["info"]["summary"],
    }

@tool
def compare_packages(pkg1: str, pkg2: str) -> str:
    """Compare two Python packages by description."""
    return f"Comparing {pkg1} vs {pkg2}: both are popular libraries."

llm = DeepSeekLLM(LLMConfig(model="deepseek-chat", api_key="sk-..."))
agent = FunctionCallingAgent(llm=llm, tools=[search_pypi, compare_packages])

answer = await agent.run("Compare synapsekit and langchain packages on PyPI")
print(answer)
```

### Raw call_with_tools

```python
result = await llm.call_with_tools(
    messages=[{"role": "user", "content": "Calculate 15% tip on $85"}],
    tools=[{
        "type": "function",
        "function": {
            "name": "calculate",
            "description": "Evaluate a mathematical expression",
            "parameters": {
                "type": "object",
                "properties": {"expression": {"type": "string"}},
                "required": ["expression"],
            },
        },
    }],
)
```

## Custom base URL

For self-hosted or proxy deployments:

```python
llm = DeepSeekLLM(config, base_url="http://localhost:8000")
```

## Auto-detection

The RAG facade auto-detects DeepSeek for `deepseek-*` model names:

```python
from synapsekit import RAG

rag = RAG(model="deepseek-chat", api_key="sk-...")
rag.add("Your document text here")
answer = rag.ask_sync("Summarize this.")
```

## Cost comparison

DeepSeek offers significant savings vs proprietary models for equivalent quality:

| Model | Input (per 1M) | Output (per 1M) | Relative cost |
|---|---|---|---|
| `deepseek-chat` | $0.07 | $1.10 | 1x (baseline) |
| `deepseek-reasoner` | $0.55 | $2.19 | ~4x |
| `gpt-4o-mini` | $0.15 | $0.60 | ~2x |
| `gpt-4o` | $2.50 | $10.00 | ~36x |
| `claude-sonnet-4-6` | $3.00 | $15.00 | ~43x |

## Cost tracking

```python
from synapsekit.observability import CostTracker

tracker = CostTracker()
llm = DeepSeekLLM(LLMConfig(model="deepseek-chat", api_key="sk-..."))
llm.attach_tracker(tracker)

for _ in range(100):
    await llm.generate("Translate this sentence to Spanish: Hello world.")

print(f"Total: ${tracker.total_cost_usd:.6f}")
```

## Error handling

```python
from synapsekit.exceptions import LLMError, RateLimitError, AuthenticationError

try:
    response = await llm.generate("Hello")
except AuthenticationError:
    print("Invalid API key -- get one at platform.deepseek.com")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except LLMError as e:
    print(f"DeepSeek error: {e}")
```

:::tip
For cost-sensitive production workloads, `deepseek-chat` provides GPT-4-class quality at a fraction of the price. The `deepseek-reasoner` model excels at math, coding, and logical reasoning tasks.
:::
