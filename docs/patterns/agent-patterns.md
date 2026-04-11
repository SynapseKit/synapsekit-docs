---
sidebar_position: 3
---

# Agent Patterns

15 copy-paste patterns for building agents, from minimal single-agent to multi-agent systems.

---

## 1. Minimal ReAct Agent (5 lines)

The simplest possible agent: a single LLM with no tools.

```python
from synapsekit.agents import ReActAgent
from synapsekit.llms.openai import OpenAILLM

agent = ReActAgent(llm=OpenAILLM(model="gpt-4o-mini"))
result = await agent.run("What is 42 squared?")
print(result.output)
```

---

## 2. FunctionCalling Agent with 3 Tools

Give an agent structured tools with automatic JSON schema generation.

```python
from synapsekit.agents import FunctionCallingAgent
from synapsekit.agents.tools import WebSearchTool, CalculatorTool, WikipediaTool
from synapsekit.llms.openai import OpenAILLM

agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o"),
    tools=[WebSearchTool(), CalculatorTool(), WikipediaTool()],
    max_steps=10,
)

result = await agent.run("What is the population of Tokyo multiplied by 2?")
print(result.output)
```

---

## 3. Agent with Web Search and File Output

Search the web and save the structured result to a file.

```python
from synapsekit.agents import FunctionCallingAgent
from synapsekit.agents.tools import TavilySearchTool, FileWriteTool
from synapsekit.llms.openai import OpenAILLM

agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o"),
    tools=[
        TavilySearchTool(api_key_env="TAVILY_API_KEY"),
        FileWriteTool(base_dir="/tmp/agent-output"),
    ],
    max_steps=8,
)

result = await agent.run(
    "Research the latest LLM benchmarks from 2026 and write a summary to benchmarks.md"
)
print(result.output)
```

---

## 4. Agent with Database Query

Give an agent read-only access to a SQL database.

```python
from synapsekit.agents import FunctionCallingAgent
from synapsekit.agents.tools import SQLTool
from synapsekit.llms.openai import OpenAILLM
import os

sql_tool = SQLTool(
    connection_string=os.environ["DATABASE_URL"],
    allowed_operations=["SELECT"],  # read-only
)

agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o"),
    tools=[sql_tool],
    max_steps=5,
)

result = await agent.run("How many users signed up in the last 30 days?")
print(result.output)
```

---

## 5. Streaming Agent with Thought Process Visible

Stream both the internal reasoning steps and the final answer in real time.

```python
from synapsekit.agents import ReActAgent
from synapsekit.agents.tools import WebSearchTool
from synapsekit.llms.openai import OpenAILLM

agent = ReActAgent(
    llm=OpenAILLM(model="gpt-4o"),
    tools=[WebSearchTool()],
    verbose=True,
)

async for event in agent.stream("What are the top AI news stories this week?"):
    if event.type == "thought":
        print(f"[Thinking] {event.content}")
    elif event.type == "action":
        print(f"[Tool] {event.tool}: {event.input}")
    elif event.type == "observation":
        print(f"[Result] {event.content[:100]}")
    elif event.type == "final":
        print(f"\n[Answer] {event.content}")
```

---

## 6. Agent with Memory Between Runs

Persist the agent's conversation history across process restarts.

```python
from synapsekit.agents import ReActAgent
from synapsekit.agents.tools import WebSearchTool
from synapsekit.memory import SQLiteConversationMemory
from synapsekit.llms.openai import OpenAILLM
import os

memory = SQLiteConversationMemory(
    path=os.path.expanduser("~/.synapsekit/agent-memory.db"),
    session_id="user-123",
)

agent = ReActAgent(
    llm=OpenAILLM(model="gpt-4o"),
    tools=[WebSearchTool()],
    memory=memory,
)

# First session
result1 = await agent.run("My name is Alice. Remember that.")

# Later session — same session_id, history is loaded from SQLite
result2 = await agent.run("What is my name?")
print(result2.output)  # "Your name is Alice."
```

---

## 7. Agent with BudgetGuard Cost Cap

