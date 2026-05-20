---
sidebar_position: 10
---

# Structured Output API Reference

Provider-agnostic Pydantic validation for LLM responses. `StructuredOutput` wraps any LLM, validates its JSON response against a Pydantic v2 model, and automatically retries with a corrective prompt on validation failure. Streaming support yields incremental JSON chunks alongside retry and result events.

**Import:**
```python
from synapsekit import StructuredOutput, StructuredOutputRetryStrategy
```

Requires pydantic v2 (already a common dependency; no extra install step).

---

## `StructuredOutput`

```python
from synapsekit import StructuredOutput

extractor = StructuredOutput(
    llm: Any,
    schema: type[SchemaT],
    *,
    retry_strategy: StructuredOutputRetryStrategy | None = None,
    cost_tracker: Any | None = None,
    corrective_prompt_builder: PromptBuilder | None = None,
)
```

`StructuredOutput` is generic over `SchemaT`, the Pydantic model type.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `llm` | `Any` | required | Any LLM/provider with `ask()`, `generate()`, `complete()`, or `__call__()` |
| `schema` | `type[SchemaT]` | required | Pydantic v2 `BaseModel` subclass to validate against |
| `retry_strategy` | `StructuredOutputRetryStrategy \| None` | `None` | Retry and fallback configuration; defaults to 3 attempts with no backoff |
| `cost_tracker` | `Any \| None` | `None` | Optional cost tracker; records each attempt |
| `corrective_prompt_builder` | `PromptBuilder \| None` | `None` | Custom corrective prompt factory; defaults to the built-in prompt |

### Methods

- `async generate(prompt: str) -> StructuredOutputResult[SchemaT]` — generate, validate, and return a Pydantic instance; raises `StructuredOutputValidationError` if all attempts fail
- `async ask(prompt: str) -> StructuredOutputResult[SchemaT]` — alias for `generate()`
- `async stream(prompt: str) -> AsyncIterator[StructuredOutputStreamEvent[SchemaT]]` — stream raw chunks, then yield a final `result` event with the validated output

---

## `StructuredOutputRetryStrategy`

```python
from synapsekit import StructuredOutputRetryStrategy
from dataclasses import dataclass

@dataclass
class StructuredOutputRetryStrategy:
    max_attempts: int = 3
    backoff_seconds: float = 0.0
    backoff_multiplier: float = 2.0
    fallback_provider: Any | None = None
    fallback_model: str | None = None
    fallback_after_attempt: int = 2
```

| Field | Type | Default | Description |
|---|---|---|---|
| `max_attempts` | `int` | `3` | Total provider calls, including fallback calls |
| `backoff_seconds` | `float` | `0.0` | Base sleep between retries; `0.0` = no sleep |
| `backoff_multiplier` | `float` | `2.0` | Exponential backoff multiplier applied to `backoff_seconds` |
| `fallback_provider` | `Any \| None` | `None` | Alternative LLM to use from attempt `fallback_after_attempt` onward |
| `fallback_model` | `str \| None` | `None` | Alternative model name on the same LLM from `fallback_after_attempt` onward |
| `fallback_after_attempt` | `int` | `2` | Switch to fallback at this attempt number |

---

## `StructuredOutputResult`

```python
@dataclass
class StructuredOutputResult(Generic[SchemaT]):
    output: SchemaT
    raw_output: str
    attempts: list[StructuredOutputAttempt]
    metadata: dict[str, Any]
```

| Field | Type | Description |
|---|---|---|
| `output` | `SchemaT` | Validated Pydantic model instance |
| `raw_output` | `str` | Raw string returned by the LLM on the successful attempt |
| `attempts` | `list[StructuredOutputAttempt]` | Per-attempt metadata including duration and token estimates |
| `metadata` | `dict` | Aggregate metadata: `attempt_count`, `total_tokens_estimate`, etc. |

---

## `StructuredOutputStreamEvent`

Yielded by `StructuredOutput.stream()`.

```python
@dataclass
class StructuredOutputStreamEvent(Generic[SchemaT]):
    type: str            # "chunk" | "retry" | "result"
    content: str = ""   # Raw JSON chunk (type="chunk") or corrective prompt (type="retry")
    output: SchemaT | None = None   # Populated on type="result"
    metadata: dict | None = None    # Populated on type="retry" and type="result"
    attempt: int = 1
```

---

## `IncrementalJSONBuffer`

Helper for detecting when a streamed JSON value is complete.

```python
from synapsekit import IncrementalJSONBuffer

buffer = IncrementalJSONBuffer()
```

### Methods

- `append(chunk: str) -> bool` — append a chunk; returns `True` when a complete JSON value has been buffered
- `text` — (property) the full accumulated text so far
- `complete` — (property) `True` if the buffer contains a complete JSON value

---

## `StructuredOutputValidationError`

Raised when all retry attempts fail.

```python
class StructuredOutputValidationError(StructuredOutputError):
    attempts: list[StructuredOutputAttempt]
    last_error: Exception
    metadata: dict[str, Any]
```

---

## Example 1 — basic extraction with retries

```python
import asyncio
from pydantic import BaseModel
from synapsekit import OpenAILLM, LLMConfig, StructuredOutput, StructuredOutputRetryStrategy
from synapsekit.structured_output import StructuredOutputValidationError

class ProductReview(BaseModel):
    product_name: str
    sentiment: str       # "positive", "negative", "neutral"
    rating: float        # 1.0–5.0
    summary: str

async def main():
    llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

    extractor = StructuredOutput(
        llm=llm,
        schema=ProductReview,
        retry_strategy=StructuredOutputRetryStrategy(
            max_attempts=3,
            backoff_seconds=0.5,
            backoff_multiplier=2.0,
        ),
    )

    try:
        result = await extractor.generate(
            "Review: 'The noise-cancelling headphones are incredible — best purchase this year!'"
            " Return JSON only."
        )
        review: ProductReview = result.output
        print(f"{review.product_name}: {review.sentiment} ({review.rating}/5.0)")
        print(f"Attempts: {len(result.attempts)}")
    except StructuredOutputValidationError as e:
        print(f"Extraction failed after {len(e.attempts)} attempts: {e}")

asyncio.run(main())
```

---

## Example 2 — streaming with incremental JSON

```python
import asyncio
from pydantic import BaseModel
from synapsekit import OpenAILLM, LLMConfig, StructuredOutput
from synapsekit.structured_output import StructuredOutputValidationError

class MeetingSummary(BaseModel):
    title: str
    action_items: list[str]
    decisions: list[str]

async def main():
    llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))
    extractor = StructuredOutput(llm=llm, schema=MeetingSummary)

    transcript = "We decided to launch v2.0 next Friday. Alice will update the docs. Bob handles CI."

    try:
        async for event in await extractor.stream(
            f"Summarize this meeting transcript as JSON:\n{transcript}"
        ):
            if event.type == "chunk":
                print(event.content, end="", flush=True)  # stream partial JSON
            elif event.type == "retry":
                print(f"\n[retry {event.attempt}] corrective prompt sent")
            elif event.type == "result":
                print()  # newline after streamed JSON
                summary: MeetingSummary = event.output
                print(f"Title: {summary.title}")
                print(f"Action items: {summary.action_items}")
    except StructuredOutputValidationError as e:
        print(f"Failed: {e}")

asyncio.run(main())
```

---

## See also

- [Structured output guide](../guides/llms/structured-output-pydantic)
- [LLM API reference](llm)
- [Evaluation API reference](evaluation)
