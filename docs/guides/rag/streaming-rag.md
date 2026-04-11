---
sidebar_position: 6
title: "Streaming RAG Responses"
description: "Stream RAG answers token-by-token with SynapseKit's astream() and wire it into a FastAPI Server-Sent Events endpoint."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Streaming RAG Responses

<ColabBadge path="rag/streaming-rag.ipynb" />

Non-streaming RAG makes the user stare at a blank screen until the full answer is ready — which can be several seconds for long responses. Streaming displays each token as it is generated, turning a frustrating wait into a fast-feeling experience. SynapseKit's `astream()` makes this a one-line change from `aquery()`. **What you'll build:** A streaming RAG pipeline that prints tokens in real time, plus a FastAPI endpoint that streams answers via Server-Sent Events. **Time:** ~10 min. **Difficulty:** Beginner

## Prerequisites

```bash
pip install synapsekit fastapi uvicorn
export OPENAI_API_KEY="sk-..."
```

## What you'll learn

- How `astream()` differs from `aquery()` and when to use each
- How to print tokens to the terminal in real time
- How to wire streaming RAG into a FastAPI SSE endpoint
- Why retrieval still happens once before generation in streaming mode

## Step 1: Build a pipeline with sample documents

```python
import asyncio
from synapsekit import RAGPipeline
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore

rag = RAGPipeline(
    llm=OpenAILLM(model="gpt-4o-mini"),
    embeddings=OpenAIEmbeddings(model="text-embedding-3-small"),
    vectorstore=InMemoryVectorStore(),
)

docs = [
    "SynapseKit supports streaming via the astream() async generator method.",
    "Streaming lets the UI render partial output as soon as the first token arrives.",
    "The retrieval step happens once before generation; it is not streamed.",
    "FastAPI's StreamingResponse combined with SSE is the standard way to stream to browsers.",
]

await rag.aadd(docs)
```

## Step 2: Stream to the terminal

```python
# astream() returns an async generator that yields one token string at a time.
# flush=True ensures each token appears immediately rather than buffering in
# the terminal's stdout buffer.
print("Answer: ", end="")
async for token in rag.astream("How does SynapseKit handle streaming?"):
    print(token, end="", flush=True)
print()  # newline when the stream finishes
```

`astream()` takes the same arguments as `aquery()` — including `k` for the number of retrieved chunks. The only difference is the return type: a string vs. an async generator.

## Step 3: Measure time-to-first-token

```python
import time

# time-to-first-token (TTFT) is the user-perceived latency before anything
# appears on screen. Streaming reduces TTFT from total_generation_time to
# retrieval_time + first_token_time, which is typically 3-5x faster.
start = time.perf_counter()
first_token_time = None

async for token in rag.astream("What is time-to-first-token?"):
    if first_token_time is None:
        first_token_time = time.perf_counter() - start
        print(f"[TTFT: {first_token_time:.2f}s] ", end="")
    print(token, end="", flush=True)

print(f"\n[Total: {time.perf_counter() - start:.2f}s]")
```

## Step 4: Collect the full response while streaming

```python
# Sometimes you need both the streamed output for UX and the complete string
# for logging or post-processing. Accumulate tokens into a list and join.
tokens = []
async for token in rag.astream("What does astream() return?"):
    tokens.append(token)
    print(token, end="", flush=True)
print()

full_response = "".join(tokens)
print(f"\nFull response ({len(full_response)} chars): {full_response[:100]}...")
```

## Step 5: FastAPI SSE endpoint

```python
# Server-Sent Events (SSE) is the standard browser protocol for streaming
# text from a server. Each event is a newline-terminated "data: ..." line.
# StreamingResponse with media_type="text/event-stream" handles the HTTP framing.

from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

@app.get("/rag/stream")
async def stream_rag(question: str):
    async def event_generator():
        async for token in rag.astream(question):
            # SSE format: each message must start with "data: " and end with "\n\n"
            yield f"data: {token}\n\n"
        # Signal the client that the stream has ended.
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

Run with `uvicorn app:app --reload` and open `http://localhost:8000/rag/stream?question=How+does+streaming+work`.

