---
sidebar_position: 1
---

# Getting Started Tutorial

Welcome to the official **Getting Started Tutorial** for SynapseKit.

This interactive, step-by-step wizard will take you from a fresh Python environment to a fully functional, production-ready LLM application in five clear stages. Each step builds directly on the previous one.

**What you will build**
- A complete RAG pipeline with memory
- An agent with custom tools
- A stateful graph workflow with checkpointing
- Deployment-ready configuration with observability

**How to use this tutorial**
- Follow the steps in order
- Each page includes runnable code, explanations, and expected output
- Use the progress tracker at the top of every page
- Code examples use the latest SynapseKit patterns (async-first, typed, minimal magic)

**Prerequisites**
- Python 3.10 or higher
- An API key for at least one supported LLM provider (OpenAI, Anthropic, Ollama, Gemini, etc.)
- Basic familiarity with Python and async/await is helpful but not required

**Tutorial Steps**

| Step | Page | What You'll Learn | Key SynapseKit Components |
|------|------|-------------------|---------------------------|
| 1 | [Installation & Setup](./installation-setup) | Environment, installation, first import, API key management | `synapsekit`, provider configuration |
| 2 | [Your First RAG Pipeline](./first-rag-pipeline) | Ingestion, retrieval, generation, streaming | `RAGPipeline`, `VectorStore`, `Embedder` |
| 3 | [Adding an Agent with Tools](./adding-agent-with-tools) | Tool creation, function calling, guardrails | `FunctionCallingAgent`, `Tool`, `BudgetGuard` |
| 4 | [Building a Graph Workflow](./building-graph-workflow) | StateGraph, nodes, edges, checkpointing | `StateGraph`, `checkpointing`, `interrupt` |
| 5 | [Deploying to Production](./deploying-to-production) | Observability, evaluation, containerization | `CostTracker`, `Evaluator`, Docker patterns |

**Progress Tracking**
Every page shows your current position (e.g., **Step 1 of 5**). Use the "Next" and "Previous" links to navigate linearly.

**Tips for success**
- Run the code in a fresh virtual environment
- Copy-paste the examples and modify them
- Check the [API Reference](/docs/api) if you want to explore beyond the tutorial

Let's begin with **Step 1: Installation & Setup**.