Hard-cap how much an agent can spend per run.

```python
from synapsekit.agents import ReActAgent
from synapsekit.agents.tools import WebSearchTool, CalculatorTool
from synapsekit.llms.openai import OpenAILLM
from synapsekit import BudgetGuard, BudgetLimit, BudgetExceededError

guard = BudgetGuard(BudgetLimit(per_request=0.10))  # 10 cents max per run

agent = ReActAgent(
    llm=OpenAILLM(model="gpt-4o", budget_guard=guard),
    tools=[WebSearchTool(), CalculatorTool()],
    max_steps=10,
)

try:
    result = await agent.run("Analyse all the top 100 companies and rank them by revenue")
except BudgetExceededError:
    print("This query is too expensive — try a more focused question.")
```

---

## 8. Agent with ContentFilter Guardrails

Block harmful input before it reaches the LLM.

```python
from synapsekit.agents import ReActAgent
from synapsekit.guardrails import ContentFilter, ContentPolicy
from synapsekit.llms.openai import OpenAILLM

agent = ReActAgent(llm=OpenAILLM(model="gpt-4o-mini"), tools=[])

content_filter = ContentFilter(
    policy=ContentPolicy(block_hate_speech=True, block_violence=True)
)

async def safe_agent(user_input: str) -> str:
    check = await content_filter.check(user_input)
    if check.blocked:
        return f"I can't help with that: {check.reason}"
    result = await agent.run(user_input)
    return result.output

response = await safe_agent("How do I build a RAG pipeline?")
```

---

## 9. Multi-Agent: Supervisor + 2 Workers

A supervisor delegates subtasks to specialised workers and synthesises their outputs.

```python
from synapsekit.agents import FunctionCallingAgent, SupervisorAgent
from synapsekit.agents.tools import WebSearchTool, CalculatorTool
from synapsekit.llms.openai import OpenAILLM

llm = OpenAILLM(model="gpt-4o")

researcher = FunctionCallingAgent(
    name="researcher",
    llm=llm,
    tools=[WebSearchTool()],
    system_prompt="You are a research specialist. Find accurate, up-to-date information.",
)

analyst = FunctionCallingAgent(
    name="analyst",
    llm=llm,
    tools=[CalculatorTool()],
    system_prompt="You are a data analyst. Perform quantitative analysis and calculations.",
)

supervisor = SupervisorAgent(
    llm=llm,
    workers=[researcher, analyst],
    system_prompt="Delegate tasks to the right worker and synthesise their outputs.",
)

result = await supervisor.run("What was NVIDIA's revenue growth rate over the last 3 years?")
print(result.output)
```

---

## 10. Multi-Agent: HandoffChain

Pass the task sequentially from one agent to the next, each specialising in a different step.

```python
from synapsekit.agents import FunctionCallingAgent
from synapsekit.multi_agent import HandoffChain
from synapsekit.agents.tools import WebSearchTool, FileWriteTool
from synapsekit.llms.openai import OpenAILLM

llm = OpenAILLM(model="gpt-4o")

researcher = FunctionCallingAgent(
    name="researcher", llm=llm, tools=[WebSearchTool()],
    system_prompt="Research the topic thoroughly.",
)
writer = FunctionCallingAgent(
    name="writer", llm=llm, tools=[],
    system_prompt="Write a clear, structured report from the research.",
)
editor = FunctionCallingAgent(
    name="editor", llm=llm, tools=[FileWriteTool(base_dir="/tmp")],
    system_prompt="Polish the report and save it as report.md.",
)

chain = HandoffChain(agents=[researcher, writer, editor])
result = await chain.run("Write a report on the state of open-source LLMs in 2026")
print(result.output)
```

---

## 11. Multi-Agent: Crew with Roles

Define a crew of agents with explicit roles, backstories, and a shared task.

