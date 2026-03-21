---
sidebar_position: 4
---

# Graph Patterns

15 copy-paste patterns for building graph workflows, from simple linear pipelines to streaming SSE endpoints.

---

## 1. Linear 3-Node Graph

The simplest graph: three nodes run in sequence.

```python
from synapsekit.graph import StateGraph
from synapsekit.llms.openai import OpenAILLM

llm = OpenAILLM(model="gpt-4o-mini")

async def fetch_node(state: dict) -> dict:
    return {**state, "raw": f"Data about: {state['topic']}"}

async def analyse_node(state: dict) -> dict:
    analysis = await llm.complete(f"Analyse this: {state['raw']}")
    return {**state, "analysis": analysis}

async def format_node(state: dict) -> dict:
    report = await llm.complete(f"Format as markdown:\n{state['analysis']}")
    return {**state, "report": report}

workflow = StateGraph()
workflow.add_node("fetch", fetch_node)
workflow.add_node("analyse", analyse_node)
workflow.add_node("format", format_node)
workflow.add_edge("fetch", "analyse")
workflow.add_edge("analyse", "format")
workflow.set_entry_point("fetch")
workflow.set_finish_point("format")

graph = workflow.compile()
result = await graph.run({"topic": "LLM caching strategies"})
print(result["report"])
```

---

## 2. Conditional Routing

Route to different nodes based on the current state value.

```python
from synapsekit.graph import StateGraph

async def classify_node(state: dict) -> dict:
    topic = state["query"].lower()
    if any(kw in topic for kw in ["price", "cost", "billing"]):
        category = "billing"
    elif any(kw in topic for kw in ["error", "bug", "crash"]):
        category = "support"
    else:
        category = "general"
    return {**state, "category": category}

async def billing_node(state: dict) -> dict:
    return {**state, "answer": "For billing questions, contact billing@example.com"}

async def support_node(state: dict) -> dict:
    return {**state, "answer": "For support, see https://docs.example.com/troubleshooting"}

async def general_node(state: dict) -> dict:
    return {**state, "answer": "How can I help you today?"}

def route(state: dict) -> str:
    return state["category"]

workflow = StateGraph()
workflow.add_node("classify", classify_node)
workflow.add_node("billing", billing_node)
workflow.add_node("support", support_node)
workflow.add_node("general", general_node)

workflow.set_entry_point("classify")
workflow.add_conditional_edges("classify", route, {
    "billing": "billing",
    "support": "support",
    "general": "general",
})
workflow.set_finish_point("billing")
workflow.set_finish_point("support")
workflow.set_finish_point("general")

graph = workflow.compile()
result = await graph.run({"query": "I have a billing question"})
print(result["answer"])
```

---

## 3. Parallel Fan-Out with Merge

Run multiple nodes in parallel and merge their results.

```python
from synapsekit.graph import StateGraph
from synapsekit.llms.openai import OpenAILLM
import asyncio

llm = OpenAILLM(model="gpt-4o-mini")

async def split_node(state: dict) -> dict:
    return {**state, "ready": True}

async def search_news(state: dict) -> dict:
    result = await llm.complete(f"What are the latest news about {state['topic']}?")
    return {**state, "news": result}

async def search_wiki(state: dict) -> dict:
    result = await llm.complete(f"Give a Wikipedia-style summary of {state['topic']}")
    return {**state, "wiki": result}

async def search_papers(state: dict) -> dict:
    result = await llm.complete(f"What recent research papers exist on {state['topic']}?")
    return {**state, "papers": result}

async def merge_node(state: dict) -> dict:
    summary = await llm.complete(
        f"Combine these sources:\nNews: {state['news']}\n"
        f"Wiki: {state['wiki']}\nPapers: {state['papers']}"
    )
    return {**state, "final": summary}

workflow = StateGraph()
workflow.add_node("split", split_node)
workflow.add_node("news", search_news)
workflow.add_node("wiki", search_wiki)
workflow.add_node("papers", search_papers)
workflow.add_node("merge", merge_node)

workflow.set_entry_point("split")
workflow.add_parallel_edges("split", ["news", "wiki", "papers"])
workflow.add_join_edge(["news", "wiki", "papers"], "merge")
workflow.set_finish_point("merge")

graph = workflow.compile()
result = await graph.run({"topic": "Mixture of Experts LLMs"})
print(result["final"])
```

