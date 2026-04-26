---
sidebar_position: 2
---

# Document Loaders

Loaders ingest content and return a `List[Document]`. All loaders share the same interface.

## Document schema

```python
from synapsekit import Document

@dataclass
class Document:
    text: str
    metadata: dict = field(default_factory=dict)
```

---

## TextLoader

Load a plain text file.

```bash
# No extra install needed
```

```python
from synapsekit import TextLoader

docs = TextLoader("path/to/file.txt").load()
# docs[0].text    → file contents
# docs[0].metadata → {"source": "path/to/file.txt"}
```

---

## StringLoader

Wrap a raw string as a Document (useful for testing or dynamic content).

```python
from synapsekit import StringLoader

docs = StringLoader("Your raw text here.", metadata={"source": "inline"}).load()
```

---

## PDFLoader

Load a PDF file, returning one Document per page.

```bash
pip install synapsekit[pdf]
```

```python
from synapsekit import PDFLoader

docs = PDFLoader("report.pdf").load()
# docs[0].metadata → {"source": "report.pdf", "page": 0}
# docs[1].metadata → {"source": "report.pdf", "page": 1}
```

---

## HTMLLoader

Load an HTML file, stripping all tags to plain text.

```bash
pip install synapsekit[html]
```

```python
from synapsekit import HTMLLoader

docs = HTMLLoader("page.html").load()
# docs[0].text    → plain text content
# docs[0].metadata → {"source": "page.html"}
```

---

## CSVLoader

Load a CSV file, one Document per row.

```python
from synapsekit import CSVLoader

# All columns joined as text
docs = CSVLoader("data.csv").load()

# Specify a dedicated text column — remaining columns become metadata
docs = CSVLoader("data.csv", text_column="content").load()
# docs[0].text         → value of "content" column
# docs[0].metadata     → all other columns + {"source": "...", "row": 0}
```

---

## JSONLoader

Load a JSON file (list of objects or a single object).

```python
from synapsekit import JSONLoader

# Default: reads "text" key from each object
docs = JSONLoader("data.json").load()

# Custom text key + promote specific fields to metadata
docs = JSONLoader(
    "data.json",
    text_key="content",
    metadata_keys=["id", "category"],
).load()
```

---

## DirectoryLoader

Load all matching files in a directory. Delegates to the correct loader per file extension (`.txt`, `.pdf`, `.csv`, `.json`, `.html`/`.htm`).

```python
from synapsekit import DirectoryLoader

# Load all files recursively (default)
docs = DirectoryLoader("./my_docs/").load()

# Custom glob pattern
docs = DirectoryLoader("./my_docs/", glob_pattern="**/*.pdf").load()

# Non-recursive
docs = DirectoryLoader("./my_docs/", glob_pattern="*.txt", recursive=False).load()
```

Unreadable or unsupported files are silently skipped.

---

## WebLoader

Fetch a URL and return its text content. Strips HTML tags automatically.

```bash
pip install synapsekit[web]
```

```python
import asyncio
from synapsekit import WebLoader

# Async (recommended)
docs = await WebLoader("https://example.com").load()

# Sync
docs = WebLoader("https://example.com").load_sync()

# docs[0].text     → stripped page text
# docs[0].metadata → {"source": "https://example.com"}
```

---

## ExcelLoader

Load an Excel (.xlsx) file, one Document per sheet. Each sheet is converted to tab-separated text.

```bash
pip install synapsekit[excel]
```

```python
from synapsekit import ExcelLoader

docs = ExcelLoader("data.xlsx").load()
# docs[0].text     -> tab-separated rows
# docs[0].metadata -> {"source": "data.xlsx", "sheet": "Sheet1"}
```

---

## PowerPointLoader

Load a PowerPoint (.pptx) file, one Document per slide. Extracts text from all shapes.

```bash
pip install synapsekit[pptx]
```

```python
from synapsekit import PowerPointLoader

docs = PowerPointLoader("presentation.pptx").load()
# docs[0].text     -> text from slide 1
# docs[0].metadata -> {"source": "presentation.pptx", "slide": 0}
```

---

## DocxLoader

Load a Microsoft Word (.docx) file.

```bash
pip install synapsekit[docx]
```

```python
from synapsekit import DocxLoader

docs = DocxLoader("report.docx").load()
# docs[0].text     → paragraph text joined by newlines
# docs[0].metadata → {"source": "report.docx"}
```

---

## MarkdownLoader

Load a Markdown file. Strips YAML frontmatter by default.

```bash
# No extra install needed
```

```python
from synapsekit import MarkdownLoader

docs = MarkdownLoader("README.md").load()
# docs[0].text     → markdown content (frontmatter stripped)
# docs[0].metadata → {"source": "README.md"}

# Keep frontmatter
docs = MarkdownLoader("README.md", strip_frontmatter=False).load()
```

---

## AudioLoader

Transcribe audio files into Documents using OpenAI Whisper API or local Whisper.

```bash
pip install synapsekit[audio]
```

```python
from synapsekit import AudioLoader

# Using Whisper API (default)
docs = AudioLoader("interview.mp3", api_key="sk-...").load()
# docs[0].text     → transcribed text
# docs[0].metadata → {"source": "interview.mp3", "loader": "AudioLoader", "backend": "whisper_api"}

# Using local Whisper
docs = AudioLoader("interview.mp3", backend="whisper_local").load()

# Async
docs = await AudioLoader("interview.mp3", api_key="sk-...").aload()
```

