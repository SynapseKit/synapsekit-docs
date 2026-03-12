---
sidebar_position: 8
---

# Azure OpenAI

Use OpenAI models hosted on your Azure resource. Supports streaming, `generate()`, and native function calling.

## Install

```bash
pip install synapsekit[openai]
```

Uses the same `openai` package as `OpenAILLM`.

## Usage

```python
from synapsekit.llm.azure_openai import AzureOpenAILLM
from synapsekit import LLMConfig

config = LLMConfig(
    model="gpt-4o",           # Your Azure deployment name
    api_key="your-azure-key",
    provider="azure",
)

llm = AzureOpenAILLM(
    config,
    azure_endpoint="https://myresource.openai.azure.com",
    api_version="2024-06-01",  # optional, this is the default
)

# Streaming
async for token in llm.stream("What is Python?"):
    print(token, end="")

# Generate
response = await llm.generate("What is Python?")
```

## Function calling

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get weather for a city",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
        },
    }
]

result = await llm.call_with_tools(
    messages=[{"role": "user", "content": "Weather in London?"}],
    tools=tools,
)
```

## Parameters

| Parameter | Required | Description |
|---|---|---|
| `azure_endpoint` | Yes | Your Azure resource URL |
| `api_version` | No | Azure API version (default `"2024-06-01"`) |

:::tip
Azure OpenAI uses the same `openai` SDK under the hood. If you already have `synapsekit[openai]` installed, no additional packages are needed.
:::
