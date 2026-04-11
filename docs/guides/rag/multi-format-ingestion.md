---
sidebar_position: 4
title: "Multi-Format Document Ingestion"
description: "Ingest PDF, DOCX, web pages, CSV, and entire directories into a single SynapseKit RAG pipeline."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Multi-Format Document Ingestion

<ColabBadge path="rag/multi-format-ingestion.ipynb" />

Real knowledge bases rarely contain a single document type. A product team might have API docs in Markdown, meeting notes in DOCX, usage data in CSV, and a public website — all of which need to be searchable together. SynapseKit's loader family provides a consistent `aload()` interface across every format so you can mix and match without glue code. **What you'll build:** A unified knowledge base that ingests five different source formats and answers questions across all of them. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit chromadb pypdf python-docx
export OPENAI_API_KEY="sk-..."
```

## What you'll learn

- How to use `PDFLoader`, `DocxLoader`, `WebLoader`, `CSVLoader`, and `DirectoryLoader`
- How each loader attaches format-specific metadata automatically
- How to merge documents from different sources before splitting
- How `DirectoryLoader` recursively ingests an entire folder
- How to identify which source answered your question

## Step 1: Load PDFs

```python
from synapsekit.loaders import PDFLoader

# Page-level metadata lets you cite exact page numbers in answers.
loader = PDFLoader("docs/product-spec.pdf")
pdf_docs = await loader.aload()
print(f"PDF: {len(pdf_docs)} pages loaded")
# Each doc: metadata = {'source': 'docs/product-spec.pdf', 'page': N}
```

## Step 2: Load DOCX files

```python
from synapsekit.loaders import DocxLoader

# DocxLoader extracts paragraphs in document order and attaches the filename.
# Headings are preserved as plain text so the splitter can use them as natural
# chunk boundaries.
loader = DocxLoader("docs/meeting-notes.docx")
docx_docs = await loader.aload()
print(f"DOCX: {len(docx_docs)} sections loaded")
```

## Step 3: Load web pages

```python
from synapsekit.loaders import WebLoader

# WebLoader fetches the URL, strips HTML tags and navigation boilerplate,
# and returns clean prose. Useful for keeping docs in sync with a public site
# without copy-pasting content.
loader = WebLoader("https://docs.example.com/api-reference")
web_docs = await loader.aload()
print(f"Web: {len(web_docs)} documents loaded")
# metadata = {'source': 'https://docs.example.com/api-reference'}
```

## Step 4: Load CSV files

```python
from synapsekit.loaders import CSVLoader

# CSVLoader converts each row into a Document whose page_content is a
# key=value string representation. This lets the LLM reason over tabular
# data without needing a SQL layer.
loader = CSVLoader("data/usage-stats.csv", content_columns=["feature", "description"])
csv_docs = await loader.aload()
print(f"CSV: {len(csv_docs)} rows loaded")
```

`content_columns` tells CSVLoader which columns to include in the text representation. Columns not listed are still available in `metadata` for filtering.

## Step 5: Load an entire directory

```python
from synapsekit.loaders import DirectoryLoader

# DirectoryLoader walks the directory recursively and dispatches each file
# to the correct loader based on extension. One call replaces five manual
# loader instantiations when your docs are organized in a folder.
loader = DirectoryLoader(
    "knowledge-base/",
    glob="**/*",                  # include all file types
    exclude=["**/*.pyc", "**/.DS_Store"],
)
dir_docs = await loader.aload()
print(f"Directory: {len(dir_docs)} documents loaded")
```

`DirectoryLoader` supports `glob` patterns for inclusion and `exclude` patterns to skip build artifacts or hidden files.

## Step 6: Merge all sources

```python
# Concatenating all document lists before splitting means the splitter sees
# every document with its original metadata intact. Splitting first and then
# merging would lose cross-document chunk_overlap context.
all_docs = pdf_docs + docx_docs + web_docs + csv_docs + dir_docs
print(f"Total documents before splitting: {len(all_docs)}")
```

## Step 7: Split and ingest

```python
from synapsekit.splitters import RecursiveCharacterTextSplitter
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.chroma import ChromaVectorStore

splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
chunks = splitter.split_documents(all_docs)
print(f"Total chunks after splitting: {len(chunks)}")

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = ChromaVectorStore(
    collection_name="unified-kb",
    embedding_function=embeddings,
    persist_directory="./chroma_db",
)
await vectorstore.aadd_documents(chunks)
print("Ingestion complete.")
```

## Step 8: Query across all formats

```python
from synapsekit import RAGPipeline
from synapsekit.llms.openai import OpenAILLM

