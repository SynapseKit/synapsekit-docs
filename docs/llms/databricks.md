---
sidebar_position: 21
---

# Databricks

Databricks Foundation Model APIs — access models like DBRX, Llama, Mixtral, and others hosted on your Databricks workspace via an OpenAI-compatible endpoint.

## Install

```bash
pip install synapsekit[openai]
```

No additional packages required — Databricks uses the OpenAI SDK pointed at your workspace URL.

## Usage

```python
from synapsekit.llm.databricks import DatabricksLLM
from synapsekit import LLMConfig
import os

config = LLMConfig(
    model="databricks-dbrx-instruct",
    api_key=os.environ["DATABRICKS_TOKEN"],
    provider="databricks",
)

llm = DatabricksLLM(
    config,
    workspace_url="https://my-workspace.azuredatabricks.net",
)

# Streaming
async for token in llm.stream("Explain Delta Lake in one paragraph"):
    print(token, end="")

# Generate
response = await llm.generate("What is MLflow?")
```

## Environment variables

You can set credentials via environment variables instead of constructor params:

```bash
export DATABRICKS_HOST=https://my-workspace.azuredatabricks.net
export DATABRICKS_TOKEN=dapi...
```

```python
import os
from synapsekit import LLMConfig
from synapsekit.llm.databricks import DatabricksLLM

llm = DatabricksLLM(
    LLMConfig(model="databricks-dbrx-instruct", api_key=os.environ["DATABRICKS_TOKEN"]),
    # workspace_url resolved from DATABRICKS_HOST if not provided
)
```

## Available models

| Model | Notes |
|---|---|
| `databricks-dbrx-instruct` | Databricks' flagship open model |
| `databricks-meta-llama-3-1-70b-instruct` | Llama 3.1 70B |
| `databricks-meta-llama-3-1-405b-instruct` | Llama 3.1 405B |
| `databricks-mixtral-8x7b-instruct` | Mixtral 8x7B |

Check your Databricks workspace for the full list of available serving endpoints.

## Function calling

DatabricksLLM supports native function calling via OpenAI-compatible tool calls:

```python
from synapsekit import FunctionCallingAgent, tool

@tool
def query_delta_table(table_name: str, limit: int = 10) -> str:
    """Query a Delta Lake table and return results."""
    return f"Results from {table_name}: ..."

agent = FunctionCallingAgent(llm=llm, tools=[query_delta_table])
answer = await agent.run("Show me the top 5 rows from sales_data.")
```

## Auto-detection

The RAG facade auto-detects Databricks for `dbrx-*` and `databricks-*` model prefixes:

```python
from synapsekit import RAG
import os

rag = RAG(
    model="databricks-dbrx-instruct",
    api_key=os.environ["DATABRICKS_TOKEN"],
    provider="databricks",  # required since DATABRICKS_HOST must also be set
)
rag.add("Your document text here")
answer = rag.ask_sync("Summarize this.")
```

:::tip
Set `DATABRICKS_HOST` and `DATABRICKS_TOKEN` in your environment to avoid passing credentials in code.
:::
