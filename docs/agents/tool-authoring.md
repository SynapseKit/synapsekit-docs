---
sidebar_position: 8
---

# Tool Authoring Guide

Write custom tools for SynapseKit agents using the `@tool` decorator or `BaseTool` class.

## The `@tool` decorator

The simplest way to create a tool. SynapseKit generates the JSON Schema automatically from type hints and the docstring:

```python
from synapsekit import tool

@tool
def get_weather(city: str, unit: str = "celsius") -> str:
    """Get the current weather for a city.

    Args:
        city: Name of the city (e.g. 'London', 'Tokyo').
        unit: Temperature unit, either 'celsius' or 'fahrenheit'.
    """
    # Your implementation here
    return f"Sunny, 22 {unit} in {city}"
```

SynapseKit reads the function signature and docstring to produce the schema:

```json
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "Get the current weather for a city.",
    "parameters": {
      "type": "object",
      "properties": {
        "city": {"type": "string", "description": "Name of the city"},
        "unit": {"type": "string", "description": "Temperature unit", "default": "celsius"}
      },
      "required": ["city"]
    }
  }
}
```

## Type hint to JSON Schema mapping

| Python type | JSON Schema type | Notes |
|---|---|---|
| `str` | `"string"` | |
| `int` | `"integer"` | |
| `float` | `"number"` | |
| `bool` | `"boolean"` | |
| `list` | `"array"` | |
| `list[str]` | `"array"` with `"items": {"type": "string"}` | |
| `dict` | `"object"` | |
| `Optional[str]` | `"string"` | Not required |
| `str \| None` | `"string"` | Not required |
| `Literal["a", "b"]` | `"string"` with `"enum": ["a", "b"]` | |

## Async tools

Tools can be async for I/O-bound operations like HTTP requests:

```python
import httpx
from synapsekit import tool

@tool
async def fetch_github_repo(owner: str, repo: str) -> dict:
    """Fetch metadata about a GitHub repository.

    Args:
        owner: GitHub username or organization name.
        repo: Repository name.
    """
    url = f"https://api.github.com/repos/{owner}/{repo}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers={"Accept": "application/vnd.github+json"})
        resp.raise_for_status()
    data = resp.json()
    return {
        "name": data["full_name"],
        "stars": data["stargazers_count"],
        "forks": data["forks_count"],
        "description": data["description"],
        "language": data["language"],
        "open_issues": data["open_issues_count"],
    }
```

SynapseKit automatically handles async tools -- the agent executor awaits them correctly.

## Class-based tools

For tools that need configuration, dependencies, or state, use `BaseTool`:

```python
from synapsekit.tools import BaseTool
import sqlite3

class DatabaseQueryTool(BaseTool):
    name = "query_database"
    description = "Execute a SQL SELECT query on the application database."

    def __init__(self, db_path: str, allowed_tables: list[str] | None = None):
        self.db_path = db_path
        self.allowed_tables = allowed_tables or []

    @property
    def schema(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "SQL SELECT query to execute",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum rows to return",
                            "default": 50,
                        },
                    },
                    "required": ["query"],
                },
            },
        }

    async def run(self, query: str, limit: int = 50) -> list[dict]:
        # Validate query
        if not query.strip().upper().startswith("SELECT"):
            raise ValueError("Only SELECT queries are allowed")

        # Check table access (optional security guard)
        if self.allowed_tables:
            for table in self.allowed_tables:
                if table.lower() in query.lower():
                    break
            else:
                raise ValueError(
                    f"Query must reference one of: {self.allowed_tables}"
                )

        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.execute(f"{query} LIMIT {limit}")
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results


# Usage
db_tool = DatabaseQueryTool(
    db_path="production.db",
    allowed_tables=["orders", "products", "customers"],
)

from synapsekit import FunctionCallingAgent
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.base import LLMConfig

agent = FunctionCallingAgent(
    llm=OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-...")),
    tools=[db_tool],
)

answer = await agent.run("How many orders were placed in March 2026?")
```

## Structured return types

Use dataclasses or Pydantic models for typed tool outputs:

```python
from dataclasses import dataclass
from synapsekit import tool

@dataclass
class StockQuote:
    ticker: str
    price: float
    change_pct: float
    volume: int
    currency: str = "USD"

@tool
def get_stock_quote(ticker: str) -> StockQuote:
    """Get the current stock quote for a ticker symbol.

    Args:
        ticker: Stock ticker symbol (e.g. 'AAPL', 'GOOG').
    """
    # In practice, call a financial API
    return StockQuote(
        ticker=ticker,
        price=185.20,
        change_pct=1.35,
        volume=52_300_000,
    )
```

The dataclass is automatically serialized to a JSON dict when returned to the LLM.

## Error handling in tools

Raise `ToolError` for expected failures. The agent will see the error message and can decide how to proceed:

```python
from synapsekit import tool
from synapsekit.exceptions import ToolError

@tool
def read_file(path: str) -> str:
    """Read a text file and return its contents.

    Args:
        path: Absolute or relative path to the file.
    """
    import os

    if not os.path.exists(path):
        raise ToolError(f"File not found: {path}")

    if os.path.getsize(path) > 10 * 1024 * 1024:  # 10 MB limit
        raise ToolError(f"File too large (>10MB): {path}")

    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except PermissionError:
        raise ToolError(f"Permission denied reading: {path}")
    except UnicodeDecodeError:
        raise ToolError(f"File is not valid UTF-8 text: {path}")
```