Supported formats: `.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`, `.webm`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `str` | required | Path to audio file |
| `api_key` | `str \| None` | `None` | OpenAI API key (for `whisper_api`) |
| `backend` | `str` | `"whisper_api"` | `"whisper_api"` or `"whisper_local"` |
| `language` | `str \| None` | `None` | Language hint |
| `model` | `str` | `"whisper-1"` | Whisper model name |

---

## VideoLoader

Extract audio from video files via ffmpeg, then transcribe using AudioLoader.

```bash
pip install synapsekit[video]
# Requires ffmpeg installed on your system
```

```python
from synapsekit import VideoLoader

docs = VideoLoader("lecture.mp4", api_key="sk-...").load()
# docs[0].text     → transcribed speech
# docs[0].metadata → {"source": "lecture.mp4", "loader": "VideoLoader", "backend": "whisper_api"}

# Async
docs = await VideoLoader("lecture.mp4", api_key="sk-...").aload()
```

Supported formats: `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`, `.m4v`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `str` | required | Path to video file |
| `api_key` | `str \| None` | `None` | OpenAI API key |
| `backend` | `str` | `"whisper_api"` | Whisper backend |
| `language` | `str \| None` | `None` | Language hint |
| `keep_audio` | `bool` | `False` | Keep extracted audio file |

---

## YAMLLoader

Load YAML files (list-of-objects or single-object) into Documents.

```bash
pip install synapsekit[yaml]
```

```python
from synapsekit import YAMLLoader

# List of objects (each becomes a Document)
docs = YAMLLoader("data.yaml").load()

# Single object YAML
docs = YAMLLoader("config.yaml").load()

# Custom key extraction
docs = YAMLLoader("data.yaml", text_key="content", metadata_keys=["title", "author"]).load()

# Async
docs = await YAMLLoader("data.yaml").aload()
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `str` | required | Path to YAML file |
| `text_key` | `str` | `"text"` | Key to extract as document text |
| `metadata_keys` | `list[str]` | `[]` | Keys to include in metadata |

---

## XMLLoader

Load XML files and extract text content using Python's built-in `xml.etree.ElementTree` — no extra dependencies.

```python
from synapsekit import XMLLoader

# Load all text from an XML file
docs = XMLLoader("feed.xml").load()

# Extract only specific tags
docs = XMLLoader("article.xml", tags=["title", "body", "summary"]).load()

# Custom encoding
docs = XMLLoader("data.xml", encoding="latin-1").load()
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `str` | required | Path to XML file |
| `tags` | `list[str] \| None` | `None` | Tag names to extract (all text if omitted) |
| `encoding` | `str` | `"utf-8"` | File encoding |

---

## DiscordLoader

Load messages from Discord channels using the Discord bot API.

```bash
pip install synapsekit[discord]
```

```python
from synapsekit import DiscordLoader

# Load last 100 messages from a channel
loader = DiscordLoader(
    token="your-bot-token",
    channel_id=1234567890123456789,
)
docs = loader.load()  # synchronous

# or async
docs = await loader.aload()

# Paginate with before/after message IDs
docs = DiscordLoader(
    token="your-bot-token",
    channel_id=1234567890123456789,
    limit=50,
    before_message_id=9876543210,
    after_message_id=1111111111,
).load()

# Exclude metadata (text only)
docs = DiscordLoader(
    token="your-bot-token",
    channel_id=1234567890123456789,
    include_metadata=False,
).load()
```

Each message becomes one `Document`. Metadata includes author, message ID, channel ID, timestamp, attachments, and reactions.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `token` | `str` | required | Discord bot token |
| `channel_id` | `int` | required | Channel ID to load from |
| `limit` | `int` | `100` | Maximum messages to fetch |
| `before_message_id` | `int \| None` | `None` | Fetch messages before this ID |
| `after_message_id` | `int \| None` | `None` | Fetch messages after this ID |
| `include_metadata` | `bool` | `True` | Include author, timestamp, reactions etc. in metadata |

:::info
The bot must have **Read Message History** permission and **Message Content Intent** enabled in the Discord Developer Portal.
:::

---

## SlackLoader

Load messages from Slack channels using the Slack Bot API.

```bash
pip install synapsekit[slack]
```

```python
from synapsekit import SlackLoader

# Load all messages from a channel
loader = SlackLoader(
    bot_token="xoxb-...",
    channel_id="C1234567890",
)
docs = loader.load()         # synchronous
docs = await loader.aload()  # async

# Limit the number of messages fetched
loader = SlackLoader(
    bot_token="xoxb-...",
    channel_id="C1234567890",
    limit=200,
)
docs = loader.load()
```

Each message becomes one `Document`. Metadata includes `source` (channel ID), `ts` (timestamp), `user`, and `thread_ts`.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `bot_token` | `str` | required | Slack Bot OAuth token (`xoxb-...`) |
| `channel_id` | `str` | required | Channel ID to load from (e.g. `C1234567890`) |
| `limit` | `int \| None` | `None` | Maximum messages to fetch (fetches all if not set) |

