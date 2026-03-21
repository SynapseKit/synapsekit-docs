---
sidebar_position: 2
---

# Error Reference

Every exception SynapseKit can raise, with causes and fixes.

## BudgetExceededError

**Module:** `synapsekit.observability.budget_guard`
**When raised:** `BudgetGuard.check_before()` or `check_after()` is called when a budget limit has been hit.

```python
from synapsekit import BudgetGuard, BudgetLimit, BudgetExceededError

guard = BudgetGuard(BudgetLimit(per_request=0.01))

try:
    guard.check_before(0.05)  # 5 cents > 1 cent limit
except BudgetExceededError as e:
    print(f"Budget exceeded: {e}")
    # Expected output: Budget exceeded: per_request limit of $0.01 exceeded
```

**Fix:** Increase the limit, reduce token usage, or catch and handle the error gracefully.

```python
# Graceful fallback
try:
    result = await agent.run(query)
except BudgetExceededError:
    result = "I'm unable to process this request due to cost constraints. Please try a shorter query."
```

**Circuit breaker:** After `BudgetExceededError` is raised, `BudgetGuard` enters a tripped state and will continue raising the error on subsequent calls until you reset it:

```python
guard.reset()  # Manually reset the circuit breaker
```

See [Observability — Cost Tracker](../observability/cost-tracker) for full configuration.

---

## GraphInterrupt

**Module:** `synapsekit.graph`
**When raised:** A node calls `raise GraphInterrupt(payload)` to pause execution for human input.

```python
from synapsekit.graph import GraphInterrupt

# Inside a graph node
async def review_node(state: dict) -> dict:
    if state["confidence"] < 0.8:
        raise GraphInterrupt({"reason": "low confidence", "content": state["draft"]})
    return state

# Catching and resuming
try:
    result = await graph.run(initial_state)
except GraphInterrupt as e:
    human_decision = input(f"Review needed: {e.payload}\nApprove? (y/n): ")
    result = await graph.resume(updates={"approved": human_decision == "y"})
```

**payload:** Any JSON-serialisable value. Accessible via `e.payload`.

See [Graph — Checkpointing](../graph/checkpointing) for human-in-the-loop patterns.

---

## ImportError for Optional Dependencies

**When raised:** You import a module that requires an optional extra that is not installed.

```
ImportError: ChromaDB is not installed. Run: pip install synapsekit[chroma]
```

**Fix:** Install the required extra shown in the error message.

| Extra | Installs | Use case |
|---|---|---|
| `synapsekit[chroma]` | chromadb | ChromaVectorStore |
| `synapsekit[qdrant]` | qdrant-client | QdrantVectorStore |
| `synapsekit[weaviate]` | weaviate-client | WeaviateVectorStore |
| `synapsekit[pinecone]` | pinecone-client | PineconeVectorStore |
| `synapsekit[redis]` | redis | RedisConversationMemory, RedisCheckpointer, RedisLLMCache |
| `synapsekit[postgres]` | asyncpg | PostgresCheckpointer |
| `synapsekit[serve]` | fastapi, uvicorn | `synapsekit serve` CLI |
| `synapsekit[openai]` | openai | OpenAILLM, OpenAIEmbeddings |
| `synapsekit[anthropic]` | anthropic | AnthropicLLM |
| `synapsekit[cohere]` | cohere | CohereLLM, CohereEmbeddings |
| `synapsekit[mistral]` | mistralai | MistralLLM |
| `synapsekit[groq]` | groq | GroqLLM |
| `synapsekit[bedrock]` | boto3 | BedrockLLM |
| `synapsekit[vertexai]` | google-cloud-aiplatform | VertexAILLM |
| `synapsekit[all]` | everything | Full install |

```bash
pip install "synapsekit[chroma,redis,serve]"
```

---

## KeyError from PluginRegistry

**When raised:** `PluginRegistry.load("name")` is called but no plugin with that name is registered.

```python
from synapsekit import PluginRegistry

registry = PluginRegistry()
try:
    registry.load("nonexistent-plugin")
except KeyError as e:
    print(f"Plugin not found: {e}")
    # List installed plugins
    for plugin in registry.discover():
        print(f"  - {plugin.name}")
```

**Fix:** Check `registry.discover()` to see what plugins are installed, or install the plugin package.

```bash
pip install synapsekit-plugin-<name>
```

See [Plugins](../plugins) for authoring your own plugin.

---

## ValueError from synapsekit serve

