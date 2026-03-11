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
```

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

All providers share the same constructor signature:

```python
LLM(config: LLMConfig)
```

`BedrockLLM` accepts an additional optional `region: str = "us-east-1"` argument.
