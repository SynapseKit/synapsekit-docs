---
sidebar_position: 1
---

# LLM Overview

[![PyPI](https://img.shields.io/pypi/v/synapsekit)](https://pypi.org/project/synapsekit/)
[![Python](https://img.shields.io/pypi/pyversions/synapsekit)](https://pypi.org/project/synapsekit/)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](https://github.com/SynapseKit/SynapseKit/blob/main/LICENSE)
[![Tests](https://img.shields.io/badge/tests-1133%20passing-brightgreen)](https://github.com/SynapseKit/SynapseKit/actions)

All LLMs in SynapseKit extend `BaseLLM` and share the same interface.

## Interface

```python
class BaseLLM(ABC):
    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]: ...
    async def generate(self, prompt: str, **kwargs) -> str: ...
    async def stream_with_messages(self, messages: list[dict], **kwargs) -> AsyncIterator[str]: ...
    async def generate_with_messages(self, messages: list[dict], **kwargs) -> str: ...
```

`generate()` is always implemented as `"".join([...async for... in stream()])` — streaming is primary.

## LLMConfig

```python
from synapsekit import LLMConfig

config = LLMConfig(
    model="gpt-4o-mini",
    api_key="sk-...",
    provider="openai",
    system_prompt="You are a helpful assistant.",
    temperature=0.2,
    max_tokens=1024,
    # Optional: caching and retries
    cache=False,          # Enable LRU response caching
    cache_maxsize=128,    # Max cached responses
    cache_backend="memory",  # "memory" or "sqlite"
    max_retries=0,        # Retry attempts (0 = disabled)
    retry_delay=1.0,      # Initial retry delay in seconds
    # Rate limiting
    requests_per_minute=None,  # Token-bucket rate limiter
)
```

See [Caching & Retries](/docs/llms/caching-retries) for details on response caching and exponential backoff.

## Available providers

| Provider | Class | Extra | Provider string |
|---|---|---|---|
| OpenAI | `OpenAILLM` | `pip install synapsekit[openai]` | `"openai"` |
| Anthropic | `AnthropicLLM` | `pip install synapsekit[anthropic]` | `"anthropic"` |
| Ollama | `OllamaLLM` | `pip install synapsekit[ollama]` | `"ollama"` |
| Cohere | `CohereLLM` | `pip install synapsekit[cohere]` | `"cohere"` |
| Mistral | `MistralLLM` | `pip install synapsekit[mistral]` | `"mistral"` |
| Google Gemini | `GeminiLLM` | `pip install synapsekit[gemini]` | `"gemini"` |
| AWS Bedrock | `BedrockLLM` | `pip install synapsekit[bedrock]` | `"bedrock"` |
| Azure OpenAI | `AzureOpenAILLM` | `pip install synapsekit[openai]` | `"azure"` |
| Groq | `GroqLLM` | `pip install synapsekit[groq]` | `"groq"` |
| DeepSeek | `DeepSeekLLM` | `pip install synapsekit[openai]` | `"deepseek"` |
| OpenRouter | `OpenRouterLLM` | `pip install synapsekit[openai]` | `"openrouter"` |
| Together AI | `TogetherLLM` | `pip install synapsekit[openai]` | `"together"` |
| Fireworks AI | `FireworksLLM` | `pip install synapsekit[openai]` | `"fireworks"` |
| Perplexity AI | `PerplexityLLM` | `pip install synapsekit[openai]` | `"perplexity"` |
| Cerebras | `CerebrasLLM` | `pip install synapsekit[openai]` | `"cerebras"` |

## Auto-detection

The `RAG` facade auto-detects the provider from the model name:

| Model prefix | Detected provider |
|---|---|
| `claude-*` | `anthropic` |
| `gemini-*` | `gemini` |
| `command-*` | `cohere` |
| `mistral-*`, `open-mistral-*` | `mistral` |
| `deepseek-*` | `deepseek` |
| `llama-*`, `mixtral-*`, `gemma-*` | `groq` |
| `*/...` (contains `/`) | `openrouter` |
| everything else | `openai` |

Override with the `provider=` argument:

```python
rag = RAG(model="llama3", api_key="", provider="ollama")
```

## Tokens and cost tracking

Every provider tracks input/output tokens:

```python
llm = OpenAILLM(config)
await llm.generate("Hello!")
print(llm.tokens_used)  # {"input": 12, "output": 8}
```

The `TokenTracer` in `RAGPipeline` aggregates this across all calls.

## Next steps

- [OpenAI](./openai) — GPT-4o, GPT-4o-mini, structured output, vision
- [Anthropic](./anthropic) — Claude models, extended context, tool use
- [Ollama](./ollama) — run local models with no API key
- [Caching & Retries](./caching-retries) — LRU caching, exponential backoff, rate limiting
- [Cost Tracker](../observability/cost-tracker) — attribute and budget LLM spending
