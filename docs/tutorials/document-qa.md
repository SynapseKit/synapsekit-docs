---
sidebar_position: 3
---

# Tutorial: Document Q&A System

Build a multi-format document Q&A system that can ingest PDFs, Word documents, web pages, and CSV files, then answer questions with streaming responses and evaluate answer quality automatically.

**What you'll build:** A document search system that supports hybrid retrieval (BM25 + vector), streams answers token-by-token, and measures faithfulness and groundedness.

**Time:** ~25 minutes
**Prerequisites:** `pip install synapsekit[openai,chroma,evaluation]`

## What you'll learn

- Load multiple document types (PDF, DOCX, web URL, CSV)
- Choose the right text splitter for your content
- Set up ChromaDB with on-disk persistence
- Perform hybrid search combining BM25 keyword and vector similarity
- Stream responses token-by-token
- Evaluate quality with FaithfulnessMetric and GroundednessMetric
- Cache embeddings to avoid re-embedding on restart

## Step 1: Install dependencies and configure the stack

```bash
pip install synapsekit[openai,chroma,evaluation]
export OPENAI_API_KEY=sk-...
```

```python
# document_qa.py

import asyncio
from synapsekit import RAG, LLMConfig
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.chroma import ChromaVectorStore

# Use gpt-4o-mini for answers — cheap and accurate enough for Q&A.
# cache_backend="sqlite" prevents re-computing answers for identical questions.
llm = OpenAILLM(
    model="gpt-4o-mini",
    config=LLMConfig(
        temperature=0.0,        # Zero temperature for fully deterministic answers
        max_tokens=1024,        # Cap answer length
        cache_backend="sqlite"
    )
)

# OpenAI text-embedding-3-small: 1536 dimensions, $0.00002/1k tokens.
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# persist_directory tells ChromaDB to write the index to disk.
# On restart the index is loaded instantly — no need to re-embed.
vector_store = ChromaVectorStore(
    embeddings,
    collection="documents",
    persist_directory="./chroma_db"
)
```

## Step 2: Load multiple document types

SynapseKit ships loaders for every common document format. Each returns a list of `Document` objects with `.page_content` and `.metadata`.

```python
from synapsekit.loaders import (
    PDFLoader,          # Extracts text from PDF pages
    DocxLoader,         # Extracts paragraphs from .docx files
    WebLoader,          # Fetches and cleans a web page
    CSVLoader,          # Treats each row as a document
    DirectoryLoader,    # Walks a directory and applies a loader to each match
)

async def load_all_documents():
    docs = []

    # --- PDFs ---
    # PDFLoader returns one Document per page.
    # metadata includes {"source": "path/to/file.pdf", "page": 3}
    pdf_loader = DirectoryLoader(
        "./data/pdfs",
        glob="**/*.pdf",
        loader_cls=PDFLoader
    )
    pdf_docs = pdf_loader.load()
    print(f"PDF documents loaded: {len(pdf_docs)}")
    # Expected output: PDF documents loaded: 84

    # --- Word documents ---
    # DocxLoader preserves heading structure in metadata.
    docx_loader = DirectoryLoader(
        "./data/docs",
        glob="**/*.docx",
        loader_cls=DocxLoader
    )
    docx_docs = docx_loader.load()
    print(f"DOCX documents loaded: {len(docx_docs)}")
    # Expected output: DOCX documents loaded: 12

    # --- Web pages ---
    # WebLoader fetches the URL, strips HTML, and returns cleaned markdown text.
    web_loader = WebLoader(
        urls=[
            "https://example.com/blog/getting-started",
            "https://example.com/docs/faq",
        ]
    )
    web_docs = web_loader.load()
    print(f"Web pages loaded: {len(web_docs)}")
    # Expected output: Web pages loaded: 2

    # --- CSV files ---
    # CSVLoader creates one Document per row.
    # content_columns specifies which columns to include in page_content.
    csv_loader = CSVLoader(
        file_path="./data/knowledge_base.csv",
        content_columns=["question", "answer"],  # Concatenated with newline
        metadata_columns=["category", "last_updated"]
    )
    csv_docs = csv_loader.load()
    print(f"CSV rows loaded: {len(csv_docs)}")
    # Expected output: CSV rows loaded: 230

    docs = pdf_docs + docx_docs + web_docs + csv_docs
    print(f"\nTotal documents: {len(docs)}")
    # Expected output: Total documents: 328
    return docs
```

