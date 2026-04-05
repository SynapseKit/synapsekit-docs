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

Execute Python code with a persistent namespace, stdout capture, and configurable timeout.

```python
from synapsekit import PythonREPLTool

repl = PythonREPLTool(timeout=5.0)  # default: 5 seconds

r = await repl.run(code="import math\nprint(math.factorial(10))")
# r.output → "3628800\n"

# Namespace persists between calls
await repl.run(code="x = [1, 2, 3, 4, 5]")
r = await repl.run(code="print(sum(x))")
# r.output → "15\n"

# Infinite loops are terminated automatically
r = await repl.run(code="while True: pass")
# r.is_error → True
# r.error → "Code execution timed out after 5.0 seconds"

# Reset namespace
repl.reset()
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `timeout` | `float` | `5.0` | Maximum execution time in seconds |

**Timeout implementation:**
- **Unix/Linux**: `signal.SIGALRM` — zero overhead, full namespace persistence
- **Windows**: `multiprocessing.Process` — reliable timeout, namespace limited to picklable objects

:::warning
`PythonREPLTool` executes real Python code. A security warning is logged on every instantiation. Only use it in trusted environments with controlled input — malicious code can access files, the network, and system resources.
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

---

## VectorSearchTool

Wraps a `Retriever` instance so agents can search a knowledge base. No external dependencies.

```python
from synapsekit import VectorSearchTool, Retriever, InMemoryVectorStore

retriever = Retriever(InMemoryVectorStore(dim=384))
tool = VectorSearchTool(retriever)

r = await tool.run(query="machine learning basics", top_k=3)
# r.output → "1. Document about ML\n\n2. Another document..."
```

Custom name and description for domain-specific knowledge bases:

```python
tool = VectorSearchTool(retriever, name="product_kb", description="Search the product knowledge base")
```

| Parameter | Default | Description |
|---|---|---|
| `query` | — | Search query (required) |
| `top_k` | `5` | Number of results to return |

---

## PubMedSearchTool

Search PubMed for biomedical and life science research articles. Uses the NCBI E-utilities API — no API key required, no extra dependencies (stdlib only).

```python
from synapsekit import PubMedSearchTool

tool = PubMedSearchTool()

r = await tool.run(query="CRISPR gene editing", max_results=3)
# r.output → "1. **CRISPR Study**\n   Authors: Smith J, ...\n   PMID: 12345\n   ..."
```

| Parameter | Default | Description |
|---|---|---|
| `query` | — | Search query (required) |
| `max_results` | `5` | Maximum number of articles to return |

---

## GitHubAPITool

Interact with the GitHub REST API. Supports searching repos, getting repo info, searching issues, and getting issue details. Uses stdlib `urllib` — no extra dependencies.

```python
from synapsekit import GitHubAPITool

tool = GitHubAPITool(token="ghp_...")  # or set GITHUB_TOKEN env var

# Search repositories
r = await tool.run(action="search_repos", query="langchain python")

# Get repo details
r = await tool.run(action="get_repo", owner="SynapseKit", repo="SynapseKit")

# Search issues
r = await tool.run(action="search_issues", query="bug fix in:title")

# Get a specific issue
r = await tool.run(action="get_issue", owner="SynapseKit", repo="SynapseKit", issue_number=42)
```

| Parameter | Default | Description |
|---|---|---|
| `action` | — | `search_repos`, `get_repo`, `search_issues`, or `get_issue` (required) |
| `query` | — | Search query (for search actions) |
| `owner` | — | Repository owner (for get actions) |
| `repo` | — | Repository name (for get actions) |
| `issue_number` | — | Issue number (for `get_issue`) |

The token is resolved in order:
1. `token` constructor parameter
2. `GITHUB_TOKEN` environment variable

---

## EmailTool

Send emails via SMTP with STARTTLS. Uses stdlib `smtplib` + `email` — no extra dependencies.

```python
from synapsekit import EmailTool

