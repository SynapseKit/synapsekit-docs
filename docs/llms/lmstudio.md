---
sidebar_position: 5
---

# LM Studio (Local)

Run local LLMs via [LM Studio](https://lmstudio.ai)'s OpenAI-compatible server. No API key required. Everything runs on your machine.

## Install LM Studio

Download from [lmstudio.ai](https://lmstudio.ai) and install it. Then enable the local server:

1. Open LM Studio
2. Go to the **Local Server** tab (left sidebar)
3. Select a model and click **Start Server**

By default the server listens on `http://localhost:1234/v1`.

Then install the SynapseKit package:

```bash
pip install synapsekit[lmstudio]
```

## Download a model in LM Studio

Use the **Discover** tab in LM Studio to search and download models:

- `meta-llama/Meta-Llama-3-8B-Instruct`
- `mistralai/Mistral-7B-Instruct-v0.3`
- `microsoft/Phi-3-mini-4k-instruct`
- `google/gemma-2-2b-it`
- `Qwen/Qwen2.5-7B-Instruct`

## Via the RAG facade

```python
from synapsekit import RAG

rag = RAG(
    model="meta-llama/Meta-Llama-3-8B-Instruct",
    api_key="",
    provider="lmstudio",
)
rag.add("Your document text here")

answer = rag.ask_sync("Summarize the document.")
print(answer)
```

## Direct usage

```python
from synapsekit.llm.lmstudio import LMStudioLLM
from synapsekit.llm.base import LLMConfig

llm = LMStudioLLM(
    LLMConfig(
        model="meta-llama/Meta-Llama-3-8B-Instruct",
        api_key="",
        provider="lmstudio",
        temperature=0.7,
        max_tokens=512,
    )
)

async for token in llm.stream("Explain async Python in one paragraph."):
    print(token, end="", flush=True)
```

## Custom base URL

If LM Studio is running on a different host (e.g. a GPU server on your LAN):

```python
llm = LMStudioLLM(
    LLMConfig(model="meta-llama/Meta-Llama-3-8B-Instruct", api_key="", provider="lmstudio"),
    base_url="http://192.168.1.10:1234/v1",
)
```

## Function calling

LM Studio supports function calling on compatible models (e.g. Llama 3.1, Mistral Instruct v3):

```python
from synapsekit import FunctionCallingAgent, tool
from synapsekit.llm.lmstudio import LMStudioLLM
from synapsekit.llm.base import LLMConfig

@tool
def get_weather(city: str) -> str:
    """Get the weather for a city."""
    return f"It's sunny in {city}, 24 degrees C"

llm = LMStudioLLM(LLMConfig(
    model="meta-llama/Meta-Llama-3-8B-Instruct",
    api_key="",
    provider="lmstudio",
))

agent = FunctionCallingAgent(llm=llm, tools=[get_weather])
answer = await agent.run("What's the weather in Tokyo?")
```

:::caution
Not all LM Studio models support function calling. Check the model card in LM Studio to confirm. For models without tool support, use `ReActAgent` instead.
:::

## Supported models

Any model loaded in LM Studio's local server is supported. Popular choices:

| Model | Size | RAM Required | Notes |
|---|---|---|---|
| `meta-llama/Meta-Llama-3-8B-Instruct` | 8B | ~8 GB | General purpose |
| `meta-llama/Meta-Llama-3-70B-Instruct` | 70B (Q4) | ~40 GB | High quality, needs GPU |
| `mistralai/Mistral-7B-Instruct-v0.3` | 7B | ~8 GB | Strong reasoning |
| `microsoft/Phi-3-mini-4k-instruct` | 3.8B | ~4 GB | Fast, efficient |
| `Qwen/Qwen2.5-7B-Instruct` | 7B | ~8 GB | Multilingual |
| `google/gemma-2-2b-it` | 2B | ~3 GB | Lightweight |

## Error handling

```python
from synapsekit.exceptions import LLMError

try:
    response = await llm.generate("Hello")
except LLMError as e:
    if "connection refused" in str(e).lower():
        print("LM Studio server is not running. Start it in the Local Server tab.")
    else:
        raise
```

:::tip
To confirm the server is running, visit `http://localhost:1234/v1/models` in your browser — it should return a JSON list of loaded models.
:::
