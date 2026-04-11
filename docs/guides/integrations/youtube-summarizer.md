---
sidebar_position: 7
title: "YouTube Video Summarizer"
description: "Extract transcripts from YouTube videos with YouTubeLoader and generate structured summaries with key timestamps using SynapseKit."
---

import ColabBadge from '@site/src/components/ColabBadge';

# YouTube Video Summarizer

<ColabBadge path="integrations/youtube-summarizer.ipynb" />

Long videos are hard to skim. A summarizer that extracts the transcript, identifies the key sections, and generates a structured summary with timestamps lets viewers decide whether to watch — and jump straight to the parts they care about.

**What you'll build:** A pipeline that loads a YouTube video's transcript with `YouTubeLoader`, generates a structured summary with timestamped sections, extracts key quotes, and outputs an action-item list. **Time:** ~15 min. **Difficulty:** Beginner

## Prerequisites

```bash
pip install synapsekit[openai,youtube]
export OPENAI_API_KEY=sk-...
# No YouTube API key required — transcripts use youtube-transcript-api
```

## What you'll learn

- Load YouTube transcripts with `YouTubeLoader`
- Handle videos with and without auto-generated captions
- Structure summary output with Pydantic timestamps
- Process long transcripts that exceed the LLM context window with chunking
- Export summaries to Markdown

## Step 1: Load the transcript

```python
import asyncio
from synapsekit.loaders import YouTubeLoader

# YouTubeLoader uses youtube-transcript-api to fetch the video transcript.
# It supports video URLs, shortened youtu.be links, and raw video IDs.
# When manual captions exist they are preferred over auto-generated ones.
loader = YouTubeLoader(
    # preferred_languages controls caption language priority
    preferred_languages=["en"],
    include_timestamps=True,    # Include start_time for each caption segment
)

async def load_video(url: str):
    docs = await loader.aload(url)

    # YouTubeLoader returns one Document per video.
    doc = docs[0]
    print(f"Title:    {doc.metadata['title']}")
    print(f"Channel:  {doc.metadata['channel']}")
    print(f"Duration: {doc.metadata['duration_seconds'] // 60} minutes")
    print(f"Transcript length: {len(doc.content)} characters\n")
    return doc
```

## Step 2: Define the summary schema

```python
from pydantic import BaseModel, Field
from typing import Optional

class TimestampedSection(BaseModel):
    title: str = Field(description="Section title — descriptive, 5-10 words")
    start_seconds: int = Field(description="Start time of the section in seconds")
    start_label: str = Field(description="Human-readable time label, e.g. '4:32'")
    summary: str = Field(description="2-4 sentence summary of this section's content")
    key_quote: Optional[str] = Field(
        default=None,
        description="The most memorable or insightful verbatim quote from this section"
    )

class VideoSummary(BaseModel):
    title: str
    one_liner: str = Field(description="One sentence that captures the entire video's value")
    tldr: str = Field(description="3-5 sentence executive summary")
    sections: list[TimestampedSection] = Field(
        description="3-8 major sections in chronological order"
    )
    key_takeaways: list[str] = Field(
        description="5-7 bullet points — the most actionable or important ideas"
    )
    action_items: list[str] = Field(
        description="Concrete actions a viewer can take after watching"
    )
    target_audience: str = Field(description="Who will benefit most from this video")
    tags: list[str] = Field(description="5 topic tags for categorisation")
```

## Step 3: Generate the summary

```python
from synapsekit import LLMConfig
from synapsekit.llms.openai import OpenAILLM

llm = OpenAILLM(
    model="gpt-4o",
    config=LLMConfig(temperature=0.2, max_tokens=2048, json_mode=True),
)

SUMMARY_PROMPT = """You are an expert content summariser. Analyse the video transcript below
and produce a structured summary.

For sections, identify the major topic shifts in the transcript. Use the timestamps
embedded in the transcript to give accurate start times for each section.

Write for someone who hasn't watched the video — be specific, not vague.
Include actual numbers, names, and examples from the transcript."""

async def summarise_video(doc) -> VideoSummary:
    """Generate a structured summary from a transcript Document."""

    # For very long videos, the transcript may exceed the LLM context window.
    # Truncate to the first 80,000 characters (~20,000 tokens) as a safe limit.
    transcript = doc.content[:80_000]
    if len(doc.content) > 80_000:
        transcript += "\n\n[Transcript truncated at 80,000 characters]"

    prompt = f"Video title: {doc.metadata['title']}\n\nTranscript:\n{transcript}"

    summary: VideoSummary = await llm.agenerate(
        prompt,
        system_prompt=SUMMARY_PROMPT,
        response_model=VideoSummary,
    )
    return summary
```

