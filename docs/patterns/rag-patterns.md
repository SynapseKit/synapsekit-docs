---
sidebar_position: 2
---

# RAG Patterns

20 copy-paste patterns for retrieval-augmented generation, from basic to advanced.

---

## 1. Basic RAG (3 lines)

The simplest possible RAG pipeline: load, index, query.

```python
from synapsekit.rag import RAGPipeline

rag = RAGPipeline.from_documents("docs/")
answer = await rag.run("What is SynapseKit?")
print(answer)
```

---

## 2. RAG with Streaming

Stream the answer token-by-token as the LLM generates it.

```python
from synapsekit.rag import RAGPipeline

rag = RAGPipeline.from_documents("docs/")

async for chunk in rag.stream("Explain the graph workflow system"):
    print(chunk, end="", flush=True)
```

---

## 3. RAG with Conversation Memory

Maintain multi-turn conversation history so follow-up questions work correctly.

```python
from synapsekit.rag import RAGPipeline
from synapsekit.memory import ConversationMemory

memory = ConversationMemory()
rag = RAGPipeline.from_documents("docs/", memory=memory)

answer1 = await rag.run("What is SynapseKit?")
answer2 = await rag.run("What are its main features?")  # uses history from answer1
answer3 = await rag.run("How does it compare to LangChain?")
```

---

## 4. Multi-Document RAG with Metadata Filters

Index documents from multiple sources and filter by metadata at query time.

```python
from synapsekit.rag.loaders import PDFLoader, MarkdownLoader
from synapsekit.rag import RAGPipeline
from synapsekit.rag.vector_stores import ChromaVectorStore

store = ChromaVectorStore(collection_name="my-docs")

# Index with metadata
pdf_docs = PDFLoader("reports/").load()
for doc in pdf_docs:
    doc.metadata["source"] = "report"

md_docs = MarkdownLoader("wiki/").load()
for doc in md_docs:
    doc.metadata["source"] = "wiki"

store.add(pdf_docs + md_docs)

rag = RAGPipeline(store=store)

# Query only the wiki docs
answer = await rag.run(
    "How do I configure Redis?",
    filter={"source": "wiki"},
)
```

---

## 5. RAG with BM25 Reranking

Combine dense vector search with sparse BM25 to boost exact keyword matches, then rerank results.

```python
from synapsekit.rag import RAGPipeline
from synapsekit.rag.retrievers import HybridRetriever
from synapsekit.rag.vector_stores import ChromaVectorStore

store = ChromaVectorStore.from_documents("docs/")
retriever = HybridRetriever(store=store, k=10, bm25_weight=0.3)
rag = RAGPipeline(retriever=retriever)

answer = await rag.run("What is the default OLLAMA_BASE_URL?")
```

---

## 6. RAG with MMR Diversity

Use Maximal Marginal Relevance to retrieve a diverse set of chunks, reducing redundancy.

```python
from synapsekit.rag import RAGPipeline
from synapsekit.rag.vector_stores import ChromaVectorStore

store = ChromaVectorStore.from_documents("docs/")
retriever = store.as_retriever(
    strategy="mmr",
    k=6,
    lambda_mult=0.5,  # 0 = max diversity, 1 = max relevance
)
rag = RAGPipeline(retriever=retriever)

answer = await rag.run("Describe all the available vector stores")
```

---

## 7. RAG Fusion (Multi-Query + RRF)

Generate multiple query variations and fuse the results with Reciprocal Rank Fusion for better recall.

```python
from synapsekit.rag import RAGPipeline
from synapsekit.rag.retrievers import RAGFusionRetriever
from synapsekit.rag.vector_stores import ChromaVectorStore
from synapsekit.llms.openai import OpenAILLM

store = ChromaVectorStore.from_documents("docs/")
llm = OpenAILLM(model="gpt-4o-mini")

# Generates 4 query variants, retrieves for each, merges with RRF
retriever = RAGFusionRetriever(store=store, llm=llm, num_queries=4, k=6)
rag = RAGPipeline(retriever=retriever)

answer = await rag.run("How do I set up persistent memory?")
```

---

## 8. HyDE Retrieval

Hypothetical Document Embeddings: generate a fake answer first, then use it to retrieve real chunks.

```python
from synapsekit.rag import RAGPipeline
from synapsekit.rag.retrievers import HyDERetriever
from synapsekit.rag.vector_stores import ChromaVectorStore
from synapsekit.llms.openai import OpenAILLM

store = ChromaVectorStore.from_documents("docs/")
llm = OpenAILLM(model="gpt-4o-mini")

retriever = HyDERetriever(store=store, llm=llm, k=5)
rag = RAGPipeline(retriever=retriever)

answer = await rag.run("What's the fastest way to get started with agents?")
```

---

## 9. Self-RAG with Quality Grading

Grade each retrieved document for relevance before including it in the context, then grade the final answer for hallucinations.