## Step 3: Choose the right text splitter

Different content types benefit from different splitters. Use `RecursiveCharacterTextSplitter` as your default and switch to specialized splitters when structure matters.

```python
from synapsekit.text_splitters import (
    RecursiveCharacterTextSplitter,   # General purpose — good for prose
    MarkdownSplitter,                 # Splits on headings (#, ##, ###)
    TokenTextSplitter,                # Splits on token count, not character count
    SentenceWindowSplitter,           # Keeps adjacent sentences for context
)

def choose_splitter(docs):
    """Route each document to the best splitter based on its source type."""

    prose_docs    = [d for d in docs if not d.metadata.get("source", "").endswith(".md")]
    markdown_docs = [d for d in docs if d.metadata.get("source", "").endswith(".md")]

    # RecursiveCharacterTextSplitter: tries separator list in order.
    # chunk_size=512, chunk_overlap=64 is a reliable default.
    prose_splitter = RecursiveCharacterTextSplitter(
        chunk_size=512,
        chunk_overlap=64,
        separators=["\n\n", "\n", ". ", " ", ""]
    )

    # MarkdownSplitter preserves heading context — each chunk knows which section it came from.
    md_splitter = MarkdownSplitter(
        chunk_size=512,
        chunk_overlap=32,
        include_metadata=True   # Adds {"heading": "## Installation"} to each chunk
    )

    # TokenTextSplitter counts tokens instead of characters.
    # Use this when you need precise control over prompt length.
    token_splitter = TokenTextSplitter(
        chunk_size=256,         # 256 tokens ~ 192 words
        chunk_overlap=32,
        encoding_name="cl100k_base"  # Matches GPT-4 / text-embedding-3-*
    )

    prose_chunks    = prose_splitter.split_documents(prose_docs)
    markdown_chunks = md_splitter.split_documents(markdown_docs)

    all_chunks = prose_chunks + markdown_chunks
    print(f"Total chunks after splitting: {len(all_chunks)}")
    # Expected output: Total chunks after splitting: 1847
    return all_chunks
```

## Step 4: Index with embedding cache

```python
from synapsekit.embeddings import EmbeddingCache

# EmbeddingCache wraps any embeddings provider and stores results in SQLite.
# On the next run, already-embedded texts are returned from disk without an API call.
cached_embeddings = EmbeddingCache(
    embeddings=embeddings,
    cache_path="./embedding_cache.db"
)

# Use the cached embeddings in the vector store
cached_vector_store = ChromaVectorStore(
    cached_embeddings,
    collection="documents",
    persist_directory="./chroma_db"
)

async def index_documents(chunks):
    rag = RAG(llm=llm, vector_store=cached_vector_store, k=5)

    # aadd() embeds and stores all chunks.
    # Chunks already in the cache skip the embedding API call.
    await rag.aadd(chunks)
    print(f"Indexed {len(chunks)} chunks")
    # Expected output: Indexed 1847 chunks (cache saved ~$0.003 on re-runs)
    return rag
```

## Step 5: Set up hybrid search

Hybrid search combines BM25 (keyword matching) and vector similarity. BM25 catches exact term matches that vector search may miss; vector search handles paraphrases and synonyms.

```python
from synapsekit.retrievers import HybridRetriever, BM25Retriever, VectorRetriever

def build_hybrid_retriever(chunks, vector_store):
    # BM25Retriever builds an inverted index over the chunk texts.
    bm25 = BM25Retriever.from_documents(chunks, k=5)

    # VectorRetriever performs approximate nearest-neighbour search.
    vector = VectorRetriever(vector_store=vector_store, k=5)

    # HybridRetriever merges results using Reciprocal Rank Fusion (RRF).
    # alpha=0.5 weights keyword and vector equally.
    # Increase alpha (toward 1.0) to favour vector search for conceptual queries.
    # Decrease alpha (toward 0.0) to favour BM25 for exact-term queries.
    hybrid = HybridRetriever(
        retrievers=[bm25, vector],
        alpha=0.5,
        k=5   # Final number of chunks to pass to the LLM
    )
    return hybrid

# Attach the hybrid retriever to the RAG pipeline
rag_hybrid = RAG(
    llm=llm,
    retriever=build_hybrid_retriever(chunks, cached_vector_store),
)
```

