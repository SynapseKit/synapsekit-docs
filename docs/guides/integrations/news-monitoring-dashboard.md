---
sidebar_position: 8
title: "News Monitoring Dashboard"
description: "Monitor news topics with NewsTool, extract named entities, and generate a daily digest using SynapseKit's structured output."
---

import ColabBadge from '@site/src/components/ColabBadge';

# News Monitoring Dashboard

<ColabBadge path="integrations/news-monitoring-dashboard.ipynb" />

Staying on top of news about your company, competitors, or industry topics requires reading hundreds of articles. This guide builds an automated monitoring pipeline that fetches relevant articles on a schedule, extracts named entities and sentiment, deduplicates stories, and assembles a daily digest — all with SynapseKit's `NewsTool` and structured output.

**What you'll build:** A scheduled news monitor that fetches articles by topic, extracts entities and sentiment, deduplicates overlapping stories, and generates a formatted digest ready to send by email or Slack. **Time:** ~25 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit[openai,news]
export OPENAI_API_KEY=sk-...
export NEWS_API_KEY=...   # Free key from https://newsapi.org
```

## What you'll learn

- Fetch news articles by topic and date range with `NewsTool`
- Extract named entities (people, companies, locations) using structured output
- Score article relevance and filter noise
- Deduplicate overlapping stories from multiple sources
- Generate a formatted daily digest with `asyncio.gather` for concurrent processing

## Step 1: Configure NewsTool and fetch articles

```python
import asyncio
from datetime import datetime, timedelta
from synapsekit.tools import NewsTool

# NewsTool wraps the NewsAPI and returns Article objects with
# title, description, content, url, source, published_at.
news = NewsTool(api_key="NEWS_API_KEY")   # Resolved from env var automatically

MONITORING_TOPICS = [
    "artificial intelligence startups",
    "open source LLM",
    "SynapseKit",          # Monitor mentions of your own product
]

async def fetch_articles(topics: list[str], days_back: int = 1) -> list[dict]:
    """Fetch recent articles across all monitoring topics."""
    since = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    all_articles = []

    for topic in topics:
        articles = await news.asearch(
            query=topic,
            from_date=since,
            language="en",
            sort_by="relevancy",
            max_results=20,
        )
        for article in articles:
            article["_topic"] = topic   # Tag for downstream deduplication
        all_articles.extend(articles)

    print(f"Fetched {len(all_articles)} articles across {len(topics)} topics.")
    return all_articles
```

## Step 2: Define entity extraction and analysis schemas

```python
from pydantic import BaseModel, Field
from typing import Literal, Optional

class NamedEntity(BaseModel):
    text: str = Field(description="The entity as it appears in the text")
    type: Literal["person", "company", "product", "location", "event", "other"]

class ArticleAnalysis(BaseModel):
    relevance_score: float = Field(
        ge=0.0, le=1.0,
        description=(
            "How relevant is this article to the monitoring topic? "
            "1.0 = central subject, 0.0 = tangential mention"
        )
    )
    sentiment: Literal["positive", "negative", "neutral"]
    entities: list[NamedEntity] = Field(
        description="All notable people, companies, products, and locations mentioned"
    )
    key_facts: list[str] = Field(
        description="3-5 bullet-point facts from the article — be specific, include numbers"
    )
    one_liner: str = Field(
        description="One sentence that captures the most newsworthy aspect of this article"
    )
    is_duplicate_signal: bool = Field(
        description="True if this article appears to cover the same event as a commonly-known story"
    )
```

## Step 3: Analyse articles concurrently

```python
from synapsekit import LLMConfig
from synapsekit.llms.openai import OpenAILLM

# Use a cheaper model for bulk analysis — most articles need simple classification
llm = OpenAILLM(
    model="gpt-4o-mini",
    config=LLMConfig(temperature=0.1, json_mode=True),
)

ANALYSIS_PROMPT = """You are a news analyst. Analyse the article below for a technology industry monitor.
Extract entities, assess sentiment, and score relevance to the topic.
Be conservative with relevance — score 0.8+ only when the topic is the central subject."""

async def analyse_article(article: dict) -> dict:
    """Analyse a single article and return enriched metadata."""
    text = (
        f"Topic: {article['_topic']}\n"
        f"Title: {article['title']}\n"
        f"Source: {article['source']['name']}\n\n"
        f"{article.get('description', '')} {article.get('content', '')[:1000]}"
    )

    analysis: ArticleAnalysis = await llm.agenerate(
        text,
        system_prompt=ANALYSIS_PROMPT,
        response_model=ArticleAnalysis,
    )
    return {**article, "analysis": analysis}

