---
sidebar_position: 3
title: "Creating Custom Tools"
description: "Learn to build SynapseKit agent tools with the @tool decorator, BaseTool subclasses, and async-safe patterns."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Creating Custom Tools

<ColabBadge path="agents/custom-tool-creation.ipynb" />

Every built-in SynapseKit tool is a `BaseTool` subclass with a `name`, `description`, and async `run()` method. Once you understand that contract, adding your own tools takes fewer than ten lines of code. **What you'll build:** four increasingly capable tools — a one-liner decorator tool, a full `BaseTool` subclass with JSON Schema validation, an async HTTP tool, and a tool that returns structured data. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit
export OPENAI_API_KEY="sk-..."
```

## What you'll learn

- The `@tool` decorator for wrapping plain functions
- `BaseTool` subclassing for full control over schema and validation
- How `ToolResult` signals success vs error to the agent
- Async tools that call external APIs safely
- How the agent reads `tool.name` and `tool.description` at runtime

## Step 1: The @tool decorator (simplest path)

The `@tool` decorator wraps any sync or async function into a `BaseTool`. It infers the tool name from the function name and the description from the docstring. Type annotations become the JSON Schema for the tool's parameters.

```python
from synapsekit.agents import tool

@tool()
def celsius_to_fahrenheit(celsius: float) -> str:
    """Convert a temperature from Celsius to Fahrenheit."""
    return str(celsius * 9 / 5 + 32)

# The decorator returns a BaseTool instance, not the raw function
print(celsius_to_fahrenheit.name)         # "celsius_to_fahrenheit"
print(celsius_to_fahrenheit.description)  # "Convert a temperature..."
```

Override `name` and `description` explicitly when the function name would be ambiguous in a multi-tool agent:

```python
@tool(name="unit_converter", description="Convert units of measurement. Supports temperature, length, and weight.")
def convert(value: float, from_unit: str, to_unit: str) -> str:
    """Convert between measurement units."""
    conversions = {
        ("celsius", "fahrenheit"): lambda v: v * 9 / 5 + 32,
        ("fahrenheit", "celsius"): lambda v: (v - 32) * 5 / 9,
        ("km", "miles"): lambda v: v * 0.621371,
        ("miles", "km"): lambda v: v / 0.621371,
    }
    key = (from_unit.lower(), to_unit.lower())
    fn = conversions.get(key)
    if fn is None:
        return f"Unsupported conversion: {from_unit} -> {to_unit}"
    return f"{fn(value):.4f} {to_unit}"
```

## Step 2: BaseTool subclass for full schema control

The `@tool` decorator infers a basic schema. When you need enum values, pattern constraints, nested objects, or `additionalProperties: false`, subclass `BaseTool` directly and define `parameters` as a class attribute.

```python
from typing import Any
from synapsekit.agents import BaseTool, ToolResult

class StockPriceTool(BaseTool):
    """Fetch the current stock price for a given ticker symbol."""

    name = "stock_price"
    description = (
        "Look up the current price of a stock by its ticker symbol. "
        "Use for questions about stock prices, market cap, or trading volume."
    )
    parameters = {
        "type": "object",
        "properties": {
            "ticker": {
                "type": "string",
                "description": "Stock ticker symbol, e.g. AAPL, MSFT, GOOG",
                "pattern": "^[A-Z]{1,5}$",
            }
        },
        "required": ["ticker"],
        "additionalProperties": False,
    }

    async def run(self, ticker: str = "", **kwargs: Any) -> ToolResult:
        # Always validate inputs even though the schema already constrains them —
        # the agent may send malformed arguments after a reasoning error
        if not ticker:
            return ToolResult(output="", error="ticker is required")
        if not ticker.isalpha() or not ticker.isupper():
            return ToolResult(output="", error=f"Invalid ticker format: {ticker!r}")

        # Simulate a real API call; replace with httpx/aiohttp in production
        mock_prices = {"AAPL": 189.45, "MSFT": 415.20, "GOOG": 175.30}
        price = mock_prices.get(ticker)
        if price is None:
            return ToolResult(output="", error=f"Ticker not found: {ticker}")

        return ToolResult(output=f"{ticker}: ${price:.2f}")
