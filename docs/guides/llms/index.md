---
sidebar_position: 1
title: "LLM Guides"
description: "Hands-on guides for working with LLM providers, routing, caching, and structured output in SynapseKit."
---

# LLM Guides

These guides cover the most important patterns for working with language models in SynapseKit. Each guide is self-contained and ends with a complete working example you can run immediately.

## Guides in this section

| Guide | What you'll build | Difficulty | Time |
|---|---|---|---|
| [LLM Provider Comparison](./provider-comparison) | Side-by-side benchmark across OpenAI, Anthropic, Groq, and Ollama | Beginner | ~15 min |
| [Cost-Aware LLM Router](./cost-router) | Complexity classifier + routing table + circuit breaker + budget guard | Intermediate | ~20 min |
| [LLM Fallback Chains](./fallback-chain) | Primary → secondary → tertiary failover with CircuitBreaker | Intermediate | ~15 min |
| [Semantic Response Caching](./semantic-caching) | SQLite and Redis cache backends, cache hit/miss metrics | Beginner | ~15 min |
| [Structured Output with Pydantic](./structured-output-pydantic) | Pydantic BaseModel response schemas, JSON mode, field validation | Beginner | ~15 min |

## Prerequisites

All guides assume you have SynapseKit installed:

```bash
pip install synapsekit
```

Individual guides list any additional provider extras (e.g. `synapsekit[openai,groq]`) in their Prerequisites section.

## Which guide should I start with?

- **New to SynapseKit?** Start with [LLM Provider Comparison](./provider-comparison) to understand the unified interface.
- **Concerned about costs?** Go straight to [Cost-Aware LLM Router](./cost-router).
- **Building production services?** Read [LLM Fallback Chains](./fallback-chain) and [Semantic Response Caching](./semantic-caching).
- **Need structured data from LLMs?** See [Structured Output with Pydantic](./structured-output-pydantic).