```python
from synapsekit.multi_agent import Crew, CrewMember, Task
from synapsekit.agents.tools import WebSearchTool
from synapsekit.llms.openai import OpenAILLM

llm = OpenAILLM(model="gpt-4o")

crew = Crew(
    members=[
        CrewMember(
            role="Senior Research Analyst",
            goal="Find comprehensive information on the given topic",
            backstory="Expert at synthesising complex technical research",
            tools=[WebSearchTool()],
            llm=llm,
        ),
        CrewMember(
            role="Technical Writer",
            goal="Transform research into clear documentation",
            backstory="Specialist in making complex topics accessible",
            llm=llm,
        ),
    ],
    task=Task(
        description="Research and document the differences between RAG and fine-tuning",
        expected_output="A structured markdown document with clear sections",
    ),
)

result = await crew.run()
print(result.output)
```

---

## 12. Agent via MCP Server

Connect your agent to an external tool server using the Model Context Protocol.

```python
from synapsekit.agents import FunctionCallingAgent
from synapsekit.agents.mcp import MCPClient
from synapsekit.llms.anthropic import AnthropicLLM

# Connect to a local or remote MCP server
mcp = MCPClient(server_url="http://localhost:3000/mcp")
await mcp.connect()

tools = await mcp.list_tools()  # discover available tools

agent = FunctionCallingAgent(
    llm=AnthropicLLM(model="claude-3-5-sonnet-20241022"),
    tools=tools,
    max_steps=10,
)

result = await agent.run("List all open GitHub issues labeled 'bug'")
print(result.output)
await mcp.disconnect()
```

---

## 13. Agent with `@eval_case` Quality Test

Write automated quality tests for your agent using the eval framework.

```python
from synapsekit.agents import FunctionCallingAgent
from synapsekit.agents.tools import CalculatorTool
from synapsekit.llms.openai import OpenAILLM
from synapsekit.evaluation import eval_case

agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=[CalculatorTool()],
)

@eval_case(metric="answer_relevancy", threshold=0.9)
async def test_calculator_agent():
    result = await agent.run("What is 15% of 240?")
    return result.output

@eval_case(metric="faithfulness", threshold=0.85)
async def test_no_hallucination():
    result = await agent.run("Multiply 123 by 456")
    return result.output

# Run with: pytest tests/ -q
```

---

## 14. Testing Agent with MockLLM (No API Calls)

Write fast, deterministic unit tests without making real LLM API calls.

```python
import pytest
from synapsekit.agents import FunctionCallingAgent
from synapsekit.agents.tools import CalculatorTool
from synapsekit.llms.mock import MockLLM

@pytest.mark.asyncio
async def test_agent_uses_calculator():
    mock_llm = MockLLM(responses=[
        # First call: agent decides to use the calculator
        '{"tool": "calculator", "input": {"expression": "42 * 7"}}',
        # Second call: agent formulates the final answer
        "The result is 294.",
    ])

    agent = FunctionCallingAgent(
        llm=mock_llm,
        tools=[CalculatorTool()],
    )

    result = await agent.run("What is 42 times 7?")
    assert "294" in result.output
    assert mock_llm.call_count == 2
```

---

## 15. Agent Node in a Graph Workflow

Embed an agent as a node inside a larger state graph workflow.

```python
from synapsekit.graph import StateGraph
from synapsekit.agents import FunctionCallingAgent
from synapsekit.agents.tools import WebSearchTool
from synapsekit.llms.openai import OpenAILLM

llm = OpenAILLM(model="gpt-4o")
research_agent = FunctionCallingAgent(llm=llm, tools=[WebSearchTool()], max_steps=5)

async def research_node(state: dict) -> dict:
    result = await research_agent.run(state["topic"])
    return {**state, "research": result.output}

async def summarise_node(state: dict) -> dict:
    summary = await llm.complete(
        f"Summarise this research in 3 bullet points:\n\n{state['research']}"
    )
    return {**state, "summary": summary}

workflow = StateGraph()
workflow.add_node("research", research_node)
workflow.add_node("summarise", summarise_node)
workflow.add_edge("research", "summarise")
workflow.set_entry_point("research")
workflow.set_finish_point("summarise")

graph = workflow.compile()
result = await graph.run({"topic": "Advances in multimodal LLMs in 2026"})
print(result["summary"])
```
