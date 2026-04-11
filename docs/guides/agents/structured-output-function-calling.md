---
sidebar_position: 10
title: "Structured Output with Function Calling"
description: "Use Pydantic models as output schemas with SynapseKit's FunctionCallingAgent to get typed, validated responses."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Structured Output with Function Calling

<ColabBadge path="agents/structured-output-function-calling.ipynb" />

Getting structured data out of an LLM — a typed dict, a list of objects, or a nested model — is one of the most practical patterns in production LLM applications. Function calling is the most reliable mechanism: the LLM fills in a JSON schema instead of generating free text, and Pydantic validates the result. **What you'll build:** an agent that returns typed Pydantic models for tasks like entity extraction, report generation, and multi-step research with a structured summary. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit pydantic
export OPENAI_API_KEY="sk-..."
```

## What you'll learn

- How to use a Pydantic model as a tool schema to force structured output
- The "extraction tool" pattern: define the desired schema as a tool, the LLM "calls" it to produce output
- How to validate and deserialize LLM output into typed Python objects
- Combining structured output with real tool calls in the same agent
- Handling optional fields and nested models

## Step 1: Define output schemas as Pydantic models

```python
import asyncio
import json
from typing import Any
from pydantic import BaseModel, Field
from synapsekit.agents import BaseTool, FunctionCallingAgent, ToolResult
from synapsekit.llms.openai import OpenAILLM
```

Define the target shape of the output using Pydantic:

```python
class CompanyProfile(BaseModel):
    name: str = Field(description="Official company name")
    industry: str = Field(description="Primary industry sector")
    founded_year: int | None = Field(None, description="Year the company was founded")
    headquarters: str = Field(description="City and country of headquarters")
    key_products: list[str] = Field(description="Top 3-5 products or services")
    competitors: list[str] = Field(description="Main competitors")
    summary: str = Field(description="2-3 sentence company summary")


class NewsArticle(BaseModel):
    title: str
    source: str
    published_date: str | None = None
    key_points: list[str] = Field(description="3-5 key takeaways from the article")
    sentiment: str = Field(description="Overall sentiment: positive, negative, or neutral")


class ResearchReport(BaseModel):
    topic: str
    findings: list[str] = Field(description="Key facts and findings, one per item")
    sources: list[str] = Field(description="Source names or URLs")
    confidence: str = Field(description="Confidence level: high, medium, or low")
    conclusion: str = Field(description="Single-paragraph conclusion")
```

## Step 2: Create extraction tools from Pydantic models

The "extraction tool" pattern treats the Pydantic schema as a tool that the LLM "calls" to produce structured output. The tool's job is to receive the validated JSON, deserialize it, and store or return it.

```python
def make_extraction_tool(model_class: type[BaseModel], tool_name: str, description: str) -> BaseTool:
    """Create a BaseTool that extracts data into a Pydantic model."""

    # Convert Pydantic schema to OpenAI-compatible JSON Schema
    pydantic_schema = model_class.model_json_schema()

    class ExtractionTool(BaseTool):
        name = tool_name
        description = description
        parameters = pydantic_schema

        # Store the last extracted result for retrieval after the run
        last_result: model_class | None = None

        async def run(self, **kwargs: Any) -> ToolResult:
            try:
                # Pydantic validates and coerces the LLM's JSON output
                instance = model_class(**kwargs)
                ExtractionTool.last_result = instance
                return ToolResult(output=instance.model_dump_json())
            except Exception as e:
                return ToolResult(output="", error=f"Schema validation failed: {e}")

    return ExtractionTool()
```

## Step 3: Build a structured extraction agent

```python
company_extractor = make_extraction_tool(
    CompanyProfile,
    tool_name="extract_company_profile",
    description=(
        "Call this tool to return a structured company profile. "
        "Use it when you have gathered enough information to fill all fields."
    ),
)

agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=[company_extractor],
    system_prompt=(
        "You are a business analyst. When asked about a company, "
        "call extract_company_profile with all available information. "
        "Do not answer in plain text — always call the tool."
    ),
    max_iterations=3,
)
```

## Step 4: Combine real tools with structured output

For agents that need to search before extracting, combine research tools with the extraction tool:

```python
from synapsekit.agents import DuckDuckGoSearchTool, WikipediaTool

research_extractor = make_extraction_tool(
    ResearchReport,
    tool_name="submit_research_report",
    description=(
        "Call this tool AFTER completing research to submit the final structured report. "
        "Fill all fields based on information gathered from search and Wikipedia."
    ),
)

research_agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=[
        DuckDuckGoSearchTool(),
        WikipediaTool(),
        research_extractor,
    ],
    system_prompt=(
        "You are a research analyst. Research the given topic using search and Wikipedia, "
        "then submit a structured report using submit_research_report. "
        "Always call submit_research_report as your final action."
    ),
    max_iterations=8,
)
```

## Step 5: Extract and validate the typed result

After `agent.run()`, recover the typed Pydantic object from the extraction tool:

```python
async def extract_company(company_name: str) -> CompanyProfile | None:
    await agent.run(f"Create a detailed profile for the company: {company_name}")
    return company_extractor.__class__.last_result
```

## Complete working example

```python
import asyncio
import json
from typing import Any
from pydantic import BaseModel, Field
from synapsekit.agents import (
    BaseTool,
    DuckDuckGoSearchTool,
    FunctionCallingAgent,
    ToolResult,
    WikipediaTool,
)
from synapsekit.llms.openai import OpenAILLM


