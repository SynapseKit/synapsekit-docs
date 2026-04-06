---
sidebar_position: 30
---

# Writer (Palmyra)

Writer's Palmyra models via the OpenAI-compatible API. Includes domain-specific models for medicine and finance.

## Install

```bash
pip install synapsekit[openai]
```

## Usage

```python
from synapsekit.llm.writer import WriterLLM
from synapsekit import LLMConfig

config = LLMConfig(
    model="palmyra-x-004",
    api_key="...",
    provider="writer",
)

llm = WriterLLM(config)

# Streaming
async for token in llm.stream("Draft a contract summary"):
    print(token, end="")

# Generate
response = await llm.generate("Explain HIPAA compliance")
```

## Available models

| Model | Notes |
|---|---|
| `palmyra-x-004` | Latest general purpose |
| `palmyra-x-003-instruct` | Instruction-tuned |
| `palmyra-med` | Medical domain |
| `palmyra-fin` | Financial domain |

## Function calling

```python
from synapsekit import AgentExecutor, AgentConfig, CalculatorTool

config = AgentConfig(
    model="palmyra-x-004",
    api_key="...",
    provider="writer",
    tools=[CalculatorTool()],
)
executor = AgentExecutor(config)
result = await executor.run("Calculate compound interest on $10,000 at 5% for 3 years")
```
