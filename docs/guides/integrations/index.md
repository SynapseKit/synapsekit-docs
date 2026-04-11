---
sidebar_position: 1
title: "Integration Guides"
description: "Real-world SynapseKit integrations with GitHub, Notion, Slack, SQL databases, email, YouTube, and news APIs."
---

# Integration Guides

These guides show you how to connect SynapseKit to the tools and platforms your team already uses. Each guide is self-contained — pick the one that matches your use case and you can have something running in under 30 minutes.

## Guides in this section

| Guide | What you'll build | Difficulty | Time |
|---|---|---|---|
| [GitHub PR Review Agent](./github-pr-review-agent) | Agent that fetches PR diffs and generates code review comments | Intermediate | ~25 min |
| [Notion Knowledge Base with RAG](./notion-knowledge-base) | Q&A system over your Notion workspace using RAG | Intermediate | ~20 min |
| [Slack Q&A Bot](./slack-qa-bot) | Slack Bolt app that answers @mentions with RAG-powered responses | Intermediate | ~30 min |
| [SQL Analytics Agent](./sql-analytics-agent) | Natural language → SQL → formatted results agent | Intermediate | ~25 min |
| [Email Triage Agent](./email-triage) | Classify, prioritise, and draft responses to incoming emails | Intermediate | ~20 min |
| [YouTube Video Summarizer](./youtube-summarizer) | Extract transcripts and generate structured summaries with timestamps | Beginner | ~15 min |
| [News Monitoring Dashboard](./news-monitoring-dashboard) | Scheduled news monitoring with entity extraction and digest generation | Intermediate | ~25 min |

## Prerequisites

All guides assume SynapseKit is installed:

```bash
pip install synapsekit
```

Each guide lists its own additional dependencies (e.g. `slack-bolt`, `youtube-transcript-api`) and required API keys in its Prerequisites section.

## Patterns used across these guides

**RAG (Retrieval-Augmented Generation)** is used in the Notion, Slack, and SQL guides. The pattern: load documents → chunk → embed → index → retrieve relevant chunks at query time → pass to LLM.

**FunctionCallingAgent** is used in the GitHub and SQL guides. The pattern: give the LLM a set of tools (functions it can call) and let it decide which tools to invoke based on the user's request.

**Loaders** (`NotionLoader`, `YouTubeLoader`) are used to pull content from external sources into SynapseKit's document format.

**Structured output** (Pydantic models) is used in the email and news guides to parse LLM responses into typed objects for downstream processing.

## Which guide should I start with?

- **Internal knowledge base / chatbot?** Start with [Notion Knowledge Base](./notion-knowledge-base) — the RAG pattern transfers directly to other document sources.
- **Developer tools?** Try [GitHub PR Review Agent](./github-pr-review-agent).
- **Customer support automation?** See [Email Triage Agent](./email-triage).
- **Data team use case?** Go to [SQL Analytics Agent](./sql-analytics-agent).
