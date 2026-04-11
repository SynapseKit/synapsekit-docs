---
sidebar_position: 8
title: "Agent with Safety Guardrails"
description: "Add ContentFilter, PIIDetector, and TopicRestrictor guardrails to a SynapseKit agent for production safety."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Agent with Safety Guardrails

<ColabBadge path="agents/agent-with-guardrails.ipynb" />

Deploying an agent in production requires more than a good system prompt. Users send unexpected inputs; LLMs occasionally hallucinate sensitive content. Guardrails enforce hard constraints at the Python layer — independently of what the LLM decides. **What you'll build:** an agent wrapped with input and output validation that blocks harmful patterns, detects PII, and restricts off-topic queries — raising a clear error before any tool is called or any response is returned. **Time:** ~15 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit
export OPENAI_API_KEY="sk-..."
```

## What you'll learn

- `ContentFilter` — block regex patterns and keyword lists in text
- `PIIDetector` — find emails, phone numbers, SSNs, and credit card numbers
- `TopicRestrictor` — allow or block topics by keyword
- `Guardrails` — compose multiple checks into one pipeline
- Pre-call input validation and post-call output validation patterns

## Step 1: Import guardrail classes

```python
import asyncio
from synapsekit.agents import (
    ContentFilter,
    FunctionCallingAgent,
    Guardrails,
    GuardrailResult,
    PIIDetector,
    TopicRestrictor,
    DuckDuckGoSearchTool,
    CalculatorTool,
)
from synapsekit.llms.openai import OpenAILLM
```

## Step 2: Configure individual checks

Each guardrail class has a standalone `.check(text)` method that returns a `GuardrailResult`. You can use them individually before composing them into a `Guardrails` pipeline.

```python
# Block content that matches security-sensitive patterns
content_filter = ContentFilter(
    blocked_patterns=[
        r"password\s*[:=]",    # credential leakage pattern
        r"\bAPI[_\s]?key\b",   # API key exposure
        r"<script[^>]*>",       # XSS attempt
    ],
    blocked_words=["hack", "exploit", "inject"],
    max_length=2000,           # reject excessively long inputs
)

# Detect personally identifiable information
pii_detector = PIIDetector(
    detect=["email", "phone", "ssn", "credit_card"],
)

# Keep the agent focused on its domain
topic_restrictor = TopicRestrictor(
    blocked_topics=["politics", "religion", "gambling"],
)
```

## Step 3: Compose into a Guardrails pipeline

`Guardrails` runs all checks in order and collects every violation into a single `GuardrailResult`. This means one call gives you a complete picture of all problems rather than stopping at the first failure.

```python
input_guardrails = Guardrails(checks=[
    content_filter,
    pii_detector,
    topic_restrictor,
])

# Separate output guardrails — may differ from input rules
output_guardrails = Guardrails(checks=[
    PIIDetector(),                       # ensure LLM didn't echo PII back
    ContentFilter(blocked_words=["hack", "exploit"]),
])
```

## Step 4: Test guardrails independently

Always verify guardrail behavior before wiring them to an agent. A guardrail that blocks too aggressively is as harmful as one that blocks too little.

```python
test_cases = [
    ("What is 2 + 2?", False),                          # should pass
    ("My email is alice@example.com", True),             # PII violation
    ("password: secret123", True),                       # pattern violation
    ("Tell me about politics in the US", True),          # topic violation
    ("How do I hack a database?", True),                 # keyword violation
]

for text, expect_violation in test_cases:
    result = input_guardrails.check(text)
    status = "FAIL" if result.passed == expect_violation else "PASS"
    print(f"[{status}] {'BLOCKED' if not result.passed else 'ALLOWED'}: {text[:50]}")
    if not result.passed:
        for v in result.violations:
            print(f"        {v}")
```

## Step 5: Build a guardrailed agent wrapper

Wrap the agent's `run()` method to enforce guardrails without modifying the agent class itself. This keeps the validation logic separate and easily testable.

```python
class GuardrailedAgent:
    """Agent with pre/post-call guardrail enforcement."""

    def __init__(
        self,
        agent: FunctionCallingAgent,
        input_guards: Guardrails,
        output_guards: Guardrails | None = None,
    ) -> None:
        self._agent = agent
        self._input_guards = input_guards
        self._output_guards = output_guards

    async def run(self, query: str) -> str:
        # Validate input before any LLM call or tool execution
        input_result = self._input_guards.check(query)
        if not input_result.passed:
            violations = "; ".join(input_result.violations)
            return f"Request blocked: {violations}"

        answer = await self._agent.run(query)

        # Validate output before returning to the user
        if self._output_guards:
            output_result = self._output_guards.check(answer)
            if not output_result.passed:
                violations = "; ".join(output_result.violations)
                return f"Response blocked (output violation): {violations}"

        return answer
```

## Step 6: Wire everything together

```python
base_agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=[DuckDuckGoSearchTool(), CalculatorTool()],
    system_prompt="You are a helpful assistant for math and web research.",
    max_iterations=6,
)

safe_agent = GuardrailedAgent(
    agent=base_agent,
    input_guards=input_guardrails,
    output_guards=output_guardrails,
)
```

## Complete working example

```python
import asyncio
from synapsekit.agents import (
    CalculatorTool,
    ContentFilter,
    DuckDuckGoSearchTool,
    FunctionCallingAgent,
    Guardrails,
    PIIDetector,
    TopicRestrictor,
)
from synapsekit.llms.openai import OpenAILLM


