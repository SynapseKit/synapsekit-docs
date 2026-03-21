---
sidebar_position: 2
---

# Streaming

SynapseKit supports streaming at every layer: token-level LLM output, RAG pipeline responses, graph node updates, Server-Sent Events (SSE), and WebSockets. This guide covers every pattern with complete runnable examples.

## Prerequisites

```bash
pip install synapsekit[openai] fastapi uvicorn
```

Set your API key:

```bash
export OPENAI_API_KEY="sk-..."
```

---

## 1. Token-level LLM streaming

The simplest streaming pattern: call `.stream()` on any LLM and iterate the async generator. Each yielded value is a string token (or small chunk) as it arrives from the API.

```python
import asyncio
from synapsekit.llms.openai import OpenAILLM

llm = OpenAILLM(model="gpt-4o-mini")

async def main():
    async for token in llm.stream("Tell me about RAG in three sentences"):
        print(token, end="", flush=True)
    print()  # newline after stream ends

asyncio.run(main())

# Expected output (streamed token-by-token):
# Retrieval-Augmented Generation (RAG) is a technique that combines a
# retrieval system with a language model to answer questions using
# external knowledge. It works by fetching relevant documents from a
# vector store and injecting them into the prompt context. RAG reduces
# hallucinations and keeps answers grounded in real data.
```

You can also collect the full response while streaming:

```python
async def stream_and_collect(prompt: str) -> str:
    """Stream tokens to stdout and return the full response."""
    tokens = []
    async for token in llm.stream(prompt):
        print(token, end="", flush=True)
        tokens.append(token)
    print()
    return "".join(tokens)

asyncio.run(stream_and_collect("What is a vector database?"))
```

### Streaming with system prompt

```python
async def main():
    async for token in llm.stream(
        "Summarize quantum computing",
        system="You are a science communicator. Be concise.",
    ):
        print(token, end="", flush=True)

asyncio.run(main())
# Expected output:
# Quantum computing uses quantum bits (qubits) that can exist in
# superposition, enabling parallel computation on certain problems...
```

---

## 2. RAG pipeline streaming

Pass `astream()` on a `RAG` instance to stream the LLM answer while the retrieval step completes synchronously before generation begins.

```python
import asyncio
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM

async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    rag = RAG(llm=llm)

    # Index some documents
    await rag.aadd([
        "SynapseKit supports streaming by default across all LLM providers.",
        "The RAG pipeline retrieves context before generating an answer.",
        "Streaming reduces time-to-first-token, improving perceived latency.",
    ])

    print("Answer: ", end="", flush=True)
    async for token in rag.astream("What does SynapseKit support?"):
        print(token, end="", flush=True)
    print()

asyncio.run(main())

# Expected output:
# Answer: SynapseKit supports streaming by default across all LLM
# providers, which reduces time-to-first-token and improves the
# perceived latency of your application.
```

---

## 3. Graph node-level streaming

`compiled_graph.stream()` yields one update dict per node execution. This lets you show incremental progress in multi-step workflows.

```python
import asyncio
from synapsekit.graph import StateGraph

async def fetch_data(state: dict) -> dict:
    # Simulate data fetching
    return {"data": "fetched_results", "step": "fetch"}

async def process_data(state: dict) -> dict:
    # Simulate processing
    return {"result": f"processed: {state['data']}", "step": "process"}

async def format_output(state: dict) -> dict:
    return {"output": state["result"].upper(), "step": "format"}

graph = StateGraph()
graph.add_node("fetch", fetch_data)
graph.add_node("process", process_data)
graph.add_node("format", format_output)
graph.add_edge("fetch", "process")
graph.add_edge("process", "format")
graph.set_entry_point("fetch")
compiled = graph.compile()

async def main():
    async for update in compiled.stream({"input": "hello"}):
        node_name = list(update.keys())[0]
        print(f"[{node_name}] -> {update[node_name]}")

asyncio.run(main())

# Expected output:
# [fetch] -> {'data': 'fetched_results', 'step': 'fetch'}
# [process] -> {'result': 'processed: fetched_results', 'step': 'process'}
# [format] -> {'output': 'PROCESSED: FETCHED_RESULTS', 'step': 'format'}
```

