---
sidebar_position: 1
---

# Guardrails

SynapseKit provides guardrails for content safety, PII detection, and topic restriction. Guardrails can be composed into a pipeline and applied to agent inputs, outputs, or both.

## ContentFilter

Block harmful or inappropriate content:

```python
from synapsekit import ContentFilter

filter = ContentFilter()

result = filter.check("How do I make a cake?")
# result.passed → True

result = filter.check("How do I hack into a server?")
# result.passed → False
# result.reason → "Content blocked: potentially harmful request"
```

## PIIDetector

Detect and optionally redact personally identifiable information:

```python
from synapsekit import PIIDetector

detector = PIIDetector()

result = detector.check("My email is alice@example.com and my SSN is 123-45-6789")
# result.passed → False
# result.pii_found → ["email", "ssn"]

# Redact PII
redacted = detector.redact("Call me at 555-0123, my email is alice@example.com")
# redacted → "Call me at [PHONE], my email is [EMAIL]"
```

## TopicRestrictor

Restrict agent conversations to allowed topics:

```python
from synapsekit import TopicRestrictor

restrictor = TopicRestrictor(
    allowed_topics=["python", "programming", "software engineering"],
    llm=llm,
)

result = await restrictor.check("How do I write a Python decorator?")
# result.passed → True

result = await restrictor.check("What is the best pizza in New York?")
# result.passed → False
# result.reason → "Topic not in allowed list"
```

## Guardrails (composed pipeline)

Compose multiple guardrail checks into a single pipeline:

```python
from synapsekit import Guardrails, ContentFilter, PIIDetector, TopicRestrictor

guardrails = Guardrails(
    checks=[
        ContentFilter(),
        PIIDetector(),
        TopicRestrictor(allowed_topics=["customer support"], llm=llm),
    ],
)

# Check input before sending to agent
result = await guardrails.check("My SSN is 123-45-6789, help me with my order")
if not result.passed:
    print(f"Blocked: {result.reason}")  # "PII detected: ssn"
```

### Using with agents

```python
from synapsekit import FunctionCallingAgent, Guardrails, ContentFilter, PIIDetector

guardrails = Guardrails(checks=[ContentFilter(), PIIDetector()])

agent = FunctionCallingAgent(llm=llm, tools=tools)

# Check input
input_check = await guardrails.check(user_input)
if not input_check.passed:
    return f"Sorry, I can't process that: {input_check.reason}"

result = await agent.run(user_input)

# Check output
output_check = await guardrails.check(result)
if not output_check.passed:
    return "Sorry, I can't share that response."

return result
```
