---
sidebar_position: 1
---

# Agents Overview

SynapseKit agents are async-first, tool-using AI systems that reason and act to complete tasks. An agent combines an LLM with a set of tools, loops until a task is complete, and tracks the full reasoning trace.

## Core concepts

| Concept | Class | Description |
|---|---|---|
| **Tool** | `BaseTool` | A single action the agent can take |
| **Registry** | `ToolRegistry` | Looks up tools by name, generates schemas |
| **Memory** | `AgentMemory` | Records Thought→Action→Observation steps |
| **ReAct** | `ReActAgent` | Prompt-based reasoning loop, any LLM |
| **Function Calling** | `FunctionCallingAgent` | Native OpenAI/Anthropic tool use |
| **Executor** | `AgentExecutor` | Unified runner — picks the right agent |

## Quick start

```python
import asyncio
from synapsekit import AgentExecutor, AgentConfig, CalculatorTool
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.base import LLMConfig

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

executor = AgentExecutor(AgentConfig(
    llm=llm,
    tools=[CalculatorTool()],
    agent_type="function_calling",
))

answer = asyncio.run(executor.run("What is 2 ** 10 + 24?"))
print(answer)  # "The answer is 1048."
```

## Agent type selection guide

Choose your agent type based on your LLM and task requirements:

| Scenario | Recommended type | Why |
|---|---|---|
| OpenAI or Anthropic LLM | `function_calling` | Native tool_calls, more reliable |
| Any other LLM (Ollama, Mistral, etc.) | `react` | Works via structured text prompts |
| Need full control over loop | `react` | Easy to inspect Thought/Action/Observation |
| Production with strict tool schemas | `function_calling` | Typed arguments, fewer hallucinations |
| Local/offline models | `react` | No function-calling API needed |
| MCP (Model Context Protocol) tools | `mcp` | Connects to external MCP servers |

## Agent types

**`"react"`** — Works with any LLM. Uses a structured text prompt (Thought/Action/Observation). No native function calling required. Best for local models and providers without tool-use APIs.

**`"function_calling"`** — Requires `OpenAILLM` or `AnthropicLLM`. Uses native `tool_calls` / `tool_use` for more reliable tool selection and type-safe arguments.

