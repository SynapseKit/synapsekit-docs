---
sidebar_position: 2
---

# Agent-to-Agent (A2A) Protocol

SynapseKit supports the Agent-to-Agent (A2A) protocol for inter-agent communication across services and networks. This enables agents built with different frameworks to discover each other and collaborate.

## A2AServer

Expose an agent as an A2A-compatible endpoint:

```python
from synapsekit import A2AServer, AgentCard, FunctionCallingAgent

agent = FunctionCallingAgent(llm=llm, tools=[WebSearchTool()])

server = A2AServer(
    agent=agent,
    card=AgentCard(
        name="Research Agent",
        description="Searches the web and summarizes findings",
        skills=["web_search", "summarization"],
    ),
)

# Run the A2A server (default port 8080)
await server.start(port=8080)
```

## A2AClient

Call remote agents via the A2A protocol:

```python
from synapsekit import A2AClient

client = A2AClient(base_url="http://localhost:8080")

# Discover agent capabilities
card = await client.get_agent_card()
print(card.name)          # "Research Agent"
print(card.skills)        # ["web_search", "summarization"]

# Send a task
task = await client.send_task("Research the latest trends in AI agents")
print(task.state)         # TaskState.COMPLETED
print(task.result)        # "AI agents are trending toward..."
```

## AgentCard

Agent metadata for discovery and capability advertisement:

```python
from synapsekit import AgentCard

card = AgentCard(
    name="Research Agent",
    description="Searches the web and summarizes findings",
    skills=["web_search", "summarization"],
    version="1.0.0",
    endpoint="http://localhost:8080",
)
```

## Task Lifecycle

Tasks go through a defined state machine:

```python
from synapsekit import A2AClient, TaskState

client = A2AClient(base_url="http://localhost:8080")

# Send task (non-blocking)
task = await client.send_task("Analyze this dataset")

# Check status
print(task.state)  # TaskState.PENDING → TaskState.RUNNING → TaskState.COMPLETED

# Task states: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
```

### A2ATask and A2AMessage

```python
from synapsekit import A2ATask, A2AMessage, TaskState

task = A2ATask(
    id="task-123",
    state=TaskState.PENDING,
    messages=[
        A2AMessage(role="user", content="Research AI agents"),
    ],
)

# Messages accumulate as the task progresses
task.messages.append(A2AMessage(role="agent", content="Here are the findings..."))
task.state = TaskState.COMPLETED
```

## Multi-Agent Communication

Connect multiple A2A agents into a collaborative system:

```python
from synapsekit import A2AClient

research_client = A2AClient(base_url="http://localhost:8080")
writing_client = A2AClient(base_url="http://localhost:8081")

# Research agent gathers information
research = await research_client.send_task("Find data on Python async patterns")

# Writing agent creates content from research
article = await writing_client.send_task(
    f"Write a blog post based on this research: {research.result}"
)

print(article.result)
```