## Step 6: JavaScript client for the SSE endpoint

```html
<!-- Paste into a browser console or an HTML file to test the SSE endpoint -->
<script>
const source = new EventSource(
  "http://localhost:8000/rag/stream?question=How+does+streaming+work"
);

source.onmessage = (event) => {
  if (event.data === "[DONE]") {
    source.close();
    return;
  }
  // Append each token to the DOM as it arrives.
  document.getElementById("answer").textContent += event.data;
};
</script>
<div id="answer"></div>
```

## Complete working example

```python
import asyncio
from synapsekit import RAGPipeline
from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore

rag = RAGPipeline(
    llm=OpenAILLM(model="gpt-4o-mini"),
    embeddings=OpenAIEmbeddings(model="text-embedding-3-small"),
    vectorstore=InMemoryVectorStore(),
)

async def main():
    await rag.aadd([
        "SynapseKit supports streaming via the astream() async generator method.",
        "Streaming lets the UI render partial output as soon as the first token arrives.",
        "The retrieval step happens once before generation; it is not streamed.",
        "FastAPI's StreamingResponse combined with SSE is the standard way to stream to browsers.",
    ])

    print("Streaming response:")
    print("-" * 40)
    tokens = []
    async for token in rag.astream("How does SynapseKit handle streaming?"):
        tokens.append(token)
        print(token, end="", flush=True)
    print()
    print("-" * 40)
    print(f"Total tokens received: {len(tokens)}")

asyncio.run(main())
```

## Expected output

```
Streaming response:
----------------------------------------
SynapseKit handles streaming through the astream() async generator method, which
yields one token at a time as soon as the language model produces it. The
retrieval step still happens once before generation begins, but each token of
the generated answer is yielded immediately rather than waiting for the complete
response.
----------------------------------------
Total tokens received: 47
```

## How it works

When `astream()` is called, `RAGPipeline` first performs the full retrieval pass synchronously — embedding the query, searching the vector store, and building the prompt. It then calls the LLM's streaming interface (`OpenAILLM` uses `AsyncOpenAI`'s `stream=True` parameter) and yields each chunk as it arrives from the API. The async generator protocol means the caller can process each token immediately without buffering the full response in memory, which matters for long answers.

## Variations

| Variation | Change required |
|---|---|
| Stream with source attribution | Yield sources as a final SSE event after `[DONE]` |
| Cancel mid-stream | Call `generator.aclose()` inside an `asyncio.CancelledError` handler |
| Stream to WebSocket | Replace `StreamingResponse` with FastAPI's `WebSocket.send_text()` |
| Add per-token latency logging | Record `time.perf_counter()` inside the `async for` loop |
| Use a different streaming LLM | Any SynapseKit LLM that supports streaming works identically |

## Troubleshooting

**Tokens arrive all at once instead of one-by-one**
Your terminal or HTTP layer is buffering output. In the terminal, ensure `flush=True` is passed to `print()`. In FastAPI, verify `media_type="text/event-stream"` is set on `StreamingResponse`.

**`TypeError: 'async_generator' object is not iterable`**
You used a regular `for` loop instead of `async for`. `astream()` returns an async generator that requires `async for` inside an async function.

**The stream stops mid-sentence**
The LLM hit its `max_tokens` limit. Pass `max_tokens=1024` (or higher) to `OpenAILLM()` to increase the generation budget.

## Next steps

- [RAG with Conversation Memory](./rag-with-memory) — add multi-turn memory to a streaming pipeline
- [RAG in 3 Lines](./quickstart-3-lines) — review the non-streaming baseline
- [RAGPipeline reference](../../rag/pipeline) — full `astream()` API documentation