```

## Step 3: Async tools that call external APIs

Use `asyncio.get_running_loop().run_in_executor` to wrap any blocking I/O, or use `httpx.AsyncClient` directly. Either way, the tool stays non-blocking so the agent event loop is never stalled.

```python
import asyncio
import json
from typing import Any
from synapsekit.agents import BaseTool, ToolResult

class ExchangeRateTool(BaseTool):
    """Fetch live currency exchange rates."""

    name = "exchange_rate"
    description = (
        "Get the current exchange rate between two currencies. "
        "Use ISO 4217 currency codes like USD, EUR, GBP, JPY."
    )
    parameters = {
        "type": "object",
        "properties": {
            "base": {"type": "string", "description": "Source currency code"},
            "target": {"type": "string", "description": "Target currency code"},
        },
        "required": ["base", "target"],
    }

    async def run(self, base: str = "", target: str = "", **kwargs: Any) -> ToolResult:
        base = (base or "").upper()
        target = (target or "").upper()

        if not base or not target:
            return ToolResult(output="", error="Both base and target currencies are required")

        # In production, replace with a real API call using httpx or aiohttp.
        # run_in_executor keeps blocking I/O off the event loop.
        loop = asyncio.get_running_loop()
        try:
            result = await loop.run_in_executor(None, self._fetch_rate, base, target)
            return result
        except Exception as e:
            return ToolResult(output="", error=f"Failed to fetch rate: {e}")

    def _fetch_rate(self, base: str, target: str) -> ToolResult:
        # Simulated synchronous HTTP call; swap for requests.get() or urllib in production
        mock = {("USD", "EUR"): 0.92, ("EUR", "USD"): 1.09, ("USD", "GBP"): 0.79}
        rate = mock.get((base, target))
        if rate is None:
            return ToolResult(output="", error=f"No rate available for {base}/{target}")
        return ToolResult(output=f"1 {base} = {rate:.4f} {target}")
```

## Step 4: Tools that return structured JSON

When downstream code needs to parse tool output, return JSON-encoded data inside `ToolResult.output`. The agent sees it as a string; your application can `json.loads()` it after the run.

```python
import json
from typing import Any
from synapsekit.agents import BaseTool, ToolResult

class CompanyInfoTool(BaseTool):
    """Return structured company information as JSON."""

    name = "company_info"
    description = (
        "Return structured information about a company: name, industry, "
        "founding year, and headquarters. Use for company research questions."
    )
    parameters = {
        "type": "object",
        "properties": {
            "company": {"type": "string", "description": "Company name or ticker"}
        },
        "required": ["company"],
    }

    async def run(self, company: str = "", **kwargs: Any) -> ToolResult:
        if not company:
            return ToolResult(output="", error="company name is required")

        mock_db = {
            "apple": {"name": "Apple Inc.", "industry": "Technology", "founded": 1976, "hq": "Cupertino, CA"},
            "openai": {"name": "OpenAI", "industry": "AI Research", "founded": 2015, "hq": "San Francisco, CA"},
        }
        data = mock_db.get(company.lower())
        if data is None:
            return ToolResult(output="", error=f"No data found for company: {company!r}")

        # Return as JSON so the agent can embed it in a formatted answer
        return ToolResult(output=json.dumps(data))
```

## Step 5: Wire tools into an agent

All four tool types plug into any agent class identically — the agent only cares that each object has `name`, `description`, `parameters`, and an async `run()` method.

```python
from synapsekit.agents import FunctionCallingAgent
from synapsekit.llms.openai import OpenAILLM

agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=[
        celsius_to_fahrenheit,  # @tool decorator instance
        StockPriceTool(),
        ExchangeRateTool(),
        CompanyInfoTool(),
    ],
    system_prompt="You are a helpful financial and unit-conversion assistant.",
)
```

## Complete working example

```python
import asyncio
import json
from typing import Any
from synapsekit.agents import BaseTool, FunctionCallingAgent, ToolResult, tool
from synapsekit.llms.openai import OpenAILLM


@tool(name="celsius_to_fahrenheit", description="Convert a Celsius temperature to Fahrenheit.")
def celsius_to_fahrenheit(celsius: float) -> str:
    """Convert Celsius to Fahrenheit."""
    return f"{celsius * 9 / 5 + 32:.1f}°F"