class GuardrailedAgent:
    def __init__(self, agent, input_guards, output_guards=None):
        self._agent = agent
        self._input_guards = input_guards
        self._output_guards = output_guards

    async def run(self, query: str) -> str:
        result = self._input_guards.check(query)
        if not result.passed:
            return "Request blocked: " + "; ".join(result.violations)

        answer = await self._agent.run(query)

        if self._output_guards:
            out_result = self._output_guards.check(answer)
            if not out_result.passed:
                return "Response blocked: " + "; ".join(out_result.violations)

        return answer


def build_safe_agent() -> GuardrailedAgent:
    base_agent = FunctionCallingAgent(
        llm=OpenAILLM(model="gpt-4o-mini"),
        tools=[DuckDuckGoSearchTool(), CalculatorTool()],
        system_prompt="You are a helpful math and research assistant.",
        max_iterations=6,
    )

    input_guards = Guardrails(checks=[
        ContentFilter(
            blocked_patterns=[r"password\s*[:=]", r"\bAPI[_\s]?key\b"],
            blocked_words=["hack", "exploit"],
            max_length=1500,
        ),
        PIIDetector(detect=["email", "phone", "ssn"]),
        TopicRestrictor(blocked_topics=["gambling", "politics"]),
    ])

    output_guards = Guardrails(checks=[
        PIIDetector(),  # ensure the LLM didn't echo PII in its response
    ])

    return GuardrailedAgent(base_agent, input_guards, output_guards)


async def main() -> None:
    agent = build_safe_agent()

    test_inputs = [
        # Legitimate requests — should pass
        ("What is 456 * 789?", "legitimate"),
        ("What is the capital of France?", "legitimate"),
        # Blocked inputs — should be rejected
        ("My phone is 555-123-4567, help me research phone hacking", "blocked"),
        ("password: admin123 — is this secure?", "blocked"),
        ("Tell me about political gambling strategies", "blocked"),
    ]

    for query, expected in test_inputs:
        answer = await agent.run(query)
        was_blocked = answer.startswith("Request blocked") or answer.startswith("Response blocked")
        status = "OK" if (was_blocked == (expected == "blocked")) else "UNEXPECTED"
        print(f"[{status}] {query[:60]}")
        print(f"  -> {answer[:120]}")
        print()


asyncio.run(main())
```

## Expected output

```
[OK] What is 456 * 789?
  -> 456 × 789 = 359,784.

[OK] What is the capital of France?
  -> The capital of France is Paris.

[OK] My phone is 555-123-4567, help me research phone hacking
  -> Request blocked: PII detected (phone): 1 instance(s); Blocked word found: hack

[OK] password: admin123 — is this secure?
  -> Request blocked: Blocked pattern matched: password\s*[:=]

[OK] Tell me about political gambling strategies
  -> Request blocked: Blocked topic detected: politics; Blocked topic detected: gambling
```

## How it works

`ContentFilter`, `PIIDetector`, and `TopicRestrictor` all compile their patterns once at construction time using `re.compile()`. The `.check()` method is synchronous and pure — it takes a string and returns a `GuardrailResult` with no side effects. This makes unit testing trivial and means guardrail evaluation adds negligible latency.

`Guardrails` iterates over all checks in order and concatenates violations. It does not short-circuit on the first failure so you always get a complete violation report.

`GuardrailResult.passed` is `True` only when `violations` is empty. The `passed` attribute being a simple boolean makes it easy to use in conditional logic without importing the class.

## Variations

**Add a custom check** by implementing any object with a `.check(text) -> GuardrailResult` method:

```python
class LengthGuard:
    def __init__(self, min_length: int = 5) -> None:
        self._min = min_length

    def check(self, text: str) -> GuardrailResult:
        from synapsekit.agents import GuardrailResult
        if len(text.strip()) < self._min:
            return GuardrailResult(passed=False, violations=["Input too short"])
        return GuardrailResult(passed=True)

guards = Guardrails(checks=[LengthGuard(min_length=10), PIIDetector()])
```

**Use `Guardrails.add_check()` dynamically** to enable or disable checks at runtime:

```python
guards = Guardrails()
guards.add_check(ContentFilter(blocked_words=["secret"]))
guards.add_check(PIIDetector())
```

**Log violations instead of blocking** for a monitoring-only mode:

```python
async def run_with_logging(self, query: str) -> str:
    result = self._input_guards.check(query)
    if not result.passed:
        print(f"[WARN] Guardrail triggered: {result.violations}")
        # Do not block — log only
    return await self._agent.run(query)
```

## Troubleshooting

**Legitimate queries are being blocked** — inspect `result.violations` to see which check fired. Common false positives: `ContentFilter` blocking emails in technical docs (tighten the regex), `TopicRestrictor` blocking topics that appear as substrings of unrelated words (use word-boundary patterns instead of plain keywords).

**PII detector misses obfuscated PII** — `PIIDetector` uses regex patterns for standard formats. It will not catch `alice AT example DOT com`. For higher-assurance PII detection, integrate a dedicated NLP service.

**Guardrail check slows down each request noticeably** — all checks are pure regex; they should complete in microseconds. If you see latency, check whether a custom check is performing I/O synchronously.

## Next steps

- [Multi-Tool Orchestration](./multi-tool-orchestration) — add guardrails to an agent with five or more tools
- [Tool Error Handling and Retries](./tool-error-handling) — handle tool-level errors in addition to guardrail violations
- [Streaming Agent Responses](./streaming-agent) — show the agent's reasoning while guardrails validate the final output