---

## 4. Token-level streaming from graph LLM nodes

Combine graph execution with token streaming using `stream_tokens`. This lets each LLM node in a graph stream its output token-by-token.

```python
import asyncio
from synapsekit.graph import StateGraph
from synapsekit.graph.nodes import llm_node, stream_tokens
from synapsekit.llms.openai import OpenAILLM

llm = OpenAILLM(model="gpt-4o-mini")

graph = StateGraph()
graph.add_node("generate", llm_node(llm, prompt_key="input"))
graph.set_entry_point("generate")
compiled = graph.compile()

async def main():
    print("Streaming tokens from graph: ", end="", flush=True)
    async for token in stream_tokens(compiled, {"input": "Explain RAG in one sentence"}):
        print(token, end="", flush=True)
    print()

asyncio.run(main())

# Expected output:
# Streaming tokens from graph: RAG (Retrieval-Augmented Generation)
# enhances LLM responses by first retrieving relevant documents from
# a knowledge base and injecting them into the prompt.
```

### Multi-node graph with token streaming

```python
graph2 = StateGraph()
graph2.add_node("research", llm_node(llm, prompt_key="topic", output_key="research"))
graph2.add_node("summarize", llm_node(llm, prompt_key="research", output_key="summary"))
graph2.add_edge("research", "summarize")
graph2.set_entry_point("research")
compiled2 = graph2.compile()

async def main():
    # stream_tokens emits tokens from the final LLM node by default
    async for token in stream_tokens(compiled2, {"topic": "vector databases"}):
        print(token, end="", flush=True)
    print()

asyncio.run(main())
```

---

## 5. SSE streaming with FastAPI

Server-Sent Events let browsers consume streaming responses over a standard HTTP connection. Use `sse_stream` to wrap any compiled graph.

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from synapsekit.graph import sse_stream

app = FastAPI()

# Build and compile your graph once at startup
graph = StateGraph()
# ... add nodes and edges ...
compiled_graph = graph.compile()

@app.get("/stream")
async def stream_endpoint(query: str):
    """Stream graph output as SSE events."""
    async def event_generator():
        async for event in sse_stream(compiled_graph, {"input": query}):
            # SSE format: each message must be "data: ...\n\n"
            yield f"data: {event}\n\n"
        # Signal end of stream
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
```

Run with:

```bash
uvicorn app:app --reload
# curl "http://localhost:8000/stream?query=What+is+RAG"
# Expected output (SSE format):
# data: Retrieval
# data: -Aug
# data: mented
# data: Generation
# data: [DONE]
```

### SSE with connection keep-alive

```python
import asyncio

@app.get("/stream/keepalive")
async def stream_keepalive(query: str):
    async def event_generator():
        async for event in sse_stream(compiled_graph, {"input": query}):
            yield f"data: {event}\n\n"
        yield "data: [DONE]\n\n"

    # Wrap in a keep-alive generator that sends comments every 15s
    async def with_keepalive(gen):
        keepalive_task = asyncio.create_task(asyncio.sleep(0))
        async for chunk in gen:
            yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )
```

---

## 6. WebSocket streaming

WebSockets provide full-duplex communication. Use `ws_stream` for token-by-token delivery over a WebSocket connection.

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from synapsekit.graph import ws_stream

app = FastAPI()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            query = await websocket.receive_text()
            async for token in ws_stream(compiled_graph, {"input": query}):
                await websocket.send_text(token)
            # Signal end of response
            await websocket.send_text("[DONE]")
    except WebSocketDisconnect:
        pass  # Client disconnected cleanly
```

### WebSocket with structured messages