:::info
The bot must have the **channels:history** (public) or **groups:history** (private) OAuth scope, and must be a member of the channel.
:::

---

## NotionLoader

Load pages or databases from Notion using the Notion API.

```bash
pip install synapsekit[notion]
```

```python
from synapsekit import NotionLoader

# Load a single page by ID
loader = NotionLoader(
    api_key="secret_...",
    page_id="abc12345-...",
)
docs = loader.load()         # synchronous
docs = await loader.aload()  # async

# Load all pages from a database
loader = NotionLoader(
    api_key="secret_...",
    database_id="def67890-...",
)
docs = loader.load()
```

Each page becomes one `Document`. Metadata includes `source` (page URL), `page_id`, and `title`.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `api_key` | `str` | required | Notion integration token (`secret_...`) |
| `page_id` | `str \| None` | `None` | Load a single Notion page by ID |
| `database_id` | `str \| None` | `None` | Load all pages from a database |
| `max_retries` | `int` | `3` | Retry attempts for transient API errors |
| `timeout` | `float` | `30.0` | HTTP request timeout in seconds |

Exactly one of `page_id` or `database_id` is required.

:::info
Create an **internal integration** at [notion.so/my-integrations](https://www.notion.so/my-integrations), then share the target page or database with that integration.
:::

---

## WikipediaLoader

Load Wikipedia articles as Documents. Accepts a single article title or multiple pipe-delimited titles.

```bash
pip install synapsekit[wikipedia]
```

```python
from synapsekit import WikipediaLoader

# Single article
loader = WikipediaLoader(query="Python (programming language)")
docs = loader.load()
# docs[0].text     → full article text
# docs[0].metadata → {"source": "wikipedia", "title": "...", "url": "...", "language": "en"}

# Multiple articles (pipe-delimited)
loader = WikipediaLoader(query="RAG | Vector database | Embeddings", max_results=3)
docs = loader.load()

# Async
docs = await loader.aload()
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `str` | required | Article title(s), pipe-separated for multiple |
| `language` | `str` | `"en"` | Wikipedia language code |
| `max_results` | `int` | `3` | Maximum articles to return |

---

## ArXivLoader

Search arXiv and load papers as Documents (downloads PDFs and extracts text).

```bash
pip install synapsekit[arxiv,pdf]
```

```python
from synapsekit import ArXivLoader

loader = ArXivLoader(
    query="retrieval augmented generation",
    max_results=5,
    sort_by="relevance",  # "relevance" | "lastUpdatedDate" | "submittedDate"
)
docs = loader.load()
# docs[0].text     → full paper text
# docs[0].metadata → {"source": "arxiv", "title": "...", "authors": [...], "arxiv_id": "...", "url": "..."}

# Async
docs = await loader.aload()
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `str` | required | Search query |
| `max_results` | `int` | `5` | Max papers to fetch |
| `sort_by` | `str` | `"relevance"` | Sort order: `"relevance"`, `"lastUpdatedDate"`, `"submittedDate"` |

---

## EmailLoader

Load emails from an IMAP mailbox (Gmail, Outlook, etc.) as Documents. Uses stdlib only — no extra dependencies.

```bash
# No extra install needed
```

```python
from synapsekit import EmailLoader

loader = EmailLoader(
    imap_server="imap.gmail.com",
    email_address="user@gmail.com",
    password="app_password",       # use an App Password for Gmail
    folder="INBOX",
    search='SINCE "01-Jan-2024"',  # standard IMAP search syntax
    limit=50,
)
docs = loader.load()
# docs[0].text     → email body (plain text)
# docs[0].metadata → {"source": "email", "subject": "...", "from": "...", "date": "...", "folder": "INBOX", "email_id": "..."}

# Async
docs = await loader.aload()
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `imap_server` | `str` | required | IMAP hostname, e.g. `imap.gmail.com` |
| `email_address` | `str` | required | Email address to log in as |
| `password` | `str` | required | Password or App Password |
| `folder` | `str` | `"INBOX"` | Mailbox folder to read |
| `search` | `str` | `"ALL"` | IMAP search query (e.g. `'SINCE "01-Jan-2024"'`, `"UNSEEN"`) |
| `limit` | `int\|None` | `None` | Max emails to load (most recent first) |

---

## GoogleDriveLoader

Load files and folders from **Google Drive** using the Drive API v3. Supports Google Docs (exported as plain text), Google Sheets (exported as CSV), PDFs, and other text files.

```bash
pip install synapsekit[gdrive]
```

Requires a **service account** with the Drive API enabled and read access to the target files or folders.

```python
from synapsekit import GoogleDriveLoader

# Load a single file by ID
loader = GoogleDriveLoader(
    credentials_path="service-account.json",
    file_id="1abc...",
)
docs = loader.load()

# Or async
docs = await loader.aload()

# Load all files from a folder
loader = GoogleDriveLoader(
    credentials_path="service-account.json",
    folder_id="1def...",
)
docs = loader.load()

# Pass credentials as a dict (e.g., from env var JSON)
import json, os
loader = GoogleDriveLoader(
    credentials_dict=json.loads(os.environ["GDRIVE_CREDS"]),
    file_id="1abc...",
)
docs = loader.load()
```

Each file becomes one `Document`. Metadata includes `source`, `file_name`, `mime_type`, `modified`, and `file_id`. Subfolders are skipped when loading a folder. Files that fail to download are skipped with a warning.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `credentials_path` | `str \| None` | `None` | Path to service account JSON file |
| `credentials_dict` | `dict \| None` | `None` | Service account credentials as a dict |
| `file_id` | `str \| None` | `None` | ID of a single file to load |
| `folder_id` | `str \| None` | `None` | ID of a folder — loads all files inside |

Either `credentials_path` or `credentials_dict` is required (not both). Either `file_id` or `folder_id` is required (not both).

:::info Supported MIME types
- **Google Docs** (`application/vnd.google-apps.document`) — exported as plain text
- **Google Sheets** (`application/vnd.google-apps.spreadsheet`) — exported as CSV
- **PDFs and text files** — downloaded directly
- **Other binary files** — returned as `[Binary file: {mime_type}]`
:::

---

## ImageLoader

Load images as Documents. Without a vision LLM, returns a metadata-only placeholder. With a vision LLM (any object with an async `generate` method), returns the LLM's description of the image.

```bash
# No extra install needed — stdlib only
```

```python
from synapsekit import ImageLoader

# Without LLM — metadata placeholder
loader = ImageLoader("path/to/photo.jpg")
docs = loader.load()
# docs[0].text     → "[Image: path/to/photo.jpg]"
# docs[0].metadata → {"source": "...", "media_type": "image/jpeg", "file_size": 102400}

# With vision LLM — async_load() returns a description
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.base import LLMConfig

llm = OpenAILLM(LLMConfig(model="gpt-4o", api_key="sk-..."))
loader = ImageLoader(
    "path/to/diagram.png",
    llm=llm,
    prompt="Describe this diagram in detail, including any text visible.",
)
docs = await loader.async_load()
# docs[0].text     → "The diagram shows a RAG pipeline with ..."
# docs[0].metadata → {"source": "...", "media_type": "image/png", "file_size": ..., "description_prompt": "..."}
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `str\|Path` | required | Path to the image file |
| `llm` | `Any\|None` | `None` | Vision LLM with async `generate(prompt, image_url=...)` |
| `prompt` | `str` | `"Describe this image in detail."` | Prompt sent to the vision LLM |

:::info Async vs sync
- `load()` — always returns a placeholder `[Image: <path>]` regardless of LLM
- `async_load()` — uses the LLM to generate a real description (requires a vision model like `gpt-4o`)
:::

---

## ConfluenceLoader

Load pages from Atlassian Confluence as Documents. Supports loading a single page by ID or an entire space, with automatic pagination and retry on rate limits.

```bash
pip install synapsekit[confluence]
```

```python
from synapsekit import ConfluenceLoader

# Load a single page by ID
loader = ConfluenceLoader(
    url="https://yourcompany.atlassian.net/wiki",
    username="you@example.com",
    api_token="your-api-token",
    page_id="123456789",
)
docs = loader.load()         # synchronous
docs = await loader.aload()  # async

# Load all pages in a space
loader = ConfluenceLoader(
    url="https://yourcompany.atlassian.net/wiki",
    username="you@example.com",
    api_token="your-api-token",
    space_key="ENG",
    limit=50,  # optional cap
)
docs = loader.load()
```

Each page becomes one `Document`. Metadata includes `source`, `title`, `page_id`, `space`, `url`, `version`, `author`, and `last_modified`.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `url` | `str` | required | Base URL of your Confluence instance |
| `username` | `str` | required | Your Atlassian email address |
| `api_token` | `str` | required | Atlassian API token |
| `page_id` | `str \| None` | `None` | Load a single page by its ID |
| `space_key` | `str \| None` | `None` | Load all pages from a Confluence space |
| `limit` | `int \| None` | `None` | Max pages to load when fetching a space |

Exactly one of `page_id` or `space_key` is required.

:::info
Generate an API token at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens).
Rate-limit errors (HTTP 429) are retried with exponential back-off automatically.
:::