**When raised:** `synapsekit serve module:attribute` cannot import the specified object.

```
ValueError: Invalid import path 'myapp'. Expected format: 'module:attribute'
```

**Fix:** Use `module:attribute` format.

```bash
# Correct
synapsekit serve myapp:rag
synapsekit serve myapp.agents:research_agent

# Wrong — missing attribute
synapsekit serve myapp
```

Also raised if the attribute does not exist in the module:

```
ValueError: Object 'rag' not found in module 'myapp'
```

**Fix:** Verify the attribute name is exported at the top level of the module.

---

## FileNotFoundError from Loaders

**When raised:** A document loader is called with a path that does not exist.

```python
from synapsekit.rag.loaders import PDFLoader

try:
    loader = PDFLoader("/tmp/missing.pdf")
    docs = loader.load()
except FileNotFoundError as e:
    print(f"File not found: {e}")
```

**Fix:** Verify the path before loading.

```python
from pathlib import Path

path = Path("/tmp/missing.pdf")
if not path.exists():
    raise FileNotFoundError(f"Document not found: {path}")
docs = PDFLoader(str(path)).load()
```

---

## RateLimitError / APIError

These come from provider SDKs (openai, anthropic, etc.). SynapseKit wraps them and auto-retries using exponential backoff when configured with `LLMConfig(max_retries=N)`.

| Error | Provider | Auto-retried |
|---|---|---|
| `RateLimitError` | openai, anthropic | Yes |
| `APIConnectionError` | openai | Yes |
| `ServiceUnavailableError` | anthropic | Yes |
| `AuthenticationError` | Any | No — fix your API key |
| `ContextWindowExceededError` | Any | No — reduce input size |
| `ContentPolicyViolationError` | OpenAI | No — change the prompt |

```python
from synapsekit.llms.openai import OpenAILLM
from synapsekit.llms.config import LLMConfig

llm = OpenAILLM(
    model="gpt-4o-mini",
    config=LLMConfig(
        max_retries=5,
        requests_per_minute=60,
    )
)
```

When all retries are exhausted, the original provider error is re-raised.

---

## ContextWindowExceededError

**When raised:** The combined prompt + completion exceeds the model's context window.

```
ContextWindowExceededError: Request exceeds model context window of 128000 tokens (got 145000)
```

**Fixes:**

1. Reduce the number of retrieved chunks: `retriever = store.as_retriever(k=3)`
2. Shrink chunk size: `splitter = RecursiveCharacterSplitter(chunk_size=512)`
3. Use a model with a larger context window (e.g. `gpt-4o` with 128k, `claude-3-5-sonnet` with 200k)
4. Summarise conversation history before it grows too large

---

## AuthenticationError

**When raised:** The provider rejects the API key as invalid or expired.

```
AuthenticationError: Invalid API key provided. Check that OPENAI_API_KEY is correct.
```

**Fix:**

```bash
# Verify the key is set
echo $OPENAI_API_KEY

# Verify the key works
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

---

## TimeoutError

**When raised:** An LLM call does not respond within the configured timeout.

```python
from synapsekit.llms.config import LLMConfig

llm = OpenAILLM(
    model="gpt-4o",
    config=LLMConfig(timeout=30.0)  # seconds
)
```

**Fix:** Increase the timeout, use a faster model, or reduce max_tokens.

---

## EvalAssertionError

**Module:** `synapsekit.evaluation`
**When raised:** An `@eval_case` decorated test fails because the score is below the threshold.

```python
from synapsekit.evaluation import eval_case

@eval_case(metric="faithfulness", threshold=0.8)
async def test_my_rag():
    result = await rag.run("What is SynapseKit?")
    return result

# AssertionError: faithfulness score 0.62 < threshold 0.80
```

**Fix:** Review the failing case, check that the retriever is returning relevant chunks, or lower the threshold if appropriate.

---

## CheckpointNotFoundError

**Module:** `synapsekit.graph.checkpointing`
**When raised:** `graph.resume(thread_id="...")` is called for a thread ID that has no saved checkpoint.

```python
try:
    result = await graph.resume(thread_id="unknown-thread")
except CheckpointNotFoundError as e:
    print(f"No checkpoint found for thread: {e.thread_id}")
    # Start a fresh run instead
    result = await graph.run(initial_state, thread_id="unknown-thread")
```

**Fix:** Ensure the `thread_id` matches a previously interrupted run, and that the checkpointer backend (SQLite/Redis/Postgres) is reachable.
