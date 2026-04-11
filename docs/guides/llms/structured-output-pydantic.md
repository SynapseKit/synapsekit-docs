---
sidebar_position: 6
title: "Structured Output with Pydantic"
description: "Use Pydantic BaseModel as a response schema to get validated, type-safe JSON from any LLM in SynapseKit."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Structured Output with Pydantic

<ColabBadge path="llms/structured-output-pydantic.ipynb" />

LLMs return free-form text by default, but most application code needs structured data — a product object, a list of action items, a classification with a confidence score. SynapseKit's structured output support lets you pass a Pydantic `BaseModel` as the response schema and receive a validated model instance back, with zero manual JSON parsing.

**What you'll build:** A pipeline that extracts structured product information, action items from meeting notes, and sentiment classifications from reviews — all validated by Pydantic with automatic retries on schema violations. **Time:** ~15 min. **Difficulty:** Beginner

## Prerequisites

```bash
pip install synapsekit[openai] pydantic
export OPENAI_API_KEY=sk-...
```

## What you'll learn

- Define response schemas as Pydantic `BaseModel` subclasses
- Pass the schema to `agenerate()` via the `response_model` parameter
- Use JSON mode to ensure the LLM always produces parseable output
- Add field-level `description` hints that guide the LLM
- Handle `ValidationError` when the LLM produces non-conforming output

## Step 1: Define your response schema

```python
import asyncio
from pydantic import BaseModel, Field
from typing import Optional
from synapsekit import LLMConfig
from synapsekit.llms.openai import OpenAILLM

# Field descriptions are injected into the prompt as hints.
# Clear descriptions dramatically improve extraction accuracy.
class Product(BaseModel):
    name: str = Field(description="The product name, exactly as mentioned in the text")
    price_usd: Optional[float] = Field(
        default=None,
        description="The price in USD. Null if not mentioned."
    )
    category: str = Field(description="One of: electronics, clothing, food, books, other")
    key_features: list[str] = Field(
        description="Up to 5 bullet-point features mentioned in the text"
    )
    in_stock: bool = Field(description="Whether the product is available to purchase now")
```

## Step 2: Generate with a response model

```python
llm = OpenAILLM(
    model="gpt-4o-mini",
    config=LLMConfig(
        temperature=0.1,    # Low temperature reduces hallucinated fields
        json_mode=True,     # Force JSON output so parsing never fails on syntax errors
    )
)

async def extract_product(description: str) -> Product:
    """Extract structured product data from unstructured marketing copy."""

    # Passing response_model tells SynapseKit to:
    # 1. Inject the schema into the system prompt
    # 2. Parse the JSON response into a Product instance
    # 3. Run Pydantic validation and raise ValidationError on failure
    product: Product = await llm.agenerate(
        description,
        response_model=Product,
    )
    return product
```

## Step 3: Extract action items from meeting notes

```python
from pydantic import BaseModel, Field
from typing import Literal
from datetime import date

class ActionItem(BaseModel):
    task: str = Field(description="A clear, actionable task description starting with a verb")
    owner: Optional[str] = Field(
        default=None,
        description="The person responsible. Null if unassigned."
    )
    due_date: Optional[str] = Field(
        default=None,
        description="Due date in YYYY-MM-DD format. Null if not mentioned."
    )
    priority: Literal["high", "medium", "low"] = Field(
        description="Priority based on urgency and importance cues in the text"
    )

class MeetingNotes(BaseModel):
    summary: str = Field(description="One-sentence summary of what was decided")
    action_items: list[ActionItem] = Field(
        description="All action items mentioned, in order of priority"
    )
    next_meeting: Optional[str] = Field(
        default=None,
        description="Date of next meeting in YYYY-MM-DD format, if mentioned"
    )

async def extract_action_items(notes: str) -> MeetingNotes:
    result: MeetingNotes = await llm.agenerate(notes, response_model=MeetingNotes)
    return result
```

## Step 4: Sentiment classification with confidence

```python
from pydantic import BaseModel, Field, field_validator

class SentimentResult(BaseModel):
    sentiment: Literal["positive", "negative", "neutral", "mixed"]
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="Confidence score between 0 and 1"
    )
    key_phrases: list[str] = Field(
        description="Up to 3 phrases that most strongly signal the sentiment"
    )
    suggested_action: Optional[str] = Field(
        default=None,
        description="Recommended follow-up action for negative or mixed reviews"
    )

    @field_validator("confidence")
    @classmethod
    def round_confidence(cls, v: float) -> float:
        # Normalise to two decimal places for consistent display
        return round(v, 2)

async def classify_sentiment(review: str) -> SentimentResult:
    result: SentimentResult = await llm.agenerate(review, response_model=SentimentResult)
    return result
```

## Complete working example

