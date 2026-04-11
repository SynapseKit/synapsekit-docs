---
sidebar_position: 4
title: "Slack Q&A Bot"
description: "Build a Slack bot powered by SynapseKit RAG that answers @mentions in threads using your team's knowledge base."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Slack Q&A Bot

<ColabBadge path="integrations/slack-qa-bot.ipynb" />

A Slack Q&A bot puts your knowledge base where your team already works. This guide builds a Slack Bolt app that listens for @mentions, queries a SynapseKit RAG pipeline, and replies in-thread with a grounded answer. The bot handles concurrent questions, avoids duplicate replies, and shows a typing indicator while it works.

**What you'll build:** A production-ready Slack bot that answers questions with RAG, replies in thread, cites sources, and degrades gracefully when the LLM is unavailable. **Time:** ~30 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit[openai] slack-bolt
export OPENAI_API_KEY=sk-...
export SLACK_BOT_TOKEN=xoxb-...     # Bot token from your Slack app
export SLACK_APP_TOKEN=xapp-...     # App-level token for Socket Mode
```

You need a Slack app with `app_mentions:read`, `chat:write`, and `channels:history` scopes, and Socket Mode enabled.

## What you'll learn

- Set up a Slack Bolt app in Socket Mode (no public URL required)
- Listen for `@mention` events and route them to a RAG pipeline
- Post threaded replies with source citations
- Show a typing indicator with `reactions:write`
- Handle errors gracefully without crashing the bot

## Step 1: Build the RAG pipeline

```python
import asyncio
import os
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM

# Build and warm the RAG index before starting the Slack listener.
# This ensures the first question gets a fast response.
llm = OpenAILLM(model="gpt-4o-mini")
rag = RAG(llm=llm, chunk_size=512, chunk_overlap=64)

async def load_knowledge_base():
    """Load documents into the RAG index at startup.

    In production, point this at your real document sources —
    Notion pages, Confluence, internal wikis, PDFs.
    """
    from synapsekit.loaders import NotionLoader
    loader = NotionLoader(token="NOTION_TOKEN", database_id="your-database-id")
    docs = await loader.aload()
    await rag.aadd_documents(docs)
    print(f"Knowledge base ready: {rag.document_count} chunks indexed.")
```

## Step 2: Set up the Slack Bolt app

```python
from slack_bolt.async_app import AsyncApp
from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler

app = AsyncApp(token=os.environ["SLACK_BOT_TOKEN"])

# Resolve the bot's own user ID so we can detect self-mentions
BOT_USER_ID: str | None = None

@app.event("app_home_opened")
async def handle_app_home_opened(client, event, logger):
    # Cache the bot's own ID on first connection
    global BOT_USER_ID
    if BOT_USER_ID is None:
        auth_info = await client.auth_test()
        BOT_USER_ID = auth_info["user_id"]
```

## Step 3: Handle @mentions and reply in thread

```python
import re

@app.event("app_mention")
async def handle_mention(event, client, say):
    """Receive an @mention, query RAG, and reply in the same thread."""

    # Strip the @mention from the message text before passing to RAG
    raw_text = event.get("text", "")
    question = re.sub(r"<@\w+>", "", raw_text).strip()

    if not question:
        await say(
            text="Hi! Ask me anything about our knowledge base.",
            thread_ts=event["ts"],
        )
        return

    channel    = event["channel"]
    thread_ts  = event.get("thread_ts", event["ts"])  # Reply in existing thread if present

    # Show a clock emoji reaction so users know the bot is working
    await client.reactions_add(channel=channel, timestamp=event["ts"], name="clock1")

    try:
        result = await rag.aquery(question)

        # Build the reply with source links
        sources_text = ""
        if result.sources:
            source_lines = []
            for chunk in result.sources[:3]:
                title = chunk.metadata.get("title", "Untitled")
                url   = chunk.metadata.get("url", "")
                source_lines.append(f"• <{url}|{title}>" if url else f"• {title}")
            sources_text = "\n\n*Sources:*\n" + "\n".join(source_lines)

        await say(
            text=result.answer + sources_text,
            thread_ts=thread_ts,
        )

    except Exception as e:
        await say(
            text=f"Sorry, I ran into an error: `{type(e).__name__}`. Please try again.",
            thread_ts=thread_ts,
        )

    finally:
        # Remove the clock and add a checkmark to signal completion
        await client.reactions_remove(channel=channel, timestamp=event["ts"], name="clock1")
        await client.reactions_add(channel=channel, timestamp=event["ts"], name="white_check_mark")
```

## Step 4: Start the bot

```python
async def main():
    # Load the knowledge base before accepting any Slack events
    await load_knowledge_base()

    handler = AsyncSocketModeHandler(app, os.environ["SLACK_APP_TOKEN"])
    print("Slack bot is running. Mention it in any channel to ask a question.")
    await handler.start_async()

