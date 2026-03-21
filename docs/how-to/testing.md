---
sidebar_position: 8
---

# Testing

Reliable LLM applications need a layered test strategy: fast unit tests with mocks, integration tests against real APIs, and eval tests that measure answer quality. This guide covers all three layers plus CI setup with GitHub Actions.

## Prerequisites

```bash
pip install synapsekit[openai] pytest pytest-asyncio
```

Configure pytest for async tests in `pyproject.toml`:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

---

## 1. Unit testing with MockLLM

`MockLLM` returns preset responses without making any API calls. Use it for all unit tests.

```python
# tests/conftest.py
import pytest
from synapsekit.llms.base import BaseLLM, LLMConfig
from typing import AsyncIterator


class MockLLM(BaseLLM):
    """Deterministic mock LLM — no API calls, no cost, no flakiness."""

    def __init__(self, responses: list[str] = None):
        super().__init__(config=LLMConfig())
        self.responses = responses or ["Mock response"]
        self._call_count = 0
        self.call_log: list[str] = []  # Record all prompts for assertions

    async def generate(self, prompt: str, **kwargs) -> str:
        self.call_log.append(prompt)
        response = self.responses[self._call_count % len(self.responses)]
        self._call_count += 1
        return response

    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        response = await self.generate(prompt, **kwargs)
        for word in response.split():
            yield word + " "

    def reset(self):
        self._call_count = 0
        self.call_log.clear()


@pytest.fixture
def mock_llm():
    return MockLLM(responses=[
        "RAG stands for Retrieval-Augmented Generation.",
        "It combines retrieval with language model generation.",
        "RAG reduces hallucinations by grounding answers in retrieved documents.",
    ])


@pytest.fixture
def single_response_llm():
    return MockLLM(responses=["The answer is 42."])
```

### Testing RAG query

```python
# tests/test_rag.py
import pytest
from synapsekit import RAG


@pytest.mark.asyncio
async def test_rag_returns_answer(mock_llm):
    rag = RAG(llm=mock_llm)
    await rag.aadd(["SynapseKit makes building LLM apps easy."])

    answer = await rag.aquery("What is SynapseKit?")

    assert isinstance(answer, str)
    assert len(answer) > 0
    assert mock_llm._call_count == 1


@pytest.mark.asyncio
async def test_rag_uses_context(mock_llm):
    rag = RAG(llm=mock_llm)
    await rag.aadd(["Python was created by Guido van Rossum in 1991."])

    await rag.aquery("Who created Python?")

    # Verify the prompt contained the retrieved context
    assert len(mock_llm.call_log) == 1
    assert "Guido" in mock_llm.call_log[0]


@pytest.mark.asyncio
async def test_rag_streaming(mock_llm):
    rag = RAG(llm=mock_llm)
    await rag.aadd(["RAG is a retrieval technique."])

    tokens = []
    async for token in rag.astream("What is RAG?"):
        tokens.append(token)

    full_response = "".join(tokens)
    assert len(tokens) > 0
    assert "RAG" in full_response


@pytest.mark.asyncio
async def test_rag_multiple_turns(mock_llm):
    from synapsekit.memory import ConversationMemory

    memory = ConversationMemory(max_messages=10)
    rag = RAG(llm=mock_llm, memory=memory)
    await rag.aadd(["Context document."])

    await rag.aquery("First question")
    await rag.aquery("Second question")

    assert mock_llm._call_count == 2
    messages = await memory.get_messages()
    assert len(messages) == 4  # 2 user + 2 assistant
```

---

## 2. Pytest fixtures for RAG