async def analyse_batch(articles: list[dict]) -> list[dict]:
    """Analyse all articles concurrently to minimise wall-clock time."""
    results = await asyncio.gather(*[analyse_article(a) for a in articles])
    # Filter out low-relevance articles before digest generation
    return [r for r in results if r["analysis"].relevance_score >= 0.5]
```

## Step 4: Deduplicate and generate digest

```python
def deduplicate(articles: list[dict], similarity_threshold: float = 0.85) -> list[dict]:
    """Remove articles that cover the same event based on title similarity.

    A simple heuristic: if two titles share more than N words (excluding stopwords),
    keep only the one from the higher-reputation source.
    """
    STOPWORDS = {"the", "a", "an", "in", "of", "and", "to", "for", "on", "is", "are", "was"}
    SOURCE_RANK = {"Reuters": 1, "BBC News": 2, "TechCrunch": 3}

    seen_tokens: list[set] = []
    unique = []

    for article in sorted(articles, key=lambda a: SOURCE_RANK.get(a["source"]["name"], 99)):
        tokens = {
            w.lower() for w in article["title"].split()
            if w.lower() not in STOPWORDS and len(w) > 3
        }
        for seen in seen_tokens:
            overlap = len(tokens & seen) / max(len(tokens | seen), 1)
            if overlap >= similarity_threshold:
                break  # Duplicate — skip this article
        else:
            unique.append(article)
            seen_tokens.append(tokens)

    print(f"After deduplication: {len(unique)} unique stories (removed {len(articles)-len(unique)})")
    return unique

class DigestSection(BaseModel):
    topic: str
    headline: str
    summary: str
    articles: list[str] = Field(description="List of article URLs in this section")

class DailyDigest(BaseModel):
    date: str
    headline_story: str = Field(description="The single most important story of the day")
    sections: list[DigestSection]
    notable_companies: list[str] = Field(description="Companies that appeared most frequently")
    notable_people: list[str] = Field(description="People who appeared most frequently")
    sentiment_summary: str = Field(description="Overall tone of today's news in 1-2 sentences")

async def generate_digest(articles: list[dict]) -> DailyDigest:
    """Synthesise a daily digest from analysed articles."""

    # Build a compact representation of all articles for the digest prompt
    article_summaries = "\n\n".join([
        f"[{a['source']['name']}] {a['title']}\n"
        f"Relevance: {a['analysis'].relevance_score:.1f} | "
        f"Sentiment: {a['analysis'].sentiment}\n"
        f"{a['analysis'].one_liner}\n"
        f"URL: {a['url']}"
        for a in articles[:30]   # Cap at 30 to stay within context window
    ])

    digest_llm = OpenAILLM(
        model="gpt-4o",
        config=LLMConfig(temperature=0.2, max_tokens=2048, json_mode=True),
    )

    digest: DailyDigest = await digest_llm.agenerate(
        f"Today's articles:\n\n{article_summaries}",
        system_prompt=(
            "You are a senior analyst compiling a daily technology news digest. "
            "Group articles by theme, identify the most important story, and note "
            "which companies and people featured most prominently."
        ),
        response_model=DailyDigest,
    )
    return digest
```

## Complete working example

```python
import asyncio
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from typing import Literal
from synapsekit import LLMConfig
from synapsekit.llms.openai import OpenAILLM
from synapsekit.tools import NewsTool

class ArticleAnalysis(BaseModel):
    relevance_score: float
    sentiment: Literal["positive", "negative", "neutral"]
    one_liner: str
    key_facts: list[str]

class DailyDigest(BaseModel):
    date: str
    headline_story: str
    topic_summaries: list[str]
    notable_companies: list[str]
    sentiment_summary: str

