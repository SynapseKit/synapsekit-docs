---
sidebar_position: 7
---

# Agent Cookbook

A collection of common agent patterns with full working code examples. Copy-paste and adapt these recipes for your use case.

---

## 1. Web research agent

Search the web and summarize findings into a structured report:

```python
import asyncio
from synapsekit import AgentExecutor, AgentConfig, tool
from synapsekit.llm.openai import OpenAILLM
from synapsekit import LLMConfig, WebSearchTool, WebFetchTool

@tool
def summarize_page(url: str, question: str) -> str:
    """Fetch a web page and extract content relevant to a question."""
    import urllib.request
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
        # Strip HTML tags (simple)
        import re
        text = re.sub(r"<[^>]+>", " ", html)
        text = " ".join(text.split())[:2000]
        return text
    except Exception as e:
        return f"Could not fetch {url}: {e}"

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

executor = AgentExecutor(AgentConfig(
    llm=llm,
    tools=[WebSearchTool(), WebFetchTool(), summarize_page],
    agent_type="function_calling",
    max_steps=10,
    system_prompt=(
        "You are a research assistant. Search for information, read sources, "
        "and produce a concise summary with key findings and sources cited."
    ),
))

report = asyncio.run(executor.run(
    "Research the current state of open-source LLMs in 2026. "
    "What are the top 3 models and their key capabilities?"
))
print(report)
```

---

## 2. Code review agent

Read a file, analyze it, and produce a structured review:

```python
import asyncio
from synapsekit import AgentExecutor, AgentConfig, tool
from synapsekit.llm.anthropic import AnthropicLLM
from synapsekit import LLMConfig, FileReadTool, PythonREPLTool

@tool
def run_tests(test_command: str) -> str:
    """Run the test suite and return results."""
    import subprocess
    result = subprocess.run(
        test_command.split(),
        capture_output=True,
        text=True,
        timeout=30,
    )
    return result.stdout + result.stderr

llm = AnthropicLLM(LLMConfig(
    model="claude-sonnet-4-6",
    api_key="sk-ant-...",
    max_tokens=4096,
))

executor = AgentExecutor(AgentConfig(
    llm=llm,
    tools=[FileReadTool(), PythonREPLTool(), run_tests],
    agent_type="function_calling",
    system_prompt=(
        "You are a senior code reviewer. Read the file, check for bugs, "
        "style issues, and performance problems. Run tests if available. "
        "Return a structured review with: summary, issues (critical/minor), "
        "and specific suggestions."
    ),
))

review = asyncio.run(executor.run(
    "Review the file at src/synapsekit/llm/openai.py. "
    "Focus on error handling and async safety."
))
print(review)
```

---

## 3. Customer support agent

Classify intent, respond appropriately, and escalate if needed:

```python
import asyncio
from synapsekit import AgentExecutor, AgentConfig, tool
from synapsekit.llm.openai import OpenAILLM
from synapsekit import LLMConfig

@tool
def lookup_order(order_id: str) -> dict:
    """Look up an order by ID in the database."""
    # In practice, query your database
    orders = {
        "ORD-123": {"status": "shipped", "eta": "2 days", "item": "SynapseKit Pro"},
        "ORD-456": {"status": "processing", "eta": "5 days", "item": "SynapseKit Basic"},
    }
    return orders.get(order_id, {"error": f"Order {order_id} not found"})

@tool
def create_support_ticket(
    category: str,
    priority: str,
    description: str,
    customer_email: str,
) -> dict:
    """Create a support ticket and assign it to the right team."""
    ticket_id = f"TKT-{hash(description) % 10000:04d}"
    return {
        "ticket_id": ticket_id,
        "category": category,
        "priority": priority,
        "assigned_to": "billing@company.com" if category == "billing" else "support@company.com",
        "message": f"Ticket {ticket_id} created and team notified.",
    }

@tool
def send_response_email(to: str, subject: str, body: str) -> str:
    """Send a support response email to the customer."""
    # In practice, use SMTP or a mailing API
    print(f"EMAIL → {to}: {subject}\n{body}")
    return f"Email sent to {to}"

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

executor = AgentExecutor(AgentConfig(
    llm=llm,
    tools=[lookup_order, create_support_ticket, send_response_email],
    agent_type="function_calling",
    system_prompt=(
        "You are a customer support agent. Classify the customer's intent "
        "(billing/order/technical/other), look up relevant information, "
        "respond helpfully, and escalate complex issues by creating a ticket."
    ),
))

response = asyncio.run(executor.run(
    "Hi, I'm John (john@example.com). My order ORD-123 hasn't arrived yet "
    "and I'm worried. Can you help?"
))
print(response)
```

---

## 4. Data analysis agent

Load a CSV, compute statistics, and generate a chart:

