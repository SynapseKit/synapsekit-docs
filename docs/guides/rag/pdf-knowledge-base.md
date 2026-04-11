---
sidebar_position: 3
title: "Build a PDF Knowledge Base"
description: "Load a PDF, split it into chunks, embed with OpenAI, store in Chroma, and query with SynapseKit RAGPipeline."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Build a PDF Knowledge Base

<ColabBadge path="rag/pdf-knowledge-base.ipynb" />

Most real-world RAG applications start with PDF files — product manuals, research papers, legal contracts, financial reports. This guide walks through ingesting a PDF, splitting it intelligently, storing vectors in a persistent Chroma database, and querying the result. **What you'll build:** A knowledge base from a PDF that survives process restarts and answers natural-language questions. **Time:** ~15 min. **Difficulty:** Beginner

## Prerequisites

```bash
pip install synapsekit chromadb pypdf
export OPENAI_API_KEY="sk-..."
```

A sample PDF is used in the examples below. Replace the path with your own file.

## What you'll learn

- How to load a PDF with `PDFLoader`
- How `RecursiveCharacterTextSplitter` preserves paragraph boundaries
- How to persist vectors with `ChromaVectorStore` so they survive restarts
- How to attach metadata (page number, source filename) to every chunk
- How to query with source attribution

## Step 1: Load the PDF

```python
from synapsekit.loaders import PDFLoader

# PDFLoader preserves page numbers as metadata so you can cite sources later.
# Async loading avoids blocking the event loop on large files.
loader = PDFLoader("company-handbook.pdf")
documents = await loader.aload()

print(f"Loaded {len(documents)} pages")
print(documents[0].metadata)
# {'source': 'company-handbook.pdf', 'page': 1}
```

`PDFLoader` returns a list of `Document` objects — one per page. Each `Document` has `.page_content` (the text) and `.metadata` (a dict you can query against later).

## Step 2: Split pages into chunks

```python
from synapsekit.splitters import RecursiveCharacterTextSplitter

# chunk_size=1000 fits comfortably in the context window while staying large
# enough to preserve complete sentences and paragraph structure.
# chunk_overlap=200 ensures a sentence cut at a boundary still appears in full
# in at least one chunk, preventing information loss.
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
chunks = splitter.split_documents(documents)

print(f"Split into {len(chunks)} chunks")
print(chunks[0].page_content[:200])
```

`RecursiveCharacterTextSplitter` tries to split on paragraph breaks first, then sentences, then words — preserving as much semantic coherence as possible. Raw character splitting would break sentences mid-word, degrading retrieval quality.

## Step 3: Set up a persistent vector store

```python
from synapsekit.vectorstores.chroma import ChromaVectorStore
from synapsekit.embeddings.openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# persist_directory keeps the vectors on disk so you only pay for embedding once.
# Subsequent restarts load from disk in milliseconds rather than re-embedding.
vectorstore = ChromaVectorStore(
    collection_name="company-handbook",
    embedding_function=embeddings,
    persist_directory="./chroma_db",
)
```

Persisting to disk is the single most important change from the quickstart. Without persistence you re-embed every time the process restarts, which costs money and adds startup latency.

## Step 4: Embed and ingest chunks

```python
# Batched ingestion respects the OpenAI embedding API rate limit automatically.
await vectorstore.aadd_documents(chunks)
print("Ingestion complete.")
```

On first run this call sends your chunks to the OpenAI embeddings API and writes the resulting vectors to `./chroma_db`. On subsequent runs you skip this step entirely and load directly from disk.

## Step 5: Build the RAG pipeline

```python
from synapsekit import RAGPipeline
from synapsekit.llms.openai import OpenAILLM

rag = RAGPipeline(
    llm=OpenAILLM(model="gpt-4o-mini"),
    embeddings=embeddings,
    vectorstore=vectorstore,
)
```

The pipeline reuses the same `vectorstore` instance, so no data is copied. Swapping the LLM later (e.g., to `AnthropicLLM`) requires changing only one line here.

## Step 6: Query with source attribution

```python
# return_sources=True makes the pipeline return (answer, sources) instead of
# just the answer string, so you can show users where the answer came from.
answer, sources = await rag.aquery(
    "What is the company's remote work policy?",
    return_sources=True,
)

print("Answer:", answer)
print("\nSources:")
for doc in sources:
    print(f"  - {doc.metadata['source']}, page {doc.metadata['page']}")
```

