---
sidebar_position: 5
---

**Tutorial Progress: Step 4 of 5**  
[← Previous: Adding an Agent with Tools](./adding-agent-with-tools) | [Next: Deploying to Production →](./deploying-to-production)

# Step 4: Building a Graph Workflow

In this step you will compose RAG and Agents into a stateful, resumable graph workflow using `StateGraph`.

## Why graphs?

Graphs give you explicit control over control flow, cycles, human-in-the-loop, checkpointing, and visualization — things that become messy with pure agent loops.

## 1. Core concepts

- **State**: A typed dictionary that flows through the graph
- **Nodes**: Functions or agents that transform state
- **Edges**: Connections (normal, conditional, cycles)
- **Checkpointing**: Automatic persistence of state after each step

## 2. A simple linear graph

```python
from synapsekit import StateGraph
from typing import TypedDict

class WorkflowState(TypedDict):
    question: str
    answer: str
    sources: list[str]

async def retrieve(state: WorkflowState):
    # Call your RAG pipeline here
    return {"sources": ["doc1.pdf", "doc2.md"]}

async def generate(state: WorkflowState):
    # Call LLM with retrieved context
    return {"answer": "SynapseKit is awesome because..."}

graph = StateGraph(WorkflowState)
graph.add_node("retrieve", retrieve)
graph.add_node("generate", generate)
graph.add_edge("retrieve", "generate")
graph.set_entry_point("retrieve")

app = graph.compile()
```

## 3. Adding conditional routing

```python
def route_after_retrieval(state: WorkflowState):
    if len(state["sources"]) > 3:
        return "generate_detailed"
    return "generate_concise"

graph.add_conditional_edges(
    "retrieve",
    route_after_retrieval,
    {
        "generate_detailed": "generate_detailed",
        "generate_concise": "generate_concise",
    }
)
```

## 4. Human-in-the-loop (HITL)

```python
from synapsekit.graph import interrupt

async def human_review(state):
    # Pause execution and wait for human input
    return interrupt("Please review the draft answer", value=state["answer"])
```

The graph will stop and return control to your application.

## 5. Checkpointing & resumability

```python
from synapsekit.checkpointing import SqliteCheckpointer

checkpointer = SqliteCheckpointer(db_path="workflows.db")

app = graph.compile(checkpointer=checkpointer)

# Run with thread_id for resumability
config = {"configurable": {"thread_id": "user-123"}}

result = await app.ainvoke({"question": "Explain RAG"}, config=config)
```

Later you can resume from any checkpoint.

## 6. Full example: Research → Draft → Review → Publish graph

```python
import asyncio
from synapsekit import StateGraph
from typing import TypedDict, Literal

class ResearchState(TypedDict):
    topic: str
    research: str
    draft: str
    feedback: str | None
    final: str | None

async def research_node(state):
    # Call agent or RAG
    return {"research": f"Research results about {state['topic']}"}

async def draft_node(state):
    return {"draft": f"Draft article about {state['topic']}"}

async def review_node(state):
    # Simulate human review
    return {"feedback": "Looks good, minor changes needed"}

async def publish_node(state):
    return {"final": state["draft"] + "\n\n[Published]"}

def should_revise(state):
    if state.get("feedback"):
        return "revise"
    return "publish"

graph = StateGraph(ResearchState)
graph.add_node("research", research_node)
graph.add_node("draft", draft_node)
graph.add_node("review", review_node)
graph.add_node("publish", publish_node)

graph.add_edge("research", "draft")
graph.add_edge("draft", "review")
graph.add_conditional_edges("review", should_revise, {
    "revise": "draft",
    "publish": "publish"
})
graph.set_entry_point("research")

app = graph.compile()

async def main():
    result = await app.ainvoke({"topic": "SynapseKit graphs"})
    print(result["final"])

asyncio.run(main())
```

## 7. Visualization

```python
from synapsekit.graph import draw_mermaid

print(draw_mermaid(app))
```

Generates a Mermaid diagram you can render in docs or notebooks.

**You have now built a real multi-step workflow with branching and checkpointing!**

**Tutorial Progress: Step 4 of 5**  
[← Previous: Adding an Agent with Tools](./adding-agent-with-tools) | [Next: Deploying to Production →](./deploying-to-production)