---

## 4. Looping Graph with max_steps

A graph that loops back on itself until a condition is met, with a safety cap on iterations.

```python
from synapsekit.graph import StateGraph
from synapsekit.llms.openai import OpenAILLM

llm = OpenAILLM(model="gpt-4o-mini")

async def draft_node(state: dict) -> dict:
    draft = await llm.complete(f"Write a draft for: {state['topic']}")
    return {**state, "draft": draft, "iterations": state.get("iterations", 0) + 1}

async def critique_node(state: dict) -> dict:
    critique = await llm.complete(
        f"Rate this draft 1-10 and give ONE improvement:\n{state['draft']}"
    )
    score = int(critique[0]) if critique[0].isdigit() else 5
    return {**state, "critique": critique, "score": score}

def should_continue(state: dict) -> str:
    if state["score"] >= 8 or state["iterations"] >= 3:
        return "done"
    return "revise"

async def revise_node(state: dict) -> dict:
    revised = await llm.complete(
        f"Revise this draft based on: {state['critique']}\n\nDraft:\n{state['draft']}"
    )
    return {**state, "draft": revised}

workflow = StateGraph()
workflow.add_node("draft", draft_node)
workflow.add_node("critique", critique_node)
workflow.add_node("revise", revise_node)

workflow.set_entry_point("draft")
workflow.add_edge("draft", "critique")
workflow.add_conditional_edges("critique", should_continue, {
    "revise": "revise",
    "done": "__end__",
})
workflow.add_edge("revise", "critique")

graph = workflow.compile(max_steps=20)
result = await graph.run({"topic": "Introduction to SynapseKit"})
print(result["draft"])
```

---

## 5. Graph with SQLite Checkpoint

Persist graph state to SQLite so interrupted runs can be resumed.

```python
from synapsekit.graph import StateGraph
from synapsekit.graph.checkpointing import SQLiteCheckpointer

checkpointer = SQLiteCheckpointer(path="graph-checkpoints.db")

# ... define nodes and edges ...
graph = workflow.compile(checkpointer=checkpointer)

thread_id = "report-job-001"

# First run — may be interrupted
result = await graph.run(initial_state, thread_id=thread_id)

# Later — resume from where it left off
result = await graph.resume(thread_id=thread_id, updates={"approved": True})
print(result["final_report"])
```

---

## 6. Graph with Redis Checkpoint

Use Redis for checkpointing in a multi-replica deployment.

```python
from synapsekit.graph import StateGraph
from synapsekit.graph.checkpointing import RedisCheckpointer
import os

checkpointer = RedisCheckpointer(redis_url=os.environ["REDIS_URL"])

# ... define nodes and edges ...
graph = workflow.compile(checkpointer=checkpointer)

result = await graph.run(initial_state, thread_id="user-456-session-1")
```

---

## 7. Human-in-the-Loop with approval_node

Pause execution and wait for explicit human approval before proceeding.