```python
# tests/conftest.py (additions)
import pytest
from synapsekit import RAG
from synapsekit.memory import ConversationMemory


@pytest.fixture
async def rag_pipeline(mock_llm):
    """RAG pipeline pre-loaded with test documents."""
    rag = RAG(llm=mock_llm)
    await rag.aadd([
        "SynapseKit is an open-source Python library for LLM applications.",
        "It supports RAG, agents, graph workflows, and multi-modal inputs.",
        "SynapseKit v1.2 introduced streaming, serve, and cost intelligence.",
    ])
    return rag


@pytest.fixture
async def rag_with_memory(mock_llm):
    """RAG pipeline with conversation memory."""
    memory = ConversationMemory(max_messages=10)
    rag = RAG(llm=mock_llm, memory=memory)
    await rag.aadd(["SynapseKit supports memory-backed pipelines."])
    return rag, memory


# Usage in tests:
@pytest.mark.asyncio
async def test_using_rag_fixture(rag_pipeline):
    answer = await rag_pipeline.aquery("What is SynapseKit?")
    assert answer is not None


@pytest.mark.asyncio
async def test_memory_fixture(rag_with_memory):
    rag, memory = rag_with_memory
    await rag.aquery("First turn")
    messages = await memory.get_messages()
    assert len(messages) >= 1
```

---

## 3. Testing agents with mock tools

```python
# tests/test_agents.py
import pytest
from unittest.mock import AsyncMock, patch
from synapsekit.agents import FunctionCallingAgent
from synapsekit.tools import tool


@tool
def get_weather(city: str) -> str:
    """Get current weather."""
    return f"{city}: 22°C, sunny"


@tool
async def fetch_price(ticker: str) -> str:
    """Get stock price."""
    return f"{ticker}: $150.00"


@pytest.mark.asyncio
async def test_agent_calls_tool(mock_llm):
    """Verify agent invokes tools when needed."""
    # Configure mock to simulate a tool call response
    mock_llm.responses = [
        '{"tool": "get_weather", "args": {"city": "Paris"}}',  # Tool call
        "The weather in Paris is 22°C and sunny.",               # Final answer
    ]

    agent = FunctionCallingAgent(llm=mock_llm, tools=[get_weather])
    result = await agent.run("What's the weather in Paris?")

    assert result is not None
    assert mock_llm._call_count >= 1


@pytest.mark.asyncio
async def test_agent_with_patched_async_tool(mock_llm):
    """Test agent with a patched async tool to avoid HTTP calls."""
    mock_llm.responses = ["The stock price is $150.00."]

    with patch.object(fetch_price, "__call__", return_value="AAPL: $150.00"):
        agent = FunctionCallingAgent(llm=mock_llm, tools=[fetch_price])
        result = await agent.run("What's the price of AAPL?")

    assert result is not None


@pytest.mark.asyncio
async def test_agent_handles_tool_error(mock_llm):
    """Agent should recover gracefully from tool errors."""
    @tool
    def always_fails(input: str) -> str:
        """A tool that always raises."""
        raise ValueError("Tool error!")

    mock_llm.responses = [
        "I encountered an error with that tool. Let me try a different approach.",
    ]

    agent = FunctionCallingAgent(
        llm=mock_llm,
        tools=[always_fails],
        on_tool_error="continue",
    )
    result = await agent.run("Use the failing tool")
    assert result is not None
```

---

## 4. Integration tests (real API)

Integration tests call real APIs and should only run in CI with valid credentials.

```python
# tests/integration/test_openai_integration.py
import pytest
import os

# Skip entirely if no API key
pytestmark = pytest.mark.skipif(
    not os.getenv("OPENAI_API_KEY"),
    reason="OPENAI_API_KEY not set",
)

from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM


@pytest.mark.integration
@pytest.mark.asyncio
async def test_real_rag_pipeline():
    """End-to-end RAG test against real OpenAI API."""
    llm = OpenAILLM(model="gpt-4o-mini")
    rag = RAG(llm=llm)

    await rag.aadd([
        "The Eiffel Tower is 330 metres tall and located in Paris.",
    ])

    answer = await rag.aquery("How tall is the Eiffel Tower?")

    assert "330" in answer or "metres" in answer.lower()
    print(f"Real API answer: {answer}")
```

Run only unit tests (fast, no API):

```bash
pytest tests/ -m "not integration" -q
# Expected output:
# .................. 18 passed in 0.43s
```

Run all tests including integration:

```bash
pytest tests/ -q
# Expected output:
# .................... 20 passed in 3.2s
```

---

## 5. Eval testing with `@eval_case`

Eval tests measure answer quality, not just whether code runs. Use `synapsekit test` to run them.

