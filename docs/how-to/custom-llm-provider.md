---
sidebar_position: 3
---

# Custom LLM Provider

SynapseKit's `BaseLLM` makes it straightforward to integrate any API — internal inference servers, fine-tuned models, or third-party providers not yet built into the library. This guide walks through building a full custom provider with streaming, function calling, and a mock for testing.

## Prerequisites

```bash
pip install synapsekit aiohttp
```

---

## 1. Minimal custom LLM

Every custom LLM must extend `BaseLLM` and implement `generate` and `stream`.

```python
# my_llm.py
from synapsekit.llms.base import BaseLLM, LLMConfig
from typing import AsyncIterator
import aiohttp


class MyCustomLLM(BaseLLM):
    """Wraps a hypothetical REST inference API."""

    def __init__(
        self,
        api_key: str,
        model: str = "my-model-v1",
        base_url: str = "https://api.myservice.com",
        config: LLMConfig = None,
    ):
        super().__init__(config=config or LLMConfig())
        self.api_key = api_key
        self.model = model
        self.base_url = base_url

    # ------------------------------------------------------------------
    # Required: non-streaming completion
    # ------------------------------------------------------------------
    async def generate(self, prompt: str, **kwargs) -> str:
        response = await self._call_api(prompt, **kwargs)
        return response["text"]

    # ------------------------------------------------------------------
    # Required: streaming completion
    # ------------------------------------------------------------------
    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        async for chunk in self._stream_api(prompt, **kwargs):
            yield chunk["token"]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    async def _call_api(self, prompt: str, **kwargs) -> dict:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/generate",
                json={"prompt": prompt, "model": self.model, **kwargs},
                headers={"Authorization": f"Bearer {self.api_key}"},
            ) as resp:
                resp.raise_for_status()
                return await resp.json()

    async def _stream_api(self, prompt: str, **kwargs):
        """Yields parsed chunk dicts from a streaming endpoint."""
        import json as _json

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/generate/stream",
                json={"prompt": prompt, "model": self.model, "stream": True, **kwargs},
                headers={"Authorization": f"Bearer {self.api_key}"},
            ) as resp:
                resp.raise_for_status()
                async for line in resp.content:
                    line = line.decode().strip()
                    if line.startswith("data:"):
                        payload = line[5:].strip()
                        if payload and payload != "[DONE]":
                            yield _json.loads(payload)
```

### Basic usage

```python
import asyncio

llm = MyCustomLLM(api_key="sk-...", model="my-model-v1")

async def main():
    # Non-streaming
    answer = await llm.generate("What is the capital of France?")
    print(answer)
    # Expected output: Paris

    # Streaming
    async for token in llm.stream("Explain neural networks briefly"):
        print(token, end="", flush=True)
    print()

asyncio.run(main())
```

---

## 2. Configuring retries and timeouts

Pass an `LLMConfig` to control retry behavior inherited from `BaseLLM`.

```python
from synapsekit.llms.base import LLMConfig

config = LLMConfig(
    max_retries=3,
    retry_delay=1.0,     # initial delay in seconds
    retry_backoff=2.0,   # multiply delay by this on each retry
    timeout=30.0,        # seconds before request times out
    temperature=0.7,
    max_tokens=1024,
)

llm = MyCustomLLM(
    api_key="sk-...",
    model="my-model-v1",
    config=config,
)

# On transient errors (5xx, timeouts), BaseLLM retries automatically:
# Attempt 1 → wait 1s → Attempt 2 → wait 2s → Attempt 3 → wait 4s → raises
```

---

## 3. Adding function calling support

Override `generate_with_tools` to send a tool schema to your API and parse the response.

```python
from synapsekit.llms.base import BaseLLM, LLMConfig, ToolCall
from typing import AsyncIterator


class MyCustomLLMWithTools(MyCustomLLM):
    """Adds function-calling support on top of the base provider."""

    async def generate_with_tools(
        self,
        prompt: str,
        tools: list[dict],
        **kwargs,
    ) -> tuple[str | None, list[ToolCall]]:
        """
        Returns:
            (text_response, tool_calls)
            text_response is None when the model calls a tool.
            tool_calls is empty when the model responds with text.
        """
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/generate",
                json={
                    "prompt": prompt,
                    "model": self.model,
                    "tools": tools,
                    **kwargs,
                },
                headers={"Authorization": f"Bearer {self.api_key}"},
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()

        if data.get("tool_calls"):
            calls = [
                ToolCall(name=tc["name"], arguments=tc["arguments"])
                for tc in data["tool_calls"]
            ]
            return None, calls

        return data["text"], []
```

### Using with a SynapseKit agent

```python
from synapsekit.agents import FunctionCallingAgent
from synapsekit.tools import tool

@tool
def calculator(expression: str) -> str:
    """Evaluate a mathematical expression."""
    return str(eval(expression))  # noqa: S307 (demo only)

llm = MyCustomLLMWithTools(api_key="sk-...")
agent = FunctionCallingAgent(llm=llm, tools=[calculator])

import asyncio

async def main():
    result = await agent.run("What is 847 * 23?")
    print(result)
    # Expected output: 847 * 23 = 19,481

asyncio.run(main())
```

---

