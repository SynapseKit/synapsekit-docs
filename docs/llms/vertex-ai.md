---
sidebar_position: 17
---

# Google Vertex AI

## Install

```bash
pip install synapsekit[vertex]
```

## Via the RAG facade

```python
from synapsekit import RAG

rag = RAG(model="gemini-1.5-pro", api_key="your-gcp-project-id")
rag.add("Your document text here")

answer = rag.ask_sync("Summarize the document.")
```

:::info
Vertex AI uses Application Default Credentials (ADC). The `api_key` field is used as the GCP project ID. Make sure you have authenticated with `gcloud auth application-default login`.
:::

## Direct usage

```python
from synapsekit.llm.vertex_ai import VertexAILLM
from synapsekit.llm.base import LLMConfig

llm = VertexAILLM(LLMConfig(
    model="gemini-1.5-pro",
    api_key="your-gcp-project-id",
    provider="vertex",
    temperature=0.3,
    max_tokens=1024,
))

async for token in llm.stream("Explain vector embeddings."):
    print(token, end="", flush=True)
```

## Function calling

VertexAILLM supports native function calling via `call_with_tools()`.

```python
from synapsekit import FunctionCallingAgent, CalculatorTool
from synapsekit.llm.vertex_ai import VertexAILLM
from synapsekit.llm.base import LLMConfig

llm = VertexAILLM(LLMConfig(
    model="gemini-1.5-pro",
    api_key="your-gcp-project-id",
    provider="vertex",
))

agent = FunctionCallingAgent(
    llm=llm,
    tools=[CalculatorTool()],
)

answer = await agent.run("What is 144 divided by 12?")
```

### How it works

SynapseKit converts OpenAI-format tool schemas to Vertex AI function declarations via `Tool.from_dict()`. Response `function_call` parts are parsed back into the standard `{"id", "name", "arguments"}` format. Since Vertex AI doesn't provide tool call IDs, SynapseKit generates them via `uuid4`.

## Supported models

- `gemini-1.5-pro` — most capable
- `gemini-1.5-flash` — faster, lower cost
- `gemini-1.0-pro`
- Any model available in your Vertex AI project

See [Vertex AI docs](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models) for the full list.

## Vertex AI vs Gemini

| | VertexAILLM | GeminiLLM |
|---|---|---|
| Auth | ADC (service accounts, gcloud) | API key |
| Package | `google-cloud-aiplatform` | `google-generativeai` |
| Best for | Production / enterprise | Development / prototyping |