```python
from synapsekit.graph import StateGraph
from synapsekit.graph import GraphInterrupt
from synapsekit.graph.checkpointing import SQLiteCheckpointer
from synapsekit.llms.openai import OpenAILLM

llm = OpenAILLM(model="gpt-4o")
checkpointer = SQLiteCheckpointer(path="hitl.db")

async def generate_action_node(state: dict) -> dict:
    action = await llm.complete(f"Plan the next action for: {state['goal']}")
    return {**state, "proposed_action": action}

async def approval_node(state: dict) -> dict:
    raise GraphInterrupt({
        "message": "Human approval required",
        "proposed_action": state["proposed_action"],
    })

async def execute_action_node(state: dict) -> dict:
    if not state.get("approved"):
        return {**state, "result": "Action rejected by human"}
    result = await llm.complete(f"Execute: {state['proposed_action']}")
    return {**state, "result": result}

workflow = StateGraph()
workflow.add_node("generate", generate_action_node)
workflow.add_node("approval", approval_node)
workflow.add_node("execute", execute_action_node)
workflow.add_edge("generate", "approval")
workflow.add_edge("approval", "execute")
workflow.set_entry_point("generate")
workflow.set_finish_point("execute")

graph = workflow.compile(checkpointer=checkpointer)
thread_id = "task-789"

try:
    result = await graph.run({"goal": "Deploy to production"}, thread_id=thread_id)
except GraphInterrupt as e:
    print(f"Approval needed: {e.payload['proposed_action']}")
    approved = input("Approve? (y/n): ") == "y"
    result = await graph.resume(thread_id=thread_id, updates={"approved": approved})

print(result["result"])
```

---

## 8. Subgraph Composition

Build complex workflows by composing smaller graphs as subgraphs.

```python
from synapsekit.graph import StateGraph

# Define a reusable research subgraph
def build_research_subgraph():
    sub = StateGraph()
    sub.add_node("search", search_node)
    sub.add_node("summarise", summarise_node)
    sub.add_edge("search", "summarise")
    sub.set_entry_point("search")
    sub.set_finish_point("summarise")
    return sub.compile()

# Define a reusable writing subgraph
def build_writing_subgraph():
    sub = StateGraph()
    sub.add_node("outline", outline_node)
    sub.add_node("draft", draft_node)
    sub.add_node("edit", edit_node)
    sub.add_edge("outline", "draft")
    sub.add_edge("draft", "edit")
    sub.set_entry_point("outline")
    sub.set_finish_point("edit")
    return sub.compile()

# Compose into a parent graph
research_graph = build_research_subgraph()
writing_graph = build_writing_subgraph()

parent = StateGraph()
parent.add_node("research", research_graph)   # subgraph as a node
parent.add_node("write", writing_graph)       # subgraph as a node
parent.add_edge("research", "write")
parent.set_entry_point("research")
parent.set_finish_point("write")

graph = parent.compile()
result = await graph.run({"topic": "SynapseKit architecture"})
```

---

## 9. Token Streaming from LLM Node

Stream tokens from an LLM node directly to the caller.

```python
from synapsekit.graph import StateGraph
from synapsekit.llms.openai import OpenAILLM

llm = OpenAILLM(model="gpt-4o-mini")

async def stream_answer_node(state: dict) -> dict:
    chunks = []
    async for token in llm.stream(state["prompt"]):
        chunks.append(token)
        # emit as a streaming event
        yield {"type": "token", "content": token}
    return {**state, "answer": "".join(chunks)}

workflow = StateGraph()
workflow.add_node("answer", stream_answer_node, streaming=True)
workflow.set_entry_point("answer")
workflow.set_finish_point("answer")

graph = workflow.compile()

async for event in graph.stream({"prompt": "Explain graph workflows in detail"}):
    if event.type == "token":
        print(event.content, end="", flush=True)
```

---

## 10. SSE Streaming Endpoint (FastAPI)

Serve a streaming graph over Server-Sent Events from a FastAPI endpoint.

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from synapsekit.graph import StateGraph
import json

app = FastAPI()
graph = workflow.compile()  # your compiled graph

@app.post("/run")
async def run_graph(body: dict):
    async def event_stream():
        async for event in graph.stream(body):
            data = json.dumps({"type": event.type, "content": event.content})
            yield f"data: {data}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

Client-side consumption:

```javascript
const es = new EventSource('/run');
es.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data === '[DONE]') { es.close(); return; }
  process.stdout.write(data.content);
};
```

---

## 11. WebSocket Streaming

Serve a graph over WebSocket for bidirectional communication.

