---
sidebar_position: 1
title: "Multi-Agent Systems"
description: "Build collaborative AI systems where multiple specialized agents work together to accomplish complex tasks."
---

# Multi-Agent Systems

Multi-agent systems let you decompose hard problems into focused subtasks, each handled by a specialized agent. SynapseKit provides the primitives to orchestrate those agents — whether they run sequentially, in parallel, or in dynamic supervisor-driven topologies.

## Guides in this section

| Guide | What you'll build | Difficulty |
|-------|------------------|------------|
| [Crew Content Pipeline](./crew-content-pipeline) | A `Crew` of researcher, writer, and editor agents that produce a polished article end-to-end | Intermediate |
| [Supervisor Agent Routing](./supervisor-routing) | A `SupervisorAgent` that inspects each query and dispatches it to the right specialist | Intermediate |
| [Agent Handoff Chains](./handoff-chains) | A `HandoffChain` that passes context from one agent to the next, each enriching the result | Intermediate |
| [Agent-to-Agent Communication](./a2a-communication) | Agents that send messages directly to each other and share mutable state | Advanced |
| [Parallel Agent Execution](./parallel-agent-execution) | Fan-out / fan-in with `asyncio.gather()` so multiple agents run simultaneously | Intermediate |

## When to use multi-agent systems

Use a single agent when the task is self-contained and the context window is manageable. Reach for a multi-agent architecture when:

- **Specialization matters** — different parts of the task require different personas, tools, or instructions.
- **Context isolation is beneficial** — each agent gets only the information it needs, keeping prompts tight.
- **Parallelism is available** — independent subtasks can run concurrently and merge at the end.
- **Quality gates are required** — a reviewer or critic agent should validate the output of a producer agent before it continues.

## Core concepts

**Crew** — a named group of `CrewMember` agents, each with a role, a backstory, and a set of tools. Tasks are defined separately and assigned to members; the crew handles execution order.

**SupervisorAgent** — a router that reads the user query, picks the best specialist agent, and delegates. The supervisor itself does not produce the final answer — it only decides who should.

**HandoffChain** — a linear pipeline where each agent's output becomes the next agent's input. Context accumulates and is passed forward in a structured handoff object.

**Shared state** — a plain dataclass or dict passed between agents. Agents read from it, append to it, and the caller sees the final merged result.

## Installation

```bash
pip install synapsekit[openai]
```

All examples in this section use `OpenAILLM`. Swap in any of SynapseKit's 30+ LLM providers without changing agent logic.