tool = EmailTool(
    smtp_host="smtp.gmail.com",
    smtp_port=587,
    smtp_user="me@gmail.com",
    smtp_password="app-password",
    from_addr="me@gmail.com",
)

r = await tool.run(to="bob@example.com", subject="Hello", body="Hi Bob!")
# r.output → "Email sent successfully to bob@example.com."
```

| Parameter | Default | Description |
|---|---|---|
| `to` | — | Recipient email address (required) |
| `subject` | — | Email subject line (required) |
| `body` | — | Email body text (required) |

SMTP configuration is resolved in order:
1. Constructor parameters (`smtp_host`, `smtp_port`, `smtp_user`, `smtp_password`, `from_addr`)
2. Environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`)

---

## YouTubeSearchTool

Search YouTube for videos. Returns titles, channels, durations, URLs, and view counts.

```bash
pip install synapsekit[youtube]
```

```python
from synapsekit import YouTubeSearchTool

tool = YouTubeSearchTool()

r = await tool.run(query="python async tutorial", max_results=3)
# r.output → "1. **Python Async Tutorial**\n   Channel: Tech Channel\n   Duration: 10:30 | Views: 1.2M\n   URL: ..."
```

| Parameter | Default | Description |
|---|---|---|
| `query` | — | Search query (required) |
| `max_results` | `5` | Maximum number of videos to return |

---

## SlackTool

Send messages to Slack channels via incoming webhook URL or Bot API token. Stdlib only — no extra dependencies.

```python
from synapsekit import SlackTool

# Via webhook
tool = SlackTool(webhook_url="https://hooks.slack.com/services/T.../B.../xxx")
r = await tool.run(action="send_webhook", text="Hello from SynapseKit!")
# r.output → "Message sent via webhook."

# Via bot token
tool = SlackTool(bot_token="xoxb-...")
r = await tool.run(action="send_message", channel="#general", text="Hi team!")
# r.output → "Message sent to #general."
```

| Parameter | Default | Description |
|---|---|---|
| `action` | — | `send_message` (bot token) or `send_webhook` (webhook URL) — required |
| `text` | — | Message text to send (required) |
| `channel` | — | Slack channel for `send_message` (e.g. `#general`) |

Configuration is resolved in order:
1. Constructor parameters (`webhook_url`, `bot_token`)
2. Environment variables (`SLACK_WEBHOOK_URL`, `SLACK_BOT_TOKEN`)

---

## JiraTool

Interact with Jira REST API v2: search issues via JQL, get issue details, create issues, and add comments. Stdlib `urllib` + `base64` Basic auth — no extra dependencies.

```python
from synapsekit import JiraTool

tool = JiraTool(
    url="https://mycompany.atlassian.net",
    email="me@company.com",
    api_token="ATATT3x...",
)

# Search issues
r = await tool.run(action="search_issues", query="project=PROJ AND status=Open")

# Get issue details
r = await tool.run(action="get_issue", issue_key="PROJ-123")

# Create issue
r = await tool.run(action="create_issue", project_key="PROJ", summary="Fix login bug")

# Add comment
r = await tool.run(action="add_comment", issue_key="PROJ-123", comment="Fixed in v2.")
```

| Parameter | Default | Description |
|---|---|---|
| `action` | — | `search_issues`, `get_issue`, `create_issue`, or `add_comment` (required) |
| `query` | — | JQL query string (for `search_issues`) |
| `issue_key` | — | Issue key e.g. `PROJ-123` (for `get_issue`, `add_comment`) |
| `project_key` | — | Project key (for `create_issue`) |
| `summary` | — | Issue summary (for `create_issue`) |
| `description` | `""` | Issue description (for `create_issue`) |
| `issue_type` | `"Task"` | Issue type e.g. Task, Bug (for `create_issue`) |
| `comment` | — | Comment body (for `add_comment`) |

Configuration is resolved in order:
1. Constructor parameters (`url`, `email`, `api_token`)
2. Environment variables (`JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`)

