---
sidebar_position: 5
title: "Choosing a Chunking Strategy"
description: "Compare RecursiveCharacterTextSplitter, MarkdownSplitter, TokenTextSplitter, and SentenceWindowSplitter to pick the best chunking approach for your RAG data."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Choosing a Chunking Strategy

<ColabBadge path="rag/chunking-strategies.ipynb" />

Chunking is the single most influential parameter in a RAG pipeline. Chunks that are too large dilute relevance; chunks that are too small lose context. The right splitter depends on how your source documents are structured. This guide benchmarks four splitters on three document types so you can make an informed choice. **What you'll build:** A side-by-side comparison of four chunking strategies on prose, Markdown, and token-sensitive content. **Time:** ~15 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit tiktoken
export OPENAI_API_KEY="sk-..."
```

## What you'll learn

- When to use `RecursiveCharacterTextSplitter` as the safe default
- Why `MarkdownSplitter` produces better chunks for documentation
- How `TokenTextSplitter` prevents context-window overflow for dense text
- How `SentenceWindowSplitter` improves precision for Q&A over long prose
- How to measure chunk quality empirically before committing to a strategy

## Step 1: Prepare sample documents

```python
# Three document types that represent common RAG inputs.
# Using fixed samples lets you compare splitters on identical input.

prose = """
Retrieval-augmented generation (RAG) is a technique that combines a retrieval
system with a generative language model. The retrieval system finds relevant
passages from a knowledge base, and the language model uses those passages as
context to generate an accurate, grounded answer.

The quality of a RAG system depends heavily on two factors: the quality of the
retrieved passages and the ability of the language model to synthesize them. If
retrieved passages are too short they lack context; if too long they introduce
noise that reduces answer quality.
""".strip()

markdown = """
# Introduction to RAG

Retrieval-augmented generation grounds LLM responses in external knowledge.

## How it works

1. The user submits a question.
2. The question is embedded into a vector.
3. The vector store returns the top-k most similar chunks.
4. Those chunks are injected into the LLM prompt as context.

## When to use RAG

Use RAG when your LLM needs access to information that post-dates its training
cutoff or that is too proprietary to include in fine-tuning data.

## Limitations

- Retrieval quality is bounded by chunk quality.
- Very long documents may require hierarchical retrieval strategies.
""".strip()

dense_technical = " ".join(["token"] * 2000)  # simulate a dense 2000-token document
```

## Step 2: RecursiveCharacterTextSplitter — the safe default

```python
from synapsekit.splitters import RecursiveCharacterTextSplitter

# RecursiveCharacterTextSplitter is the right first choice for any document
# type you haven't specifically optimised for. It tries paragraph breaks first,
# so it rarely cuts a sentence in half.
splitter = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=50)
chunks = splitter.split_text(prose)

print(f"RecursiveCharacter: {len(chunks)} chunks")
for i, c in enumerate(chunks):
    print(f"  Chunk {i}: {len(c)} chars — {c[:60]!r}...")
```

**Best for:** General prose, mixed-format documents, any document type when you are unsure which splitter to use.

## Step 3: MarkdownSplitter — structure-aware splitting

```python
from synapsekit.splitters import MarkdownSplitter

# MarkdownSplitter uses heading levels (##, ###) as natural boundaries.
# This keeps an entire section together rather than splitting mid-paragraph,
# which dramatically improves retrieval precision for documentation sites.
splitter = MarkdownSplitter(chunk_size=500)
chunks = splitter.split_text(markdown)

print(f"Markdown: {len(chunks)} chunks")
for i, c in enumerate(chunks):
    print(f"  Chunk {i}: {c[:80]!r}...")
```

**Best for:** Markdown documentation, README files, wikis — any content where headings define logical sections.

## Step 4: TokenTextSplitter — context-window safety

```python
from synapsekit.splitters import TokenTextSplitter

# TokenTextSplitter counts tokens using tiktoken rather than characters.
# Character count is a poor proxy for token count on technical text: code,
# URLs, and numbers tokenise very differently from prose. This splitter
# guarantees no chunk exceeds the token budget you set.
splitter = TokenTextSplitter(
    encoding_name="cl100k_base",  # same encoding as gpt-4o-mini
    chunk_size=256,               # tokens, not characters
    chunk_overlap=32,
)
chunks = splitter.split_text(dense_technical)

print(f"TokenText: {len(chunks)} chunks")
print(f"  Each chunk is at most 256 tokens — safe for any OpenAI model")
```

**Best for:** Code, URLs, dense technical documentation, any content where token count matters more than character count.

## Step 5: SentenceWindowSplitter — precision Q&A

```python
from synapsekit.splitters import SentenceWindowSplitter

# SentenceWindowSplitter stores one sentence per chunk for embedding but
# attaches a window of surrounding sentences as metadata. Retrieval uses the
# precise single-sentence embedding; the LLM receives the richer window.
# This technique improves recall without enlarging the embedding space.
splitter = SentenceWindowSplitter(window_size=3)
chunks = splitter.split_text(prose)

print(f"SentenceWindow: {len(chunks)} chunks")
for i, c in enumerate(chunks[:2]):
    print(f"  Chunk {i} (embed): {c.page_content!r}")
    print(f"  Chunk {i} (context window): {c.metadata['window']!r}")
    print()
```

**Best for:** Long-form prose, articles, transcripts — any content where a single sentence is meaningful but needs surrounding context to be answered correctly.

## Step 6: Measure chunk quality empirically

```python
from synapsekit import RAGPipeline
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore

test_question = "When should you use RAG instead of fine-tuning?"

