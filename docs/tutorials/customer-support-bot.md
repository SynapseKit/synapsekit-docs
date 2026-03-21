---
sidebar_position: 2
---

# Tutorial: Customer Support Bot

Build a production-ready customer support bot that answers questions from your product documentation.

**What you'll build:** A FastAPI-served bot that indexes product docs, remembers conversation history, filters unsafe inputs, and tracks cost per session.

**Time:** ~20 minutes
**Prerequisites:** `pip install synapsekit[openai,serve,chroma]`

## What you'll learn

- Load and chunk PDF documentation
- Build a RAG pipeline with ChromaDB
- Add persistent conversation memory
- Add content safety with guardrails
- Track cost per conversation
- Serve as a REST API with `synapsekit serve`

## Step 1: Set up the project

```bash
pip install synapsekit[openai,serve,chroma]
export OPENAI_API_KEY=sk-...
```

```python
# support_bot.py

import asyncio
from synapsekit import RAG, LLMConfig
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.chroma import ChromaVectorStore
from synapsekit.memory import SQLiteConversationMemory
from synapsekit.guardrails import Guardrails, ContentFilter, PIIDetector
from synapsekit import CostTracker, BudgetGuard, BudgetLimit

# Configure the LLM with caching and retries.
# Low temperature produces more deterministic, factual answers.
llm = OpenAILLM(
    model="gpt-4o-mini",
    config=LLMConfig(
        temperature=0.1,        # Low temperature for factual answers
        max_retries=3,          # Auto-retry on transient failures
        cache_backend="sqlite"  # Cache repeated queries to avoid duplicate spend
    )
)

# text-embedding-3-small is fast and cheap; upgrade to -large if quality is insufficient
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# ChromaDB persists the index to disk — the collection name is arbitrary
vector_store = ChromaVectorStore(embeddings, collection="support-docs")
```

## Step 2: Index your documentation

```python
from synapsekit.loaders import PDFLoader, DirectoryLoader
from synapsekit.text_splitters import RecursiveCharacterTextSplitter

# DirectoryLoader walks a directory and applies the given loader class to every match.
# glob="**/*.pdf" matches PDFs in any subdirectory.
loader = DirectoryLoader("./docs", glob="**/*.pdf", loader_cls=PDFLoader)
documents = loader.load()
print(f"Loaded {len(documents)} documents")
# Expected output: Loaded 47 documents

# RecursiveCharacterTextSplitter tries each separator in order until chunks fit.
# chunk_size=512 tokens is a good default for support docs.
# chunk_overlap=64 ensures adjacent chunks share context so answers don't get cut off.
splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,
    chunk_overlap=64,
    separators=["\n\n", "\n", ". ", " "]  # Try paragraph breaks first, then sentences
)
chunks = splitter.split_documents(documents)
print(f"Split into {len(chunks)} chunks")
# Expected output: Split into 312 chunks

# Build the RAG pipeline and index all chunks.
# k=5 means retrieve the 5 most relevant chunks per query.
rag = RAG(
    llm=llm,
    vector_store=vector_store,
    k=5,
)
await rag.aadd(chunks)
print("Indexing complete")
# Expected output: Indexing complete
```

## Step 3: Add conversation memory

```python
# SQLiteConversationMemory persists history to a local SQLite file.
# The bot will remember prior turns even after a process restart.
memory = SQLiteConversationMemory(
    db_path="./support_memory.db",
    max_messages=20,    # Keep the last 20 messages; older history is dropped
    session_id="default"
)

# Attach memory to the RAG pipeline.
# On each query, the last N messages are prepended to the prompt as context.
rag = RAG(
    llm=llm,
    vector_store=vector_store,
    memory=memory,
    k=5,
)
```

## Step 4: Add guardrails