```python
# tests/evals/test_rag_quality.py
from synapsekit.evaluation import eval_case, EvalConfig
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM


@eval_case(
    inputs={"question": "What is RAG?"},
    expected="Retrieval-Augmented Generation",
    metric="contains",  # Check that answer contains the expected string
)
async def test_rag_definition(question: str) -> str:
    llm = OpenAILLM(model="gpt-4o-mini")
    rag = RAG(llm=llm)
    await rag.aadd(["RAG is Retrieval-Augmented Generation, a technique that..."])
    return await rag.aquery(question)


@eval_case(
    inputs={"question": "Summarize quantum computing in one sentence"},
    expected_keywords=["quantum", "computing", "qubit"],
    metric="keyword_coverage",
    threshold=0.8,  # At least 80% of keywords must appear
)
async def test_summary_keywords(question: str) -> str:
    llm = OpenAILLM(model="gpt-4o-mini")
    return await llm.generate(question)


@eval_case(
    inputs={"question": "Is Python a programming language?"},
    expected="yes",
    metric="llm_judge",  # Use an LLM to judge correctness
    judge_prompt="Does the response confirm that Python is a programming language?",
    threshold=0.9,
)
async def test_factual_correctness(question: str) -> str:
    llm = OpenAILLM(model="gpt-4o-mini")
    return await llm.generate(question)
```

Run evals locally:

```bash
synapsekit test tests/evals/ --threshold 0.7
# Expected output:
# Running 3 eval cases...
# test_rag_definition         PASS  score=1.00
# test_summary_keywords       PASS  score=0.83
# test_factual_correctness    PASS  score=0.95
# ----------------------------------------
# Passed: 3/3  (threshold: 0.70)
```

Run with JSON output for CI:

```bash
synapsekit test tests/evals/ --threshold 0.7 --format json --output eval_results.json
```

---

## 6. GitHub Actions CI example

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: pip install synapsekit[openai] pytest pytest-asyncio

      - name: Run unit tests
        run: pytest tests/ -m "not integration" -q --tb=short
        # Expected output:
        # .................. 18 passed in 0.43s

  eval-tests:
    name: Eval Tests
    runs-on: ubuntu-latest
    needs: unit-tests  # Only run evals after unit tests pass
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: pip install synapsekit[openai]

      - name: Run eval suite
        run: synapsekit test tests/evals/ --threshold 0.7 --format json
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      - name: Upload eval results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: eval-results
          path: eval_results.json
```

---

## 7. Snapshot testing for prompts

Ensure prompt construction does not regress across refactors.

```python
# tests/test_prompt_snapshots.py
import pytest
from synapsekit import RAG
from synapsekit.llms.base import BaseLLM, LLMConfig
from typing import AsyncIterator


class CapturingLLM(BaseLLM):
    """Captures the full prompt for snapshot testing."""

    def __init__(self):
        super().__init__(config=LLMConfig())
        self.captured_prompts: list[str] = []

    async def generate(self, prompt: str, **kwargs) -> str:
        self.captured_prompts.append(prompt)
        return "Test response"

    async def stream(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        yield "Test response"


@pytest.mark.asyncio
async def test_rag_prompt_includes_context():
    capturing_llm = CapturingLLM()
    rag = RAG(llm=capturing_llm)
    await rag.aadd(["Paris is the capital of France."])

    await rag.aquery("What is the capital of France?")

    assert len(capturing_llm.captured_prompts) == 1
    prompt = capturing_llm.captured_prompts[0]

    # Prompt must include the retrieved context
    assert "Paris" in prompt
    assert "capital" in prompt.lower()
    # Prompt must include the question
    assert "What is the capital of France?" in prompt
```

---

## Summary

| Test type | Tool | Speed | Cost |
|---|---|---|---|
| Unit tests | `MockLLM` + pytest | Fast (< 1s) | $0 |
| Integration tests | Real API + `skipif` | Slow (2-10s) | Minimal |
| Eval tests | `@eval_case` + LLM judge | Slow (5-30s) | Low |
| Snapshot tests | `CapturingLLM` | Fast (< 1s) | $0 |

Run unit tests on every commit, integration and eval tests on PRs and main branch merges.