## 4. Mock LLM for testing (no API calls)

Use `MockLLM` in unit tests to avoid real API calls, cost, and flakiness.

```python
# tests/conftest.py
from synapsekit.llms.base import BaseLLM, LLMConfig
from typing import AsyncIterator
import pytest


class MockLLM(BaseLLM):
    """Mock LLM for testing — no API calls."""

    def __init__(self, responses: list[str] = None):
        super().__init__(config=LLMConfig())
        self.responses = responses or ["Mock response"]
        self._call_count = 0

    async def generate(self, prompt: str, **kwargs) -> str:
        response = self.responses[self._call_count % len(self.responses)]
        self._call_count += 1
        return response

    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        response = await self.generate(prompt, **kwargs)
        for word in response.split():
            yield word + " "

    def reset(self):
        self._call_count = 0


@pytest.fixture
def mock_llm():
    return MockLLM(responses=[
        "RAG stands for Retrieval-Augmented Generation.",
        "It combines retrieval with generation.",
    ])
```

### Using MockLLM in a test

```python
# tests/test_rag_pipeline.py
import pytest
from synapsekit import RAG


@pytest.mark.asyncio
async def test_rag_pipeline(mock_llm):
    rag = RAG(llm=mock_llm)
    await rag.aadd(["SynapseKit makes building LLM apps easy."])

    answer = await rag.aquery("What is SynapseKit?")
    assert "RAG" in answer
    assert mock_llm._call_count == 1

    # Second call cycles to next response
    answer2 = await rag.aquery("Tell me more")
    assert "generation" in answer2.lower()
    assert mock_llm._call_count == 2
```

---

## 5. Using your custom LLM with RAGPipeline

```python
import asyncio
from synapsekit import RAG
from synapsekit.vectorstores.chroma import ChromaVectorStore
from synapsekit.embeddings.openai import OpenAIEmbeddings

async def main():
    embeddings = OpenAIEmbeddings()
    store = ChromaVectorStore(embeddings=embeddings, collection_name="docs")
    llm = MyCustomLLM(api_key="sk-...")

    rag = RAG(llm=llm, vector_store=store)

    await rag.aadd([
        "SynapseKit supports custom LLM providers through BaseLLM.",
        "Any REST API can be wrapped in about 30 lines of code.",
    ])

    answer = await rag.aquery("How do I add a custom LLM to SynapseKit?")
    print(answer)
    # Expected output:
    # You can add a custom LLM by extending BaseLLM and implementing
    # the generate() and stream() methods to call your API.

asyncio.run(main())
```

---

## 6. Using your custom LLM with agents

```python
import asyncio
from synapsekit.agents import FunctionCallingAgent
from synapsekit.tools import tool


@tool
def get_stock_price(ticker: str) -> str:
    """Get the current stock price for a given ticker symbol."""
    # Demo — in production call a real financial API
    prices = {"AAPL": 189.30, "GOOG": 175.50, "MSFT": 420.10}
    price = prices.get(ticker.upper(), 0.0)
    return f"{ticker.upper()}: ${price:.2f}"


async def main():
    llm = MyCustomLLM(api_key="sk-...")
    agent = FunctionCallingAgent(llm=llm, tools=[get_stock_price])

    result = await agent.run("What is the current price of Apple stock?")
    print(result)
    # Expected output: The current price of Apple (AAPL) is $189.30.

asyncio.run(main())
```

---

## 7. Testing your custom provider

A complete test suite for a custom LLM:

```python
# tests/test_my_custom_llm.py
import pytest
from unittest.mock import AsyncMock, patch
from my_llm import MyCustomLLM


@pytest.fixture
def llm():
    return MyCustomLLM(api_key="test-key", model="test-model")


@pytest.mark.asyncio
async def test_generate_returns_text(llm):
    mock_response = {"text": "Hello, world!"}
    with patch.object(llm, "_call_api", return_value=mock_response):
        result = await llm.generate("Say hello")
    assert result == "Hello, world!"


@pytest.mark.asyncio
async def test_stream_yields_tokens(llm):
    async def mock_stream(*args, **kwargs):
        for token in ["Hello", " world", "!"]:
            yield {"token": token}

    with patch.object(llm, "_stream_api", side_effect=mock_stream):
        tokens = []
        async for token in llm.stream("Say hello"):
            tokens.append(token)

    assert tokens == ["Hello", " world", "!"]
    assert "".join(tokens) == "Hello world!"


@pytest.mark.asyncio
async def test_generate_retries_on_error(llm):
    """BaseLLM retries transient errors automatically."""
    call_count = 0
    original = llm._call_api

    async def flaky_api(prompt, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise aiohttp.ClientError("Transient error")
        return {"text": "Success after retries"}

    with patch.object(llm, "_call_api", side_effect=flaky_api):
        result = await llm.generate("test")
    assert result == "Success after retries"
    assert call_count == 3
```

---

## Summary checklist

- Extend `BaseLLM` and implement `generate()` and `stream()`
- Pass `LLMConfig` for retries, timeouts, and temperature
- Override `generate_with_tools()` for function calling
- Use `MockLLM` in all unit tests — never call real APIs in CI
- Register your LLM with `RAG`, agents, and graph nodes exactly like built-in providers