```python
import asyncio
from typing import Optional, Literal
from pydantic import BaseModel, Field
from synapsekit import LLMConfig
from synapsekit.llms.openai import OpenAILLM

class Product(BaseModel):
    name: str
    price_usd: Optional[float] = None
    category: str
    key_features: list[str]
    in_stock: bool

class ActionItem(BaseModel):
    task: str
    owner: Optional[str] = None
    priority: Literal["high", "medium", "low"]

class MeetingNotes(BaseModel):
    summary: str
    action_items: list[ActionItem]

class SentimentResult(BaseModel):
    sentiment: Literal["positive", "negative", "neutral", "mixed"]
    confidence: float
    key_phrases: list[str]

async def main():
    llm = OpenAILLM(
        model="gpt-4o-mini",
        config=LLMConfig(temperature=0.1, json_mode=True),
    )

    # --- Product extraction ---
    product_text = """
    Introducing the SoundWave X3 wireless headphones. Priced at $149.99, these
    premium headphones feature 40-hour battery life, active noise cancellation,
    foldable design, and multipoint Bluetooth pairing. Available now in black and white.
    """
    product: Product = await llm.agenerate(product_text, response_model=Product)
    print("=== Product ===")
    print(f"Name:     {product.name}")
    print(f"Price:    ${product.price_usd}")
    print(f"Category: {product.category}")
    print(f"Features: {', '.join(product.key_features[:3])}")
    print(f"In stock: {product.in_stock}\n")

    # --- Meeting notes extraction ---
    meeting_text = """
    Weekly sync — April 11 2026.
    We agreed to ship the API docs by Friday. Alice will own this.
    Bob needs to set up the staging environment by Wednesday — high priority.
    Carol will review the pricing page copy by end of month.
    Next meeting: April 18.
    """
    notes: MeetingNotes = await llm.agenerate(meeting_text, response_model=MeetingNotes)
    print("=== Meeting Notes ===")
    print(f"Summary: {notes.summary}")
    for item in notes.action_items:
        print(f"  [{item.priority.upper()}] {item.task} — {item.owner or 'unassigned'}")
    print()

    # --- Sentiment classification ---
    review = """
    The delivery was fast but the product arrived damaged. Customer support was
    helpful and sent a replacement within 24 hours, so overall I'm satisfied.
    """
    sentiment: SentimentResult = await llm.agenerate(review, response_model=SentimentResult)
    print("=== Sentiment ===")
    print(f"Sentiment:   {sentiment.sentiment} ({sentiment.confidence:.0%} confidence)")
    print(f"Key phrases: {', '.join(sentiment.key_phrases)}")

asyncio.run(main())
```

## Expected output

```
=== Product ===
Name:     SoundWave X3
Price:    $149.99
Category: electronics
Features: 40-hour battery life, active noise cancellation, foldable design
In stock: True

=== Meeting Notes ===
Summary: Team agreed on deliverables and deadlines for API docs, staging environment, and pricing copy.
  [HIGH] Set up staging environment — Bob
  [HIGH] Ship API docs by Friday — Alice
  [LOW] Review pricing page copy — Carol

=== Sentiment ===
Sentiment:   mixed (87% confidence)
Key phrases: arrived damaged, customer support was helpful, overall satisfied
```

## How it works

When `response_model` is set, SynapseKit serializes the Pydantic schema to a JSON Schema object and appends it to the system prompt as a constraint. It also enables `json_mode=True` automatically so the LLM is instructed to produce valid JSON. The raw JSON string is parsed with `model.model_validate_json()` and returned as a typed Python instance. If validation fails, SynapseKit retries up to `max_retries` times (default: 2), appending the validation error to the prompt so the LLM can correct its output.

## Variations

**Nested models:**
```python
class Address(BaseModel):
    street: str
    city: str
    country: str

class Customer(BaseModel):
    name: str
    email: str
    address: Address   # Nested model works automatically
```

**Optional retry on validation failure:**
```python
# Increase retries for complex schemas that the LLM sometimes gets wrong
result = await llm.agenerate(prompt, response_model=MySchema, max_retries=3)
```

**Using with Groq or Anthropic:**
```python
from synapsekit.llms.groq import GroqLLM

groq_llm = GroqLLM(
    model="llama-3.3-70b-versatile",
    config=LLMConfig(temperature=0.1, json_mode=True),
)
result: Product = await groq_llm.agenerate(text, response_model=Product)
```

## Troubleshooting

**`ValidationError`: field required**
Add the missing field to your `BaseModel` or mark it `Optional` with a default. Include a `description` to help the LLM know it should populate the field.

**LLM returns prose instead of JSON despite `json_mode=True`**
Some older models (e.g. `gpt-3.5-turbo` before `1106`) do not support JSON mode. Upgrade to a model that does, or add an explicit instruction in your prompt: `"Respond only with valid JSON matching this schema."`.

**Nested lists come back as strings**
This happens when the LLM serializes inner arrays as comma-separated strings. Add `description="A JSON array of strings, not a comma-separated list"` to the field.

## Next steps

- [Cost-Aware LLM Router](./cost-router) — route structured extraction calls by complexity
- [GitHub PR Review Agent](../integrations/github-pr-review-agent) — combine structured output with tool use
- [SQL Analytics Agent](../integrations/sql-analytics-agent) — extract structured SQL queries from natural language