---

## RSSLoader

Load articles from RSS or Atom feeds as Documents.

```bash
pip install synapsekit[rss]
```

```python
from synapsekit import RSSLoader

loader = RSSLoader("https://feeds.feedburner.com/oreilly/radar")
docs = loader.load()         # synchronous
docs = await loader.aload()  # async

# docs[0].text     → article body (full content if available, summary otherwise)
# docs[0].metadata → {"title": "...", "published": "...", "link": "...", "author": "..."}
```

Each feed entry becomes one `Document`. Metadata fields (`title`, `published`, `link`, `author`) are omitted when empty.

| Parameter | Type | Description |
|---|---|---|
| `url` | `str` | URL of the RSS or Atom feed |

---

## GCSLoader

Load files from a Google Cloud Storage bucket as Documents. Install with `pip install synapsekit[gcs]`.

```python
from synapsekit import GCSLoader

loader = GCSLoader(
    bucket_name="my-bucket",
    prefix="documents/",
    credentials_path="service-account.json",
    max_files=100,
)

docs = await loader.aload()
```

| Parameter | Type | Description |
|---|---|---|
| `bucket_name` | `str` | GCS bucket name (required) |
| `prefix` | `str \| None` | Optional prefix filter (e.g. `"documents/"`) |
| `credentials_path` | `str \| None` | Path to a service account JSON file |
| `credentials_dict` | `dict \| None` | Service account credentials as a dict |
| `max_files` | `int \| None` | Maximum number of files to load |