```python
from synapsekit.rag import SelfRAGPipeline
from synapsekit.rag.vector_stores import ChromaVectorStore
from synapsekit.llms.openai import OpenAILLM

store = ChromaVectorStore.from_documents("docs/")
llm = OpenAILLM(model="gpt-4o")

rag = SelfRAGPipeline(
    store=store,
    llm=llm,
    relevance_threshold=0.7,
    hallucination_threshold=0.8,
    max_retries=2,
)

result = await rag.run("What is the difference between ReAct and FunctionCalling agents?")
print(result.answer)
print(f"Faithfulness: {result.faithfulness_score:.2f}")
```

---

## 10. Adaptive RAG (Route by Complexity)

Route simple questions to a fast/cheap model and complex questions to a more capable one.

```python
from synapsekit.rag import AdaptiveRAGPipeline
from synapsekit.rag.vector_stores import ChromaVectorStore
from synapsekit.llms.openai import OpenAILLM

store = ChromaVectorStore.from_documents("docs/")

rag = AdaptiveRAGPipeline(
    store=store,
    fast_llm=OpenAILLM(model="gpt-4o-mini"),
    strong_llm=OpenAILLM(model="gpt-4o"),
    complexity_threshold=0.6,   # questions scored above this go to strong_llm
)

answer = await rag.run("What is RAG?")                # → fast_llm
answer = await rag.run("Compare Self-RAG and RAG Fusion in detail")  # → strong_llm
```

---

## 11. Contextual RAG (Anthropic-Style)

Prepend a short context summary to each chunk before embedding, improving retrieval accuracy for long documents.

```python
from synapsekit.rag.loaders import PDFLoader
from synapsekit.rag.splitters import RecursiveCharacterSplitter
from synapsekit.rag import ContextualRAGPipeline
from synapsekit.rag.vector_stores import ChromaVectorStore
from synapsekit.llms.anthropic import AnthropicLLM

docs = PDFLoader("annual_report.pdf").load()
splitter = RecursiveCharacterSplitter(chunk_size=512, chunk_overlap=64)
chunks = splitter.split(docs)

llm = AnthropicLLM(model="claude-3-5-haiku-20241022")
store = ChromaVectorStore(collection_name="contextual-rag")

# Each chunk gets a generated context summary prepended before embedding
rag = ContextualRAGPipeline(store=store, llm=llm, chunks=chunks)
await rag.build_index()

answer = await rag.run("What were the key financial results?")
```

---

## 12. GraphRAG

Use an entity-relationship graph to answer questions that require connecting information across documents.

```python
from synapsekit.rag import GraphRAGPipeline
from synapsekit.rag.loaders import MarkdownLoader
from synapsekit.llms.openai import OpenAILLM

docs = MarkdownLoader("docs/").load()
llm = OpenAILLM(model="gpt-4o")

rag = GraphRAGPipeline(llm=llm)
await rag.build_index(docs)

# GraphRAG can answer multi-hop questions
answer = await rag.run("Which vector stores support metadata filters?")
```

---

## 13. RAG with Redis Caching

Cache both embeddings and LLM responses in Redis to reduce cost and latency on repeated queries.

```python
from synapsekit.llms.openai import OpenAILLM
from synapsekit.llms.embeddings import OpenAIEmbeddings
from synapsekit.llms.caching import RedisLLMCache
from synapsekit.rag import RAGPipeline
from synapsekit.rag.vector_stores import ChromaVectorStore

cache = RedisLLMCache(redis_url="redis://localhost:6379/0", ttl=3600)

embeddings = OpenAIEmbeddings(model="text-embedding-3-small", cache=cache)
llm = OpenAILLM(model="gpt-4o-mini", cache=cache)
store = ChromaVectorStore(embeddings=embeddings)
store.add_documents("docs/")

rag = RAGPipeline(store=store, llm=llm)
answer = await rag.run("What is SynapseKit?")  # first call hits API
answer = await rag.run("What is SynapseKit?")  # served from cache
```

---

## 14. RAG Evaluation (Faithfulness + Groundedness)

Measure your RAG pipeline quality automatically using an LLM judge.

```python
from synapsekit.evaluation import Evaluator, RAGEvalDataset
from synapsekit.llms.openai import OpenAILLM

dataset = RAGEvalDataset([
    {"question": "What is SynapseKit?", "ground_truth": "A Python library for building LLM applications."},
    {"question": "What vector stores are supported?", "ground_truth": "Chroma, Qdrant, Weaviate, Pinecone, FAISS."},
])

evaluator = Evaluator(
    pipeline=rag,
    judge_llm=OpenAILLM(model="gpt-4o"),
    metrics=["faithfulness", "answer_relevancy", "context_precision"],
)

results = await evaluator.evaluate(dataset)
print(f"Faithfulness:      {results.faithfulness:.2f}")
print(f"Answer Relevancy:  {results.answer_relevancy:.2f}")
print(f"Context Precision: {results.context_precision:.2f}")
```

---

## 15. Batch Indexing Large Document Sets

Index thousands of documents efficiently with batching and progress reporting.

