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