If neither `credentials_path` nor `credentials_dict` is provided, default application credentials are used. Binary files are kept with a placeholder string and their content type in metadata.

---

## SQLLoader

Load rows from any SQLAlchemy-supported database (PostgreSQL, MySQL, SQLite, etc.) as Documents. Install with `pip install synapsekit[sql]`.

```python
from synapsekit import SQLLoader

loader = SQLLoader(
    connection_string="postgresql://user:pass@localhost/db",
    query="SELECT id, title, body, author FROM articles WHERE published = true",
    text_columns=["title", "body"],
    metadata_columns=["id", "author"],
)

docs = await loader.aload()
```

| Parameter | Type | Description |
|---|---|---|
| `connection_string` | `str` | SQLAlchemy database URL (required) |
| `query` | `str` | SQL query to execute (required) |
| `text_columns` | `list[str] \| None` | Columns concatenated into the document text. Defaults to all columns. |
| `metadata_columns` | `list[str] \| None` | Columns included in metadata. Defaults to all columns. |

Each Document gets `metadata["source"] = "sql"` and `metadata["row_index"]` automatically.

---

## GitHubLoader

Load README, issues, pull requests, or repository files from a GitHub repository via the REST API. Uses the existing `httpx` dependency — no new install needed if you already have `synapsekit[web]`.

```python
from synapsekit import GitHubLoader

# README
loader = GitHubLoader(repo="SynapseKit/SynapseKit", content_type="readme")

# Issues (filters out PRs automatically)
loader = GitHubLoader(repo="SynapseKit/SynapseKit", content_type="issues", limit=20)

# Pull requests
loader = GitHubLoader(repo="SynapseKit/SynapseKit", content_type="prs", limit=10)

# Repository files (recursive Git Trees API)
loader = GitHubLoader(
    repo="SynapseKit/SynapseKit",
    content_type="files",
    path="src/synapsekit/llm/",
    limit=50,
    token="ghp_...",  # optional but recommended for higher rate limits
)

docs = await loader.load()
```

| Parameter | Type | Description |
|---|---|---|
| `repo` | `str` | Repository in `owner/repo` format (required) |
| `content_type` | `"readme" \| "issues" \| "prs" \| "files"` | What to load. Defaults to `"readme"`. |
| `token` | `str \| None` | GitHub token for higher rate limits |
| `path` | `str \| None` | Path prefix filter (only for `files`) |
| `limit` | `int \| None` | Maximum number of items to load |

Includes retry with exponential back-off for rate limits (HTTP 429) and 5xx errors.

---

## GitLoader

Load files from a Git repository — local path or remote URL — at any revision. Supports glob pattern filtering.

```bash
pip install synapsekit[git]
```

```python
from synapsekit import GitLoader

# Local repo, all files at HEAD
loader = GitLoader("/path/to/repo")

# Remote repo, specific revision, only Python files
loader = GitLoader(
    repo="https://github.com/org/repo.git",
    revision="v2.0.0",
    glob_pattern="**/*.py",
)

docs = loader.load()
# or
docs = await loader.aload()
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `repo` | `str` | required | Local path or remote URL |
| `revision` | `str` | `"HEAD"` | Git revision (branch, tag, commit hash) |
| `glob_pattern` | `str` | `"**/*"` | Glob filter for file paths |

Each document's metadata includes `path`, `commit_hash`, `author`, and `date`.

---

## GoogleSheetsLoader

Load rows from a Google Sheets spreadsheet as Documents. Each row becomes one document; headers become field names.

```bash
pip install synapsekit[gsheets]
```

```python
from synapsekit import GoogleSheetsLoader

loader = GoogleSheetsLoader(
    spreadsheet_id="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
    sheet_name="Sheet1",               # optional — auto-detects first sheet
    credentials_path="credentials.json",
)

docs = loader.load()
# or
docs = await loader.aload()
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `spreadsheet_id` | `str` | required | Google Sheets document ID from the URL |
| `sheet_name` | `str \| None` | `None` | Sheet tab name; first sheet used if omitted |
| `credentials_path` | `str` | `"credentials.json"` | Path to service account credentials file |

Row text format: `"ColumnA: value, ColumnB: value, ..."`. Metadata includes `source` URL, `sheet`, and `row` index.

---

## JiraLoader

Load Jira issues using a JQL query. Handles Atlassian Document Format (ADF) descriptions, pagination, and rate-limit retry automatically.

```bash
pip install synapsekit[jira]
```

```python
from synapsekit import JiraLoader

loader = JiraLoader(
    url="https://your-domain.atlassian.net",
    username="your-email@example.com",
    api_token="your-api-token",
    jql="project = MYPROJ AND status = Open",
    limit=100,  # optional
)

# Async (recommended)
docs = await loader.aload()

# Sync
docs = loader.load()
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `url` | `str` | required | Jira instance base URL |
| `username` | `str` | required | Jira account email |
| `api_token` | `str` | required | Jira API token |
| `jql` | `str` | required | JQL query string |
| `limit` | `int \| None` | `None` | Maximum number of issues to load |

Each document includes the issue summary, description, and comments. Metadata includes `key`, `status`, `assignee`, `priority`, and `source`.

---

## SupabaseLoader

Load rows from a Supabase table as Documents. Supports column selection and environment variable auth.

```bash
pip install synapsekit[supabase]
```

```python
from synapsekit import SupabaseLoader

