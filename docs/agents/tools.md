---
sidebar_position: 4
---

# Built-in Tools

## `@tool` decorator (recommended)

The easiest way to create a tool — just decorate a function:

```python
from synapsekit import tool

@tool(name="uppercase", description="Convert text to uppercase")
def uppercase(text: str) -> str:
    return text.upper()

# Use it with any agent
agent = ReActAgent(llm=llm, tools=[uppercase])
```

The decorator auto-generates the JSON Schema from type hints. Supports both sync and async functions:

```python
@tool(name="fetch_url", description="Fetch a URL")
async def fetch_url(url: str) -> str:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            return await resp.text()
```

If you omit `name` and `description`, they default to the function name and docstring.

## Creating a custom tool (class-based)

For more control, extend `BaseTool` directly:

```python
from synapsekit import BaseTool, ToolResult

class MyTool(BaseTool):
    name = "my_tool"
    description = "Does something useful. Input: a string."
    parameters = {
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "Input text"},
        },
        "required": ["text"],
    }

    async def run(self, text: str = "", **kwargs) -> ToolResult:
        result = text.upper()
        return ToolResult(output=result)
```

Pass your tool directly to any agent:

```python
agent = ReActAgent(llm=llm, tools=[MyTool()])
```

---

## CalculatorTool

Safe math eval using Python's `math` module. No external dependencies.

```python
from synapsekit import CalculatorTool

tool = CalculatorTool()
result = await tool.run(expression="sqrt(144) + pi")
# result.output → "15.141592653589793"
```

Supports: `+`, `-`, `*`, `/`, `**`, `%`, `sqrt`, `sin`, `cos`, `tan`, `log`, `log2`, `log10`, `exp`, `pi`, `e`, `factorial`, `gcd`, `ceil`, `floor`, `round`, `abs`, `min`, `max`.

---

## PythonREPLTool

Execute Python code with a persistent namespace and stdout capture.

```python
from synapsekit import PythonREPLTool

repl = PythonREPLTool()

r = await repl.run(code="import math\nprint(math.factorial(10))")
# r.output → "3628800\n"

# Namespace persists between calls
await repl.run(code="x = [1, 2, 3, 4, 5]")
r = await repl.run(code="print(sum(x))")
# r.output → "15\n"

# Reset namespace
repl.reset()
```

:::warning
`PythonREPLTool` executes real Python code. Only use it in trusted environments.
:::

---

## FileReadTool

Read local files from disk.

```python
from synapsekit import FileReadTool

r = await FileReadTool().run(path="/path/to/file.txt")
# r.output → file contents
# r.is_error → True if file not found
```

---

## WebSearchTool

Search the web via DuckDuckGo. No API key needed.

```bash
pip install synapsekit[search]
```

```python
from synapsekit import WebSearchTool

tool = WebSearchTool()
r = await tool.run(query="SynapseKit async RAG framework", max_results=3)
# r.output → formatted list of results with title, URL, snippet
```

---

## SQLQueryTool

Run SQL `SELECT` queries against SQLite or any SQLAlchemy-supported database.

```python
from synapsekit import SQLQueryTool

# SQLite (stdlib, no extra deps)
tool = SQLQueryTool("./mydb.sqlite")

r = await tool.run(query="SELECT name, age FROM users WHERE age > 25 ORDER BY age")
# r.output → markdown table
```

```python
# PostgreSQL / MySQL (requires sqlalchemy)
tool = SQLQueryTool("postgresql://user:pass@localhost/mydb")
```

Only `SELECT` queries are allowed. `INSERT`, `UPDATE`, `DROP`, etc. return an error.
