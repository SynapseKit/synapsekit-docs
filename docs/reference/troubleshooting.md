---
sidebar_position: 3
---

# Troubleshooting

Diagnosis steps and fixes for common SynapseKit symptoms, organized by what you observe.

---

## RAG returns irrelevant results

**Symptoms:** Answers are off-topic, contain hallucinations, or say "I don't know" when the document clearly has the answer.

**Diagnosis checklist:**

1. **Chunk size too large or too small.** Large chunks dilute the signal; small chunks lose context.

```python
# Start here: 512 tokens with 64-token overlap
from synapsekit.rag.splitters import RecursiveCharacterSplitter
splitter = RecursiveCharacterSplitter(chunk_size=512, chunk_overlap=64)
```

2. **k too small.** You may not be retrieving the relevant chunk at all.

```python
retriever = store.as_retriever(k=6)  # retrieve more, then rerank
```

3. **Wrong retrieval strategy.** Try hybrid (BM25 + vector) or MMR for diverse coverage.

```python
retriever = store.as_retriever(strategy="hybrid", k=6)
retriever = store.as_retriever(strategy="mmr", k=6, lambda_mult=0.5)
```

4. **Embedding model mismatch.** The embedding model used at index time must match query time.

```python
# Both must use the same model
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
store = ChromaVectorStore(embeddings=embeddings)
```

5. **Inspect what is actually retrieved:**

```python
docs = await retriever.retrieve("your query")
for doc in docs:
    print(doc.metadata, doc.content[:200])
```

---

## My agent is looping

**Symptoms:** The agent keeps calling tools in circles, exceeds `max_steps`, or never returns a final answer.

**Diagnosis checklist:**

1. **Set `max_steps`** to catch infinite loops early:

```python
agent = ReActAgent(llm=llm, tools=tools, max_steps=10)
```

2. **Inspect the thought process.** Add verbose logging to see each step:

```python
agent = ReActAgent(llm=llm, tools=tools, verbose=True)
```

3. **Temperature too high.** High temperature causes inconsistent action selection.

```python
from synapsekit.llms.config import LLMConfig
llm = OpenAILLM(model="gpt-4o", config=LLMConfig(temperature=0.0))
```

4. **Tool descriptions are ambiguous.** The LLM may not know when to stop using a tool. Make the stopping condition explicit in the tool description.

5. **Prompt missing a termination instruction.** Add a clear stopping condition:

```
When you have enough information to answer the question, stop using tools and return FINAL ANSWER: <answer>.
```

---

## Streaming is not working

**Symptoms:** `async for chunk in llm.stream(prompt)` hangs, returns all at once, or raises `RuntimeError: no running event loop`.

**Diagnosis checklist:**

1. **Running in a sync context.** Streaming requires an async context.

```python
# Wrong — sync context
for chunk in llm.stream("Hello"):  # AttributeError or hangs
    print(chunk)

# Correct — async context
async def main():
    async for chunk in llm.stream("Hello"):
        print(chunk, end="", flush=True)

import asyncio
asyncio.run(main())
```

2. **Jupyter notebooks.** Use `nest_asyncio` if you get `RuntimeError: This event loop is already running`.

```python
import nest_asyncio
nest_asyncio.apply()
```

3. **FastAPI / Starlette.** Use `StreamingResponse` with an async generator:

```python
from fastapi.responses import StreamingResponse

@app.get("/stream")
async def stream_endpoint(q: str):
    async def generate():
        async for chunk in llm.stream(q):
            yield chunk
    return StreamingResponse(generate(), media_type="text/plain")
```

4. **Provider does not support streaming.** Check the provider's docs. All OpenAI and Anthropic models support streaming; some smaller providers may not.

---

## ImportError for a backend

**Symptoms:** `ImportError: ChromaDB is not installed. Run: pip install synapsekit[chroma]`

**Fix:** Install the extra indicated in the error message.

```bash
pip install "synapsekit[chroma]"
pip install "synapsekit[redis]"
pip install "synapsekit[postgres]"
pip install "synapsekit[serve]"
pip install "synapsekit[all]"   # install everything
```

