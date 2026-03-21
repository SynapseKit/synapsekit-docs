---
sidebar_position: 12
---

# Together AI

[Together AI](https://together.ai/) provides fast, scalable inference for open-source models including Llama, Mistral, Qwen, and more -- with competitive pricing.

## Install

```bash
pip install synapsekit[openai]
```

Together AI uses the OpenAI-compatible API, so it requires the `openai` package.

## Usage

```python
from synapsekit import LLMConfig
from synapsekit.llm.together import TogetherLLM

llm = TogetherLLM(LLMConfig(
    model="meta-llama/Llama-3.3-70B-Instruct-Turbo",
    api_key="...",
))

async for token in llm.stream("What is RAG?"):
    print(token, end="", flush=True)
```

## Available models

| Model | ID | Input (per 1M) | Output (per 1M) | Notes |
|---|---|---|---|---|
| Llama 3.3 70B | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | $0.88 | $0.88 | Best Llama quality |
| Llama 3.1 405B | `meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo` | $3.50 | $3.50 | Largest open model |
| Llama 3.1 8B | `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` | $0.18 | $0.18 | Fast and cheap |
| Mistral 7B | `mistralai/Mistral-7B-Instruct-v0.3` | $0.20 | $0.20 | Reliable workhorse |
| Mixtral 8x7B | `mistralai/Mixtral-8x7B-Instruct-v0.1` | $0.60 | $0.60 | MoE architecture |
| Qwen 2.5 72B | `Qwen/Qwen2.5-72B-Instruct-Turbo` | $1.20 | $1.20 | Strong multilingual |
| DeepSeek V3 | `deepseek-ai/DeepSeek-V3` | $1.25 | $1.25 | Reasoning optimized |

See the full list at [api.together.ai/models](https://api.together.ai/models).

## Llama 3.1 405B example

Together AI is one of the few providers offering Llama 3.1 405B:

```python
from synapsekit.llm.together import TogetherLLM
from synapsekit import LLMConfig

llm = TogetherLLM(LLMConfig(
    model="meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
    api_key="...",
    temperature=0.1,
    max_tokens=4096,
))

response = await llm.generate(
    "Analyze this code and suggest architectural improvements: ..."
)
```

## Function calling

```python
from synapsekit import FunctionCallingAgent, tool
from synapsekit.llm.together import TogetherLLM

@tool
def web_search(query: str, num_results: int = 5) -> list:
    """Search the web for information."""
    return [{"title": f"Result {i}: {query}", "url": f"https://example.com/{i}"}
            for i in range(num_results)]

@tool
def summarize_url(url: str) -> str:
    """Fetch and summarize a web page."""
    return f"Summary of {url}: This page discusses relevant topics..."

llm = TogetherLLM(LLMConfig(
    model="meta-llama/Llama-3.3-70B-Instruct-Turbo",
    api_key="...",
))

agent = FunctionCallingAgent(llm=llm, tools=[web_search, summarize_url])
answer = await agent.run("Research the latest developments in vector databases")
```

### Raw call_with_tools

```python
result = await llm.call_with_tools(
    messages=[{"role": "user", "content": "What's the weather in Berlin?"}],
    tools=[{
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
    }],
)
```

## Custom base URL

```python
llm = TogetherLLM(config, base_url="http://localhost:8000/v1")
```

## Provider comparison

| Provider | Best for | Llama 3.1 8B | Llama 3.3 70B |
|---|---|---|---|
| Together AI | Large models, 405B | $0.18/1M | $0.88/1M |
| Groq | Ultra-low latency | $0.05/1M | $0.59/1M |
| Fireworks AI | Production throughput | $0.20/1M | $0.90/1M |

## LLMConfig options

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | str | required | Together AI model ID |
| `api_key` | str | required | Your Together AI API key |
| `temperature` | float | `0.7` | Sampling temperature |
| `max_tokens` | int | None | Maximum output tokens |
| `max_retries` | int | `3` | Auto-retry on transient errors |
| `requests_per_minute` | int | None | Rate throttle |

## Parameters

| Parameter | Description |
|---|---|
| `model` | Together AI model ID |
| `api_key` | Your Together AI API key |
| `base_url` | Custom API base URL (default: `https://api.together.xyz/v1`) |

## Error handling

```python
from synapsekit.exceptions import LLMError, RateLimitError, AuthenticationError

try:
    response = await llm.generate("Hello")
except AuthenticationError:
    print("Invalid API key -- get one at api.together.ai")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except LLMError as e:
    print(f"Together AI error: {e}")
```

:::tip
Together AI is the go-to choice when you need Llama 3.1 405B or want to run large models (70B+) at competitive prices. For maximum speed at lower cost, consider Groq for 8B/70B models.
:::
