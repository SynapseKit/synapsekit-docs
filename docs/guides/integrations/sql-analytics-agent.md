---
sidebar_position: 5
title: "SQL Analytics Agent"
description: "Build a natural language to SQL agent that introspects your database schema and returns formatted analytics results."
---

import ColabBadge from '@site/src/components/ColabBadge';

# SQL Analytics Agent

<ColabBadge path="integrations/sql-analytics-agent.ipynb" />

Data analysts and business stakeholders often need quick answers from databases but lack SQL expertise. A SQL analytics agent bridges that gap: it receives a natural language question, introspects the database schema, generates the correct SQL query, executes it, and formats the results into a human-readable answer.

**What you'll build:** A `FunctionCallingAgent` that connects to a SQLite database (easily swapped for PostgreSQL or MySQL), generates SQL from natural language, validates queries before execution, and formats results as tables or prose. **Time:** ~25 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit[openai] aiosqlite
export OPENAI_API_KEY=sk-...
```

## What you'll learn

- Build a `FunctionCallingAgent` with database introspection and query tools
- Generate SQL from natural language using schema-aware prompting
- Validate SQL before execution to prevent destructive queries
- Format query results as markdown tables or natural language summaries
- Handle queries that span multiple tables with joins

## Step 1: Set up the database and tools

```python
import asyncio
import aiosqlite
from synapsekit import LLMConfig
from synapsekit.llms.openai import OpenAILLM
from synapsekit.agents import FunctionCallingAgent

DATABASE_PATH = "./analytics.db"

async def seed_demo_database():
    """Create a small e-commerce database for demonstration."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                country TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY,
                customer_id INTEGER REFERENCES customers(id),
                total_usd REAL NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT,
                price_usd REAL NOT NULL,
                inventory_count INTEGER DEFAULT 0
            );

            INSERT OR IGNORE INTO customers VALUES
                (1,'Alice Chen','alice@example.com','US','2025-01-15'),
                (2,'Bob Smith','bob@example.com','UK','2025-02-20'),
                (3,'Carol White','carol@example.com','US','2025-03-01');

            INSERT OR IGNORE INTO orders VALUES
                (1,1,149.99,'completed','2026-01-10'),
                (2,1,89.50,'completed','2026-02-14'),
                (3,2,210.00,'completed','2026-03-05'),
                (4,3,55.25,'pending','2026-04-01');

            INSERT OR IGNORE INTO products VALUES
                (1,'Wireless Headphones','electronics',149.99,45),
                (2,'Python Cookbook','books',49.99,120),
                (3,'Mechanical Keyboard','electronics',89.99,30);
        """)
        await db.commit()
```

## Step 2: Define database tool functions

```python
import json
from typing import Any

async def get_schema() -> str:
    """Return the database schema as a string the LLM can reason about."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        tables = [row["name"] for row in await cursor.fetchall()]

        schema_parts = []
        for table in tables:
            cursor = await db.execute(f"PRAGMA table_info({table})")
            columns = await cursor.fetchall()
            col_defs = ", ".join(
                f"{col['name']} {col['type']}{'  -- PK' if col['pk'] else ''}"
                for col in columns
            )
            schema_parts.append(f"Table: {table}\n  Columns: {col_defs}")

        return "\n\n".join(schema_parts)

async def execute_query(sql: str) -> list[dict[str, Any]]:
    """Execute a read-only SQL query and return results as a list of dicts.

    Only SELECT statements are permitted — any other statement raises ValueError.
    This prevents the agent from accidentally running DROP or UPDATE.
    """
    normalised = sql.strip().upper()
    if not normalised.startswith("SELECT"):
        raise ValueError(
            f"Only SELECT queries are allowed. Received: {sql[:60]!r}"
        )

    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(sql)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

def format_as_table(rows: list[dict]) -> str:
    """Format query results as a markdown table for readable Slack/chat display."""
    if not rows:
        return "No results found."

    headers = list(rows[0].keys())
    header_row  = " | ".join(headers)
    divider_row = " | ".join("---" for _ in headers)
    data_rows   = "\n".join(
        " | ".join(str(row.get(h, "")) for h in headers)
        for row in rows
    )
    return f"{header_row}\n{divider_row}\n{data_rows}"
```

## Step 3: Build the SQL agent

```python
from synapsekit.tools import FunctionTool

# Wrap async functions as tools the agent can call
schema_tool = FunctionTool(
    fn=get_schema,
    name="get_schema",
    description="Returns the full database schema. Always call this first.",
)

query_tool = FunctionTool(
    fn=execute_query,
    name="execute_query",
    description="Execute a SELECT SQL query and return results as JSON.",
    parameters={
        "sql": {"type": "string", "description": "A valid SELECT SQL query"}
    }
)

SQL_SYSTEM_PROMPT = """You are a SQL analytics assistant. Your job is to answer questions
about data in a relational database.

Workflow for every question:
1. Call get_schema() to understand the available tables and columns.
2. Write a SQL SELECT query that answers the question precisely.
3. Call execute_query(sql) to run it.
4. Summarise the results in plain English. Include key numbers.