class ResearchReport(BaseModel):
    topic: str = Field(description="Research topic")
    findings: list[str] = Field(description="3-5 key findings, one per list item")
    sources: list[str] = Field(description="Source names referenced")
    confidence: str = Field(description="Confidence level: high, medium, or low")
    conclusion: str = Field(description="One-paragraph conclusion")


def make_report_tool() -> BaseTool:
    class ReportTool(BaseTool):
        name = "submit_research_report"
        description = (
            "Submit the final structured research report. "
            "Call this as your last action after gathering all information."
        )
        parameters = ResearchReport.model_json_schema()
        last_result: ResearchReport | None = None

        async def run(self, **kwargs: Any) -> ToolResult:
            try:
                report = ResearchReport(**kwargs)
                ReportTool.last_result = report
                return ToolResult(output=f"Report submitted: {report.topic}")
            except Exception as e:
                return ToolResult(output="", error=str(e))

    return ReportTool()


async def research_topic(topic: str) -> ResearchReport | None:
    report_tool = make_report_tool()

    agent = FunctionCallingAgent(
        llm=OpenAILLM(model="gpt-4o-mini"),
        tools=[
            DuckDuckGoSearchTool(),
            WikipediaTool(),
            report_tool,
        ],
        system_prompt=(
            "You are a research analyst. Use search and Wikipedia to research the topic. "
            "Then call submit_research_report with structured findings. "
            "Always end by calling submit_research_report."
        ),
        max_iterations=8,
    )

    await agent.run(f"Research the following topic and submit a report: {topic}")
    return report_tool.__class__.last_result


async def main() -> None:
    topics = [
        "The current state of quantum computing hardware",
        "SynapseKit Python library for LLM applications",
    ]

    for topic in topics:
        print(f"\nResearching: {topic}")
        print("-" * 60)
        report = await research_topic(topic)

        if report is None:
            print("No report generated.")
            continue

        print(f"Topic:      {report.topic}")
        print(f"Confidence: {report.confidence}")
        print(f"\nFindings:")
        for i, finding in enumerate(report.findings, 1):
            print(f"  {i}. {finding}")
        print(f"\nSources: {', '.join(report.sources)}")
        print(f"\nConclusion:\n{report.conclusion}")

        # Access as a typed Python object — no manual JSON parsing needed
        report_dict = report.model_dump()
        print(f"\nJSON keys: {list(report_dict.keys())}")


asyncio.run(main())
```

## Expected output

```
Researching: The current state of quantum computing hardware
------------------------------------------------------------
Topic:      The current state of quantum computing hardware
Confidence: high

Findings:
  1. IBM's Condor processor reached 1,000+ qubits in late 2023
  2. Google achieved quantum supremacy benchmarks with Sycamore
  3. Error correction remains the primary engineering challenge
  4. Trapped-ion and superconducting approaches are the leading architectures

Sources: Wikipedia, DuckDuckGo search results
Conclusion:
Quantum computing hardware has advanced significantly, with IBM and Google leading...

JSON keys: ['topic', 'findings', 'sources', 'confidence', 'conclusion']
```

## How it works

The extraction tool pattern works because the LLM interprets the instruction "call this tool to return your answer" as the termination condition. Instead of generating free text, it fills the tool's JSON schema — which Pydantic then validates. If required fields are missing or types are wrong, `model_class(**kwargs)` raises a `ValidationError`, which the tool returns as a `ToolResult` error, giving the LLM a chance to retry with corrected values.

`model_json_schema()` (Pydantic v2) converts the model's field definitions, type annotations, and `Field(description=...)` metadata into an OpenAI-compatible JSON Schema object. The `description` strings become the parameter descriptions that guide the LLM's field population.

## Variations

**Extract a list of objects** by wrapping in a container model:

```python
class ArticleList(BaseModel):
    articles: list[NewsArticle]
    total_count: int

list_extractor = make_extraction_tool(ArticleList, "submit_articles", "Submit a list of news articles.")
```

**Use OpenAI's `response_format` for simpler cases** (no tool call needed):

```python
# Note: response_format is available on OpenAILLM via the underlying SDK
# For full control, the extraction tool pattern is more portable across providers
```

**Return the Pydantic object directly** from `run()` by serializing with `model_dump_json()`:

```python
async def run_and_parse(agent, question: str, model_class: type[BaseModel]) -> BaseModel | None:
    await agent.run(question)
    for step in agent.memory.steps:
        try:
            data = json.loads(step.observation)
            return model_class(**data)
        except Exception:
            continue
    return None
```

## Troubleshooting

**`ValidationError`: field required** — the LLM did not fill all required fields. Add `field_name: str | None = None` to make fields optional, or strengthen the system prompt: "You must populate every field in the schema."

**Agent calls the extraction tool immediately without researching** — the description says "call when done" but the LLM ignores it. Add to `system_prompt`: "You must call at least one research tool before calling submit_research_report."

**`model_json_schema()` not found** — you are using Pydantic v1. Replace with `model_class.schema()` for v1 compatibility.

**Nested model fields populated as strings instead of objects** — the LLM serialized the nested model as a JSON string. Normalize with `json.loads()` before passing to Pydantic, or use `model_validate_json()` instead of `model_class(**kwargs)`.

## Next steps

- [Multi-Tool Orchestration](./multi-tool-orchestration) — combine structured output with a larger toolset
- [Tool Error Handling and Retries](./tool-error-handling) — retry when Pydantic validation fails
- [SQL Database Agent](./sql-database-agent) — return SQL query results as typed Pydantic models
