---
sidebar_position: 4
---

# Custom Tools

Tools let agents take actions: search the web, call APIs, run code, query databases. SynapseKit provides two authoring patterns — the `@tool` decorator for simple functions and `BaseTool` for full control.

## Prerequisites

```bash
pip install synapsekit[openai] aiohttp
```

---

## 1. @tool decorator — simplest approach

Decorate any function with `@tool`. SynapseKit reads the type hints and docstring to auto-generate a JSON schema that is sent to the LLM.

```python
from synapsekit.tools import tool


@tool
def get_weather(city: str, unit: str = "celsius") -> str:
    """Get the current weather for a city.

    Args:
        city: The city name to get weather for
        unit: Temperature unit - 'celsius' or 'fahrenheit'
    """
    # In production, call a real weather API
    temperatures = {"London": 15, "New York": 22, "Tokyo": 28}
    temp = temperatures.get(city, 20)
    if unit == "fahrenheit":
        temp = temp * 9 / 5 + 32
    symbol = "°C" if unit == "celsius" else "°F"
    return f"The weather in {city} is {temp}{symbol} and partly cloudy."


# The decorator generates JSON schema from type hints and docstring
import json
print(json.dumps(get_weather.schema, indent=2))

# Expected output:
# {
#   "name": "get_weather",
#   "description": "Get the current weather for a city.",
#   "parameters": {
#     "type": "object",
#     "properties": {
#       "city": {
#         "type": "string",
#         "description": "The city name to get weather for"
#       },
#       "unit": {
#         "type": "string",
#         "description": "Temperature unit - 'celsius' or 'fahrenheit'",
#         "default": "celsius"
#       }
#     },
#     "required": ["city"]
#   }
# }
```

### Calling the tool directly

```python
result = get_weather("London")
print(result)
# Expected output: The weather in London is 15°C and partly cloudy.

result_f = get_weather("New York", unit="fahrenheit")
print(result_f)
# Expected output: The weather in New York is 71.6°F and partly cloudy.
```

---

## 2. Async tool

Use `@tool` on `async` functions for tools that perform I/O.

```python
import aiohttp
from synapsekit.tools import tool


@tool
async def search_database(query: str, limit: int = 10) -> list[dict]:
    """Search the product database for items matching a query.

    Args:
        query: The search query string
        limit: Maximum number of results to return (default 10)
    """
    async with aiohttp.ClientSession() as session:
        async with session.get(
            "https://api.example.com/products/search",
            params={"q": query, "limit": limit},
        ) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data["results"]


@tool
async def send_email(to: str, subject: str, body: str) -> str:
    """Send an email to a recipient.

    Args:
        to: Recipient email address
        subject: Email subject line
        body: Email body text
    """
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.sendgrid.com/v3/mail/send",
            json={"to": to, "subject": subject, "body": body},
        ) as resp:
            if resp.status == 202:
                return f"Email sent successfully to {to}"
            return f"Failed to send email: {resp.status}"
```

### Calling async tools

```python
import asyncio

async def main():
    results = await search_database("noise-canceling headphones", limit=5)
    print(f"Found {len(results)} products")
    # Expected output: Found 5 products

asyncio.run(main())
```

---

## 3. BaseTool subclass — full control

For tools that need state, dependency injection, or complex validation, extend `BaseTool`.

```python
from synapsekit.tools import BaseTool
from pydantic import BaseModel, Field
import aiohttp


class SearchInput(BaseModel):
    query: str = Field(description="The search query")
    max_results: int = Field(default=5, ge=1, le=50, description="Maximum results")
    category: str | None = Field(default=None, description="Optional category filter")


class DatabaseSearchTool(BaseTool):
    name = "database_search"
    description = "Search the internal product database by keyword and optional category"

    def __init__(self, db_url: str, api_key: str):
        self.db_url = db_url
        self.api_key = api_key

    @property
    def schema(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": SearchInput.model_json_schema(),
        }

    async def arun(self, query: str, max_results: int = 5, category: str = None) -> str:
        """Execute the search and return formatted results."""
        results = await self._query_db(query, max_results, category)
        if not results:
            return f"No results found for '{query}'"
        lines = [f"Found {len(results)} results for '{query}':"]
        for r in results:
            lines.append(f"- {r['name']}: {r['description']} (${r['price']:.2f})")
        return "\n".join(lines)

    async def _query_db(self, query: str, limit: int, category: str = None) -> list[dict]:
        params = {"q": query, "limit": limit}
        if category:
            params["category"] = category
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.db_url}/search",
                params=params,
                headers={"X-API-Key": self.api_key},
            ) as resp:
                resp.raise_for_status()
                return await resp.json()
```

### Instantiating BaseTool

```python
tool = DatabaseSearchTool(
    db_url="https://db.internal.example.com",
    api_key="internal-key-xyz",
)

import asyncio, json

async def main():
    result = await tool.arun("bluetooth speaker", max_results=3)
    print(result)
    # Expected output:
    # Found 3 results for 'bluetooth speaker':
    # - JBL Flip 6: Portable waterproof speaker ($99.99)
    # - Bose SoundLink: Premium portable speaker ($249.00)
    # - Anker Soundcore: Budget-friendly option ($39.99)

    print(json.dumps(tool.schema, indent=2))
    # Expected output:
    # {
    #   "name": "database_search",
    #   "description": "Search the internal product database...",
    #   "parameters": { ... Pydantic-generated schema ... }
    # }

asyncio.run(main())
```