```python
import asyncio
from synapsekit import AgentExecutor, AgentConfig
from synapsekit.llm.openai import OpenAILLM
from synapsekit import LLMConfig, PythonREPLTool, FileReadTool, FileWriteTool

llm = OpenAILLM(LLMConfig(model="gpt-4o", api_key="sk-..."))

executor = AgentExecutor(AgentConfig(
    llm=llm,
    tools=[PythonREPLTool(), FileReadTool(), FileWriteTool()],
    agent_type="function_calling",
    system_prompt=(
        "You are a data analyst. Use Python to load data, compute statistics, "
        "and create visualizations. Save charts as PNG files. "
        "Always explain your findings in plain English after analysis."
    ),
))

analysis = asyncio.run(executor.run(
    "Load sales_data.csv, compute monthly revenue totals, "
    "identify the top 3 months, and save a bar chart as sales_chart.png."
))
print(analysis)
# Loaded sales_data.csv with 1,200 rows...
# Top 3 months: March ($52,400), December ($49,800), October ($44,100)
# Chart saved to sales_chart.png.
```

---

## 5. Multi-provider fallback agent

Try OpenAI first, automatically fall back to Anthropic if it fails:

```python
import asyncio
from synapsekit import AgentExecutor, AgentConfig, CalculatorTool, WebSearchTool
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.anthropic import AnthropicLLM
from synapsekit import LLMConfig
from synapsekit.exceptions import LLMError, RateLimitError

async def get_agent_with_fallback():
    """Build an agent that falls back from OpenAI to Anthropic."""
    tools = [CalculatorTool(), WebSearchTool()]

    try:
        llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))
        # Quick health check
        await llm.generate("ping", max_tokens=5)
        print("Using OpenAI gpt-4o-mini")
    except (LLMError, RateLimitError):
        print("OpenAI unavailable, falling back to Anthropic")
        llm = AnthropicLLM(LLMConfig(
            model="claude-haiku-4-5",
            api_key="sk-ant-...",
            max_tokens=1024,
        ))

    return AgentExecutor(AgentConfig(
        llm=llm,
        tools=tools,
        agent_type="function_calling",
    ))

async def main():
    executor = await get_agent_with_fallback()
    answer = await executor.run("What is 15% of $1,250, and search for the latest Python version?")
    print(answer)

asyncio.run(main())
```

---

## 6. Agent with Redis memory

Persist conversation context across sessions using Redis:

```python
import asyncio
from synapsekit import AgentExecutor, AgentConfig, CalculatorTool
from synapsekit.llm.openai import OpenAILLM
from synapsekit import LLMConfig
from synapsekit.memory import RedisMemory

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

# Memory persists across process restarts
memory = RedisMemory(
    url="redis://localhost:6379",
    session_id="user-42-session",   # unique per user/session
    ttl_seconds=3600,               # expire after 1 hour
)

executor = AgentExecutor(AgentConfig(
    llm=llm,
    tools=[CalculatorTool()],
    agent_type="function_calling",
    memory=memory,
))

# First turn
answer1 = asyncio.run(executor.run("My name is Alice and my budget is $500."))
print(answer1)  # Nice to meet you, Alice!

# Second turn (different process, same session_id) — agent remembers Alice
answer2 = asyncio.run(executor.run("How much can I spend on each of 4 items?"))
print(answer2)  # Based on your $500 budget, you can spend $125 per item.
```

---

## 7. Human-in-the-loop agent

Pause for human approval before executing sensitive actions:

```python
import asyncio
from synapsekit import AgentExecutor, AgentConfig, tool
from synapsekit.llm.openai import OpenAILLM
from synapsekit import LLMConfig
from synapsekit.exceptions import ToolError

APPROVED_ACTIONS: set[str] = set()  # Track approved actions

@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email. Requires human approval before sending."""
    action_key = f"email:{to}:{subject}"

    if action_key not in APPROVED_ACTIONS:
        # Pause and ask for approval
        print(f"\n[APPROVAL REQUIRED]")
        print(f"  To: {to}")
        print(f"  Subject: {subject}")
        print(f"  Body: {body[:200]}...")
        confirmed = input("Approve? (yes/no): ").strip().lower()
        if confirmed != "yes":
            raise ToolError(f"User rejected sending email to {to}")
        APPROVED_ACTIONS.add(action_key)

    # In practice, send via SMTP
    return f"Email sent to {to} with subject '{subject}'"

@tool
def delete_file(path: str) -> str:
    """Delete a file. Always requires human approval."""
    print(f"\n[APPROVAL REQUIRED] Delete file: {path}")
    confirmed = input("Confirm deletion? (yes/no): ").strip().lower()
    if confirmed != "yes":
        raise ToolError(f"User rejected deleting {path}")
    import os
    os.remove(path)
    return f"Deleted {path}"

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))
executor = AgentExecutor(AgentConfig(
    llm=llm,
    tools=[send_email, delete_file],
    agent_type="function_calling",
))

asyncio.run(executor.run(
    "Send a welcome email to new_user@example.com with subject 'Welcome!' "
    "and a brief welcome message."
))
```

