---
sidebar_position: 8
title: "Metadata Filtering in Vector Search"
description: "Scope SynapseKit RAG queries to specific document sources, date ranges, or categories using the filter= parameter."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Metadata Filtering in Vector Search

<ColabBadge path="rag/metadata-filtering.ipynb" />

Without filtering, every query searches the entire vector store. When your knowledge base spans multiple products, departments, or time periods, an unfiltered search returns chunks from the wrong context — and the LLM has no way to know they are irrelevant. The `filter=` parameter on `aquery()` and `astream()` lets you scope retrieval to exactly the documents that matter for a given question. **What you'll build:** A knowledge base with documents from multiple sources and categories, queried with precise metadata filters. **Time:** ~10 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit chromadb
export OPENAI_API_KEY="sk-..."
```

## What you'll learn

- How to attach metadata to documents at ingestion time
- How to filter by a single field (`source`, `category`, `department`)
- How to combine multiple filter conditions with `$and` and `$or`
- How to filter by date range
- How metadata filtering interacts with similarity search

## Step 1: Ingest documents with rich metadata

```python
from synapsekit.schema import Document
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.chroma import ChromaVectorStore

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = ChromaVectorStore(
    collection_name="company-kb",
    embedding_function=embeddings,
    persist_directory="./chroma_db",
)

# Metadata is stored alongside the vector and does not affect similarity scores.
# Rich metadata at ingestion time is what makes filtering possible at query time —
# you cannot filter on fields you did not set when ingesting.
documents = [
    Document(
        page_content="Product Alpha supports single sign-on via SAML 2.0.",
        metadata={"source": "product-alpha-docs.pdf", "category": "security", "product": "alpha", "year": 2024},
    ),
    Document(
        page_content="Product Beta uses OAuth 2.0 for all API authentication.",
        metadata={"source": "product-beta-docs.pdf", "category": "security", "product": "beta", "year": 2024},
    ),
    Document(
        page_content="Product Alpha pricing starts at $49/month per user.",
        metadata={"source": "pricing-2024.pdf", "category": "pricing", "product": "alpha", "year": 2024},
    ),
    Document(
        page_content="Product Beta pricing starts at $99/month per user.",
        metadata={"source": "pricing-2024.pdf", "category": "pricing", "product": "beta", "year": 2024},
    ),
    Document(
        page_content="The 2023 security audit found no critical vulnerabilities in Product Alpha.",
        metadata={"source": "audit-2023.pdf", "category": "security", "product": "alpha", "year": 2023},
    ),
    Document(
        page_content="HR policy: all employees must complete security training annually.",
        metadata={"source": "hr-policy.pdf", "category": "hr", "department": "hr", "year": 2024},
    ),
]

await vectorstore.aadd_documents(documents)
print("Ingested 6 documents with metadata.")
```

## Step 2: Build the RAG pipeline

```python
from synapsekit import RAGPipeline
from synapsekit.llms.openai import OpenAILLM

rag = RAGPipeline(
    llm=OpenAILLM(model="gpt-4o-mini"),
    embeddings=embeddings,
    vectorstore=vectorstore,
)
```

## Step 3: Filter by a single field

```python
# Without a filter this query would return chunks from both products.
# Filtering on product="alpha" guarantees only Alpha-specific content is
# retrieved, preventing the LLM from mixing up the two products.
answer = await rag.aquery(
    "What authentication method is supported?",
    filter={"product": "alpha"},
)
print("Alpha only:", answer)

answer = await rag.aquery(
    "What authentication method is supported?",
    filter={"product": "beta"},
)
print("Beta only:", answer)
```

## Step 4: Filter by category

```python
# Scoping to category="pricing" prevents security documents from surfacing
# in a pricing question even if they contain relevant-sounding words.
answer = await rag.aquery(
    "How much does the product cost?",
    filter={"category": "pricing"},
)
print("Pricing answer:", answer)
```

## Step 5: Combine conditions with $and

```python
# $and requires ALL conditions to match. This narrows retrieval to
# exactly the Alpha security documents from 2024 — the current year only,
# not the older 2023 audit report.
answer = await rag.aquery(
    "Is the product secure?",
    filter={"$and": [{"product": "alpha"}, {"category": "security"}, {"year": 2024}]},
)
print("Alpha security 2024:", answer)
```

## Step 6: Combine conditions with $or

```python
# $or matches if ANY condition is true. Useful for queries that span
# multiple products when a user has access to more than one.
answer = await rag.aquery(
    "What are the authentication options?",
    filter={"$or": [{"product": "alpha"}, {"product": "beta"}]},
)
print("Both products:", answer)
```

## Step 7: Filter by date range

```python
# Numeric comparisons use $gte / $lte operators so you can scope queries
# to a time window. This is essential for "current year policy" questions
# where an old document would give a stale answer.
answer = await rag.aquery(
    "What does the security audit say?",
    filter={"year": {"$gte": 2024}},
)
print("2024+ only:", answer)
```

## Step 8: Combine filtering with streaming

```python
# filter= works identically on astream(). Streaming and filtering are
# independent features that compose naturally.
print("Streaming with filter: ", end="")
async for token in rag.astream(
    "Explain the authentication approach.",
    filter={"product": "beta"},
):
    print(token, end="", flush=True)