class StockPriceTool(BaseTool):
    name = "stock_price"
    description = "Return the current stock price for a ticker symbol like AAPL or MSFT."
    parameters = {
        "type": "object",
        "properties": {
            "ticker": {"type": "string", "description": "Uppercase stock ticker, e.g. AAPL"}
        },
        "required": ["ticker"],
    }

    async def run(self, ticker: str = "", **kwargs: Any) -> ToolResult:
        prices = {"AAPL": 189.45, "MSFT": 415.20, "GOOG": 175.30}
        price = prices.get((ticker or "").upper())
        if price is None:
            return ToolResult(output="", error=f"Unknown ticker: {ticker!r}")
        return ToolResult(output=f"{ticker.upper()}: ${price:.2f}")


async def main() -> None:
    agent = FunctionCallingAgent(
        llm=OpenAILLM(model="gpt-4o-mini"),
        tools=[celsius_to_fahrenheit, StockPriceTool()],
        system_prompt="You are a helpful assistant for unit conversion and stock lookups.",
    )

    queries = [
        "What is 22 degrees Celsius in Fahrenheit?",
        "What is the current price of Apple stock?",
        "Convert 37.5°C to Fahrenheit and also give me the MSFT stock price.",
    ]

    for query in queries:
        print(f"Q: {query}")
        answer = await agent.run(query)
        print(f"A: {answer}\n")


asyncio.run(main())
```

## Expected output

```
Q: What is 22 degrees Celsius in Fahrenheit?
A: 22 degrees Celsius is 71.6°F.

Q: What is the current price of Apple stock?
A: The current price of Apple (AAPL) is $189.45.

Q: Convert 37.5°C to Fahrenheit and also give me the MSFT stock price.
A: 37.5°C is 99.5°F. Microsoft (MSFT) is currently trading at $415.20.
```

## How it works

The `@tool` decorator uses `inspect.signature()` to build a JSON Schema from the function's parameter annotations. The schema is stored in `_DynamicTool.parameters` and returned by `BaseTool.schema()`, which produces the OpenAI-compatible function-calling spec. The agent sends all tool schemas in the initial API request; the LLM responds with `tool_calls` JSON; the agent dispatches to the matching tool by name from `ToolRegistry`.

`ToolResult.is_error` is `True` when `error` is not `None`. The `FunctionCallingAgent` converts both success and error results to strings and appends them as `role: tool` messages so the LLM can reason about what went wrong and decide whether to retry.

## Variations

**Combine `@tool` with a class** when you need initialization parameters:

```python
class WeatherAPITool:
    def __init__(self, api_key: str) -> None:
        self._key = api_key

    @tool(name="current_weather", description="Get current weather for a city.")
    def get_weather(city: str) -> str:
        # self is not available here; use a closure instead
        return f"Weather for {city}: sunny, 24°C"
```

**Use closures** to inject runtime configuration into a decorator tool:

```python
def make_db_tool(connection_string: str):
    @tool(name="query_users", description="Query the users table by email.")
    async def query_users(email: str) -> str:
        # connection_string captured from closure
        return f"User with {email} found in {connection_string}"
    return query_users
```

## Troubleshooting

**Agent ignores the tool and answers from training data** — the `description` is too vague. Add concrete trigger phrases: "Use this tool whenever the user asks about X."

**`ToolResult.error` is set but the agent retries forever** — add explicit instructions in `system_prompt`: "If a tool returns an error, report it to the user and do not retry more than once."

**Type annotations not reflected in schema** — the `@tool` decorator only maps `int`, `float`, `str`, and `bool`. For `list`, `dict`, or custom types, use a `BaseTool` subclass and define `parameters` manually.

**`run()` receives unexpected kwargs** — always add `**kwargs: Any` to `run()` signatures. The agent may pass extra fields if the LLM generates arguments outside the schema.

## Next steps

- [Multi-Tool Orchestration](./multi-tool-orchestration) — compose five or more custom tools in a single agent
- [Tool Error Handling and Retries](./tool-error-handling) — build robust retry logic around `ToolResult.is_error`
- [Structured Output with Function Calling](./structured-output-function-calling) — return Pydantic models instead of raw strings