## Step 6: Stream responses

Instead of waiting for the full answer, stream tokens to the terminal (or to your front-end) as they arrive.

```python
import sys

async def stream_query(rag, question: str):
    print(f"Q: {question}")
    print("A: ", end="", flush=True)

    # astream() yields text chunks as the LLM generates them.
    # Each chunk is a string of one or more tokens.
    async for chunk in rag.astream(question):
        print(chunk, end="", flush=True)   # Print without newline so tokens flow inline

    print("\n")   # Newline after the full answer

async def demo_streaming():
    questions = [
        "What is the refund policy?",
        "How do I enable two-factor authentication?",
        "Where can I find the API rate limits?",
    ]
    for q in questions:
        await stream_query(rag_hybrid, q)
        # Expected output (streamed character by character):
        # Q: What is the refund policy?
        # A: Our refund policy allows full refunds within 30 days of purchase...
```

## Step 7: Evaluate answer quality

After building the system, measure how well it actually performs. SynapseKit provides two metrics out of the box.

```python
from synapsekit.evaluation import Evaluator, FaithfulnessMetric, GroundednessMetric

# FaithfulnessMetric checks that every claim in the answer is supported by the retrieved context.
# GroundednessMetric checks that the answer doesn't contradict the source documents.
evaluator = Evaluator(
    metrics=[
        FaithfulnessMetric(threshold=0.8),    # Flag answers where < 80% of claims are grounded
        GroundednessMetric(threshold=0.75),    # Flag answers that contradict sources
    ],
    llm=llm   # Uses the same LLM as a judge
)

# A test set: question + the expected ideal answer (reference)
test_cases = [
    {
        "question":  "What is the refund policy?",
        "reference": "Full refund within 30 days of purchase.",
    },
    {
        "question":  "How do I contact billing?",
        "reference": "Email billing@acme.com or call 1-800-ACME.",
    },
    {
        "question":  "How do I enable 2FA?",
        "reference": "Go to Settings > Security > 2FA and follow the prompts.",
    },
]

async def run_evaluation():
    results = []
    for tc in test_cases:
        # Generate an answer using the full pipeline
        answer = await rag_hybrid.aquery(tc["question"])

        # Score the answer against the reference and the retrieved context
        score = await evaluator.ascore(
            question=tc["question"],
            answer=answer,
            reference=tc["reference"],
        )
        results.append(score)
        print(f"Q: {tc['question']}")
        print(f"A: {answer}")
        print(f"Faithfulness: {score.faithfulness:.2f}  Groundedness: {score.groundedness:.2f}\n")
        # Expected output:
        # Q: What is the refund policy?
        # A: Our refund policy provides a full refund within 30 days of purchase...
        # Faithfulness: 0.95  Groundedness: 0.91

    # Aggregate scores across the whole test set
    avg_faithfulness  = sum(r.faithfulness  for r in results) / len(results)
    avg_groundedness  = sum(r.groundedness  for r in results) / len(results)
    print(f"Average faithfulness:  {avg_faithfulness:.2f}")
    print(f"Average groundedness:  {avg_groundedness:.2f}")
    # Expected output:
    # Average faithfulness:  0.93
    # Average groundedness:  0.89
    return results
```

## Complete working example

Run this file end-to-end to verify your installation. It uses `InMemoryVectorStore` so no external services are needed beyond the OpenAI API.