## Step 4: Export to Markdown

```python
def to_markdown(summary: VideoSummary, video_url: str) -> str:
    """Format the structured summary as a readable Markdown document."""
    lines = [
        f"# {summary.title}",
        f"\n> {summary.one_liner}",
        f"\n**Video:** {video_url}",
        f"\n**Target audience:** {summary.target_audience}",
        f"\n**Tags:** {', '.join(summary.tags)}",
        "\n## TL;DR",
        summary.tldr,
        "\n## Key Takeaways",
        *[f"- {t}" for t in summary.key_takeaways],
        "\n## Timestamped Sections",
    ]

    for section in summary.sections:
        lines += [
            f"\n### [{section.start_label}] {section.title}",
            section.summary,
        ]
        if section.key_quote:
            lines.append(f"\n> \"{section.key_quote}\"")

    lines += [
        "\n## Action Items",
        *[f"- [ ] {item}" for item in summary.action_items],
    ]

    return "\n".join(lines)
```

## Complete working example

```python
import asyncio
from pydantic import BaseModel, Field
from typing import Optional
from synapsekit import LLMConfig
from synapsekit.llms.openai import OpenAILLM
from synapsekit.loaders import YouTubeLoader

class TimestampedSection(BaseModel):
    title: str
    start_seconds: int
    start_label: str
    summary: str
    key_quote: Optional[str] = None

class VideoSummary(BaseModel):
    title: str
    one_liner: str
    tldr: str
    sections: list[TimestampedSection]
    key_takeaways: list[str]
    action_items: list[str]
    target_audience: str
    tags: list[str]

async def main():
    loader = YouTubeLoader(preferred_languages=["en"], include_timestamps=True)
    llm    = OpenAILLM(
        model="gpt-4o",
        config=LLMConfig(temperature=0.2, max_tokens=2048, json_mode=True),
    )

    # Replace with any YouTube URL
    video_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    print(f"Loading transcript for: {video_url}")
    docs = await loader.aload(video_url)
    doc  = docs[0]
    print(f"Title:    {doc.metadata['title']}")
    print(f"Duration: {doc.metadata['duration_seconds'] // 60} min\n")

    print("Generating structured summary...")
    summary: VideoSummary = await llm.agenerate(
        f"Title: {doc.metadata['title']}\n\nTranscript:\n{doc.content[:80_000]}",
        system_prompt=(
            "Analyse the transcript and return a structured VideoSummary. "
            "Be specific — cite actual quotes, timestamps, and examples."
        ),
        response_model=VideoSummary,
    )

    print(f"\n{'='*60}")
    print(f"  {summary.title}")
    print(f"{'='*60}")
    print(f"\nTL;DR: {summary.tldr}\n")

    print("SECTIONS:")
    for s in summary.sections:
        print(f"  [{s.start_label}] {s.title}")
        print(f"    {s.summary[:120]}...")

    print("\nKEY TAKEAWAYS:")
    for t in summary.key_takeaways:
        print(f"  • {t}")

    print("\nACTION ITEMS:")
    for item in summary.action_items:
        print(f"  [ ] {item}")

    # Save as Markdown
    md = "\n".join([
        f"# {summary.title}",
        f"\n{summary.tldr}",
        "\n## Sections",
        *[f"\n### [{s.start_label}] {s.title}\n{s.summary}" for s in summary.sections],
        "\n## Key Takeaways",
        *[f"- {t}" for t in summary.key_takeaways],
    ])
    with open("summary.md", "w") as f:
        f.write(md)
    print("\nSaved to summary.md")

asyncio.run(main())
```

