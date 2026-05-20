---
sidebar_position: 10
---

# Reasoning Agent

Routes queries to either a fast LLM or a reasoning-capable LLM based on query complexity. Simple queries use the fast path; complex queries (math, multi-step reasoning, architecture, debugging) are sent to the reasoning LLM with a token budget. Falls back to the fast LLM on timeout or budget exhaustion.

**Import:**
```python
from synapsekit.agents import ReasoningAgent, ReasoningAgentConfig
```

No extra dependency beyond the reasoning LLM providers you are already using.

---

## `ReasoningAgentConfig`

```python
from synapsekit.agents import ReasoningAgentConfig
from dataclasses import dataclass

@dataclass
class ReasoningAgentConfig:
    fast_llm: BaseLLM
    reasoning_llm: ReasoningLLM
    tools: list[BaseTool]
    agent_type: Literal["react", "function_calling"] = "react"
    max_iterations: int = 10
    system_prompt: str = "You are a helpful AI assistant."
    classifier_llm: BaseLLM | None = None
    classifier_prompt: str | None = None
    complexity_threshold: int = 2
    thinking_budget_tokens: int = 15000
    timeout_seconds: float | None = 30.0
    fallback_on_error: bool = True
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `fast_llm` | `BaseLLM` | required | LLM for simple queries |
| `reasoning_llm` | `ReasoningLLM` | required | Reasoning-capable LLM for complex queries |
| `tools` | `list[BaseTool]` | required | Tools available to both executors |
| `agent_type` | `str` | `"react"` | Agent loop type: `"react"` or `"function_calling"` |
| `max_iterations` | `int` | `10` | Maximum agent loop iterations |
| `system_prompt` | `str` | `"You are a helpful AI assistant."` | System prompt for both executors |
| `classifier_llm` | `BaseLLM \| None` | `None` | LLM for query classification; falls back to heuristics if not set |
| `classifier_prompt` | `str \| None` | `None` | Custom classifier prompt template with `{query}` placeholder |
| `complexity_threshold` | `int` | `2` | Minimum heuristic score to classify a query as complex |
| `thinking_budget_tokens` | `int` | `15000` | Maximum thinking tokens allowed per reasoning call |
| `timeout_seconds` | `float \| None` | `30.0` | Timeout for the reasoning path in seconds; `None` = no timeout |
| `fallback_on_error` | `bool` | `True` | Fall back to `fast_llm` on timeout or budget exceeded |

`function_calling` agent type is only supported for OpenAI and Anthropic reasoning models.

---

## `ReasoningAgent`

```python
from synapsekit.agents import ReasoningAgent

agent = ReasoningAgent(config: ReasoningAgentConfig)
```

### Methods

- `async run(query: str) -> str` — classify the query, run the appropriate executor, return the answer string
- `async stream(query: str)` — async generator; runs `run()` and yields tokens

### Properties

- `last_decision: ReasoningDecision | None` — classification result from the most recent call
- `last_usage: ReasoningUsage | None` — token usage from the reasoning LLM (if used)
- `last_fallback_reason: str | None` — reason for the fast-path fallback if one occurred

---

## `ComplexityClassifier`

Classifies a query as `"simple"` or `"complex"`. Used internally by `ReasoningAgent` but available standalone.

```python
from synapsekit.agents.reasoning_agent import ComplexityClassifier

classifier = ComplexityClassifier(
    llm: BaseLLM | None = None,
    prompt: str | None = None,
    threshold: int = 2,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM \| None` | `None` | Optional LLM for classification; falls back to heuristics |
| `prompt` | `str \| None` | `None` | Custom prompt template; must contain `{query}` |
| `threshold` | `int` | `2` | Heuristic score threshold for `"complex"` |

### Methods

- `async classify(query: str) -> ReasoningDecision` — classify the query; uses LLM if configured, heuristics otherwise

Heuristic signals: long queries (30+ words), multiple questions, math symbols/keywords (`theorem`, `proof`, `∑`, `matrix`), reasoning keywords (`derive`, `optimize`, `architecture`, `complexity`).

---

## `ReasoningDecision`

```python
from dataclasses import dataclass

@dataclass
class ReasoningDecision:
    complexity: Literal["simple", "complex"]
    reason: str
    score: float | None = None
```

| Field | Type | Description |
|---|---|---|
| `complexity` | `"simple" \| "complex"` | Classification result |
| `reason` | `str` | Human-readable explanation of the classification |
| `score` | `float \| None` | Heuristic score if heuristics were used |

---

## Example

```python
import asyncio
from synapsekit import OpenAILLM, LLMConfig
from synapsekit.llm import ReasoningLLM
from synapsekit.agents import ReasoningAgent, ReasoningAgentConfig
from synapsekit.agents.tools import CalculatorTool, WebSearchTool

async def main():
    # Fast LLM for simple queries
    fast_llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

    # Reasoning LLM for complex queries
    reasoning_llm = ReasoningLLM(
        provider="openai",
        model="o1-mini",
        api_key="sk-...",
    )

    config = ReasoningAgentConfig(
        fast_llm=fast_llm,
        reasoning_llm=reasoning_llm,
        tools=[CalculatorTool(), WebSearchTool()],
        thinking_budget_tokens=10_000,
        timeout_seconds=60.0,
        fallback_on_error=True,
    )

    agent = ReasoningAgent(config)

    # Simple query — routed to fast_llm
    answer = await agent.run("What is the capital of France?")
    print(f"[{agent.last_decision.complexity}] {answer}")
    # > [simple] Paris

    # Complex query — routed to reasoning_llm
    answer = await agent.run(
        "Derive the time complexity of Dijkstra's algorithm with a Fibonacci heap "
        "and explain why it is optimal for sparse graphs."
    )
    print(f"[{agent.last_decision.complexity}] {answer[:120]}...")
    print(f"Thinking tokens used: {agent.last_usage.thinking_tokens if agent.last_usage else 'n/a'}")

    # Inspect classification
    decision = agent.last_decision
    print(f"Classification reason: {decision.reason}")

asyncio.run(main())
```

---

## See also

- [Agents overview](overview)
- [Agent executor](executor)
- [Agent federation](federation)
- [ReasoningLLM](../llms/reasoning)