rag = RAGPipeline(
    llm=OpenAILLM(model="gpt-4o-mini"),
    embeddings=embeddings,
    vectorstore=vectorstore,
)

answer, sources = await rag.aquery(
    "What features had the highest usage last quarter?",
    return_sources=True,
)

print("Answer:", answer)
print("\nSources used:")
for doc in sources:
    # 'source' is set by every loader so you always know the origin.
    print(f"  [{doc.metadata.get('source', 'unknown')}]")
```

## Complete working example

```python
import asyncio
from synapsekit import RAGPipeline
from synapsekit.loaders import PDFLoader, DocxLoader, WebLoader, CSVLoader, DirectoryLoader
from synapsekit.splitters import RecursiveCharacterTextSplitter
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.llms.openai import OpenAILLM
from synapsekit.vectorstores.chroma import ChromaVectorStore

async def load_all_sources():
    pdf_docs = await PDFLoader("docs/product-spec.pdf").aload()
    docx_docs = await DocxLoader("docs/meeting-notes.docx").aload()
    web_docs = await WebLoader("https://docs.example.com/api-reference").aload()
    csv_docs = await CSVLoader(
        "data/usage-stats.csv", content_columns=["feature", "description"]
    ).aload()
    dir_docs = await DirectoryLoader(
        "knowledge-base/", glob="**/*", exclude=["**/*.pyc"]
    ).aload()
    return pdf_docs + docx_docs + web_docs + csv_docs + dir_docs

async def main():
    all_docs = await load_all_sources()
    print(f"Loaded {len(all_docs)} documents total")

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_documents(all_docs)
    print(f"Split into {len(chunks)} chunks")

    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = ChromaVectorStore(
        collection_name="unified-kb",
        embedding_function=embeddings,
        persist_directory="./chroma_db",
    )
    await vectorstore.aadd_documents(chunks)

    rag = RAGPipeline(
        llm=OpenAILLM(model="gpt-4o-mini"),
        embeddings=embeddings,
        vectorstore=vectorstore,
    )

    answer, sources = await rag.aquery(
        "What features had the highest usage last quarter?",
        return_sources=True,
    )
    print("\nAnswer:", answer)
    print("\nSources:")
    for doc in sources:
        print(f"  - {doc.metadata.get('source', 'unknown')}")

asyncio.run(main())
```

## Expected output

```
Loaded 87 documents total
Split into 341 chunks
Answer: According to the usage statistics, the Dashboard and Export features
had the highest usage last quarter, with Dashboard recording 12,400 sessions
and Export 9,800 sessions.

Sources:
  - data/usage-stats.csv
  - docs/product-spec.pdf
  - https://docs.example.com/api-reference
```

## How it works

Every SynapseKit loader implements the same `BaseLoader` interface with an `aload()` coroutine that returns `List[Document]`. Format-specific parsing (pypdf for PDFs, python-docx for DOCX, httpx for web, csv stdlib for CSV) is handled inside each loader class. The `source` metadata key is set uniformly so downstream code never needs to know which loader produced a given chunk. `DirectoryLoader` maintains an internal registry that maps file extensions to loader classes, so adding a new format requires only registering a new mapping.

## Variations

| Variation | Change required |
|---|---|
| Load from S3 instead of local disk | Use `S3Loader` with `bucket` and `prefix` parameters |
| Load Notion pages | Use `NotionLoader` with a Notion integration token |
| Load GitHub repos | Use `GitHubLoader` with `repo` and `branch` parameters |
| Skip already-ingested files | Track ingested filenames in a SQLite table and filter before calling `aadd_documents` |
| Parallelise loading across sources | `asyncio.gather()` all `aload()` calls simultaneously |

## Troubleshooting

**`ModuleNotFoundError: No module named 'docx'`**
Run `pip install python-docx`. The package name differs from the import name.

**`WebLoader` returns empty content**
The target page may require JavaScript to render. Use `WebLoader(js_render=True)` which switches to a headless browser (requires `pip install playwright && playwright install chromium`).

**CSV rows appear as garbled text**
Check the file encoding. Pass `encoding="latin-1"` to `CSVLoader` if the file is not UTF-8.

**`DirectoryLoader` skips some files silently**
Unrecognised extensions are skipped by default. Pass `loader_mapping={".txt": TextLoader}` to handle additional types.

## Next steps

- [Choosing a Chunking Strategy](./chunking-strategies) — tune splitting for different content types
- [Metadata Filtering in Vector Search](./metadata-filtering) — query only from specific sources
- [Loaders reference](../../rag/loaders) — full list of available loaders and their options
