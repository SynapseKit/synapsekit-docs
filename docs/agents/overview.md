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

SynapseKit includes 32+ built-in tools organized by category:

### Math and code
| Tool | Class | Description |
|---|---|---|
| Calculator | `CalculatorTool` | Safe math eval (sqrt, trig, log, etc.) |
| Python REPL | `PythonREPLTool` | Execute Python with persistent namespace |
| Shell | `ShellTool` | Run shell commands (use with care) |

### Web and search
| Tool | Class | Extra | Description |
|---|---|---|---|
| Web Search | `WebSearchTool` | `synapsekit[search]` | DuckDuckGo search |
| Web Fetch | `WebFetchTool` | none | Fetch and parse a URL |
| Wikipedia | `WikipediaTool` | none | Search Wikipedia |
| News Search | `NewsSearchTool` | `synapsekit[search]` | Recent news articles |

### File and data
| Tool | Class | Description |
|---|---|---|
| File Read | `FileReadTool` | Read local files (text, JSON, CSV) |
| File Write | `FileWriteTool` | Write content to local files |
| Directory List | `DirectoryListTool` | List files in a directory |
| CSV Reader | `CSVReaderTool` | Load and query CSV files |
| JSON Parser | `JSONParserTool` | Parse and extract fields from JSON |

### Database
| Tool | Class | Extra | Description |
|---|---|---|---|
| SQL Query | `SQLQueryTool` | `sqlalchemy` optional | SQL SELECT queries |
| SQLite | `SQLiteTool` | none | SQLite read/write |
| MongoDB | `MongoDBTool` | `motor` | MongoDB queries |

### APIs and integrations
| Tool | Class | Extra | Description |
|---|---|---|---|
| HTTP Request | `HTTPRequestTool` | none | GET/POST any HTTP endpoint |
| GitHub | `GitHubTool` | none | Read repos, issues, PRs |
| Slack | `SlackTool` | `slack-sdk` | Send Slack messages |
| Email | `EmailTool` | none | Send emails via SMTP |

### AI and ML
| Tool | Class | Description |
|---|---|---|
| Image Describer | `ImageDescriberTool` | Describe images using vision LLM |
| Text Classifier | `TextClassifierTool` | Zero-shot classification |
| Embeddings | `EmbeddingsTool` | Compute text embeddings |
| Vector Search | `VectorSearchTool` | Similarity search over a vector store |

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
- [Built-in Tools](./tools) — all 32+ tools with usage examples
- [AgentExecutor](./executor) — unified runner, multi-step loops, and streaming
- [Agent Cookbook](./cookbook) — 10 common patterns with full code examples
- [Tool Authoring Guide](./tool-authoring) — build custom tools with `@tool` and `BaseTool`
- [Multi-Agent](../multi-agent/overview) — coordinating multiple agents with message passing