```python
# Guardrails run before the query reaches the LLM.
# ContentFilter blocks messages that match any of the given patterns.
# PIIDetector finds personal information and either masks or blocks it.
guardrails = Guardrails([
    ContentFilter(
        blocked_patterns=["hack", "exploit", "bypass", "jailbreak"],
        max_length=2000,            # Reject unusually long inputs that may be prompt injections
    ),
    PIIDetector(
        detect=["email", "phone", "ssn", "credit_card"],
        action="mask"               # Replace PII with [REDACTED] instead of blocking the message
    ),
])

async def safe_query(user_input: str, session_id: str) -> str:
    # Run guardrails first; if they fail, return a safe message immediately.
    checked = guardrails.check(user_input)
    if not checked.passed:
        return f"I can't help with that: {checked.reason}"

    # Each session gets its own memory so conversations don't bleed into each other.
    memory = SQLiteConversationMemory(
        db_path="./support_memory.db",
        session_id=session_id,
        max_messages=20
    )
    rag_with_memory = RAG(llm=llm, vector_store=vector_store, memory=memory, k=5)

    # checked.text contains the sanitized input (PII already masked).
    return await rag_with_memory.aquery(checked.text)
```

## Step 5: Add cost tracking

```python
# CostTracker is a lightweight, thread-safe accumulator.
# It tracks token usage and converts it to USD using per-model pricing tables.
tracker = CostTracker()

# BudgetGuard raises BudgetExceededError if a limit is breached.
# per_request cap prevents a single runaway query from burning through budget.
# daily cap protects against abuse across many sessions.
guard = BudgetGuard(BudgetLimit(per_request=0.10, daily=5.00))

async def tracked_query(user_input: str, session_id: str) -> dict:
    # tracker.scope() groups costs under a named key — useful in tracker.summary().
    with tracker.scope(f"session:{session_id}"):
        # Raise BudgetExceededError early if the daily limit is already hit.
        guard.check_before(0)

        response = await safe_query(user_input, session_id)

        # Record actual token usage; cost_usd is computed from the model's pricing table.
        rec = tracker.record("gpt-4o-mini", input_tokens=500, output_tokens=200)

        # Raise BudgetExceededError if this individual request exceeded per_request.
        guard.check_after(rec.cost_usd)

    return {
        "response": response,
        "cost_usd": tracker.scope_cost(f"session:{session_id}"),
    }
```

## Step 6: Build the FastAPI app

```python
# app.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Support Bot", version="1.0")

# Pydantic models give automatic request validation and OpenAPI docs.
class QueryRequest(BaseModel):
    message: str
    session_id: str = "default"   # Callers can omit session_id for a shared conversation

class QueryResponse(BaseModel):
    response: str
    cost_usd: float

@app.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest):
    try:
        result = await tracked_query(req.message, req.session_id)
        return QueryResponse(**result)
    except Exception as e:
        # Surface errors as HTTP 500 so callers get a readable message.
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    # Lightweight liveness probe — useful for load balancers and Kubernetes.
    return {"status": "ok", "total_cost_usd": tracker.total_cost_usd}

@app.get("/cost-summary")
async def cost_summary():
    # Returns a breakdown of cost per session, per model, and total.
    return tracker.summary()
```

## Step 7: Serve and test

```bash
# synapsekit serve wraps uvicorn with sensible defaults.
# --reload restarts the server when source files change — great for development.
synapsekit serve app:app --port 8000 --reload

# Or launch directly with uvicorn for production
uvicorn app:app --port 8000 --workers 4
```

```bash
# Test a basic query
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I reset my password?", "session_id": "user-123"}'
# Expected response:
# {
#   "response": "To reset your password, go to Settings → Security → Reset Password...",
#   "cost_usd": 0.000042
# }

# Test multi-turn memory — the bot should remember the previous question
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"message": "Can I do the same thing on mobile?", "session_id": "user-123"}'
# Expected response (bot recalls the password reset context):
# {
#   "response": "Yes, on mobile you can reset your password by opening the app, tapping ...",
#   "cost_usd": 0.000038
# }

# Check live cost
curl http://localhost:8000/cost-summary
# Expected:
# {"total_usd": 0.000080, "by_session": {"session:user-123": 0.000080}, "by_model": {...}}
```