Rules:
- Only write SELECT queries. Never write INSERT, UPDATE, DELETE, or DROP.
- Use table aliases for readability in joins.
- If a question is ambiguous, answer what was most likely intended and note your assumption."""

agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o", config=LLMConfig(temperature=0.1)),
    tools=[schema_tool, query_tool],
    system_prompt=SQL_SYSTEM_PROMPT,
)
```

## Complete working example

```python
import asyncio
import aiosqlite
from synapsekit import LLMConfig
from synapsekit.llms.openai import OpenAILLM
from synapsekit.agents import FunctionCallingAgent
from synapsekit.tools import FunctionTool

DATABASE_PATH = "./demo_analytics.db"

async def get_schema() -> str:
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
        tables = [r["name"] for r in await cursor.fetchall()]
        parts = []
        for t in tables:
            cur2 = await db.execute(f"PRAGMA table_info({t})")
            cols = ", ".join(f"{c['name']} {c['type']}" for c in await cur2.fetchall())
            parts.append(f"Table: {t} ({cols})")
        return "\n".join(parts)

async def execute_query(sql: str) -> list[dict]:
    if not sql.strip().upper().startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed.")
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(sql)
        return [dict(r) for r in await cursor.fetchall()]

async def seed():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY, name TEXT, country TEXT);
            CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, customer_id INTEGER, total_usd REAL, status TEXT);
            INSERT OR IGNORE INTO customers VALUES (1,'Alice','US'),(2,'Bob','UK'),(3,'Carol','US');
            INSERT OR IGNORE INTO orders VALUES (1,1,149.99,'completed'),(2,1,89.50,'completed'),(3,2,210.00,'completed'),(4,3,55.25,'pending');
        """)
        await db.commit()

async def main():
    await seed()

    agent = FunctionCallingAgent(
        llm=OpenAILLM(model="gpt-4o", config=LLMConfig(temperature=0.1)),
        tools=[
            FunctionTool(get_schema, name="get_schema", description="Get DB schema."),
            FunctionTool(execute_query, name="execute_query",
                         description="Run a SELECT query.",
                         parameters={"sql": {"type": "string"}}),
        ],
        system_prompt=(
            "You are a SQL analytics assistant. Call get_schema first, then "
            "execute_query with a SELECT statement to answer the question. "
            "Summarise results in plain English."
        ),
    )

    questions = [
        "How many customers do we have per country?",
        "What is the total revenue from completed orders?",
        "Who is our highest-spending customer?",
    ]

    for question in questions:
        print(f"\nQ: {question}")
        answer = await agent.arun(question)
        print(f"A: {answer}")

asyncio.run(main())
```

## Expected output

```
Q: How many customers do we have per country?
A: We have 2 customers in the US (Alice and Carol) and 1 customer in the UK (Bob),
   for a total of 3 customers across 2 countries.

Q: What is the total revenue from completed orders?
A: Total revenue from completed orders is $449.49, from 3 orders.

Q: Who is our highest-spending customer?
A: Alice is our highest-spending customer with $239.49 across 2 completed orders.
```

## How it works

The agent's system prompt instructs it to always call `get_schema` before writing SQL. This means the LLM sees the actual column names and types before generating a query, which dramatically reduces schema-mismatch errors. The `execute_query` tool enforces a `SELECT`-only guard at the Python level — even if the LLM produces a destructive statement, it will be rejected before reaching the database.

`FunctionTool` wraps any async Python callable and generates a JSON Schema parameter spec that the LLM uses to know how to call it. SynapseKit handles the tool call/response loop automatically.

## Variations

**PostgreSQL connection:**
```python
import asyncpg

async def execute_query(sql: str) -> list[dict]:
    if not sql.strip().upper().startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed.")
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    rows = await conn.fetch(sql)
    await conn.close()
    return [dict(row) for row in rows]
```

**Return results as a markdown table:**
```python
answer = await agent.arun(question)
# Post-process: ask the agent to also format results as a table
table = await agent.arun(f"Format the previous results as a markdown table.")
```

## Troubleshooting

**Agent generates invalid SQL**
Add `few_shot_examples` to the system prompt with sample queries for your schema. GPT-4o is significantly more reliable than GPT-4o-mini for complex multi-table joins.

**`ValueError: Only SELECT queries are allowed`**
The agent occasionally generates subqueries wrapped in `WITH` (CTEs). Update the guard to also allow `WITH` statements: `if not normalised.startswith(("SELECT", "WITH"))`.

**Results truncated for large tables**
Add `LIMIT 100` to the system prompt rules so the agent doesn't inadvertently fetch millions of rows.

## Next steps

- [GitHub PR Review Agent](./github-pr-review-agent) — another FunctionCallingAgent pattern
- [Structured Output with Pydantic](../llms/structured-output-pydantic) — return typed result objects instead of plain strings
- [Cost-Aware LLM Router](../llms/cost-router) — use a cheap model for simple count queries, GPT-4o for complex joins