The agent will receive the error as an observation and can try a different approach (e.g., try a different path, skip the file, or inform the user).

## Tool with retry logic

For tools that call flaky external services:

```python
import asyncio
import httpx
from synapsekit import tool
from synapsekit.exceptions import ToolError

@tool
async def call_external_api(endpoint: str, payload: dict) -> dict:
    """Call an external REST API endpoint with automatic retry.

    Args:
        endpoint: Full URL of the API endpoint.
        payload: JSON payload to send in the POST request.
    """
    max_retries = 3
    last_error = None

    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(endpoint, json=payload)
                resp.raise_for_status()
                return resp.json()
        except httpx.TimeoutException as e:
            last_error = e
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)  # exponential backoff
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                retry_after = int(e.response.headers.get("Retry-After", 5))
                await asyncio.sleep(retry_after)
                last_error = e
            elif e.response.status_code >= 500:
                last_error = e
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
            else:
                raise ToolError(f"API error {e.response.status_code}: {e.response.text}")

    raise ToolError(f"API call failed after {max_retries} attempts: {last_error}")
```

## Tool registry

Register tools centrally and reuse them across agents:

```python
from synapsekit.tools import ToolRegistry
from synapsekit import tool

registry = ToolRegistry()

@registry.register
@tool
def search_docs(query: str) -> list:
    """Search internal documentation."""
    return [{"title": f"Doc about {query}", "score": 0.95}]

@registry.register
@tool
def get_user(user_id: str) -> dict:
    """Look up a user by ID."""
    return {"id": user_id, "name": "Alice", "role": "admin"}

@registry.register
@tool
def send_notification(user_id: str, message: str) -> str:
    """Send a notification to a user."""
    return f"Notification sent to user {user_id}"

# Create agents with specific tool subsets
support_agent_tools = registry.get(["search_docs", "get_user", "send_notification"])
read_only_tools = registry.get(["search_docs", "get_user"])

# List all registered tools
for name, tool_fn in registry.items():
    print(f"{name}: {tool_fn.description}")
```

## Parameterized tools via factory

Create tool variants configured at runtime:

```python
from synapsekit.tools import BaseTool

def make_http_tool(base_url: str, auth_token: str, tool_name: str = "api_call") -> BaseTool:
    """Factory that creates an HTTP tool pre-configured for a specific API."""

    class ConfiguredHTTPTool(BaseTool):
        name = tool_name
        description = f"Make authenticated API calls to {base_url}"

        @property
        def schema(self) -> dict:
            return {
                "type": "function",
                "function": {
                    "name": self.name,
                    "description": self.description,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string", "description": "API path (e.g. /users/42)"},
                            "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE"], "default": "GET"},
                            "body": {"type": "object", "description": "Request body for POST/PUT"},
                        },
                        "required": ["path"],
                    },
                },
            }

        async def run(self, path: str, method: str = "GET", body: dict | None = None) -> dict:
            import httpx
            url = f"{base_url}{path}"
            headers = {"Authorization": f"Bearer {auth_token}"}
            async with httpx.AsyncClient() as client:
                resp = await client.request(method, url, json=body, headers=headers)
                resp.raise_for_status()
                return resp.json()

    return ConfiguredHTTPTool()


# Usage
stripe_tool = make_http_tool(
    base_url="https://api.stripe.com/v1",
    auth_token="sk_live_...",
    tool_name="stripe_api",
)

github_tool = make_http_tool(
    base_url="https://api.github.com",
    auth_token="ghp_...",
    tool_name="github_api",
)
```

## Testing tools

Always test tools independently before using them in agents:

```python
import asyncio
import pytest
from synapsekit import tool
from synapsekit.exceptions import ToolError

@tool
def divide(a: float, b: float) -> float:
    """Divide a by b."""
    if b == 0:
        raise ToolError("Cannot divide by zero")
    return a / b


def test_divide_basic():
    result = asyncio.run(divide.run(10, 2))
    assert result == 5.0


def test_divide_by_zero():
    with pytest.raises(ToolError, match="zero"):
        asyncio.run(divide.run(10, 0))


def test_divide_schema():
    schema = divide.schema
    assert schema["function"]["name"] == "divide"
    params = schema["function"]["parameters"]["properties"]
    assert "a" in params
    assert "b" in params
    assert schema["function"]["parameters"]["required"] == ["a", "b"]


# Test async tools
@tool
async def fetch_data(url: str) -> str:
    """Fetch data from a URL."""
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        return resp.text[:500]


@pytest.mark.asyncio
async def test_fetch_data():
    result = await fetch_data.run("https://httpbin.org/get")
    assert "url" in result
```

## Best practices

| Practice | Recommendation |
|---|---|
| Docstrings | Always write clear descriptions -- the LLM uses them to decide when to call |
| Parameter names | Use descriptive names (`city` not `c`, `user_id` not `uid`) |
| Return types | Return serializable types (str, dict, list, int, float) |
| Error messages | Be specific: `"File not found: /tmp/foo.txt"` not `"error"` |
| Idempotency | Make tools safe to call twice (avoid duplicate writes/emails) |
| Side effects | Document any side effects in the docstring |
| Auth/credentials | Pass via constructor, not as tool arguments |
| Timeouts | Always set timeouts on network calls |
| Validation | Validate inputs before executing -- the LLM may pass unexpected values |

:::tip
A well-written docstring is critical for reliable tool use. Explain what the tool does, when to use it, and any limitations or preconditions. The LLM reads the description to decide which tool to call.
:::
