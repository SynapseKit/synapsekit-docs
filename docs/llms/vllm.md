---
sidebar_position: 33
---

# vLLM

High-throughput LLM inference via [vLLM](https://vllm.ai/)'s OpenAI-compatible API. Run self-hosted models with PagedAttention for maximum GPU utilisation.

## Install

```bash
pip install synapsekit[vllm]
```

Start a vLLM server:

```bash
pip install vllm
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Meta-Llama-3.1-8B-Instruct \
  --port 8000
```

## Usage

```python
from synapsekit.llm.vllm import VLLMLlm
from synapsekit import LLMConfig

config = LLMConfig(
    model="meta-llama/Meta-Llama-3.1-8B-Instruct",
    api_key="EMPTY",  # vLLM accepts any non-empty string
    provider="vllm",
)

llm = VLLMLlm(config)

# Streaming
async for token in llm.stream("Explain attention mechanisms"):
    print(token, end="", flush=True)

# Generate
response = await llm.generate("What is PagedAttention?")
print(response)
```

## Custom base URL

```python
llm = VLLMLlm(config, base_url="http://my-vllm-server:8000/v1")
```

Default base URL: `http://localhost:8000/v1`

## With RAG

```python
from synapsekit import RAG

rag = RAG(
    model="meta-llama/Meta-Llama-3.1-8B-Instruct",
    api_key="EMPTY",
    provider="vllm",
)

rag.add("Your knowledge base document.")
answer = rag.ask_sync("Query your knowledge base.")
```

## Function calling

vLLM supports OpenAI-compatible tool calling for models that were trained with tool use:

```python
from synapsekit import FunctionCallingAgent
from synapsekit.llm.vllm import VLLMLlm
from synapsekit import LLMConfig, CalculatorTool

config = LLMConfig(model="meta-llama/Meta-Llama-3.1-8B-Instruct", api_key="EMPTY")
llm = VLLMLlm(config)

agent = FunctionCallingAgent(llm=llm, tools=[CalculatorTool()])
result = await agent.run("What is 1337 * 42?")
```

## Notes

- vLLM uses `AsyncOpenAI` client pointed at the vLLM server — no separate SDK needed.
- Throughput is significantly higher than Ollama for concurrent requests (PagedAttention).
- For multi-GPU setups, pass `--tensor-parallel-size N` to the vLLM server.