**`"mcp"`** — Connects to external [Model Context Protocol](https://modelcontextprotocol.io) servers. Access any MCP-compatible tool (filesystem, databases, APIs) without writing wrapper code.

## Built-in tools

SynapseKit includes 40 built-in tools organized by category:

### Math and code
| Tool | Class | Description |
|---|---|---|
| Calculator | `CalculatorTool` | Safe math eval (sqrt, trig, log, etc.) |
| Python REPL | `PythonREPLTool` | Execute Python with persistent namespace |
| Shell | `ShellTool` | Run shell commands (use with care) |

### Web and search
| Tool | Class | Extra | Description |
|---|---|---|---|
| Web Search | `WebSearchTool` | `synapsekit[search]` | DuckDuckGo web search |
| DuckDuckGo | `DuckDuckGoSearchTool` | `synapsekit[search]` | Text and news search |
| Wikipedia | `WikipediaTool` | none | Search Wikipedia articles |
| Arxiv | `ArxivSearchTool` | none | Academic paper search |
| PubMed | `PubMedSearchTool` | none | Biomedical literature search |
| Tavily | `TavilySearchTool` | `synapsekit[tavily]` | AI-optimized web search |
| Brave Search | `BraveSearchTool` | none | Brave Search API |
| YouTube | `YouTubeSearchTool` | `synapsekit[youtube]` | YouTube video search |
| Bing Search | `BingSearchTool` | none | Bing Web Search API v7 |
| Wolfram Alpha | `WolframAlphaTool` | none | Wolfram Alpha short-answer API |

### File and data
| Tool | Class | Description |
|---|---|---|
| File Read | `FileReadTool` | Read local files |
| File Write | `FileWriteTool` | Write content to local files |
| File List | `FileListTool` | List files in a directory |
| PDF Reader | `PDFReaderTool` | Extract text from PDFs |
| JSON Query | `JSONQueryTool` | Query JSON with dot-notation paths |
| Regex | `RegexTool` | Apply regex (findall, replace, split) |
| DateTime | `DateTimeTool` | Get/format/parse dates and times |

### Database
| Tool | Class | Extra | Description |
|---|---|---|---|
| SQL Query | `SQLQueryTool` | `sqlalchemy` optional | SQL SELECT queries |
| SQL Schema | `SQLSchemaInspectionTool` | `sqlalchemy` optional | Inspect DB schema |
| GraphQL | `GraphQLTool` | `synapsekit[http]` | Execute GraphQL queries |
| HTTP Request | `HTTPRequestTool` | none | GET/POST/PUT/DELETE any endpoint |

### APIs and integrations
| Tool | Class | Extra | Description |
|---|---|---|---|
| GitHub API | `GitHubAPITool` | none | Search repos, issues, PRs |
| Slack | `SlackTool` | none | Send messages via webhook or bot token |
| Email | `EmailTool` | none | Send emails via SMTP |
| Jira | `JiraTool` | none | Search, create, comment on Jira issues |
| Google Calendar | `GoogleCalendarTool` | `synapsekit[gcal-tool]` | List, create, delete calendar events |
| AWS Lambda | `AWSLambdaTool` | `synapsekit[aws-lambda]` | Invoke Lambda functions |
| API Builder | `APIBuilderTool` | none | Execute API calls from OpenAPI specs |

### AI and ML
| Tool | Class | Extra | Description |
|---|---|---|---|
| Summarization | `SummarizationTool` | LLM required | Summarize text with an LLM |
| Sentiment Analysis | `SentimentAnalysisTool` | LLM required | Analyze text sentiment |
| Translation | `TranslationTool` | LLM required | Translate between languages |
| Image Analysis | `ImageAnalysisTool` | `synapsekit[openai]` | Analyze images with a vision LLM |
| Text to Speech | `TextToSpeechTool` | `synapsekit[openai]` | Convert text to audio (OpenAI TTS) |
| Speech to Text | `SpeechToTextTool` | `synapsekit[openai]` | Transcribe audio (Whisper API/local) |
| Vector Search | `VectorSearchTool` | none | Similarity search over a vector store |
| Human Input | `HumanInputTool` | none | Pause to collect user input |

## ReActAgent vs FunctionCallingAgent vs MCPAgent

| Feature | `ReActAgent` | `FunctionCallingAgent` | `MCPAgent` |
|---|---|---|---|
| LLM requirement | Any LLM | OpenAI / Anthropic only | Any LLM with function calling |
| Tool format | Text prompt | JSON schema (tool_calls) | MCP protocol |
| Reliability | Good | Excellent | Depends on MCP server |
| Tracing | Thought/Action/Obs | Tool call history | Tool call history |
| Best for | Flexibility, local LLMs | Production, typed outputs | Ecosystem integrations |
| Streaming | Yes | Yes | Yes |
| Max steps | Configurable | Configurable | Configurable |

## Multi-agent patterns

For complex tasks, coordinate multiple agents:

```python
from synapsekit.multi_agent import HandoffChain, Crew

# Sequential: researcher → writer → reviewer
chain = HandoffChain([
    researcher_agent,
    writer_agent,
    reviewer_agent,
])
result = await chain.run("Write a technical blog post about vector databases.")

# Parallel crew: multiple agents tackle sub-tasks simultaneously
crew = Crew(agents=[data_agent, chart_agent, summary_agent])
results = await crew.run("Analyze Q4 sales data.")
```

See [Multi-Agent](../multi-agent/overview) for full patterns.

## Sync usage

```python
executor = AgentExecutor(AgentConfig(llm=llm, tools=[CalculatorTool()]))
answer = executor.run_sync("What is sqrt(144)?")
print(answer)  # "The square root of 144 is 12."
```

## Cost and latency tips

- Use `gpt-4o-mini` or `llama-3.1-8b` for agent loops — cheaper and faster per step
- Set `max_steps` to cap runaway loops: `AgentConfig(max_steps=10)`
- Use `BudgetGuard` to hard-stop on cost: `AgentConfig(budget_usd=0.10)`
- Enable caching on the LLM to avoid re-calling identical sub-queries
- For latency-sensitive agents, use Groq or Cerebras for the underlying LLM

```python
from synapsekit import AgentConfig, BudgetGuard

config = AgentConfig(
    llm=llm,
    tools=[WebSearchTool(), CalculatorTool()],
    agent_type="function_calling",
    max_steps=15,
    budget_guard=BudgetGuard(max_cost_usd=0.50),
)
```

## Next steps

- [ReAct Agent](./react) — prompt-based reasoning loop that works with any LLM
- [Function Calling Agent](./function-calling) — native tool_calls for OpenAI and Anthropic
- [Built-in Tools](./tools) — all 40 tools with usage examples
- [AgentExecutor](./executor) — unified runner, multi-step loops, and streaming
- [Streaming Steps](./streaming-steps) — stream `ThoughtEvent`, `ActionEvent`, `TokenEvent` in real time
- [Agent Cookbook](./cookbook) — 10 common patterns with full code examples
- [Tool Authoring Guide](./tool-authoring) — build custom tools with `@tool` and `BaseTool`
- [Multi-Agent](../multi-agent/overview) — coordinating multiple agents with message passing
