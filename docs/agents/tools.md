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

## DuckDuckGoSearchTool

Extended DuckDuckGo search with support for both text and news search types. Returns numbered results.

```bash
pip install synapsekit[search]
```

```python
from synapsekit import DuckDuckGoSearchTool

tool = DuckDuckGoSearchTool()

# Text search (default)
r = await tool.run(query="SynapseKit framework", max_results=5)
# r.output → "1. Title\n   URL\n   Snippet\n\n2. ..."

# News search
r = await tool.run(query="AI frameworks", search_type="news", max_results=3)
```

| Parameter | Default | Description |
|---|---|---|
| `query` | — | Search query (required) |
| `max_results` | `5` | Maximum number of results |
| `search_type` | `"text"` | `"text"` or `"news"` |

---

## PDFReaderTool

Read and extract text from PDF files with optional page selection.

```bash
pip install synapsekit[pdf]
```

```python
from synapsekit import PDFReaderTool

tool = PDFReaderTool()

# Read all pages
r = await tool.run(file_path="/path/to/document.pdf")
# r.output → "--- Page 1 ---\n...\n\n--- Page 2 ---\n..."

# Read specific pages
r = await tool.run(file_path="/path/to/document.pdf", page_numbers="1,3,5")
```

| Parameter | Default | Description |
|---|---|---|
| `file_path` | — | Path to the PDF file (required) |
| `page_numbers` | all pages | Comma-separated page numbers (e.g. `"1,3,5"`) |

---

## GraphQLTool

Execute GraphQL queries against any endpoint.

```bash
pip install synapsekit[http]
```

```python
from synapsekit import GraphQLTool

tool = GraphQLTool(timeout=30)

# Basic query
r = await tool.run(
    url="https://api.example.com/graphql",
    query="{ users { id name } }",
)
# r.output → formatted JSON response

# With variables and headers
r = await tool.run(
    url="https://api.example.com/graphql",
    query="query($id: ID!) { user(id: $id) { name } }",
    variables='{"id": "1"}',
    headers='{"Authorization": "Bearer token123"}',
)
```

| Parameter | Default | Description |
|---|---|---|
| `url` | — | GraphQL endpoint URL (required) |
| `query` | — | GraphQL query string (required) |
| `variables` | `""` | JSON string of variables |
| `headers` | `""` | JSON string of extra HTTP headers |

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

---

## HTTPRequestTool

Make HTTP requests (GET, POST, PUT, DELETE, PATCH).

```bash
pip install aiohttp
```

```python
from synapsekit import HTTPRequestTool

tool = HTTPRequestTool(max_response_length=10000, timeout=30)

# GET request
r = await tool.run(url="https://api.github.com/repos/SynapseKit/SynapseKit")
# r.output → "HTTP 200\n{...}"

# POST request
r = await tool.run(
    url="https://httpbin.org/post",
    method="POST",
    body='{"key": "value"}',
    headers={"Content-Type": "application/json"},
)
```

---

## FileWriteTool

Write content to a file on disk. Creates parent directories if needed.

```python
from synapsekit import FileWriteTool

tool = FileWriteTool()

# Write a new file
r = await tool.run(path="output/result.txt", content="Hello world!")
# r.output → "Written to output/result.txt (12 chars)"

# Append to existing file
r = await tool.run(path="log.txt", content="New line\n", append=True)
# r.output → "Appended to log.txt (9 chars)"
```

---

## FileListTool

List files and directories at a given path.

```python
from synapsekit import FileListTool

tool = FileListTool()

# List current directory
r = await tool.run(path=".")
# r.output → "file1.txt\nfile2.py\nsubdir/"

# Filter by pattern
r = await tool.run(path="./src", pattern="*.py")

# Recursive listing
r = await tool.run(path="./src", recursive=True, pattern="*.py")
```

---

## DateTimeTool

Get current date/time or parse/format dates.

```python
from synapsekit import DateTimeTool

tool = DateTimeTool()

# Current time (local)
r = await tool.run(action="now")
# r.output → "2026-03-12T14:30:00.123456"

# Current time (UTC)
r = await tool.run(action="now", tz="utc")

# With custom format
r = await tool.run(action="now", fmt="%B %d, %Y")
# r.output → "March 12, 2026"

# Parse a date string
r = await tool.run(action="parse", value="2026-03-12T10:30:00")

# Format a date
r = await tool.run(action="format", value="2026-03-12T10:30:00", fmt="%B %d, %Y")
# r.output → "March 12, 2026"
```

---

## RegexTool

Apply regex operations: findall, match, search, replace, split.

```python
from synapsekit import RegexTool

tool = RegexTool()

# Find all matches
r = await tool.run(pattern=r"\d+", text="abc 123 def 456")
# r.output → "123\n456"

# Search with groups
r = await tool.run(pattern=r"(\d+)-(\d+)", text="range: 10-20", action="search")
# r.output → "Found: 10-20\nPosition: 7-12\nGroups: ('10', '20')"

# Replace
r = await tool.run(pattern=r"\d+", text="abc 123", action="replace", replacement="NUM")
# r.output → "abc NUM"

# Split
r = await tool.run(pattern=r",\s*", text="a, b, c", action="split")

# Case insensitive
r = await tool.run(pattern="hello", text="Hello World", action="findall", flags="i")
```

Supported flags: `i` (ignore case), `m` (multiline), `s` (dotall).

---

## JSONQueryTool

Query JSON data using dot-notation paths (like jq).

