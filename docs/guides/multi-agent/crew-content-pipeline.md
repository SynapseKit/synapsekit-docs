---
sidebar_position: 2
title: "Crew Content Pipeline"
description: "Build a multi-agent content pipeline using SynapseKit's Crew and CrewMember to produce polished articles with a researcher, writer, and editor."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Crew Content Pipeline

<ColabBadge path="multi-agent/crew-content-pipeline.ipynb" />

A `Crew` groups specialized agents under shared coordination. Each `CrewMember` carries a role, a backstory, and a set of tools — the crew assigns tasks to members and manages execution order so you focus on what each agent should do, not how they hand off to one another.

**What you'll build:** A three-member crew (researcher, writer, editor) that takes a topic, gathers key facts, drafts a 500-word article, then polishes it for tone and clarity. **Time:** ~25 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit[openai]
```

You need an `OPENAI_API_KEY` environment variable set.

## What you'll learn

- Define a `Crew` with named `CrewMember` agents
- Give each member a role, a backstory, and focused instructions
- Create `Task` objects and assign them to specific members
- Run the crew sequentially and inspect each agent's output
- Pass the output of one task as context to the next

## Step 1: Import and configure

```python
# crew_content_pipeline.py

from __future__ import annotations
import asyncio

from synapsekit.agents import Crew, CrewMember, Task
from synapsekit.llms.openai import OpenAILLM
from synapsekit import LLMConfig

# A single LLM instance can be shared across all crew members, or each member
# can have its own — useful when different roles benefit from different models.
llm = OpenAILLM(
    model="gpt-4o-mini",
    config=LLMConfig(temperature=0.7),
)
```

## Step 2: Define crew members

```python
# Backstories ground the agent's persona and make outputs more consistent.
researcher = CrewMember(
    name="researcher",
    role="Research Analyst",
    backstory=(
        "You are a thorough research analyst with a talent for distilling "
        "complex topics into clear, accurate bullet-point summaries. "
        "You always cite the key claims you make."
    ),
    llm=llm,
)

writer = CrewMember(
    name="writer",
    role="Content Writer",
    backstory=(
        "You are an engaging content writer who transforms research notes "
        "into well-structured, reader-friendly articles. "
        "You write in an active voice and keep paragraphs short."
    ),
    llm=llm,
)

editor = CrewMember(
    name="editor",
    role="Senior Editor",
    backstory=(
        "You are a senior editor with high standards for clarity and flow. "
        "You tighten prose, fix awkward phrasing, and ensure the article "
        "has a strong opening and a satisfying conclusion."
    ),
    llm=llm,
)
```

## Step 3: Define tasks

```python
def build_tasks(topic: str) -> list[Task]:
    research_task = Task(
        description=f"Research the topic: '{topic}'. Produce 5–7 key facts, statistics, or insights in bullet-point form. Keep each bullet under 30 words.",
        assigned_to="researcher",
        # output_key names the field in the shared context other tasks can read
        output_key="research_notes",
    )

    write_task = Task(
        description="Using the research_notes from the previous task, write a 500-word article aimed at a general audience. Include an introduction, three body paragraphs, and a conclusion.",
        assigned_to="writer",
        # context_keys lists which previous outputs this task should receive
        context_keys=["research_notes"],
        output_key="draft_article",
    )

    edit_task = Task(
        description="Edit the draft_article for clarity, tone, and flow. Fix grammatical issues, tighten verbose sentences, and ensure the article reads smoothly from start to finish.",
        assigned_to="editor",
        context_keys=["draft_article"],
        output_key="final_article",
    )

    return [research_task, write_task, edit_task]
```

## Step 4: Assemble and run the crew

```python
async def run_crew(topic: str) -> str:
    tasks = build_tasks(topic)

    crew = Crew(
        name="content-crew",
        members=[researcher, writer, editor],
        tasks=tasks,
        # sequential=True means each task waits for the previous one to finish.
        # The output of each task is automatically injected into the next task's
        # context when context_keys is specified.
        sequential=True,
        verbose=True,   # Prints each agent's action to stdout
    )

    result = await crew.arun()

    # result.outputs is a dict keyed by output_key
    final = result.outputs["final_article"]
    print("\n--- FINAL ARTICLE ---")
    print(final)
    return final
```

## Complete working example

```python
async def main():
    topic = "The environmental impact of large language models"
    await run_crew(topic)

asyncio.run(main())
```

## Expected output

```
[researcher] Researching: 'The environmental impact of large language models'...
[researcher] Done. Produced 6 bullet points.

[writer] Writing article from research notes...
[writer] Done. Draft is 512 words.

[editor] Editing draft for clarity and flow...
[editor] Done. Final article ready.

--- FINAL ARTICLE ---
Training large language models demands enormous computational resources...
(full article text)
```

## How it works

When `crew.arun()` is called with `sequential=True`:

1. Tasks execute in the order they appear in the list.
2. After each task completes, the result is stored in a shared context dict under `output_key`.
3. Before the next task runs, any keys listed in `context_keys` are extracted from the shared context and appended to that task's prompt as a `Context:` block.
4. The `CrewMember` never sees the full task list — only its own task description and the injected context. This keeps prompts focused.

## Variations

**Use different models per role**

```python
researcher = CrewMember(
    name="researcher",
    role="Research Analyst",
    backstory="...",
    # Use a more capable model for the writer, faster/cheaper for research
    llm=OpenAILLM(model="gpt-4o", config=LLMConfig(temperature=0.3)),
)
```

**Add tools to a member**

```python
from synapsekit.tools import WebSearchTool

researcher = CrewMember(
    name="researcher",
    role="Research Analyst",
    backstory="...",
    llm=llm,
    tools=[WebSearchTool()],   # The researcher can now query the web
)
```

**Run tasks in parallel where possible**

When tasks have no dependencies on each other, omit `context_keys` and set `sequential=False`. The crew uses `asyncio.gather()` internally to run independent tasks concurrently.

## Troubleshooting

**Output from one task is not reaching the next**
Verify that `output_key` on the producing task matches one of the values in `context_keys` on the consuming task. Keys are case-sensitive.

**Agent ignores the injected context**
Increase the specificity of the task description. Instead of "use the previous notes", say "use the bullet points under `research_notes`". Some models respond better to explicit field references.

**Crew member produces off-topic output**
Tighten the `backstory` and add a constraint to the `description`, e.g., "Respond only with the requested output. Do not add commentary or caveats."

## Next steps

- [Supervisor Agent Routing](./supervisor-routing) — dynamically choose which agent handles each query
- [Parallel Agent Execution](./parallel-agent-execution) — run independent agents with `asyncio.gather()`
- [Agent Handoff Chains](./handoff-chains) — pass enriched context through a linear pipeline