asyncio.run(main())
```

## Complete working example

```python
import asyncio
import os
import re
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from slack_bolt.async_app import AsyncApp
from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler

rag = RAG(llm=OpenAILLM(model="gpt-4o-mini"), chunk_size=512, chunk_overlap=64)
app = AsyncApp(token=os.environ["SLACK_BOT_TOKEN"])

@app.event("app_mention")
async def handle_mention(event, client, say):
    question  = re.sub(r"<@\w+>", "", event.get("text", "")).strip()
    channel   = event["channel"]
    thread_ts = event.get("thread_ts", event["ts"])

    if not question:
        await say(text="Ask me anything!", thread_ts=event["ts"])
        return

    await client.reactions_add(channel=channel, timestamp=event["ts"], name="clock1")

    try:
        result = await rag.aquery(question)

        source_lines = []
        for chunk in result.sources[:3]:
            title = chunk.metadata.get("title", "Source")
            url   = chunk.metadata.get("url", "")
            source_lines.append(f"• <{url}|{title}>" if url else f"• {title}")

        reply = result.answer
        if source_lines:
            reply += "\n\n*Sources:*\n" + "\n".join(source_lines)

        await say(text=reply, thread_ts=thread_ts)

    except Exception as e:
        await say(
            text=f"Something went wrong: `{type(e).__name__}`. Try again shortly.",
            thread_ts=thread_ts,
        )
    finally:
        await client.reactions_remove(channel=channel, timestamp=event["ts"], name="clock1")
        await client.reactions_add(channel=channel, timestamp=event["ts"], name="white_check_mark")

async def main():
    # Seed the index with a few in-memory documents for this demo
    from synapsekit.loaders import Document
    docs = [
        Document(
            content="Our PTO policy allows 25 days per year, accruing monthly.",
            metadata={"title": "HR Handbook", "url": "https://notion.so/hr-handbook"},
        ),
        Document(
            content="The engineering on-call rotation runs weekly. Escalation: #ops-incidents.",
            metadata={"title": "On-Call Runbook", "url": "https://notion.so/oncall"},
        ),
    ]
    await rag.aadd_documents(docs)
    print(f"Indexed {rag.document_count} chunks.")

    handler = AsyncSocketModeHandler(app, os.environ["SLACK_APP_TOKEN"])
    print("Bot running — mention it in Slack to ask a question.")
    await handler.start_async()

asyncio.run(main())
```

## Expected output

When a user types `@KnowledgeBot What is our PTO policy?` in Slack:

```
[Bot reply in thread]
Our PTO policy allows 25 days per year, accruing monthly. Days must be
approved by your manager at least 2 weeks in advance for periods longer
than 3 consecutive days.

Sources:
• HR Handbook
```

## How it works

Slack Bolt's `AsyncApp` runs an event loop that receives events from Slack over a persistent WebSocket (Socket Mode). When an `app_mention` event arrives, Bolt calls the handler coroutine. The handler strips the `@mention` token from the text, passes the clean question to `rag.aquery()`, and sends the result back as a threaded reply. All Slack API calls are async — they do not block the event loop while waiting for Slack's response.

The clock reaction gives users immediate visual feedback that the bot received their question, which is important since RAG queries can take 1-3 seconds.

## Variations

**Support follow-up questions in the same thread:**
```python
# Include previous thread messages as conversation history
thread_history = await client.conversations_replies(
    channel=channel, ts=thread_ts
)
context = "\n".join(m["text"] for m in thread_history["messages"][:-1])
result = await rag.aquery(question, context=context)
```

**Rate-limit per user:**
```python
from collections import defaultdict
import time

last_query: dict[str, float] = defaultdict(float)
COOLDOWN = 5.0  # seconds

user_id = event["user"]
if time.time() - last_query[user_id] < COOLDOWN:
    await say(text="Please wait a moment before asking another question.", thread_ts=thread_ts)
    return
last_query[user_id] = time.time()
```

## Troubleshooting

**Bot does not respond to mentions**
Verify the app has `app_mentions:read` scope and is invited to the channel. Socket Mode requires an App-Level Token (`xapp-`) with `connections:write` scope.

**`asyncio` warnings in Slack Bolt**
Slack Bolt's async support requires `asyncio` mode. Ensure you use `AsyncApp` and `AsyncSocketModeHandler`, not the synchronous variants.

**Answers are irrelevant**
Increase `top_k` in `rag.aquery(top_k=8)` to retrieve more candidates. Also check that your documents were indexed correctly by calling `rag.search(question)` directly to inspect retrieved chunks.

## Next steps

- [Notion Knowledge Base](./notion-knowledge-base) — build the knowledge base that backs this bot
- [Email Triage Agent](./email-triage) — apply the same pattern to email
- [Semantic Response Caching](../llms/semantic-caching) — cache frequent questions to reduce API costs