## Complete working example

This self-contained script demonstrates the full pipeline without needing a local PDF directory. Run it directly to verify your setup.

```python
# complete_bot.py — run this to see everything working together
import asyncio
from synapsekit import RAG, LLMConfig, CostTracker, BudgetGuard, BudgetLimit
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.inmemory import InMemoryVectorStore
from synapsekit.memory import SQLiteConversationMemory
from synapsekit.guardrails import Guardrails, ContentFilter, PIIDetector

async def main():
    # --- LLM + embeddings setup ---
    llm = OpenAILLM(
        model="gpt-4o-mini",
        config=LLMConfig(temperature=0.1, cache_backend="sqlite")
    )
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

    # InMemoryVectorStore is ideal for testing; no external service needed.
    store = InMemoryVectorStore(embeddings)

    # --- Cost tracking ---
    tracker = CostTracker()
    guard   = BudgetGuard(BudgetLimit(per_request=0.10, daily=5.00))

    # --- Guardrails ---
    guardrails = Guardrails([
        ContentFilter(blocked_patterns=["hack", "jailbreak"]),
        PIIDetector(detect=["email", "phone"], action="mask"),
    ])

    # --- Build RAG pipeline ---
    # For the demo we use an in-process SQLite file for memory.
    memory = SQLiteConversationMemory(db_path=":memory:", session_id="demo")
    rag = RAG(llm=llm, vector_store=store, memory=memory, k=3)

    # --- Index a few documents ---
    await rag.aadd([
        "To reset your password: go to Settings > Security > Reset Password.",
        "Billing questions: contact billing@acme.com or call 1-800-ACME.",
        "Refund policy: full refund within 30 days of purchase, no questions asked.",
        "Two-factor authentication can be enabled under Settings > Security > 2FA.",
        "To cancel your subscription, visit Account > Billing > Cancel Subscription.",
    ])
    print("Documents indexed.\n")
    # Expected output: Documents indexed.

    # --- Multi-turn conversation ---
    questions = [
        "How do I reset my password?",
        "What about billing issues?",
        "Can I get a refund?",
        "Is two-factor authentication available?",
    ]

    for q in questions:
        # Check guardrails before every query
        checked = guardrails.check(q)
        if not checked.passed:
            print(f"Q: {q}\nA: [blocked] {checked.reason}\n")
            continue

        with tracker.scope("conversation"):
            guard.check_before(0)
            answer = await rag.aquery(checked.text)
            rec = tracker.record("gpt-4o-mini", input_tokens=300, output_tokens=150)
            guard.check_after(rec.cost_usd)

        print(f"Q: {q}")
        print(f"A: {answer}\n")
        # Expected output per turn (example):
        # Q: How do I reset my password?
        # A: To reset your password, go to Settings > Security > Reset Password.

    # --- Print cost summary ---
    print("=" * 60)
    print("Cost summary:")
    print(tracker.summary())
    # Expected output:
    # Cost summary:
    # {'total_usd': 0.000120, 'by_scope': {'conversation': 0.000120}, 'by_model': {'gpt-4o-mini': 0.000120}}

asyncio.run(main())
```

## Troubleshooting

**`BudgetExceededError` on first query**
The daily limit resets at midnight UTC. Check `tracker.summary()` to see accumulated spend, or temporarily raise `BudgetLimit(daily=10.00)` during testing.

**Answers are off-topic or hallucinated**
Increase `k` (retrieve more chunks) or reduce `chunk_size` so individual chunks are more focused. Also verify your embeddings model matches the one used during indexing.

**Memory not persisting between runs**
Ensure `db_path` points to a writable file path (not `":memory:"`). The SQLite file must exist and be accessible on every restart.

## Next steps

- [How-to: Deploy to production](../how-to/production) — Docker, gunicorn, health checks
- [How-to: Handle errors and retries](../how-to/error-handling) — provider fallbacks
- [Cost tracker reference](../observability/cost-tracker) — full CostTracker API
- [Guardrails reference](../guardrails/overview) — all guardrail types