```python
from synapsekit import JSONQueryTool

tool = JSONQueryTool()

data = '{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]}'

# Get a nested value
r = await tool.run(json_data=data, path="users.0.name")
# r.output → "Alice"

# Get an array element
r = await tool.run(json_data=data, path="users.1")
# r.output → '{"name": "Bob", "age": 25}'

# Get a top-level key
r = await tool.run(json_data=data, path="users")
# r.output → '[{"name": "Alice", ...}, ...]'
```

---

## HumanInputTool

Pause agent execution to ask the user a question and get their input.

```python
from synapsekit import HumanInputTool

# Default: uses Python's built-in input()
tool = HumanInputTool()
r = await tool.run(question="What city should I search for?")
# r.output → user's typed response
```

### Custom input function

For web apps or non-terminal environments, provide a custom input function:

```python
# Sync function
tool = HumanInputTool(input_fn=lambda prompt: my_ui_input(prompt))

# Async function (e.g., waiting for a webhook)
async def get_web_input(prompt: str) -> str:
    return await wait_for_user_response(prompt)

tool = HumanInputTool(input_fn=get_web_input)
```

---

## WikipediaTool

Search and fetch Wikipedia article summaries. Uses the Wikipedia REST API — no API key required, no extra dependencies.

```python
from synapsekit import WikipediaTool

tool = WikipediaTool(max_chars=4000)

r = await tool.run(query="Python programming language")
# r.output → "**Python (programming language)**\nhttps://...\n\nPython is a..."
```

### Multiple results

```python
r = await tool.run(query="machine learning", max_results=3)
# Returns up to 3 article summaries, separated by ---
```

---

## ShellTool

Execute shell commands with timeout and optional command whitelist.

```python
from synapsekit import ShellTool

tool = ShellTool(timeout=30)

r = await tool.run(command="echo hello world")
# r.output → "hello world\n"

# Restrict allowed commands for security
tool = ShellTool(allowed_commands=["echo", "ls", "cat"])
r = await tool.run(command="echo safe")    # works
r = await tool.run(command="rm -rf /")     # error: not in allowed list
```

:::warning
`ShellTool` executes real shell commands. Use `allowed_commands` to restrict which commands can be run in untrusted environments.
:::

---

## SQLSchemaInspectionTool

Inspect database schema — list tables and describe columns.

```python
from synapsekit import SQLSchemaInspectionTool

# SQLite (stdlib, no extra deps)
tool = SQLSchemaInspectionTool(connection_string="mydb.db")

# List all tables
r = await tool.run(action="list_tables")
# r.output → "users, posts, comments"

# Describe a table's columns
r = await tool.run(action="describe_table", table_name="users")
# r.output → "id (INTEGER, nullable=False, pk=True)\nname (TEXT, ...)"
```

```python
# PostgreSQL / MySQL (requires sqlalchemy)
tool = SQLSchemaInspectionTool(connection_string="postgresql://user:pass@localhost/mydb")
```

---

## SummarizationTool

Summarize text using an LLM. Supports concise, bullet point, and detailed styles.

```python
from synapsekit import SummarizationTool

tool = SummarizationTool(llm=llm)

# Concise summary (default)
r = await tool.run(text="Long article text here...", max_sentences=3)
# r.output → "A concise 3-sentence summary."

# Bullet points
r = await tool.run(text="Long text...", style="bullet_points", max_sentences=5)
# r.output → "- Point 1\n- Point 2\n..."

# Detailed
r = await tool.run(text="Long text...", style="detailed")
```

---

## SentimentAnalysisTool

Analyze the sentiment of text using an LLM.

```python
from synapsekit import SentimentAnalysisTool

tool = SentimentAnalysisTool(llm=llm)

r = await tool.run(text="I love this product! It's amazing.")
# r.output → "Sentiment: positive\nConfidence: high\nExplanation: ..."
```

Returns three lines: sentiment (positive/negative/neutral/mixed), confidence (high/medium/low), and a one-sentence explanation.

---

## TranslationTool

Translate text between languages using an LLM.

```python
from synapsekit import TranslationTool

tool = TranslationTool(llm=llm)

# Auto-detect source language
r = await tool.run(text="Hello world!", target_language="Spanish")
# r.output → "¡Hola mundo!"

# Specify source language
r = await tool.run(text="Bonjour", target_language="English", source_language="French")
# r.output → "Hello"
```

---

## ArxivSearchTool

Search arXiv for academic papers. Uses the arXiv API — no API key required, no extra dependencies (stdlib only).

```python
from synapsekit import ArxivSearchTool

tool = ArxivSearchTool()

r = await tool.run(query="attention is all you need", max_results=3)
# r.output → "1. **Attention Is All You Need**\n   Authors: Ashish Vaswani, ...\n   Link: ...\n   ..."
```

| Parameter | Default | Description |
|---|---|---|
| `query` | — | Search query (required) |
| `max_results` | `5` | Maximum number of papers to return |

---

## TavilySearchTool

AI-optimized web search via the Tavily API.

```bash
pip install synapsekit[tavily]
```

```python
from synapsekit import TavilySearchTool

tool = TavilySearchTool(api_key="tvly-...")

r = await tool.run(query="latest AI breakthroughs", max_results=5)
# r.output → "1. **Title**\n   URL: https://...\n   Content snippet..."

# Advanced search depth
r = await tool.run(query="RAG frameworks comparison", search_depth="advanced")
```

| Parameter | Default | Description |
|---|---|---|
| `query` | — | Search query (required) |
| `max_results` | `5` | Maximum number of results |
| `search_depth` | `"basic"` | `"basic"` or `"advanced"` |

The API key is resolved in order:
1. `api_key` constructor parameter
2. `TAVILY_API_KEY` environment variable