# All columns, credentials from env vars (SUPABASE_URL, SUPABASE_KEY)
loader = SupabaseLoader(table="articles")

# Specific text and metadata columns
loader = SupabaseLoader(
    table="articles",
    supabase_url="https://xyz.supabase.co",
    supabase_key="your-anon-key",
    text_columns=["title", "content"],
    metadata_columns=["id", "author", "created_at"],
)

docs = loader.load()
# or
docs = await loader.aload()
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `table` | `str` | required | Supabase table name |
| `supabase_url` | `str \| None` | `SUPABASE_URL` env | Supabase project URL |
| `supabase_key` | `str \| None` | `SUPABASE_KEY` env | Supabase anon/service key |
| `text_columns` | `list[str] \| None` | `None` | Columns to include in document text; all columns used if omitted |
| `metadata_columns` | `list[str] \| None` | `None` | Columns to include in metadata |

---

## TeamsLoader

Load messages from Microsoft Teams channels via the Microsoft Graph API.

```bash
pip install synapsekit[teams]
```

```python
from synapsekit.loaders import TeamsLoader

loader = TeamsLoader(
    team_id="your-team-id",
    channel_id="your-channel-id",
    access_token="Bearer ...",
    max_messages=500,
)
docs = loader.load()
# Each doc: message body as text, metadata includes author, timestamp, channel_id
```

- Automatic pagination via `@odata.nextLink`
- HTML-to-plain-text conversion
- Exponential backoff for 429 / 5xx responses

---

## S3Loader

Load files from Amazon S3 buckets.

```bash
pip install synapsekit[s3]
```

```python
from synapsekit.loaders import S3Loader

loader = S3Loader(
    bucket="my-bucket",
    prefix="docs/",                   # optional key prefix
    extensions=[".pdf", ".txt"],      # optional filter
    max_files=100,
    aws_access_key_id="AKI...",
    aws_secret_access_key="...",
)
docs = loader.load()
```

Supports text files directly and PDF / DOCX / XLSX / PPTX / CSV / JSON / HTML via the corresponding loaders. Falls back to raw binary read for unknown types. Uses ambient IAM role if no explicit credentials are given.

---

## AzureBlobLoader

Load blobs from Azure Blob Storage containers.

```bash
pip install synapsekit[azure]
```

```python
from synapsekit.loaders import AzureBlobLoader

loader = AzureBlobLoader(
    container="my-container",
    connection_string="DefaultEndpointsProtocol=https;...",
    prefix="reports/",
    max_files=50,
)
docs = loader.load()
```

Also accepts `account_url` + `credential` for token-based auth.

---

## MongoDBLoader

Load documents from a MongoDB collection.

```bash
pip install synapsekit[mongodb]
```

```python
from synapsekit.loaders import MongoDBLoader

loader = MongoDBLoader(
    uri="mongodb://localhost:27017",
    database="mydb",
    collection="articles",
    text_fields=["title", "body"],
    metadata_fields=["author", "created_at"],
    query_filter={"published": True},
)
docs = loader.load()
```

---

## DropboxLoader

Load files from a Dropbox folder.

```bash
pip install synapsekit[dropbox]
```

```python
from synapsekit.loaders import DropboxLoader

loader = DropboxLoader(
    access_token="sl.xxx",
    folder_path="/Reports",
    extensions=[".txt", ".md", ".pdf"],
    limit=200,
)
docs = loader.load()
```

Supports 20+ text and code extensions. Skips files that fail to download instead of raising.

---

## EPUBLoader

Load EPUB files chapter-by-chapter.

```bash
pip install synapsekit[epub]
```

```python
from synapsekit.loaders import EPUBLoader

loader = EPUBLoader("book.epub")
docs = loader.load()
# One Document per chapter; metadata: title, author, chapter_name
```

---

## LaTeXLoader

Load `.tex` files as plain text. No external dependencies.

```python
from synapsekit.loaders import LaTeXLoader

loader = LaTeXLoader("paper.tex")
docs = loader.load()
# Strips commands, environments, math, and comments; captures section titles in metadata
```

---

## TSVLoader

Load tab-separated files, one Document per row.

```python
from synapsekit.loaders import TSVLoader

loader = TSVLoader("data.tsv", text_column="description")
docs = loader.load()
# text_column becomes the document body; all other columns become metadata
```

---

## RTFLoader

Load RTF files as plain text via `striprtf`.

```bash
pip install synapsekit[rtf]
```

```python
from synapsekit.loaders import RTFLoader

loader = RTFLoader("document.rtf")
docs = loader.load()
```

Default encoding is `latin-1` (Windows-1252 superset) — the encoding used by Office and WordPad.

---

## ConfigLoader

Load `.env`, `.ini`, `.cfg`, `.toml`, and environment-specific dotfiles into Documents.

```python
from synapsekit.loaders import ConfigLoader

loader = ConfigLoader(".env.production")
docs = loader.load()
# Sensitive keys (password, secret, token, api_key, auth) are redacted automatically
```