```python
from fastapi import FastAPI, WebSocket
from synapsekit.graph import StateGraph
import json

app = FastAPI()
graph = workflow.compile()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            async for event in graph.stream(data):
                await websocket.send_json({
                    "type": event.type,
                    "content": event.content,
                })
            await websocket.send_json({"type": "done"})
    except Exception:
        await websocket.close()
```

---

## 12. Graph with Execution Tracing

Attach a tracer to record every node's inputs, outputs, and timing.

```python
from synapsekit.graph import StateGraph
from synapsekit.observability import DistributedTracer
import os

tracer = DistributedTracer(
    service_name="my-graph",
    export_to="otlp",
    otlp_endpoint=os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"],
)

# ... build workflow ...
graph = workflow.compile(tracer=tracer)

result = await graph.run(initial_state, thread_id="trace-demo")

# Every node execution now appears as a span in your tracing backend
# with attributes: node_name, input_state, output_state, duration_ms
```

---

## 13. Graph with Event Callbacks

Hook into node lifecycle events for custom logging or side-effects.

```python
from synapsekit.graph import StateGraph
from synapsekit.graph.events import NodeStartEvent, NodeCompleteEvent
import logging

logger = logging.getLogger(__name__)

def on_node_start(event: NodeStartEvent):
    logger.info(f"[Graph] Starting node '{event.node_name}' | state keys: {list(event.state.keys())}")

def on_node_complete(event: NodeCompleteEvent):
    logger.info(
        f"[Graph] Completed '{event.node_name}' in {event.duration_ms:.1f}ms"
    )

# ... build workflow ...
graph = workflow.compile(
    on_node_start=on_node_start,
    on_node_complete=on_node_complete,
)

result = await graph.run(initial_state)
```

---

## 14. TypedState with Custom Reducer

Use a typed dataclass for state and define how conflicting updates are merged.

```python
from dataclasses import dataclass, field
from synapsekit.graph import StateGraph
from synapsekit.graph.state import reducer

@dataclass
class ResearchState:
    topic: str = ""
    queries: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    draft: str = ""

    # Custom reducer: merge lists from parallel branches instead of overwriting
    @staticmethod
    @reducer("sources")
    def merge_sources(current: list[str], update: list[str]) -> list[str]:
        return list(set(current + update))  # deduplicate

    @staticmethod
    @reducer("queries")
    def merge_queries(current: list[str], update: list[str]) -> list[str]:
        return current + update

async def generate_queries_node(state: ResearchState) -> ResearchState:
    return ResearchState(
        **{**vars(state), "queries": [f"What is {state.topic}?", f"Why is {state.topic} important?"]}
    )

workflow = StateGraph(state_type=ResearchState)
workflow.add_node("generate_queries", generate_queries_node)
workflow.set_entry_point("generate_queries")
workflow.set_finish_point("generate_queries")

graph = workflow.compile()
result = await graph.run(ResearchState(topic="GraphRAG"))
print(result.queries)
```

---

## 15. Mermaid Export with Trace Highlighting

Export your graph as a Mermaid diagram and highlight the nodes that executed in a specific trace.

```python
from synapsekit.graph import StateGraph
from synapsekit.graph.checkpointing import SQLiteCheckpointer

checkpointer = SQLiteCheckpointer(path="checkpoints.db")
graph = workflow.compile(checkpointer=checkpointer)

thread_id = "demo-run"
result = await graph.run(initial_state, thread_id=thread_id)

# Export the graph structure as Mermaid
mermaid = graph.to_mermaid()
print(mermaid)

# Export with the executed path highlighted in green
mermaid_traced = graph.to_mermaid(highlight_thread=thread_id)
print(mermaid_traced)

# Save to file for inclusion in documentation
with open("graph-diagram.md", "w") as f:
    f.write(f"```mermaid\n{mermaid_traced}\n```")
```

Example output:

```
graph TD
    fetch["fetch"] --> analyse["analyse"]
    analyse --> format["format"]

    style fetch fill:#00c853,color:#fff
    style analyse fill:#00c853,color:#fff
    style format fill:#00c853,color:#fff
```