## Expected output

```
Loading transcript for: https://www.youtube.com/watch?v=...
Title:    How to Build a RAG Pipeline from Scratch
Duration: 28 min

Generating structured summary...

============================================================
  How to Build a RAG Pipeline from Scratch
============================================================

TL;DR: This tutorial walks through building a retrieval-augmented generation
pipeline from scratch using Python. The host covers document ingestion,
chunking strategies, vector embeddings, and query-time retrieval, then
demonstrates the complete system on a 200-page PDF.

SECTIONS:
  [0:00] Introduction and Prerequisites
    The host introduces RAG, explains why it outperforms fine-tuning for
    knowledge-intensive tasks, and lists the required libraries...
  [4:32] Document Ingestion and Chunking
    Covers PDF parsing with PyMuPDF, fixed-size vs. semantic chunking...
  [11:15] Embedding and Vector Storage
    Demonstrates OpenAI embeddings and Chroma vector store setup...

KEY TAKEAWAYS:
  • Chunk size of 512 tokens with 64-token overlap gives the best retrieval precision
  • Always store document metadata alongside embeddings for source attribution
  • Re-ranking retrieved chunks before passing to the LLM improves answer quality

ACTION ITEMS:
  [ ] Install the required libraries: pip install langchain chromadb openai
  [ ] Download the sample PDF from the video description
  [ ] Run the starter notebook linked in the description

Saved to summary.md
```

## How it works

`YouTubeLoader` calls `youtube-transcript-api` to fetch the caption track as a list of `{text, start, duration}` segments. It concatenates them into a single string, optionally injecting `[MM:SS]` markers at natural break points for the LLM to use as timestamp references. The structured summary is generated in one LLM call with `response_model=VideoSummary`, then validated by Pydantic before being returned.

For very long videos (1+ hours), the transcript will exceed most LLM context windows. The 80,000-character truncation keeps the input within GPT-4o's 128K context limit. For true full-video summarisation of longer content, use a map-reduce approach: summarise each 15-minute chunk separately, then summarise the chunk summaries.

## Variations

**Summarise a playlist:**
```python
import asyncio

playlist_urls = [
    "https://youtu.be/video1",
    "https://youtu.be/video2",
    "https://youtu.be/video3",
]

summaries = await asyncio.gather(*[
    summarise_video_url(url) for url in playlist_urls
])
```

**Map-reduce for videos longer than 60 minutes:**
```python
async def summarise_long_video(doc, chunk_chars: int = 20_000) -> VideoSummary:
    chunks = [doc.content[i:i+chunk_chars]
              for i in range(0, len(doc.content), chunk_chars)]

    chunk_summaries = await asyncio.gather(*[
        llm.agenerate(chunk, system_prompt="Summarise this transcript section in 5 bullet points.")
        for chunk in chunks
    ])

    combined = "\n\n".join(r.text for r in chunk_summaries)
    return await llm.agenerate(combined, response_model=VideoSummary)
```

## Troubleshooting

**`TranscriptsDisabled` error**
Some YouTube channels disable transcripts. There is no workaround — you cannot fetch a transcript the uploader has blocked. Check whether auto-generated captions are available by opening the video in YouTube and looking for the CC button.

**Transcript is in the wrong language**
Set `preferred_languages=["fr", "en"]` to prefer French with English as fallback. Pass `translate_to="en"` to automatically translate non-English transcripts.

**Summary is vague ("the speaker discusses...")**
Add to the prompt: "Be specific. Cite actual quotes, statistics, tool names, and examples from the transcript. Avoid vague phrases like 'the speaker discusses'."

## Next steps

- [Notion Knowledge Base](./notion-knowledge-base) — index video summaries alongside your Notion docs
- [News Monitoring Dashboard](./news-monitoring-dashboard) — apply the same summarisation pattern to news articles
- [Structured Output with Pydantic](../llms/structured-output-pydantic) — customise the summary schema for your use case