```python
# complete_document_qa.py
import asyncio
import sys
from synapsekit import RAG, LLMConfig
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.inmemory import InMemoryVectorStore
from synapsekit.text_splitters import RecursiveCharacterTextSplitter
from synapsekit.retrievers import HybridRetriever, BM25Retriever, VectorRetriever
from synapsekit.evaluation import Evaluator, FaithfulnessMetric, GroundednessMetric

# Sample documents — replace with your actual content
SAMPLE_DOCS = [
    "Refund policy: customers may request a full refund within 30 days of purchase. No questions asked.",
    "Two-factor authentication: navigate to Settings > Security > 2FA. Scan the QR code with your authenticator app.",
    "Billing contact: email billing@acme.com or call 1-800-ACME Monday–Friday 9am–5pm EST.",
    "API rate limits: free tier 100 req/min, pro tier 1000 req/min, enterprise unlimited.",
    "Password reset: go to the login page, click 'Forgot password', enter your email. A reset link expires in 1 hour.",
    "Data export: account owners can export all data from Settings > Data > Export. CSV format only.",
    "Supported file types for upload: PDF, DOCX, XLSX, PNG, JPG, MP4 (max 500 MB).",
    "SLA: 99.9% uptime guaranteed for pro and enterprise plans. Credits issued for downtime exceeding threshold.",
]

async def main():
    llm = OpenAILLM(
        model="gpt-4o-mini",
        config=LLMConfig(temperature=0.0, cache_backend="sqlite")
    )
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    store      = InMemoryVectorStore(embeddings)

    # --- Split and index ---
    splitter = RecursiveCharacterTextSplitter(chunk_size=256, chunk_overlap=32)
    chunks   = splitter.split_texts(SAMPLE_DOCS)

    # Attach metadata to each chunk so we can trace answers back to sources
    from synapsekit.schema import Document
    doc_objects = [Document(page_content=c, metadata={"idx": i}) for i, c in enumerate(chunks)]

    # Build hybrid retriever
    bm25   = BM25Retriever.from_documents(doc_objects, k=3)
    vector = VectorRetriever(vector_store=store, k=3)
    hybrid = HybridRetriever(retrievers=[bm25, vector], alpha=0.5, k=4)

    # Index documents into the vector store
    await store.aadd_documents(doc_objects)

    rag = RAG(llm=llm, retriever=hybrid)

    # --- Streaming Q&A demo ---
    questions = [
        "What is the refund policy?",
        "How do I set up 2FA?",
        "What are the API rate limits for the pro plan?",
    ]

    print("=== Streaming Q&A Demo ===\n")
    for q in questions:
        print(f"Q: {q}")
        print("A: ", end="", flush=True)
        async for token in rag.astream(q):
            print(token, end="", flush=True)
        print("\n")

    # --- Evaluation ---
    print("=== Evaluation ===\n")
    evaluator = Evaluator(
        metrics=[FaithfulnessMetric(threshold=0.8), GroundednessMetric(threshold=0.75)],
        llm=llm
    )

    test_cases = [
        {"question": "What is the refund policy?",   "reference": "Full refund within 30 days of purchase."},
        {"question": "How do I contact billing?",    "reference": "Email billing@acme.com or call 1-800-ACME."},
        {"question": "What are the API rate limits?","reference": "Free tier 100 req/min, pro 1000 req/min."},
    ]

    for tc in test_cases:
        answer = await rag.aquery(tc["question"])
        score  = await evaluator.ascore(
            question=tc["question"],
            answer=answer,
            reference=tc["reference"]
        )
        print(f"Q:            {tc['question']}")
        print(f"A:            {answer}")
        print(f"Faithfulness: {score.faithfulness:.2f}  Groundedness: {score.groundedness:.2f}\n")
        # Expected output:
        # Q:            What is the refund policy?
        # A:            You can request a full refund within 30 days of purchase...
        # Faithfulness: 0.97  Groundedness: 0.94

asyncio.run(main())
```

## Troubleshooting

**Answers contain information not in the documents**
Lower `temperature` to `0.0` and increase `FaithfulnessMetric(threshold=0.9)` to catch hallucinations earlier. Consider adding a `system_prompt` that instructs the LLM to only use provided context.

**BM25 retriever returns irrelevant results on short queries**
Increase `alpha` toward `1.0` to weight vector search more heavily. BM25 works best on queries with 3+ distinct keywords.

**Embedding cache is not reducing API calls**
Verify that `cache_path` points to the same file across runs. Also confirm that chunk text is deterministic — if splitter output changes (e.g., because source files changed), cache keys will miss.

## Next steps

- [RAG pipeline reference](../rag/pipeline) — retrieval modes, custom prompts
- [Loaders reference](../rag/loaders) — all supported formats
- [Evaluation overview](../evaluation/overview) — all available metrics
- [Text splitters reference](../rag/splitter) — when to use each splitter