Supported: `.env`, `.env.local`, `.env.staging`, `.env.production`, `.ini`, `.cfg`, `.toml`.

---

## OneDriveLoader

Load files from OneDrive and SharePoint via Microsoft Graph API.

```python
from synapsekit.loaders import OneDriveLoader

loader = OneDriveLoader(
    access_token="Bearer ...",
    folder_path="/Documents/Reports",
    recursive=True,
    extensions=[".pdf", ".docx"],
    max_files=100,
)
docs = loader.load()
```

Extracts PDF, DOCX, XLSX, PPTX, CSV, JSON, HTML via existing loaders. Uses stdlib HTTP — no external SDK required.

---

## ParquetLoader

Load Parquet files as Documents, one Document per row.

```bash
pip install synapsekit[parquet]
```

```python
from synapsekit.loaders import ParquetLoader

loader = ParquetLoader("data.parquet", text_column="content")
docs = loader.load()
# text_column becomes the document body; remaining columns become metadata
```

Supports local files and remote URLs via `pandas.read_parquet`.

---

## RedisLoader

Load key/value pairs from a Redis database as Documents.

```bash
pip install synapsekit[redis]
```

```python
from synapsekit.loaders import RedisLoader

loader = RedisLoader(
    host="localhost",
    port=6379,
    pattern="docs:*",       # key pattern filter
    value_type="hash",      # "string", "hash", or "json"
)
docs = loader.load()
# Each doc: key as metadata, value as text
```

---

## ElasticsearchLoader

Load documents from an Elasticsearch index.

```bash
pip install synapsekit[elasticsearch]
```

```python
from synapsekit.loaders import ElasticsearchLoader

loader = ElasticsearchLoader(
    hosts=["http://localhost:9200"],
    index="my-index",
    text_field="content",
    metadata_fields=["author", "timestamp"],
    query={"match_all": {}},   # optional DSL query; omit for full scan
)
docs = loader.load()
```

---

## DynamoDBLoader

Load items from an AWS DynamoDB table.

```bash
pip install synapsekit[dynamodb]
```

```python
from synapsekit.loaders import DynamoDBLoader

# Full table scan
loader = DynamoDBLoader(
    table_name="my-table",
    text_fields=["title", "body"],
    metadata_fields=["author", "created_at"],
    region_name="us-east-1",
)
docs = loader.load()

# Query mode (specific partition)
loader = DynamoDBLoader(
    table_name="my-table",
    text_fields=["body"],
    key_condition_expression="pk = :pk",
    expression_attribute_values={":pk": {"S": "user#123"}},
)
docs = loader.load()
```

Automatically paginates using `LastEvaluatedKey`. Deserialises typed DynamoDB attribute values (S, N, BOOL, L, M, etc.).

---

## YouTubeLoader

Load transcripts from YouTube videos via the `youtube-transcript-api` library.

```bash
pip install synapsekit[youtube]
```

```python
from synapsekit.loaders import YouTubeLoader

loader = YouTubeLoader(video_id="dQw4w9WgXcQ", language="en")
docs = loader.load()
# docs[0].text     → transcript text
# docs[0].metadata → {"source": "youtube", "video_id": "...", "language": "en"}
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `video_id` | `str` | required | YouTube video ID |
| `language` | `str` | `"en"` | Preferred transcript language |

---

## ObsidianLoader

Load an Obsidian vault directory, resolving `[[wikilinks]]` and YAML frontmatter.

```bash
# No extra install needed
```

```python
from synapsekit.loaders import ObsidianLoader

loader = ObsidianLoader("/path/to/vault")
docs = loader.load()
# One Document per note; frontmatter promoted to metadata; [[links]] resolved to titles
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `vault_path` | `str` | required | Path to the Obsidian vault root |
| `recursive` | `bool` | `True` | Traverse subdirectories |

---

## AirtableLoader

Load records from an Airtable base via the Airtable REST API.

```bash
pip install synapsekit[airtable]
```

```python
from synapsekit.loaders import AirtableLoader

loader = AirtableLoader(
    api_key="keyXXX",
    base_id="appXXX",
    table_name="Tasks",
)
docs = loader.load()
```

---

## SitemapLoader

Crawl a sitemap XML and load all linked pages.

```bash
pip install synapsekit[web]
```

```python
from synapsekit.loaders import SitemapLoader

loader = SitemapLoader("https://example.com/sitemap.xml", max_pages=50)
docs = await loader.aload()
```

---

## HubSpotLoader

Load HubSpot contacts, companies, or deals via the HubSpot API.

```bash
pip install synapsekit[hubspot]
```

```python
from synapsekit.loaders import HubSpotLoader

loader = HubSpotLoader(
    api_key="pat-...",
    object_type="contacts",  # "contacts", "companies", "deals"
)
docs = loader.load()
```

---

## SalesforceLoader

Load Salesforce records via SOQL queries using the simple-salesforce client.

```bash
pip install synapsekit[salesforce]
```

```python
from synapsekit.loaders import SalesforceLoader

loader = SalesforceLoader(
    username="user@example.com",
    password="...",
    security_token="...",
    soql="SELECT Id, Name, Description FROM Account LIMIT 100",
)
docs = loader.load()
```

---

## BigQueryLoader

Load rows from a Google BigQuery table or SQL query.

```bash
pip install synapsekit[bigquery]
```