---

## NotionTool

Interact with Notion pages and databases. Requires `httpx` — no extra install if you already have it, or install via:

```bash
pip install synapsekit[notion]
```

```python
from synapsekit import NotionTool

tool = NotionTool(api_key="secret_...")  # or set NOTION_API_KEY env var

# Search pages
r = await tool.run(operation="search", query="meeting notes")
# r.output → "Found pages:\n1. Q1 Planning — abc123\n2. ..."

# Get a page's content
r = await tool.run(operation="get_page", page_id="abc12345-...")
# r.output → "Title: Q1 Planning\n\nContent:\n...\n\nURL: https://notion.so/..."

# Create a new page in a database or under a parent page
r = await tool.run(
    operation="create_page",
    parent_id="def67890-...",
    title="New Report",
    content="This is the first paragraph.\nThis is the second.",
)
# r.output → "Page created successfully:\nhttps://notion.so/..."

# Append content to an existing page
r = await tool.run(
    operation="append_block",
    page_id="abc12345-...",
    content="Appended paragraph.\nAnother line.",
)
# r.output → "Content appended successfully."
```

| Parameter | Default | Description |
|---|---|---|
| `operation` | — | `search`, `get_page`, `create_page`, or `append_block` (required) |
| `query` | `""` | Search query (for `search`) |
| `page_id` | `""` | Page ID (for `get_page`, `append_block`) |
| `parent_id` | `""` | Parent database or page ID (for `create_page`) |
| `title` | `""` | Page title (for `create_page`) |
| `content` | `""` | Page content as plain text, one paragraph per line (for `create_page`, `append_block`) |

The API key is resolved in order:
1. `api_key` constructor parameter
2. `NOTION_API_KEY` environment variable