print()
```

## Complete working example

```python
import asyncio
from synapsekit import RAGPipeline
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.chroma import ChromaVectorStore
from synapsekit.schema import Document

async def main():
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = ChromaVectorStore(
        collection_name="company-kb",
        embedding_function=embeddings,
        persist_directory="./chroma_db",
    )

    documents = [
        Document(
            page_content="Product Alpha supports single sign-on via SAML 2.0.",
            metadata={"product": "alpha", "category": "security", "year": 2024},
        ),
        Document(
            page_content="Product Beta uses OAuth 2.0 for all API authentication.",
            metadata={"product": "beta", "category": "security", "year": 2024},
        ),
        Document(
            page_content="Product Alpha pricing starts at $49/month per user.",
            metadata={"product": "alpha", "category": "pricing", "year": 2024},
        ),
        Document(
            page_content="Product Beta pricing starts at $99/month per user.",
            metadata={"product": "beta", "category": "pricing", "year": 2024},
        ),
    ]
    await vectorstore.aadd_documents(documents)

    rag = RAGPipeline(
        llm=OpenAILLM(model="gpt-4o-mini"),
        embeddings=embeddings,
        vectorstore=vectorstore,
    )

    # Single-field filter
    answer = await rag.aquery(
        "What authentication method is used?",
        filter={"product": "alpha"},
    )
    print("Alpha auth:", answer)

    # Combined filter
    answer = await rag.aquery(
        "How much does it cost?",
        filter={"$and": [{"product": "beta"}, {"category": "pricing"}]},
    )
    print("Beta pricing:", answer)

    # Date range filter
    answer = await rag.aquery(
        "What is the current pricing?",
        filter={"year": {"$gte": 2024}},
    )
    print("2024+ pricing:", answer)

asyncio.run(main())
```

## Expected output

```
Alpha auth: Product Alpha supports single sign-on via SAML 2.0.

Beta pricing: Product Beta pricing starts at $99 per user per month.

2024+ pricing: Product Alpha is priced at $49 per user per month and Product
Beta at $99 per user per month, both as of 2024.
```

## How it works

Metadata filters are applied inside the vector store before the similarity ranking step. When `filter={"product": "alpha"}` is passed, the Chroma collection runs a pre-filter that excludes all vectors whose stored metadata does not match, then performs cosine similarity search over the remaining subset. This means `k=4` returns the four most similar chunks _from the filtered set_, not the four most similar overall. The filter is translated to Chroma's native `where` clause format automatically by `ChromaVectorStore`. Compound operators (`$and`, `$or`, `$gte`, `$lte`) are forwarded directly to Chroma's query language.

## Variations

| Variation | Change required |
|---|---|
| Filter by source filename | `filter={"source": "pricing-2024.pdf"}` |
| Filter by department | `filter={"department": "engineering"}` |
| Exclude a category | `filter={"category": {"$ne": "hr"}}` |
| Filter in streaming mode | Pass `filter=` to `astream()` — identical behaviour |
| Use with Pinecone | `PineconeVectorStore` supports the same filter syntax |

## Troubleshooting

**Filter returns no results**
The metadata key or value does not exist in the stored documents. Check what metadata was set at ingestion time with `vectorstore.aget_document(id)` or by inspecting your ingestion code.

**`$and` / `$or` operators not recognised**
Ensure you are on SynapseKit >= 1.4. Compound filter operators were added in that release.

**Filtering slows down queries significantly**
Pre-filtering reduces the candidate set before HNSW search, which can hurt performance if the filtered set is very small (< 100 documents). Consider using Pinecone or Weaviate for large-scale filtered search, as they handle metadata indexing more efficiently than Chroma at scale.

## Next steps

- [Hybrid BM25 + Vector Search](./hybrid-bm25-vector) — combine keyword and semantic search within a filtered scope
- [Build a PDF Knowledge Base](./pdf-knowledge-base) — set up a Chroma collection to filter against
- [VectorStore reference](../../rag/vector-stores) — full filter operator documentation