---

## 4. Adding tools to agents

```python
import asyncio
from synapsekit.agents import FunctionCallingAgent
from synapsekit.llms.openai import OpenAILLM
from synapsekit.tools import tool


@tool
def get_weather(city: str) -> str:
    """Get current weather for a city."""
    return f"{city}: 22°C, sunny"


@tool
def convert_currency(amount: float, from_currency: str, to_currency: str) -> str:
    """Convert an amount between currencies."""
    rates = {"USD_EUR": 0.92, "EUR_USD": 1.09, "USD_GBP": 0.79}
    key = f"{from_currency}_{to_currency}"
    rate = rates.get(key, 1.0)
    converted = amount * rate
    return f"{amount} {from_currency} = {converted:.2f} {to_currency}"


async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    agent = FunctionCallingAgent(
        llm=llm,
        tools=[get_weather, convert_currency],
        max_iterations=5,
    )

    result = await agent.run(
        "What's the weather in Tokyo, and how much is 100 USD in EUR?"
    )
    print(result)
    # Expected output:
    # Tokyo is currently 22°C and sunny.
    # 100 USD is equal to 92.00 EUR.

asyncio.run(main())
```

### Using BaseTool instances with agents

```python
async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    db_tool = DatabaseSearchTool(db_url="https://db.example.com", api_key="key")

    agent = FunctionCallingAgent(
        llm=llm,
        tools=[db_tool, get_weather],  # Mix @tool and BaseTool freely
    )

    result = await agent.run("Find bluetooth speakers under $100")
    print(result)

asyncio.run(main())
```

---

## 5. Error handling in tools

Tools should raise or return errors in a way the agent can understand.

```python
from synapsekit.tools import tool


@tool
async def fetch_url(url: str) -> str:
    """Fetch the content of a URL.

    Args:
        url: The URL to fetch
    """
    import aiohttp

    if not url.startswith(("http://", "https://")):
        return f"Error: '{url}' is not a valid URL. Must start with http:// or https://"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    return f"Error: HTTP {resp.status} for {url}"
                content = await resp.text()
                # Truncate to avoid overwhelming the context window
                return content[:2000] + ("..." if len(content) > 2000 else "")
    except aiohttp.ClientConnectorError:
        return f"Error: Could not connect to {url}. Check the URL and try again."
    except TimeoutError:
        return f"Error: Request to {url} timed out after 10 seconds."
```

### BaseTool error handling

```python
class RobustSearchTool(BaseTool):
    name = "robust_search"
    description = "Search with automatic error recovery"

    async def arun(self, query: str, max_results: int = 5) -> str:
        try:
            results = await self._query_db(query, max_results)
            return self._format(results)
        except aiohttp.ClientResponseError as e:
            if e.status == 429:
                return "Error: Rate limit reached. Please try again in a few seconds."
            if e.status == 503:
                return "Error: Search service temporarily unavailable."
            return f"Error: API returned status {e.status}"
        except Exception as e:
            return f"Error: Unexpected error during search: {type(e).__name__}: {e}"

    def _format(self, results: list[dict]) -> str:
        if not results:
            return "No results found."
        return "\n".join(f"- {r['title']}" for r in results)
```

---

## 6. Testing tools in isolation

```python
# tests/test_tools.py
import pytest
from unittest.mock import AsyncMock, patch
from my_tools import get_weather, DatabaseSearchTool


def test_get_weather_celsius():
    result = get_weather("London")
    assert "London" in result
    assert "°C" in result


def test_get_weather_fahrenheit():
    result = get_weather("London", unit="fahrenheit")
    assert "°F" in result


def test_get_weather_schema():
    schema = get_weather.schema
    assert schema["name"] == "get_weather"
    assert "city" in schema["parameters"]["properties"]
    assert "city" in schema["parameters"]["required"]
    assert "unit" not in schema["parameters"]["required"]


@pytest.mark.asyncio
async def test_database_search_tool():
    tool = DatabaseSearchTool(db_url="http://test.com", api_key="test")

    mock_results = [
        {"name": "Product A", "description": "Desc A", "price": 10.0},
        {"name": "Product B", "description": "Desc B", "price": 20.0},
    ]

    with patch.object(tool, "_query_db", return_value=mock_results):
        result = await tool.arun("widgets", max_results=2)

    assert "Product A" in result
    assert "Product B" in result
    assert "Found 2 results" in result


@pytest.mark.asyncio
async def test_database_search_no_results():
    tool = DatabaseSearchTool(db_url="http://test.com", api_key="test")

    with patch.object(tool, "_query_db", return_value=[]):
        result = await tool.arun("nonexistent item")

    assert "No results found" in result
```

---

## Summary

| Pattern | When to use |
|---|---|
| `@tool` on sync function | Simple deterministic functions, no I/O |
| `@tool` on async function | Functions that call external APIs |
| `BaseTool` subclass | Stateful tools, Pydantic validation, DI |
| Return error strings | Let the agent handle and retry |
| `MockLLM` + patched tools | Unit testing without API calls |