```python
from synapsekit.rag.loaders import DirectoryLoader
from synapsekit.rag.splitters import RecursiveCharacterSplitter
from synapsekit.rag.vector_stores import ChromaVectorStore
import asyncio

loader = DirectoryLoader("large-corpus/", glob="**/*.pdf")
docs = loader.load()
print(f"Loaded {len(docs)} documents")

splitter = RecursiveCharacterSplitter(chunk_size=512, chunk_overlap=64)
chunks = splitter.split(docs)
print(f"Split into {len(chunks)} chunks")

store = ChromaVectorStore(collection_name="large-corpus")

# Index in batches of 500 to avoid rate limits
batch_size = 500
for i in range(0, len(chunks), batch_size):
    batch = chunks[i:i + batch_size]
    await store.add(batch)
    print(f"Indexed {min(i + batch_size, len(chunks))}/{len(chunks)} chunks")
```

---

## 16. Incremental Indexing

Add new documents to an existing vector store without re-indexing everything.

```python
from synapsekit.rag.loaders import PDFLoader
from synapsekit.rag.splitters import RecursiveCharacterSplitter
from synapsekit.rag.vector_stores import ChromaVectorStore

store = ChromaVectorStore(collection_name="my-docs")  # existing collection

new_docs = PDFLoader("new-reports/Q1-2026.pdf").load()
splitter = RecursiveCharacterSplitter(chunk_size=512, chunk_overlap=64)
new_chunks = splitter.split(new_docs)

# Deduplicate by source to avoid double-indexing
existing_sources = {m["source"] for m in store.get_all_metadata()}
unique_chunks = [c for c in new_chunks if c.metadata.get("source") not in existing_sources]

await store.add(unique_chunks)
print(f"Added {len(unique_chunks)} new chunks")
```

---

## 17. RAG with Guardrails

Apply input content filtering and PII redaction before every retrieval call.

```python
from synapsekit.rag import RAGPipeline
from synapsekit.guardrails import ContentFilter, PIIDetector, PIIAction, ContentPolicy
from synapsekit.rag.vector_stores import ChromaVectorStore

store = ChromaVectorStore.from_documents("docs/")
rag = RAGPipeline(store=store)

content_filter = ContentFilter(policy=ContentPolicy(block_hate_speech=True, block_violence=True))
pii_detector = PIIDetector(action=PIIAction.REDACT)

async def safe_rag(user_input: str) -> str:
    check = await content_filter.check(user_input)
    if check.blocked:
        return f"Request blocked: {check.reason}"
    clean_input = pii_detector.redact(user_input)
    return await rag.run(clean_input)

answer = await safe_rag("How do I configure Redis memory?")
```

---

## 18. RAG with Cost Tracking

Track and cap the cost of every retrieval query.

```python
from synapsekit.rag import RAGPipeline
from synapsekit.rag.vector_stores import ChromaVectorStore
from synapsekit.llms.openai import OpenAILLM
from synapsekit.observability import CostTracker
from synapsekit import BudgetGuard, BudgetLimit

tracker = CostTracker()
guard = BudgetGuard(BudgetLimit(per_request=0.05, per_day=10.00))

llm = OpenAILLM(model="gpt-4o-mini", cost_tracker=tracker, budget_guard=guard)
store = ChromaVectorStore.from_documents("docs/")
rag = RAGPipeline(store=store, llm=llm)

answer = await rag.run("What is SynapseKit?")

summary = tracker.summary()
print(f"Total cost so far: ${summary.total_cost_usd:.4f}")
print(f"Total tokens: {summary.total_tokens:,}")
```

---

## 19. Multi-Modal RAG (Images + Text)

Index documents that contain both text and images, then answer questions about either.

```python
from synapsekit.rag.loaders import PDFLoader
from synapsekit.rag import MultiModalRAGPipeline
from synapsekit.rag.vector_stores import ChromaVectorStore
from synapsekit.llms.openai import OpenAILLM
from synapsekit.llms.embeddings import OpenAIEmbeddings

# PDFLoader extracts both text chunks and image captions
docs = PDFLoader("technical-manual.pdf", extract_images=True).load()

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
store = ChromaVectorStore(embeddings=embeddings)
llm = OpenAILLM(model="gpt-4o")  # vision-capable model

rag = MultiModalRAGPipeline(store=store, llm=llm)
await rag.build_index(docs)

answer = await rag.run("What does Figure 3 show?")
print(answer)
```

---

## 20. RAG with PromptHub Versioned Prompts

Store your RAG prompt template in PromptHub so you can iterate on it without changing code.

```python
from synapsekit.rag import RAGPipeline
from synapsekit.rag.vector_stores import ChromaVectorStore
from synapsekit.rag.prompts import PromptHubRAGPrompt
from synapsekit.llms.openai import OpenAILLM

# Save your prompt once
from synapsekit.rag.prompt_hub import PromptHub

hub = PromptHub()
hub.save("rag-v1", """
You are a helpful assistant. Answer the question using ONLY the context below.
If you cannot answer from the context, say "I don't know."

Context:
{context}

Question: {question}
""")

# Use the versioned prompt in your pipeline
store = ChromaVectorStore.from_documents("docs/")
prompt = PromptHubRAGPrompt(hub=hub, name="rag-v1")
llm = OpenAILLM(model="gpt-4o-mini")

rag = RAGPipeline(store=store, llm=llm, prompt=prompt)
answer = await rag.run("How do I install SynapseKit?")
```