async def main():
    news_tool = NewsTool(api_key="NEWS_API_KEY")
    llm       = OpenAILLM(model="gpt-4o-mini", config=LLMConfig(temperature=0.1, json_mode=True))
    digest_llm = OpenAILLM(model="gpt-4o",    config=LLMConfig(temperature=0.2, json_mode=True))

    topics = ["open source LLM", "AI safety", "generative AI startups"]
    since  = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")

    print("Fetching articles...")
    all_articles = []
    for topic in topics:
        articles = await news_tool.asearch(
            query=topic, from_date=since, language="en", max_results=10
        )
        for a in articles:
            a["_topic"] = topic
        all_articles.extend(articles)

    print(f"Analysing {len(all_articles)} articles concurrently...")
    async def analyse(a: dict) -> dict | None:
        try:
            text = f"Topic: {a['_topic']}\nTitle: {a['title']}\n{a.get('description','')}"
            result: ArticleAnalysis = await llm.agenerate(text, response_model=ArticleAnalysis)
            return {**a, "analysis": result} if result.relevance_score >= 0.5 else None
        except Exception:
            return None

    results  = await asyncio.gather(*[analyse(a) for a in all_articles])
    filtered = [r for r in results if r is not None]
    print(f"{len(filtered)} relevant articles after filtering.\n")

    article_text = "\n\n".join([
        f"[{a['source']['name']}] {a['title']}\n{a['analysis'].one_liner}"
        for a in filtered[:25]
    ])

    digest: DailyDigest = await digest_llm.agenerate(
        f"Articles from {since}:\n\n{article_text}",
        system_prompt="Compile a concise daily technology news digest.",
        response_model=DailyDigest,
    )

    print("=== Daily News Digest ===")
    print(f"Date:  {digest.date}")
    print(f"\nHeadline story:\n  {digest.headline_story}")
    print(f"\nTop companies: {', '.join(digest.notable_companies[:5])}")
    print(f"\nSentiment:\n  {digest.sentiment_summary}")
    print("\nTopic summaries:")
    for summary in digest.topic_summaries:
        print(f"  • {summary}")

asyncio.run(main())
```

## Expected output

```
Fetching articles...
Analysing 30 articles concurrently...
22 relevant articles after filtering.

=== Daily News Digest ===
Date:  2026-04-11

Headline story:
  Meta released LLaMA 4 with a 1M-token context window, claiming
  state-of-the-art performance on coding benchmarks at lower inference cost
  than competing open-weight models.

Top companies: Meta, Google DeepMind, Mistral AI, HuggingFace, Anthropic

Sentiment:
  Coverage is broadly positive, driven by excitement around new open-weight
  model releases. One negative thread relates to EU AI Act compliance concerns.

Topic summaries:
  • Open source LLM: Major releases from Meta and Mistral dominate coverage; community focus on quantisation and local deployment.
  • AI safety: Anthropic published new interpretability research; EU regulators signalled stricter enforcement timelines.
  • Generative AI startups: Three new funding rounds totalling $400M announced; enterprise adoption stories increasing.
```

## How it works

`NewsTool.asearch()` queries the NewsAPI and returns a list of article dicts. Each article is analysed in parallel with `asyncio.gather` — because each analysis is an independent LLM call, there is no reason to process them sequentially. The `relevance_score` from `ArticleAnalysis` acts as a noise filter: articles scoring below 0.5 are dropped before the digest step.

The digest uses a more capable model (GPT-4o) because it must synthesise patterns across dozens of articles — a task that benefits from stronger reasoning. The per-article analysis uses GPT-4o-mini because it just needs to classify a single article, a simpler task.

## Variations

**Send the digest to Slack:**
```python
import httpx

async def post_digest_to_slack(digest: DailyDigest, webhook_url: str):
    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": f"Daily News Digest — {digest.date}"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Headline:* {digest.headline_story}"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Sentiment:* {digest.sentiment_summary}"}},
    ]
    async with httpx.AsyncClient() as client:
        await client.post(webhook_url, json={"blocks": blocks})
```

**Schedule with APScheduler:**
```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()
scheduler.add_job(run_daily_digest, "cron", hour=8, minute=0)  # Run at 8 AM
scheduler.start()
```

## Troubleshooting

**NewsAPI returns `429 Too Many Requests`**
The free NewsAPI tier is limited to 100 requests per day. Cache results to a local file and only refetch when the cache is stale: `if cache_age > timedelta(hours=1): fetch_and_cache()`.

**Many articles have `relevance_score = 0.1`**
Broaden your search queries. NewsAPI relevance ranking does not perfectly match LLM-assessed relevance. Try adding synonyms: `"AI language model OR large language model OR LLM"`.

**Digest is repetitive**
The same event covered by multiple outlets inflates importance. Ensure deduplication runs before passing articles to the digest step.

## Next steps

- [Email Triage Agent](./email-triage) — deliver the digest by email with reply handling
- [Slack Q&A Bot](./slack-qa-bot) — let team members ask follow-up questions about today's news
- [YouTube Video Summarizer](./youtube-summarizer) — extend monitoring to video content
