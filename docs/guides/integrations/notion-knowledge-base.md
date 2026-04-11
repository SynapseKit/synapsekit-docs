---
sidebar_position: 3
title: "Notion Knowledge Base with RAG"
description: "Index your Notion workspace with NotionLoader and build a RAG-powered Q&A system that answers questions from your team's documentation."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Notion Knowledge Base with RAG

<ColabBadge path="integrations/notion-knowledge-base.ipynb" />

Most team knowledge lives in Notion — specs, runbooks, meeting notes, onboarding docs. This guide turns your Notion workspace into a searchable knowledge base using SynapseKit's `NotionLoader` and RAG pipeline. Ask questions in natural language and get answers grounded in your actual documentation.

**What you'll build:** A RAG system that loads pages from a Notion database, chunks and indexes them, and answers questions with citations back to the source pages. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit[openai,notion]
export OPENAI_API_KEY=sk-...
export NOTION_TOKEN=secret_...   # Notion integration token from https://www.notion.so/my-integrations
```

You must also share each Notion page or database with your integration. In Notion, open the page → Share → Invite your integration.

## What you'll learn

- Authenticate and load pages from Notion using `NotionLoader`
- Convert Notion blocks to plain text for indexing
- Chunk documents and build a vector index with `RAG`
- Query the index and return answers with source citations
- Incrementally refresh the index as Notion pages are updated

## Step 1: Load pages from Notion

```python
import asyncio
from synapsekit.loaders import NotionLoader

# NotionLoader fetches pages from a Notion database or a list of page IDs.
# It converts all block types (paragraphs, headings, bullets, code, tables)
# to plain text, preserving hierarchy with indentation.
loader = NotionLoader(
    token="NOTION_TOKEN",        # Resolved from env var automatically
    # Option A: load an entire database
    database_id="your-database-id-here",
    # Option B: load specific pages
    # page_ids=["page-id-1", "page-id-2"],
)

async def load_docs():
    docs = await loader.aload()
    print(f"Loaded {len(docs)} documents from Notion")
    for doc in docs[:3]:
        print(f"  - {doc.metadata['title']} ({len(doc.content)} chars)")
    return docs
```

## Step 2: Index documents with RAG

```python
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM

# RAG handles chunking, embedding, and indexing automatically.
# chunk_size=512 tokens is a good starting point for prose documentation.
# overlap=64 preserves context at chunk boundaries.
rag = RAG(
    llm=OpenAILLM(model="gpt-4o-mini"),
    chunk_size=512,
    chunk_overlap=64,
    # By default uses an in-memory vector store — swap for a persistent one in production
)

async def build_index(docs):
    print("Building vector index...")
    await rag.aadd_documents(docs)
    print(f"Indexed {rag.document_count} chunks from {len(docs)} documents.")
```

## Step 3: Answer questions with citations

```python
async def ask(question: str) -> dict:
    """Query the knowledge base and return an answer with source citations."""

    result = await rag.aquery(question)

    # result.sources is a list of the most relevant chunks with metadata
    sources = [
        {
            "title":  chunk.metadata.get("title", "Untitled"),
            "url":    chunk.metadata.get("url", ""),
            "excerpt": chunk.content[:200],
        }
        for chunk in result.sources
    ]

    return {
        "question": question,
        "answer":   result.answer,
        "sources":  sources,
    }

def format_answer(result: dict):
    print(f"\nQ: {result['question']}")
    print(f"\nA: {result['answer']}")
    print(f"\nSources ({len(result['sources'])}):")
    for src in result["sources"]:
        print(f"  - {src['title']}")
        if src["url"]:
            print(f"    {src['url']}")
```

## Step 4: Incremental index refresh

```python
import asyncio
from datetime import datetime, timedelta

async def refresh_index(since: datetime | None = None):
    """Reload pages edited since `since` and update the index.

    Call this on a schedule (e.g. every 15 minutes) to keep the index fresh
    without a full re-index every time.
    """
    since = since or (datetime.utcnow() - timedelta(hours=1))

    # NotionLoader filters by last_edited_time when since is provided
    updated_docs = await loader.aload(edited_after=since)

    if not updated_docs:
        print(f"No Notion pages updated since {since.isoformat()}")
        return

    print(f"Refreshing {len(updated_docs)} updated pages...")
    # remove_by_source removes old chunks for the same page before re-adding
    for doc in updated_docs:
        await rag.aremove_source(doc.metadata["id"])
    await rag.aadd_documents(updated_docs)
    print("Index refreshed.")