```python
import json

@app.websocket("/ws/structured")
async def websocket_structured(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = json.loads(await websocket.receive_text())
            query = data["query"]
            session_id = data.get("session_id", "default")

            async for token in ws_stream(compiled_graph, {"input": query}):
                await websocket.send_text(json.dumps({
                    "type": "token",
                    "content": token,
                    "session_id": session_id,
                }))

            await websocket.send_text(json.dumps({
                "type": "done",
                "session_id": session_id,
            }))
    except WebSocketDisconnect:
        pass
```

---

## 7. Consuming SSE in JavaScript

```javascript
// Plain JavaScript EventSource
const source = new EventSource('/stream?query=What+is+RAG');
const output = document.getElementById('output');

source.onmessage = (event) => {
    if (event.data === '[DONE]') {
        source.close();
        return;
    }
    output.textContent += event.data;
};

source.onerror = (err) => {
    console.error('SSE error:', err);
    source.close();
};
```

### Using the Fetch API for POST requests (more flexible)

```javascript
async function streamPost(query) {
    const response = await fetch('/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const token = line.slice(6);
                if (token !== '[DONE]') {
                    document.getElementById('output').textContent += token;
                }
            }
        }
    }
}

streamPost("Explain vector databases");
```

### WebSocket client

```javascript
const ws = new WebSocket('ws://localhost:8000/ws');

ws.onopen = () => {
    ws.send('What is RAG?');
};

ws.onmessage = (event) => {
    if (event.data === '[DONE]') {
        console.log('Stream complete');
        return;
    }
    document.getElementById('output').textContent += event.data;
};

ws.onerror = (err) => console.error('WebSocket error:', err);
```

---

## 8. Streaming with progress callbacks

```python
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM

async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    rag = RAG(llm=llm)
    await rag.aadd(["SynapseKit is a Python library for building LLM applications."])

    token_count = 0

    async def on_token(token: str):
        nonlocal token_count
        token_count += 1
        print(token, end="", flush=True)

    async for token in rag.astream("What is SynapseKit?"):
        await on_token(token)

    print(f"\n\nTotal tokens streamed: {token_count}")
    # Expected output:
    # SynapseKit is a Python library for building LLM applications.
    #
    # Total tokens streamed: 12
```

---

## 9. Gotchas and common mistakes

### Do not use `asyncio.run()` inside a running event loop

```python
# WRONG — raises RuntimeError in Jupyter or FastAPI handlers
import asyncio
asyncio.run(my_async_generator())

# CORRECT — use await directly
async def my_handler():
    async for token in llm.stream("hello"):
        print(token, end="", flush=True)
```

### Sync wrappers do not support streaming

```python
# WRONG — sync wrappers buffer the full response
result = llm.generate_sync("Tell me about RAG")  # No streaming

# CORRECT — use async API
async for token in llm.stream("Tell me about RAG"):
    print(token, end="", flush=True)
```

### Always flush stdout when printing tokens

```python
# WRONG — tokens may appear in batches due to buffering
print(token, end="")

# CORRECT — force immediate flush
print(token, end="", flush=True)
```

### Handle stream interruptions gracefully

```python
async def safe_stream(llm, prompt: str) -> str:
    tokens = []
    try:
        async for token in llm.stream(prompt):
            print(token, end="", flush=True)
            tokens.append(token)
    except Exception as e:
        print(f"\nStream interrupted: {e}")
        # Return partial result
    return "".join(tokens)
```

---

## Summary

| Pattern | Method | Use case |
|---|---|---|
| Token streaming | `llm.stream()` | CLI tools, notebooks |
| RAG streaming | `rag.astream()` | Chat interfaces |
| Graph node updates | `compiled.stream()` | Progress indicators |
| Graph token streaming | `stream_tokens()` | Fine-grained UI updates |
| SSE | `sse_stream()` | Web browsers via HTTP |
| WebSocket | `ws_stream()` | Real-time bidirectional |
