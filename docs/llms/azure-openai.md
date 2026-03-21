---
sidebar_position: 8
---

# Azure OpenAI

Use OpenAI models (GPT-4o, GPT-4o-mini, o1, etc.) hosted on your own Azure resource. Azure OpenAI provides enterprise compliance features: data residency, private networking, Azure AD authentication, and SLA guarantees.

## Installation

```bash
pip install synapsekit[openai]
```

Uses the same `openai` package as `OpenAILLM` -- no additional packages needed.

## Prerequisites

Before using Azure OpenAI with SynapseKit, you need:

1. An Azure subscription with Azure OpenAI access approved
2. An Azure OpenAI resource created in a supported region
3. A model deployed in your resource (deployment name can differ from model name)

## Authentication

### Option 1: API key (simplest)

```bash
export AZURE_OPENAI_API_KEY=your-azure-api-key
export AZURE_OPENAI_ENDPOINT=https://myresource.openai.azure.com
```

### Option 2: Azure Active Directory (enterprise recommended)

```bash
pip install azure-identity
az login
```

```python
from azure.identity import DefaultAzureCredential
from synapsekit.llm.azure_openai import AzureOpenAILLM
from synapsekit import LLMConfig

llm = AzureOpenAILLM(
    LLMConfig(model="gpt-4o", api_key="", provider="azure"),
    azure_endpoint="https://myresource.openai.azure.com",
    azure_ad_token_provider=DefaultAzureCredential(),
)
```

## Basic usage

```python
from synapsekit.llm.azure_openai import AzureOpenAILLM
from synapsekit import LLMConfig

config = LLMConfig(
    model="gpt-4o",           # Your Azure deployment name -- NOT the model name
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
response = await llm.generate("Explain Azure OpenAI vs OpenAI direct API")
print(response)
```

:::important
The `model` field in `LLMConfig` must be your **deployment name** in Azure, not the underlying model name. For example, if you deployed GPT-4o under the name `"my-gpt4o-deployment"`, use that as the `model` value.
:::

## Function calling

Azure OpenAI supports the same function calling as the direct OpenAI API:

```python
from synapsekit.tools import tool
from synapsekit.llm.azure_openai import AzureOpenAILLM
from synapsekit.agents import FunctionCallingAgent

@tool
def query_azure_sql(query: str, database: str) -> list[dict]:
    """Execute a read-only SQL query on an Azure SQL Database."""
    return [
        {"id": 1, "name": "Alice", "department": "Engineering"},
        {"id": 2, "name": "Bob", "department": "Product"},
    ]

llm = AzureOpenAILLM(
    LLMConfig(model="gpt-4o", api_key="your-azure-key", provider="azure"),
    azure_endpoint="https://myresource.openai.azure.com",
)
agent = FunctionCallingAgent(llm=llm, tools=[query_azure_sql])

result = await agent.arun("List all employees in the Engineering department")
print(result)
```

### Direct call_with_tools

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

## Deployment name vs model name

This is the most common source of confusion with Azure OpenAI:

| Azure setting | Example value | SynapseKit field |
|---|---|---|
| Deployment name | `my-gpt4o-prod` | `LLMConfig(model="my-gpt4o-prod")` |
| Underlying model | `gpt-4o` | Used for token counting only |
| Resource endpoint | `https://myco.openai.azure.com` | `azure_endpoint=...` |
| API version | `2024-06-01` | `api_version=...` |

## API versions

Azure OpenAI uses dated API versions. The default is `2024-06-01`:

| API Version | Key features |
|---|---|
| `2024-06-01` | GPT-4o, structured outputs, latest -- recommended |
| `2024-02-01` | Function calling, vision |

## Cost tracking

```python
from synapsekit import CostTracker
from synapsekit.llm.azure_openai import AzureOpenAILLM

tracker = CostTracker()
llm = AzureOpenAILLM(
    LLMConfig(model="my-gpt4o-mini", api_key="...", provider="azure"),
    azure_endpoint="https://myresource.openai.azure.com",
)

with tracker.scope("azure-request"):
    response = await llm.generate("Explain Azure Cognitive Services")
    rec = tracker.record("gpt-4o-mini", input_tokens=50, output_tokens=200)

print(f"Cost: ${rec.cost_usd:.6f}")
```

## Error handling

```python
from openai import RateLimitError, APIError, AuthenticationError

llm = AzureOpenAILLM(
    LLMConfig(model="gpt-4o", api_key="...", max_retries=3),
    azure_endpoint="https://myresource.openai.azure.com",
)

try:
    response = await llm.generate("Hello")
except AuthenticationError:
    print("Invalid Azure API key or endpoint")
except RateLimitError:
    print("Azure OpenAI quota exceeded -- check your Azure quota in the portal")
except APIError as e:
    if "DeploymentNotFound" in str(e):
        print("Deployment name not found -- check your Azure OpenAI deployments")
    else:
        print(f"Azure OpenAI error {e.status_code}: {e.message}")
```

## Parameters

| Parameter | Required | Default | Description |
|---|---|---|---|
| `azure_endpoint` | Yes | -- | Your Azure resource URL |
| `api_version` | No | `"2024-06-01"` | Azure API version |
| `azure_ad_token_provider` | No | `None` | Azure AD credential for AAD auth |

:::tip
Azure OpenAI uses the same `openai` SDK under the hood. If you already have `synapsekit[openai]` installed, no additional packages are needed.
:::

## Environment variables

| Variable | Description |
|---|---|
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | Azure resource endpoint |
| `OPENAI_API_VERSION` | API version |

## See also

- [OpenAI](./openai) -- direct OpenAI API
- [Function calling agents](../agents/function-calling)
- [Cost tracking](../observability/cost-tracker)
- [Azure OpenAI docs](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
