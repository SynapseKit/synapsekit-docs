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