```python
from synapsekit.loaders import BigQueryLoader

loader = BigQueryLoader(
    project="my-gcp-project",
    query="SELECT title, body FROM `my_dataset.articles` LIMIT 500",
    credentials_path="service-account.json",
)
docs = loader.load()
```

---

## PubMedLoader

Load PubMed abstracts and metadata by PMID list or free-text search. No extra dependencies.

```bash
# No extra install needed
```

```python
from synapsekit.loaders import PubMedLoader

# Search by keyword
loader = PubMedLoader(query="retrieval augmented generation", max_results=10)
docs = loader.load()

# Load specific PMIDs
loader = PubMedLoader(pmids=["37160872", "36823232"])
docs = loader.load()
```

---

## SnowflakeLoader

Load rows from Snowflake via a SQL query.

```bash
pip install synapsekit[snowflake]
```

```python
from synapsekit.loaders import SnowflakeLoader

loader = SnowflakeLoader(
    account="myaccount.us-east-1",
    user="myuser",
    password="...",
    warehouse="COMPUTE_WH",
    database="MY_DB",
    schema="PUBLIC",
    query="SELECT title, content FROM articles WHERE active = TRUE",
)
docs = loader.load()
```

---

## FirestoreLoader

Load documents from a Google Firestore collection.

```bash
pip install synapsekit[firestore]
```

```python
from synapsekit.loaders import FirestoreLoader

loader = FirestoreLoader(
    collection="articles",
    credentials_path="service-account.json",
    text_fields=["title", "body"],
)
docs = loader.load()
```

---

## ZendeskLoader

Load tickets from Zendesk via the Support API.

```bash
pip install synapsekit[zendesk]
```

```python
from synapsekit.loaders import ZendeskLoader

loader = ZendeskLoader(
    subdomain="mycompany",
    email="agent@example.com",
    api_token="your-api-token",
    status="open",   # "open", "pending", "solved", "closed", or None for all
)
docs = loader.load()
```

---

## IntercomLoader

Load conversations from Intercom via the REST API.

```bash
pip install synapsekit[intercom]
```

```python
from synapsekit.loaders import IntercomLoader

loader = IntercomLoader(access_token="dG9rXXX", max_results=200)
docs = loader.load()
# Each Document contains one conversation thread
```

---

## FreshdeskLoader

Load tickets from Freshdesk via the v2 API.

```bash
pip install synapsekit[freshdesk]
```

```python
from synapsekit.loaders import FreshdeskLoader

loader = FreshdeskLoader(
    domain="mycompany.freshdesk.com",
    api_key="your-api-key",
    status=2,  # 2 = open; see Freshdesk docs for other status codes
)
docs = loader.load()
```

---

## HackerNewsLoader

Load HN stories and comments via the Firebase REST API. No extra dependencies.

```bash
# No extra install needed
```

```python
from synapsekit.loaders import HackerNewsLoader

# Top stories
loader = HackerNewsLoader(story_type="top", max_stories=30)
docs = loader.load()

# Load a specific item by ID
loader = HackerNewsLoader(item_id=39443107)
docs = loader.load()
```

---

## RedditLoader

Load Reddit posts and comments via PRAW.

```bash
pip install synapsekit[reddit]
```

```python
from synapsekit.loaders import RedditLoader

loader = RedditLoader(
    client_id="...",
    client_secret="...",
    user_agent="synapsekit/1.0",
    subreddit="MachineLearning",
    post_limit=25,
    include_comments=True,
)
docs = loader.load()
```

---

## TwitterLoader

Load tweets via the Twitter API v2.

```bash
pip install synapsekit[twitter]
```

```python
from synapsekit.loaders import TwitterLoader

loader = TwitterLoader(
    bearer_token="AAAA...",
    query="retrieval augmented generation lang:en",
    max_results=50,
)
docs = loader.load()
```

---

## GoogleCalendarLoader

Load events from Google Calendar via the Calendar API v3.

```bash
pip install synapsekit[gcal]
```

```python
from synapsekit.loaders import GoogleCalendarLoader

loader = GoogleCalendarLoader(
    credentials_path="service-account.json",
    calendar_id="primary",
    time_min="2026-01-01T00:00:00Z",
    max_results=100,
)
docs = loader.load()
# Each event becomes one Document; metadata: summary, start, end, location, attendees
```

---

## TrelloLoader

Load Trello cards and boards via the Trello REST API.

```bash
pip install synapsekit[trello]
```

```python
from synapsekit.loaders import TrelloLoader

loader = TrelloLoader(
    api_key="...",
    api_token="...",
    board_id="...",
)
docs = loader.load()
# Each card becomes one Document; metadata: list_name, labels, due_date, url
```

---

## Loading into the RAG facade

All loaders return `List[Document]`, which you can pass directly to `add_documents()`:

```python
from synapsekit import RAG, PDFLoader, DirectoryLoader

rag = RAG(model="gpt-4o-mini", api_key="sk-...")

# Single loader
rag.add_documents(PDFLoader("report.pdf").load())

# Multiple loaders
from itertools import chain
docs = list(chain(
    PDFLoader("report.pdf").load(),
    DirectoryLoader("./notes/").load(),
))
rag.add_documents(docs)

answer = rag.ask_sync("Summarize everything.")
```