```

## Complete working example

```python
import asyncio
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.loaders import NotionLoader

async def main():
    loader = NotionLoader(
        token="NOTION_TOKEN",
        database_id="your-database-id-here",
    )

    rag = RAG(
        llm=OpenAILLM(model="gpt-4o-mini"),
        chunk_size=512,
        chunk_overlap=64,
    )

    # Load and index
    print("Loading Notion workspace...")
    docs = await loader.aload()
    print(f"Loaded {len(docs)} pages.")

    print("Building index...")
    await rag.aadd_documents(docs)
    print(f"Indexed {rag.document_count} chunks.\n")

    # Interactive Q&A loop
    questions = [
        "What is our on-call rotation policy?",
        "How do I set up the development environment?",
        "What were the key decisions from last month's architecture review?",
    ]

    for question in questions:
        result = await rag.aquery(question)
        print(f"Q: {question}")
        print(f"A: {result.answer[:200]}...")
        print(f"   Sources: {', '.join(c.metadata.get('title','?') for c in result.sources[:2])}")
        print()

asyncio.run(main())
```

## Expected output

```
Loading Notion workspace...
Loaded 47 pages.
Building index...
Indexed 312 chunks.

Q: What is our on-call rotation policy?
A: The on-call rotation follows a weekly schedule. Each engineer is primary on-call for
   one week every six weeks. The secondary on-call is the engineer from the previous week...
   Sources: On-Call Runbook, Engineering Handbook

Q: How do I set up the development environment?
A: Clone the repository and run `./scripts/setup.sh`. This installs all dependencies
   via uv and configures the local environment variables from .env.example...
   Sources: Developer Setup Guide, README

Q: What were the key decisions from last month's architecture review?
A: The main decisions were: (1) migrate the auth service to use JWTs instead of session
   cookies, (2) adopt a hexagonal architecture pattern for new services...
   Sources: Architecture Review — March 2026, ADR-042
```

## How it works

`NotionLoader` uses the Notion API to fetch all blocks within each page, recursively expanding child blocks. It flattens them into a single `Document` object with `content` (plain text) and `metadata` (page title, URL, last edited time, and the Notion page ID).

`RAG.aadd_documents()` chunks each document with a sliding window tokenizer, calls the embedding model to produce a dense vector per chunk, and inserts all chunks into the vector store. `RAG.aquery()` embeds the question, retrieves the top-K most similar chunks, and passes them as context to the LLM with a citation-prompting template.

## Variations

**Use a persistent vector store (Chroma):**
```python
from synapsekit.vectorstores import ChromaVectorStore

rag = RAG(
    llm=OpenAILLM(model="gpt-4o-mini"),
    vector_store=ChromaVectorStore(path="./notion_index"),
)
```

**Filter by Notion database properties:**
```python
docs = await loader.aload(
    filter={"property": "Status", "select": {"equals": "Published"}}
)
```

**Multi-workspace support:**
```python
loaders = [
    NotionLoader(token="TOKEN_1", database_id="workspace-1-db"),
    NotionLoader(token="TOKEN_2", database_id="workspace-2-db"),
]
all_docs = []
for loader in loaders:
    all_docs.extend(await loader.aload())
await rag.aadd_documents(all_docs)
```

## Troubleshooting

**`APIResponseError: Could not find database`**
The integration must be explicitly shared with each database. Open the database in Notion → click `...` → Connections → add your integration.

**Answers reference outdated information**
The index is only as fresh as the last `aload()` call. Set up a periodic refresh using `loader.aload(edited_after=last_refresh_time)`.

**Chunks are too large and miss detail**
Reduce `chunk_size` to 256 for dense technical docs. Increase `top_k` in `rag.aquery(top_k=8)` to retrieve more candidates.

## Next steps

- [Slack Q&A Bot](./slack-qa-bot) — expose your Notion knowledge base as a Slack bot
- [YouTube Video Summarizer](./youtube-summarizer) — index video transcripts alongside Notion pages
- [LLM Provider Comparison](../llms/provider-comparison) — swap in a cheaper LLM for the Q&A step