## Step 7: Re-use an existing Chroma database

```python
# On subsequent runs, skip aadd_documents() and just point at the existing db.
# Chroma loads the index from disk without hitting the embeddings API.
existing_vectorstore = ChromaVectorStore(
    collection_name="company-handbook",
    embedding_function=embeddings,
    persist_directory="./chroma_db",
)

rag = RAGPipeline(
    llm=OpenAILLM(model="gpt-4o-mini"),
    embeddings=embeddings,
    vectorstore=existing_vectorstore,
)

answer = await rag.aquery("How many days of paid leave do employees get?")
print(answer)
```

## Complete working example

```python
import asyncio
from synapsekit import RAGPipeline
from synapsekit.loaders import PDFLoader
from synapsekit.splitters import RecursiveCharacterTextSplitter
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.llms.openai import OpenAILLM
from synapsekit.vectorstores.chroma import ChromaVectorStore

PERSIST_DIR = "./chroma_db"
PDF_PATH = "company-handbook.pdf"

async def ingest(vectorstore):
    loader = PDFLoader(PDF_PATH)
    documents = await loader.aload()

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_documents(documents)

    await vectorstore.aadd_documents(chunks)
    print(f"Ingested {len(chunks)} chunks from {len(documents)} pages.")

async def main():
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = ChromaVectorStore(
        collection_name="company-handbook",
        embedding_function=embeddings,
        persist_directory=PERSIST_DIR,
    )

    await ingest(vectorstore)

    rag = RAGPipeline(
        llm=OpenAILLM(model="gpt-4o-mini"),
        embeddings=embeddings,
        vectorstore=vectorstore,
    )

    answer, sources = await rag.aquery(
        "What is the company's remote work policy?",
        return_sources=True,
    )
    print("Answer:", answer)
    for doc in sources:
        print(f"  Source: {doc.metadata['source']}, page {doc.metadata['page']}")

asyncio.run(main())
```

## Expected output

```
Ingested 142 chunks from 38 pages.
Answer: Employees may work remotely up to three days per week, subject to
manager approval. Full-remote arrangements require VP sign-off and a six-month
performance review on file.
  Source: company-handbook.pdf, page 12
  Source: company-handbook.pdf, page 13
```

## How it works

`PDFLoader` uses `pypdf` under the hood to extract text page by page, attaching `source` and `page` keys to each `Document`'s metadata. `RecursiveCharacterTextSplitter` walks a priority list of separators (`\n\n`, `\n`, ` `, `""`) so it always tries the least-destructive split first. `ChromaVectorStore` wraps the Chroma client in SynapseKit's async interface and calls `collection.persist()` automatically after each `aadd_documents()`. At query time `return_sources=True` tells the pipeline to also return the raw `Document` objects that were injected into the prompt, giving you provenance without any extra work.

## Variations

| Variation | Change required |
|---|---|
| Use a local embedding model | Replace `OpenAIEmbeddings` with `OllamaEmbeddings` |
| Use Pinecone instead of Chroma | Replace `ChromaVectorStore` with `PineconeVectorStore` |
| Larger chunks for dense technical text | Increase `chunk_size` to 1500–2000 |
| Smaller chunks for precise Q&A | Decrease `chunk_size` to 300–500 |
| Add custom metadata | Extend `doc.metadata` after loading, before splitting |

## Troubleshooting

**`ModuleNotFoundError: No module named 'pypdf'`**
Run `pip install pypdf`. SynapseKit's PDF support uses pypdf as an optional dependency to keep the base install lean.

**`PdfReadError: EOF marker not found`**
The PDF is corrupted or password-protected. Try opening it in a PDF viewer first. For password-protected files pass `password="..."` to `PDFLoader`.

**Chunks contain garbled text or missing spaces**
PDF text extraction quality depends heavily on how the PDF was generated. Scanned PDFs need OCR preprocessing (e.g., with `pytesseract`) before loading.

**`InvalidDimensionException` from Chroma**
You changed the embedding model after the collection was created. Delete `./chroma_db` and re-ingest so all vectors share the same dimensionality.

## Next steps

- [Multi-Format Document Ingestion](./multi-format-ingestion) — add DOCX, web pages, and CSVs alongside PDFs
- [Choosing a Chunking Strategy](./chunking-strategies) — understand when to use a different splitter
- [Metadata Filtering in Vector Search](./metadata-filtering) — scope queries to specific pages or sections