async def evaluate_splitter(splitter, label):
    chunks = splitter.split_text(markdown)
    rag = RAGPipeline(
        llm=OpenAILLM(model="gpt-4o-mini"),
        embeddings=OpenAIEmbeddings(model="text-embedding-3-small"),
        vectorstore=InMemoryVectorStore(),
    )
    await rag.aadd([c if isinstance(c, str) else c.page_content for c in chunks])
    answer, sources = await rag.aquery(test_question, return_sources=True)
    # Fewer source chunks needed = better retrieval precision.
    print(f"\n[{label}]")
    print(f"  Chunks: {len(chunks)}, Sources used: {len(sources)}")
    print(f"  Answer: {answer[:120]}")

await evaluate_splitter(
    RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=50), "RecursiveCharacter"
)
await evaluate_splitter(
    MarkdownSplitter(chunk_size=500), "Markdown"
)
```

## Complete working example

```python
import asyncio
from synapsekit import RAGPipeline
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.splitters import (
    RecursiveCharacterTextSplitter,
    MarkdownSplitter,
    TokenTextSplitter,
    SentenceWindowSplitter,
)

MARKDOWN_DOC = """
# Introduction to RAG

Retrieval-augmented generation grounds LLM responses in external knowledge.

## How it works

1. The user submits a question.
2. The question is embedded into a vector.
3. The vector store returns the top-k most similar chunks.
4. Those chunks are injected into the LLM prompt as context.

## When to use RAG

Use RAG when your LLM needs access to information that post-dates its training
cutoff or that is too proprietary to include in fine-tuning data.
""".strip()

SPLITTERS = {
    "RecursiveCharacter": RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=50),
    "Markdown": MarkdownSplitter(chunk_size=500),
    "TokenText": TokenTextSplitter(encoding_name="cl100k_base", chunk_size=64, chunk_overlap=8),
    "SentenceWindow": SentenceWindowSplitter(window_size=2),
}

async def evaluate(name, splitter):
    raw_chunks = splitter.split_text(MARKDOWN_DOC)
    texts = [c if isinstance(c, str) else c.page_content for c in raw_chunks]

    rag = RAGPipeline(
        llm=OpenAILLM(model="gpt-4o-mini"),
        embeddings=OpenAIEmbeddings(model="text-embedding-3-small"),
        vectorstore=InMemoryVectorStore(),
    )
    await rag.aadd(texts)

    answer, sources = await rag.aquery(
        "When should you use RAG instead of fine-tuning?",
        return_sources=True,
    )
    print(f"\n{'='*50}")
    print(f"Splitter: {name} ({len(raw_chunks)} chunks)")
    print(f"Sources used: {len(sources)}")
    print(f"Answer: {answer[:200]}")

async def main():
    for name, splitter in SPLITTERS.items():
        await evaluate(name, splitter)

asyncio.run(main())
```

## Expected output

```
==================================================
Splitter: RecursiveCharacter (6 chunks)
Sources used: 2
Answer: Use RAG when your LLM needs access to information that post-dates its
training cutoff or that is too proprietary to include in fine-tuning data.

==================================================
Splitter: Markdown (3 chunks)
Sources used: 1
Answer: Use RAG when your LLM needs access to information that post-dates its
training cutoff or that is too proprietary to include in fine-tuning data.

==================================================
Splitter: TokenText (9 chunks)
Sources used: 3
Answer: RAG is appropriate when the information needed post-dates the model's
training or is too sensitive for fine-tuning.

==================================================
Splitter: SentenceWindow (8 chunks)
Sources used: 2
Answer: You should use RAG when your LLM needs access to information that
post-dates its training cutoff or that is too proprietary for fine-tuning.
```

## How it works

`RecursiveCharacterTextSplitter` walks a list of separator characters in priority order (`\n\n` → `\n` → ` ` → `""`), always choosing the least-destructive split that stays within `chunk_size`. `MarkdownSplitter` pre-processes the text to identify heading boundaries and treats each section as an atomic unit before applying character-based splitting as a fallback. `TokenTextSplitter` uses the tiktoken library to count tokens with the exact same BPE vocabulary as the target model, guaranteeing budget compliance. `SentenceWindowSplitter` runs a sentence boundary detection pass first (using punkt tokenization), then stores each sentence with a metadata `window` field containing the N surrounding sentences for LLM context.

## Variations

| Variation | Change required |
|---|---|
| HTML documentation | Use `HTMLTextSplitter` from `synapsekit.splitters` |
| Source code files | Use `CodeSplitter(language="python")` to split on function boundaries |
| Mixed document types | Use `RecursiveCharacterTextSplitter` as a safe fallback |
| Very large PDFs (1000+ pages) | Use `TokenTextSplitter` to guarantee no chunk overflows the embedding model limit |

## Troubleshooting

**`ModuleNotFoundError: No module named 'tiktoken'`**
Run `pip install tiktoken`. It is required only for `TokenTextSplitter`.

**Chunks are much larger than `chunk_size`**
`chunk_size` is a soft limit. If no separator is found within the budget, the splitter falls back to hard character splitting. You can override this with `length_function=len` and `keep_separator=False`.

**`SentenceWindowSplitter` produces too many tiny chunks**
Decrease `window_size` from 3 to 1 or switch to `RecursiveCharacterTextSplitter` if your documents have short sentences that do not benefit from windowing.

## Next steps

- [PDF Knowledge Base](./pdf-knowledge-base) — apply chunking to real PDF files
- [Hybrid BM25 + Vector Search](./hybrid-bm25-vector) — combine chunking with keyword search for better recall
- [Splitters reference](../../rag/splitter) — full API for all splitters
