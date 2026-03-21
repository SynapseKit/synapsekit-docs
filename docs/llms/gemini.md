---
sidebar_position: 7
---

# Google Gemini

Use Google's Gemini models with up to 1M token context, multimodal inputs, and native function calling.

## Install

```bash
pip install synapsekit[gemini]
```

## Via the RAG facade

```python
from synapsekit import RAG

rag = RAG(model="gemini-2.0-flash", api_key="your-google-api-key")
rag.add("Your document text here")

answer = rag.ask_sync("Summarize the document.")
```

## Direct usage

```python
from synapsekit.llm.gemini import GeminiLLM
from synapsekit.llm.base import LLMConfig

llm = GeminiLLM(LLMConfig(
    model="gemini-2.0-flash",
    api_key="your-google-api-key",
    provider="gemini",
    temperature=0.3,
    max_tokens=1024,
))

async for token in llm.stream("Explain vector embeddings."):
    print(token, end="", flush=True)
```

## Available models

| Model | Context | Input (per 1M) | Output (per 1M) | Notes |
|---|---|---|---|---|
| `gemini-2.5-pro` | 1M | $1.25 | $10.00 | Most capable, multimodal |
| `gemini-2.5-flash` | 1M | $0.075 | $0.30 | Fast, low cost |
| `gemini-2.0-flash` | 1M | $0.075 | $0.30 | Stable, production-ready |
| `gemini-2.0-flash-lite` | 1M | $0.01 | $0.04 | Cheapest |
| `gemini-1.5-pro` | 2M | $1.25 | $5.00 | Legacy, largest context |
| `gemini-1.5-flash` | 1M | $0.075 | $0.30 | Legacy fast |

## Google AI API vs Vertex AI

| Feature | Google AI API | Vertex AI |
|---|---|---|
| Auth | API key | `gcloud` / service account |
| Cost | Pay-per-use | Same, + GCP billing |
| Region control | No | Yes |
| Enterprise SLA | No | Yes |
| Free tier | Yes | No |

### Google AI API (default)

```python
llm = GeminiLLM(LLMConfig(
    model="gemini-2.0-flash",
    api_key="AIza...",
    provider="gemini",
))
```

### Vertex AI

```python
llm = GeminiLLM(
    LLMConfig(model="gemini-2.0-flash", api_key="", provider="gemini"),
    use_vertex=True,
    project_id="my-gcp-project",
    location="us-central1",
)
```

When `use_vertex=True`, SynapseKit uses `google-auth` Application Default Credentials. Run `gcloud auth application-default login` first.

## Function calling

GeminiLLM supports native function calling via `call_with_tools()`. SynapseKit automatically converts OpenAI-format tool schemas to Gemini's `FunctionDeclaration` format.

```python
from synapsekit import FunctionCallingAgent, CalculatorTool
from synapsekit.llm.gemini import GeminiLLM
from synapsekit.llm.base import LLMConfig

llm = GeminiLLM(LLMConfig(
    model="gemini-2.0-flash",
    api_key="your-google-api-key",
    provider="gemini",
))

agent = FunctionCallingAgent(
    llm=llm,
    tools=[CalculatorTool()],
)

answer = await agent.run("What is 144 divided by 12?")
```

### Direct call_with_tools

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "City name"},
                },
                "required": ["city"],
            },
        },
    }
]

messages = [
    {"role": "system", "content": "You are helpful."},
    {"role": "user", "content": "What's the weather in Paris?"},
]

result = await llm.call_with_tools(messages, tools)
# {"content": None, "tool_calls": [{"id": "call_...", "name": "get_weather", "arguments": {"city": "Paris"}}]}
```

:::note
Gemini doesn't provide tool call IDs natively. SynapseKit generates them via `uuid4` for compatibility.
:::

## Multimodal inputs

```python
from synapsekit.multimodal import ImageContent

# Analyze an image
message = {
    "role": "user",
    "content": [
        ImageContent.from_url("https://example.com/chart.png"),
        {"type": "text", "text": "Describe the trend shown in this chart."},
    ],
}

response = await llm.generate(message)
```

### Audio inputs

```python
from synapsekit.multimodal import AudioContent

with open("meeting_recording.mp3", "rb") as f:
    audio = AudioContent.from_bytes(f.read(), media_type="audio/mp3")

response = await llm.generate([audio, "Summarize this meeting recording."])
```

## Long context: processing large documents

Gemini's 1M+ token context enables loading entire books or codebases:

```python
# Load a 500-page PDF (as text) into context
with open("annual_report.txt") as f:
    document = f.read()

# Gemini 2.5 Pro handles ~750K words in a single request
llm = GeminiLLM(LLMConfig(
    model="gemini-2.5-pro",
    api_key="AIza...",
    max_tokens=8192,
))

response = await llm.generate(
    f"Here is the annual report:\n\n{document}\n\nWhat were the top 3 risks mentioned?"
)
```

For documents exceeding 1M tokens, chunk and summarize progressively:

```python
CHUNK_SIZE = 800_000  # tokens (approximate)

chunks = [document[i:i+CHUNK_SIZE*4] for i in range(0, len(document), CHUNK_SIZE*4)]
summaries = []

for i, chunk in enumerate(chunks):
    summary = await llm.generate(f"Summarize section {i+1}:\n\n{chunk}")
    summaries.append(summary)

final = await llm.generate("Combine these summaries:\n\n" + "\n\n".join(summaries))
```

## Rate limits

| Tier | RPM | TPM | Notes |
|---|---|---|---|
| Free | 15 | 1M | For prototyping |
| Pay-as-you-go | 360 | 4M | gemini-2.0-flash |
| Pay-as-you-go | 360 | 4M | gemini-2.5-pro |

Use `requests_per_minute` in `LLMConfig` to throttle if needed:

```python
llm = GeminiLLM(LLMConfig(
    model="gemini-2.0-flash",
    api_key="AIza...",
    requests_per_minute=14,  # stay under free tier limit
))
```

## Error handling

```python
from synapsekit.exceptions import LLMError, RateLimitError, AuthenticationError

try:
    response = await llm.generate("Hello")
except AuthenticationError:
    print("Invalid API key — visit aistudio.google.com to create one")
except RateLimitError:
    print("Rate limit exceeded — upgrade to pay-as-you-go or reduce RPM")
except LLMError as e:
    print(f"Gemini error: {e}")
```

:::tip
Get a free API key at [aistudio.google.com](https://aistudio.google.com). The free tier includes 15 RPM and 1M tokens/day.
:::