See [Error Reference — ImportError](./errors#importerror-for-optional-dependencies) for the full extras table.

---

## Graph checkpoint not saving

**Symptoms:** `graph.resume()` raises `CheckpointNotFoundError`, or state is lost between runs.

**Diagnosis checklist:**

1. **Checkpointer not attached.** You must pass a checkpointer at compile time.

```python
from synapsekit.graph.checkpointing import SQLiteCheckpointer

checkpointer = SQLiteCheckpointer(path="checkpoints.db")
graph = workflow.compile(checkpointer=checkpointer)
```

2. **Different `thread_id` between run and resume.** Both calls must use the same ID.

```python
thread_id = "my-conversation-1"
await graph.run(state, thread_id=thread_id)
await graph.resume(thread_id=thread_id, updates={...})
```

3. **Redis/Postgres not reachable.** Verify the `REDIS_URL` or `DATABASE_URL` environment variable is set and the service is running.

```bash
redis-cli -u $REDIS_URL ping  # should return PONG
psql $DATABASE_URL -c "SELECT 1"
```

4. **Checkpointer table not created.** For Postgres, run the schema migration:

```python
await PostgresCheckpointer.create_tables(DATABASE_URL)
```

---

## Rate limit exceeded

**Symptoms:** `RateLimitError: Rate limit reached for gpt-4o` after many requests.

**Fix:** Configure `LLMConfig` with a rate limiter and automatic retries.

```python
from synapsekit.llms.config import LLMConfig

llm = OpenAILLM(
    model="gpt-4o",
    config=LLMConfig(
        max_retries=5,
        requests_per_minute=60,    # stay under the limit
        tokens_per_minute=90_000,
    )
)
```

For batch workloads, add delays between calls:

```python
import asyncio

results = []
for chunk in batches:
    result = await llm.complete(chunk)
    results.append(result)
    await asyncio.sleep(1.0)  # 1 second between calls
```

---

## My eval cases always pass

**Symptoms:** `@eval_case` tests never fail even when the output is clearly wrong.

**Diagnosis checklist:**

1. **Threshold too low.** The default threshold may be 0.5 — raise it.

```python
@eval_case(metric="faithfulness", threshold=0.85)
async def test_rag():
    ...
```

2. **Wrong metric for the task.** Use `faithfulness` for RAG (does the answer match the context), `answer_relevancy` for Q&A, `groundedness` for factual claims.

3. **MockLLM grader.** If you are using `MockLLM` in tests, swap in a real LLM for the evaluation judge.

```python
from synapsekit.evaluation import Evaluator
evaluator = Evaluator(judge_llm=OpenAILLM(model="gpt-4o"))
```

4. **Empty or trivial outputs.** If the RAG returns "I don't know" every time, faithfulness is technically 1.0 (no hallucinations). Check `answer_relevancy` as well.

---

## synapsekit serve returns 500

**Symptoms:** All requests to the served endpoint return HTTP 500 Internal Server Error.

**Diagnosis checklist:**

1. **Import path is wrong.** Verify the `module:attribute` format.

```bash
# Check the object loads correctly in Python first
python -c "from myapp import rag; print(rag)"

# Then serve it
synapsekit serve myapp:rag
```

2. **Object is not an Agent, Pipeline, or Graph.** `synapsekit serve` only accepts these types. Pass a compatible object.

3. **Missing environment variables.** The server process inherits the shell environment. Ensure API keys are exported.

```bash
export OPENAI_API_KEY=sk-...
synapsekit serve myapp:rag
```

4. **Check the server logs.** Run with `--log-level debug` for the full traceback.

```bash
synapsekit serve myapp:rag --log-level debug
```

---

## Memory not persisting between runs

**Symptoms:** The agent starts fresh on every run and has no recall of previous conversations.

**Diagnosis checklist:**

1. **In-memory store.** The default `ConversationMemory` is in-process and lost on restart. Switch to a persistent backend.

```python
from synapsekit.memory import RedisConversationMemory, SQLiteConversationMemory

# Persists across restarts
memory = SQLiteConversationMemory(path="memory.db", session_id="user-123")
memory = RedisConversationMemory(redis_url="redis://localhost:6379/0", session_id="user-123")
```

2. **Different `session_id` each run.** The session ID must be the same to retrieve the same history.

```python
# Use a stable identifier — user ID, conversation ID, etc.
memory = SQLiteConversationMemory(path="memory.db", session_id="user-123")
```

3. **SQLite file path changes.** If you use a relative path, it resolves differently depending on your working directory. Use an absolute path.

```python
import os
memory = SQLiteConversationMemory(
    path=os.path.expanduser("~/.synapsekit/memory.db"),
    session_id="user-123"
)
```

---

## Function calling not working

**Symptoms:** Tools are never called, the agent always responds with plain text, or you get `NotImplementedError`.

**Supported providers:** Function calling is only available on providers that expose a tool-call API.

| Provider | Function calling |
|---|---|
| OpenAI (gpt-4o, gpt-4o-mini, gpt-3.5-turbo) | Yes |
| Anthropic (claude-3+) | Yes |
| Groq (llama-3, mixtral) | Yes |
| Mistral (mistral-large, mistral-medium) | Yes |
| Google Gemini (gemini-1.5+) | Yes |
| AWS Bedrock (Claude, Llama 3) | Yes |
| Ollama | Model-dependent |
| Cohere | Yes (command-r+) |
| DeepSeek | Yes (deepseek-chat) |

**Fix for unsupported models:** Use `ReActAgent` (text-based tool use via prompting) instead of `FunctionCallingAgent`.

```python
# FunctionCallingAgent requires native tool-call support
agent = FunctionCallingAgent(llm=OpenAILLM(model="gpt-4o"), tools=[...])

# ReActAgent works with any model via prompting
agent = ReActAgent(llm=OllamaLLM(model="llama3"), tools=[...])
```

---

## Embeddings are slow

**Symptoms:** Indexing or retrieval takes too long, especially in a loop.

**Diagnosis and fixes:**

1. **Enable embedding caching.** Re-embedding the same text repeatedly is wasteful.

```python
from synapsekit.llms.caching import RedisLLMCache

cache = RedisLLMCache(redis_url="redis://localhost:6379/0")
embeddings = OpenAIEmbeddings(model="text-embedding-3-small", cache=cache)
```

2. **Use batch embedding.** Embed many texts in one API call.

```python
texts = [doc.content for doc in documents]
vectors = await embeddings.embed_batch(texts)  # one API call
```

3. **Use a local embedding model for development.** Avoids network round-trips entirely.

```python
from synapsekit.llms.embeddings import SentenceTransformerEmbeddings
embeddings = SentenceTransformerEmbeddings(model="all-MiniLM-L6-v2")
```

4. **Parallelise large indexing jobs.**

```python
import asyncio

async def embed_all(texts: list[str]):
    tasks = [embeddings.embed(t) for t in texts]
    return await asyncio.gather(*tasks)
```

---

## BudgetExceededError immediately

**Symptoms:** Every call raises `BudgetExceededError` even for cheap requests, including the very first one.

**Diagnosis checklist:**

1. **Circuit breaker is tripped.** After any budget exceedance, the guard stays tripped until you reset it.

```python
guard.reset()  # reset the tripped circuit breaker
```

2. **Limit is too tight.** A `per_request` limit of `0.001` (0.1 cent) will fire even for short responses with gpt-4o.

```python
from synapsekit import BudgetLimit

# Realistic limits (2026 prices)
limit = BudgetLimit(
    per_request=0.05,    # 5 cents per call
    per_day=5.00,        # $5 / day
    per_month=50.00,     # $50 / month
)
```

3. **Cost estimate is using the wrong model pricing.** Ensure the model name passed to `BudgetGuard` matches the model you are actually using.

```python
guard = BudgetGuard(limit, model="gpt-4o-mini")  # uses gpt-4o-mini pricing
```

See [Observability — Cost Tracker](../observability/cost-tracker) for the full BudgetGuard reference.