:::info
Create an **internal integration** at [notion.so/my-integrations](https://www.notion.so/my-integrations), then share the target pages or databases with that integration.
:::

---

## BraveSearchTool

Web search via the Brave Search API. Stdlib `urllib` only — no extra dependencies.

```python
from synapsekit import BraveSearchTool

tool = BraveSearchTool(api_key="BSA...")

r = await tool.run(query="latest AI news", count=5)
# r.output → "1. **AI News Title**\n   URL: https://...\n   Description..."
```

| Parameter | Default | Description |
|---|---|---|
| `query` | — | Search query (required) |
| `count` | `5` | Number of results to return (max 20) |

The API key is resolved in order:
1. `api_key` constructor parameter
2. `BRAVE_API_KEY` environment variable

---

## APIBuilderTool

Build and execute API calls from OpenAPI specs or natural-language intent. Supports inline specs, spec URLs, explicit path/method, and optional LLM-assisted operation selection. Uses stdlib `urllib` — no extra dependencies.

```python
from synapsekit import APIBuilderTool

tool = APIBuilderTool()

# From an OpenAPI spec
spec = {
    "openapi": "3.0.0",
    "servers": [{"url": "https://api.example.com"}],
    "paths": {
        "/users": {
            "get": {"operationId": "listUsers", "summary": "List users"},
            "post": {"operationId": "createUser", "summary": "Create user"},
        }
    },
}
r = await tool.run(intent="list all users", openapi_spec=spec)
# r.output → "Selected operation: listUsers\nRequest: GET https://api.example.com/users\n\nHTTP 200\n[...]"
```

### With explicit path and parameters

```python
r = await tool.run(
    intent="get user by id",
    path="/users/{id}",
    method="GET",
    server_url="https://api.example.com",
    path_params={"id": 42},
    query_params={"expand": "profile"},
    headers={"Authorization": "Bearer token123"},
)
```

### With LLM-assisted operation selection

```python
tool = APIBuilderTool(llm=llm)
r = await tool.run(intent="create a new user", openapi_spec=spec)
# LLM picks the best operationId; falls back to token scoring if LLM fails
```

| Parameter | Default | Description |
|---|---|---|
| `intent` | — | Natural-language description of the API call (required) |
| `openapi_spec` | `""` | Inline OpenAPI spec as dict or JSON string |
| `openapi_url` | `""` | URL to fetch an OpenAPI spec from |
| `operation_id` | `""` | Explicit operationId to invoke |
| `path` | `""` | Explicit API path (e.g. `/users/{id}`) |
| `method` | `"GET"` | HTTP method when using explicit path |
| `server_url` | `""` | Base server URL override |
| `path_params` | `{}` | Path parameters for templated routes |
| `query_params` | `{}` | Query parameters |
| `headers` | `{}` | HTTP headers |
| `body` | `""` | Request body (dict, JSON string, or plain text) |

---

## GoogleCalendarTool

Create, list, and delete Google Calendar events. Uses the Google Calendar API v3 with Application Default Credentials.

```bash
pip install synapsekit[gcal-tool]
```

```python
from synapsekit import GoogleCalendarTool

tool = GoogleCalendarTool()

# List upcoming events
r = await tool.run(action="list_events", max_results=5)
# r.output → "- Standup | 2026-03-24T09:00:00+05:30 -> 2026-03-24T09:15:00+05:30 | evt1"

# Create an event
r = await tool.run(
    action="create_event",
    summary="Team Meeting",
    description="Weekly sync",
    start="2026-03-25T14:00:00Z",
    end="2026-03-25T15:00:00Z",
    timezone="America/New_York",
)
# r.output → "Created event: Team Meeting | https://calendar.google.com/..."

# Delete an event
r = await tool.run(action="delete_event", event_id="evt-123")
# r.output → "Deleted event evt-123 from calendar primary."
```

| Parameter | Default | Description |
|---|---|---|
| `action` | — | `list_events`, `create_event`, or `delete_event` (required) |
| `calendar_id` | `"primary"` | Calendar ID |
| `max_results` | `10` | Max events for `list_events` |
| `time_min` | `""` | RFC3339 lower bound for `list_events` |
| `time_max` | `""` | RFC3339 upper bound for `list_events` |
| `summary` | `""` | Event title (required for `create_event`) |
| `description` | `""` | Event description |
| `start` | `""` | RFC3339 start datetime (required for `create_event`) |
| `end` | `""` | RFC3339 end datetime (required for `create_event`) |
| `timezone` | `"UTC"` | Timezone for the event |
| `event_id` | `""` | Event ID (required for `delete_event`) |

:::tip
Set up [Application Default Credentials](https://cloud.google.com/docs/authentication/provide-credentials-adc) before using this tool. For local development, run `gcloud auth application-default login`.
:::

---

## AWSLambdaTool

Invoke AWS Lambda functions. Uses boto3 with standard AWS credential resolution.

```bash
pip install synapsekit[aws-lambda]
```

```python
from synapsekit import AWSLambdaTool

tool = AWSLambdaTool(region_name="us-east-1")

# Invoke a function
r = await tool.run(
    function_name="my-function",
    payload={"key": "value"},
)
# r.output → "StatusCode: 200\nExecutedVersion: $LATEST\nPayload:\n{...}"

# Async invocation (fire-and-forget)
r = await tool.run(
    function_name="my-function",
    payload={"key": "value"},
    invocation_type="Event",
)

# Invoke a specific version or alias
r = await tool.run(
    function_name="my-function",
    qualifier="v2",
)

# Dry run (validate permissions without executing)
r = await tool.run(
    function_name="my-function",
    invocation_type="DryRun",
)
```

| Parameter | Default | Description |
|---|---|---|
| `function_name` | — | Lambda function name or ARN (required) |
| `payload` | `{}` | JSON payload to send (dict, string, or bytes) |
| `invocation_type` | `"RequestResponse"` | `RequestResponse`, `Event`, or `DryRun` |
| `qualifier` | `""` | Version or alias to invoke |
| `region_name` | `""` | AWS region override |

Region is resolved in order:
1. `region_name` parameter in `run()`
2. `region_name` constructor parameter
3. `AWS_REGION` or `AWS_DEFAULT_REGION` environment variable
4. Default boto3 configuration

---

## ImageAnalysisTool

Analyze or describe an image using a multimodal LLM. Supports local file paths and public URLs.

```bash
pip install synapsekit[openai]  # or synapsekit[anthropic]
```

```python
from synapsekit import ImageAnalysisTool, OpenAILLM, LLMConfig

llm = OpenAILLM(LLMConfig(model="gpt-4o", api_key="sk-..."))
tool = ImageAnalysisTool(llm=llm)

# From a local file
r = await tool.run(path="/path/to/image.png")
# r.output → "The image shows a golden retriever sitting on a beach..."

# From a URL
r = await tool.run(image_url="https://example.com/photo.jpg", prompt="What objects are visible?")

# Custom prompt
r = await tool.run(path="/path/to/chart.png", prompt="Extract all data values from this chart.")
```

| Parameter | Default | Description |
|---|---|---|
| `path` | — | Local image file path |
| `image_url` | — | Public image URL |
| `prompt` | `"Describe this image in detail."` | Analysis instruction |
| `media_type` | `"image/png"` | MIME type for URL-based images |

Works with any multimodal LLM provider (OpenAI `gpt-4o`, Anthropic `claude-3-5-sonnet`, Google Gemini, etc.).

---

## TextToSpeechTool

Convert text to speech audio using OpenAI TTS. Saves the audio to a local file.

```bash
pip install synapsekit[openai]
```

```python
from synapsekit import TextToSpeechTool

tool = TextToSpeechTool(api_key="sk-...")

r = await tool.run(text="Hello, world!", output_path="/tmp/hello.mp3")
# r.output → "Saved speech audio to /tmp/hello.mp3"

# Different voice and format
r = await tool.run(
    text="Welcome to SynapseKit.",
    output_path="/tmp/welcome.wav",
    voice="nova",
    format="wav",
)
```

| Parameter | Default | Description |
|---|---|---|
| `text` | — | Text to synthesize (required) |
| `output_path` | — | Path to save the audio file (required) |
| `voice` | `"alloy"` | Voice: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer` |
| `model` | `"tts-1"` | TTS model: `tts-1` (faster) or `tts-1-hd` (higher quality) |
| `format` | `"mp3"` | Audio format: `mp3`, `wav`, `flac`, `aac` |

The API key is resolved in order:
1. `api_key` parameter in `run()`
2. `api_key` constructor parameter
3. `OPENAI_API_KEY` environment variable

---

## SpeechToTextTool

Transcribe audio files to text using OpenAI Whisper API or a local Whisper model.

```bash
pip install synapsekit[openai]           # for whisper_api backend
pip install synapsekit[whisper]          # for whisper_local backend
```

```python
from synapsekit import SpeechToTextTool

# Whisper API (default)
tool = SpeechToTextTool(api_key="sk-...")
r = await tool.run(path="/path/to/audio.mp3")
# r.output → "Hello, this is the transcribed text."

# Local Whisper model (no API key required)
tool = SpeechToTextTool(backend="whisper_local", model="base")
r = await tool.run(path="/path/to/audio.wav")

# Specify language
r = await tool.run(path="/path/to/audio.mp3", language="fr")
```

| Parameter | Default | Description |
|---|---|---|
| `path` | — | Audio file path (required) |
| `backend` | `"whisper_api"` | `"whisper_api"` (OpenAI) or `"whisper_local"` (local model) |
| `model` | `"whisper-1"` | Model name (`whisper-1` for API; `base`, `small`, `medium`, `large` for local) |
| `language` | — | Optional language hint (e.g. `"en"`, `"fr"`) |

---

## BingSearchTool

Search the web via the Bing Web Search API v7. Requires an `Ocp-Apim-Subscription-Key`.

```python
from synapsekit import BingSearchTool

tool = BingSearchTool(api_key="your-bing-subscription-key")

r = await tool.run(query="SynapseKit async RAG framework", max_results=5)
# r.output → formatted list of results with title, URL, snippet
```

| Parameter | Default | Description |
|---|---|---|
| `query` | — | Search query (required) |
| `max_results` | `5` | Maximum number of results to return |

The API key can also be set via the `BING_SEARCH_API_KEY` environment variable.

---

## WolframAlphaTool

Query the Wolfram Alpha short-answer API for computational and factual questions.

```python
from synapsekit import WolframAlphaTool

tool = WolframAlphaTool(app_id="your-wolfram-app-id")

r = await tool.run(query="What is the square root of 144?")
# r.output → "12"

r = await tool.run(query="Population of France")
# r.output → "67.97 million people (world rank: 22nd) (2022 estimate)"
```

| Parameter | Default | Description |
|---|---|---|
| `query` | — | Natural language or math query (required) |

The app ID can also be set via the `WOLFRAM_ALPHA_APP_ID` environment variable.

---

## GoogleSearchTool

Search the web using Google via the SerpAPI.

```bash
pip install synapsekit[google-search]
```

```python
from synapsekit import GoogleSearchTool

tool = GoogleSearchTool(api_key="your-serpapi-key")

r = await tool.run(query="SynapseKit async LLM framework", num_results=5)
# r.output → "1. **Title**\n   URL: https://...\n   Snippet..."
```

| Parameter | Default | Description |
|---|---|---|
| `query` | — | Search query (required) |
| `num_results` | `5` | Number of results to return |

The API key is resolved in order:
1. `api_key` constructor parameter
2. `SERPAPI_API_KEY` environment variable

Supports MP3, WAV, FLAC, M4A, OGG, and other common audio formats.

---

## TwilioTool

Send SMS and WhatsApp messages via the Twilio REST API. Uses stdlib `urllib` only — no extra dependencies.

```python
from synapsekit import TwilioTool

tool = TwilioTool(
    account_sid="ACxxxxxxxx",
    auth_token="your-auth-token",
    from_number="+15550001111",
)

# Send SMS
r = await tool.run(action="send_sms", to="+15551234567", body="Hello from SynapseKit!")
# r.output → "SMS sent to +15551234567 (sid=SMxxx)."

# Send WhatsApp
r = await tool.run(action="send_whatsapp", to="+15551234567", body="Hello via WhatsApp!")
# r.output → "WhatsApp message sent to +15551234567 (sid=SMxxx)."
```

| Parameter | Default | Description |
|---|---|---|
| `action` | — | `send_sms` or `send_whatsapp` (required) |
| `to` | — | Recipient phone number in E.164 format, e.g. `+15551234567` (required) |
| `body` | — | Message body text (required) |

Credentials are resolved in order:
1. Constructor parameters (`account_sid`, `auth_token`, `from_number`)
2. Environment variables (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`)

The `whatsapp:` prefix is handled automatically — pass a plain E.164 number for both SMS and WhatsApp; `TwilioTool` adds the prefix internally. If you pass a number that already has `whatsapp:`, it won't be doubled.

:::warning
`TwilioTool` can send messages to arbitrary phone numbers. A security warning is logged on every instantiation. Consider rate-limiting at the agent level when using this tool in automated pipelines.

**WhatsApp caveats:**
- Sandbox requires recipients to opt in first (send a join code to the sandbox number)
- Freeform messages are only allowed within 24 hours of the last user message; outside that window, use pre-approved templates
- Production WhatsApp requires a Twilio WhatsApp Business sender (Meta verification, 1–2 weeks)
- Tier-based rate limits (1K/10K/100K unique users per 24h) apply to business-initiated conversations only
- Business-initiated conversations (marketing, utility, authentication) carry an additional per-conversation charge on top of the per-message fee; user-initiated conversations have no per-conversation fee
:::
