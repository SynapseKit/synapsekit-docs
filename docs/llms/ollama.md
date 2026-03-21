---
sidebar_position: 4
---

# Ollama (Local)

Run open-source LLMs locally via [Ollama](https://ollama.com). No API key required. Full privacy -- nothing leaves your machine.

## Install Ollama

### macOS

```bash
brew install ollama
ollama serve
```

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve
```

### Windows

Download the installer from [ollama.com/download](https://ollama.com/download) and run it.

Then install the SynapseKit package:

```bash
pip install synapsekit[ollama]
```

## Pull a model

```bash
ollama pull llama3.2
ollama pull mistral
ollama pull gemma2
ollama pull phi3
ollama pull codellama
ollama pull deepseek-r1
```

## Via the RAG facade

```python
from synapsekit import RAG

rag = RAG(model="llama3.2", api_key="", provider="ollama")
rag.add("Your document text here")

answer = rag.ask_sync("Summarize the document.")
print(answer)
```

## Direct usage

```python
from synapsekit.llm.ollama import OllamaLLM
from synapsekit.llm.base import LLMConfig

llm = OllamaLLM(LLMConfig(
    model="llama3.2",
    api_key="",
    provider="ollama",
    temperature=0.7,
    max_tokens=512,
))

async for token in llm.stream("Explain async Python in one paragraph."):
    print(token, end="", flush=True)
```

## Custom base URL

If Ollama is running on a different host (e.g. a GPU server on your LAN):

```python
llm = OllamaLLM(
    LLMConfig(model="llama3.2", api_key="", provider="ollama"),
    base_url="http://192.168.1.50:11434",
)
```

## Supported models

Any model available from `ollama pull`:

| Model | Size | RAM Required | Notes |
|---|---|---|---|
| `llama3.2` | 3B | ~4 GB | Fast, great for most tasks |
| `llama3.1` | 8B | ~8 GB | Good quality |
| `llama3.1:70b` | 70B (Q4) | ~40 GB | High quality, needs GPU |
| `mistral` | 7B | ~8 GB | Strong reasoning |
| `gemma2` | 9B | ~10 GB | Google's open model |
| `phi3` | 3.8B | ~4 GB | Microsoft, fast + efficient |
| `codellama` | 7B | ~8 GB | Code generation |
| `deepseek-r1` | 7B | ~8 GB | Reasoning with chain of thought |
| `nomic-embed-text` | — | ~1 GB | Embeddings only |

## GPU memory guide

| Model size | Minimum VRAM | Recommended |
|---|---|---|
| 1-3B | 4 GB | GTX 1650, M1 |
| 7-8B | 8 GB | RTX 3070, M2 |
| 13B | 12 GB | RTX 3080, M2 Pro |
| 70B (Q4) | 40 GB | A100, M2 Ultra |

Models that don't fit in VRAM run on CPU -- much slower.

## Ollama-specific options

```python
llm = OllamaLLM(
    LLMConfig(model="llama3.2", api_key="", provider="ollama"),
    keep_alive="10m",   # keep model loaded in VRAM after request
    num_ctx=8192,       # context window override (default: model default)
)
```

| Option | Description |
|---|---|
| `keep_alive` | Time to keep model in memory. `"0"` unloads immediately, `"-1"` keeps forever |
| `num_ctx` | Override context window size |
| `num_gpu` | Number of GPU layers to offload |
| `num_thread` | CPU threads to use |

## Function calling

Some Ollama models support function calling (e.g. `llama3.1`, `mistral-nemo`):

```python
from synapsekit import FunctionCallingAgent, tool
from synapsekit.llm.ollama import OllamaLLM
from synapsekit.llm.base import LLMConfig

@tool
def get_weather(city: str) -> str:
    """Get the weather for a city."""
    return f"It's sunny in {city}, 24 degrees C"

llm = OllamaLLM(LLMConfig(
    model="llama3.1",
    api_key="",
    provider="ollama",
))

agent = FunctionCallingAgent(llm=llm, tools=[get_weather])
answer = await agent.run("What's the weather in Tokyo?")
```

:::caution
Not all Ollama models support function calling. Use `llama3.1` or later for reliable results. For other models, use `ReActAgent` instead.
:::

## Use in GitHub Actions (CI)

Run tests with a local Ollama model in CI:

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Start Ollama
        run: |
          curl -fsSL https://ollama.com/install.sh | sh
          ollama serve &
          sleep 5
          ollama pull phi3
      - name: Run tests
        run: |
          pip install synapsekit[ollama]
          pytest tests/
```

## Error handling

```python
from synapsekit.exceptions import LLMError

try:
    response = await llm.generate("Hello")
except LLMError as e:
    if "connection refused" in str(e).lower():
        print("Ollama is not running. Start it with: ollama serve")
    elif "model not found" in str(e).lower():
        print("Pull the model first: ollama pull llama3.2")
    else:
        raise
```

:::tip
To list all locally available models: `ollama list`
:::