---

## 8. Cost-bounded agent

Hard-stop the agent when it exceeds a cost budget:

```python
import asyncio
from synapsekit import AgentExecutor, AgentConfig, WebSearchTool, PythonREPLTool
from synapsekit.llm.openai import OpenAILLM
from synapsekit import LLMConfig, BudgetGuard
from synapsekit.observability import CostTracker
from synapsekit.exceptions import BudgetExceededError

tracker = CostTracker()
llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))
llm.attach_tracker(tracker)

executor = AgentExecutor(AgentConfig(
    llm=llm,
    tools=[WebSearchTool(), PythonREPLTool()],
    agent_type="function_calling",
    max_steps=20,
    budget_guard=BudgetGuard(
        tracker=tracker,
        max_cost_usd=0.10,             # Stop if cost exceeds $0.10
        on_exceeded="raise",           # or "warn" to log and continue
    ),
))

try:
    answer = asyncio.run(executor.run(
        "Research and compare the top 10 vector databases. "
        "For each, find pricing, performance benchmarks, and key features."
    ))
    print(answer)
    print(f"\nTotal cost: ${tracker.total_cost_usd:.4f}")
except BudgetExceededError as e:
    print(f"Budget exceeded: {e}")
    print(f"Spent: ${tracker.total_cost_usd:.4f} / $0.10 limit")
    print("Partial result:", e.partial_result)
```

---

## 9. Streaming agent

Stream tokens to the user as the agent generates its final response:

```python
import asyncio
from synapsekit import AgentExecutor, AgentConfig, CalculatorTool, WebSearchTool
from synapsekit.llm.openai import OpenAILLM
from synapsekit import LLMConfig

llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

executor = AgentExecutor(AgentConfig(
    llm=llm,
    tools=[CalculatorTool(), WebSearchTool()],
    agent_type="function_calling",
))

async def main():
    print("Agent: ", end="", flush=True)
    async for token in executor.stream(
        "Search for the current population of Tokyo and calculate "
        "what percentage that is of Japan's total population."
    ):
        print(token, end="", flush=True)
    print()  # newline at end

asyncio.run(main())
# Agent: Tokyo's population is approximately 13.96 million, which represents
# about 11.2% of Japan's total population of 125.7 million.
```

---

## 10. Multi-agent pipeline

Chain a researcher, writer, and reviewer in sequence:

```python
import asyncio
from synapsekit import AgentExecutor, AgentConfig, WebSearchTool, WebFetchTool
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.anthropic import AnthropicLLM
from synapsekit import LLMConfig, FileWriteTool

# Agent 1: Researcher — gathers facts
researcher = AgentExecutor(AgentConfig(
    llm=OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-...")),
    tools=[WebSearchTool(), WebFetchTool()],
    agent_type="function_calling",
    system_prompt=(
        "You are a researcher. Search for information and return a list of "
        "key facts with sources. Be thorough and cite your sources."
    ),
))

# Agent 2: Writer — turns facts into a blog post
writer = AgentExecutor(AgentConfig(
    llm=AnthropicLLM(LLMConfig(
        model="claude-sonnet-4-6",
        api_key="sk-ant-...",
        max_tokens=4096,
    )),
    tools=[FileWriteTool()],
    agent_type="function_calling",
    system_prompt=(
        "You are a technical writer. Given research notes, write a clear, "
        "engaging blog post. Use markdown. Save the result as a file."
    ),
))

# Agent 3: Reviewer — checks quality and suggests edits
reviewer = AgentExecutor(AgentConfig(
    llm=OpenAILLM(LLMConfig(model="gpt-4o", api_key="sk-...")),
    tools=[],
    agent_type="function_calling",
    system_prompt=(
        "You are an editor. Review the draft and provide specific, actionable "
        "feedback on clarity, accuracy, and structure. Score it 1-10."
    ),
))

async def run_pipeline(topic: str) -> str:
    print(f"[1/3] Researching: {topic}")
    research_notes = await researcher.run(f"Research: {topic}")

    print("[2/3] Writing draft...")
    draft = await writer.run(
        f"Write a blog post using these research notes:\n\n{research_notes}\n\n"
        f"Save it as '{topic.replace(' ', '_')}.md'"
    )

    print("[3/3] Reviewing draft...")
    review = await reviewer.run(
        f"Review this blog post draft:\n\n{draft}"
    )

    return f"Draft complete.\n\nReview:\n{review}"

result = asyncio.run(run_pipeline("the future of vector databases in 2026"))
print(result)
```
