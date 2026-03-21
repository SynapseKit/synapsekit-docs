---
sidebar_position: 1
---

# Multi-Agent Overview

SynapseKit provides three multi-agent patterns for building systems where multiple agents collaborate:

| Pattern | Classes | Best For |
|---|---|---|
| **Supervisor/Worker** | `SupervisorAgent`, `WorkerAgent` | Hierarchical task delegation |
| **Handoffs** | `HandoffChain`, `Handoff` | Linear pipelines with conditional routing |
| **Crew** | `Crew`, `CrewAgent`, `Task` | Role-based teams with structured tasks |

## Supervisor/Worker

![Supervisor/Worker pattern — hierarchical task delegation](/img/supervisor-worker.svg)

A supervisor agent receives a task, decides which worker to delegate to, and synthesizes the final answer. Workers are specialized agents that handle specific domains.

```python
from synapsekit import SupervisorAgent, WorkerAgent, FunctionCallingAgent

# Create specialized workers
researcher = WorkerAgent(
    name="researcher",
    agent=FunctionCallingAgent(llm=llm, tools=[WebSearchTool()]),
    description="Searches the web for information",
)

writer = WorkerAgent(
    name="writer",
    agent=FunctionCallingAgent(llm=llm, tools=[]),
    description="Writes polished content from research",
)

# Supervisor delegates to workers
supervisor = SupervisorAgent(
    llm=llm,
    workers=[researcher, writer],
)

result = await supervisor.run("Write a blog post about async Python")
```

The supervisor uses a DELEGATE/FINAL protocol:
- **DELEGATE(worker_name): instruction** — routes a subtask to a worker
- **FINAL: answer** — returns the final answer to the user

## Handoffs

A chain of agents where control transfers based on conditions:

```python
from synapsekit import HandoffChain, Handoff

chain = HandoffChain(
    agents=[triage_agent, support_agent, escalation_agent],
    handoffs=[
        Handoff(condition=lambda r: "technical" in r.lower(), target="support_agent"),
        Handoff(condition=lambda r: "urgent" in r.lower(), target="escalation_agent"),
    ],
)

result = await chain.run("I have a technical issue with my account")
```

## Crew

Role-based teams where agents have defined roles, goals, and backstories. Tasks are assigned and executed sequentially or in parallel:

```python
from synapsekit import Crew, CrewAgent, Task

analyst = CrewAgent(
    role="Data Analyst",
    goal="Analyze data and extract insights",
    backstory="Expert in data analysis with 10 years of experience",
    llm=llm,
)

writer = CrewAgent(
    role="Content Writer",
    goal="Write clear, engaging content from analysis",
    backstory="Technical writer who makes complex topics accessible",
    llm=llm,
)

crew = Crew(
    agents=[analyst, writer],
    tasks=[
        Task(description="Analyze the Q4 sales data", agent=analyst),
        Task(description="Write a summary report", agent=writer),
    ],
)

# Sequential execution (default)
result = await crew.run()

# Parallel execution
result = await crew.run(parallel=True)
```
