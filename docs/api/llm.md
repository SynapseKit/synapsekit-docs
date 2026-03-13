---
sidebar_position: 1
---

# LLM API Reference

## `BaseLLM`

Abstract base class for all LLM providers.

```python
class BaseLLM(ABC):
    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]: ...
    async def generate(self, prompt: str, **kwargs) -> str: ...
    async def stream_with_messages(self, messages: list[dict], **kwargs) -> AsyncIterator[str]: ...
    async def generate_with_messages(self, messages: list[dict], **kwargs) -> str: ...

    @property
    def tokens_used(self) -> dict: ...  # {"input": int, "output": int}
```

## `LLMConfig`

```python
@dataclass
class LLMConfig:
    model: str
    api_key: str
    provider: str
    system_prompt: str = "You are a helpful assistant."
    temperature: float = 0.2
    max_tokens: int = 1024
    # Caching (v0.5.0)
    cache: bool = False
    cache_maxsize: int = 128
    # Retries (v0.5.0)
    max_retries: int = 0
    retry_delay: float = 1.0
```

| Field | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | required | Model name |
| `api_key` | `str` | required | API key |
| `provider` | `str` | required | Provider string (`"openai"`, `"anthropic"`, etc.) |
| `system_prompt` | `str` | `"You are a helpful assistant."` | System instruction |
| `temperature` | `float` | `0.2` | Sampling temperature |
| `max_tokens` | `int` | `1024` | Maximum output tokens |
| `cache` | `bool` | `False` | Enable LRU response caching |
| `cache_maxsize` | `int` | `128` | Maximum cached responses |
| `max_retries` | `int` | `0` | Retry attempts with exponential backoff |
| `retry_delay` | `float` | `1.0` | Initial retry delay in seconds |

See [Caching & Retries](/docs/llms/caching-retries) for usage details.

## Provider classes

| Class | Import path | Extra |
|---|---|---|
| `OpenAILLM` | `synapsekit.llm.openai` | `synapsekit[openai]` |
| `AnthropicLLM` | `synapsekit.llm.anthropic` | `synapsekit[anthropic]` |
| `OllamaLLM` | `synapsekit.llm.ollama` | `synapsekit[ollama]` |
| `CohereLLM` | `synapsekit.llm.cohere` | `synapsekit[cohere]` |
| `MistralLLM` | `synapsekit.llm.mistral` | `synapsekit[mistral]` |
| `GeminiLLM` | `synapsekit.llm.gemini` | `synapsekit[gemini]` |
| `BedrockLLM` | `synapsekit.llm.bedrock` | `synapsekit[bedrock]` |
| `AzureOpenAILLM` | `synapsekit.llm.azure_openai` | `synapsekit[openai]` |
| `GroqLLM` | `synapsekit.llm.groq` | `synapsekit[groq]` |
| `DeepSeekLLM` | `synapsekit.llm.deepseek` | `synapsekit[openai]` |
| `OpenRouterLLM` | `synapsekit.llm.openrouter` | `synapsekit[openai]` |
| `TogetherLLM` | `synapsekit.llm.together` | `synapsekit[openai]` |
| `FireworksLLM` | `synapsekit.llm.fireworks` | `synapsekit[openai]` |

All providers share the same constructor signature:

```python
LLM(config: LLMConfig)
```

`BedrockLLM` accepts an additional optional `region: str = "us-east-1"` argument.
`AzureOpenAILLM` accepts additional `azure_endpoint`, `api_version`, and `azure_deployment` arguments.

## `call_with_tools()`

Available on providers that support native function calling:

| Provider | `call_with_tools()` |
|---|---|
| `OpenAILLM` | ✅ |
| `AnthropicLLM` | ✅ |
| `GeminiLLM` | ✅ |
| `MistralLLM` | ✅ |
| `DeepSeekLLM` | ✅ |
| `OpenRouterLLM` | ✅ |
| `TogetherLLM` | ✅ |
| `FireworksLLM` | ✅ |
| `AzureOpenAILLM` | ✅ |
| `GroqLLM` | ✅ |
| `OllamaLLM` | ❌ — use `ReActAgent` |
| `CohereLLM` | ❌ — use `ReActAgent` |
| `BedrockLLM` | ❌ — use `ReActAgent` |

```python
result = await llm.call_with_tools(messages, tools)
# Returns: {"content": str | None, "tool_calls": list | None}
```
