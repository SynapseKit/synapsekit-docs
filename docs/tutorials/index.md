---
sidebar_position: 1
---

# Tutorials

Step-by-step guides that build real applications with SynapseKit. Each tutorial is fully self-contained and runnable.

| Tutorial | What you'll build | Key concepts |
|---|---|---|
| [Customer support bot](./customer-support-bot) | RAG + memory + guardrails | RAGPipeline, SQLiteConversationMemory, ContentFilter |
| [Document Q&A](./document-qa) | Multi-format document search | Loaders, splitters, evaluation |
| [Research agent](./research-agent) | Web + wiki + arxiv search agent | FunctionCallingAgent, BudgetGuard, tools |
| [Human-in-the-loop workflow](./hitl-workflow) | Content moderation graph | StateGraph, GraphInterrupt, checkpointing |
| [Cost-aware pipeline](./cost-aware-pipeline) | Budget-enforced multi-provider | CostTracker, BudgetGuard, routing |

**Prerequisites:** Python 3.10+, `pip install synapsekit`
