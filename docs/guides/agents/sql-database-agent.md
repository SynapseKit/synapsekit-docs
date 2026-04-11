---
sidebar_position: 6
title: "SQL Database Agent"
description: "Build a natural language to SQL agent with read-only access and schema introspection using SynapseKit."
---

import ColabBadge from '@site/src/components/ColabBadge';

# SQL Database Agent

<ColabBadge path="agents/sql-database-agent.ipynb" />

A SQL agent lets non-technical users query a database in plain English. Instead of writing `SELECT COUNT(*) FROM orders WHERE status = 'shipped'`, they can ask "How many orders shipped this week?" and the agent translates the question, runs the query safely, and explains the results. **What you'll build:** a natural-language analytics assistant backed by an in-memory SQLite database, using `SQLQueryTool` for safe SELECT-only execution and `SQLSchemaInspectionTool` for schema discovery. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit
export OPENAI_API_KEY="sk-..."
# For PostgreSQL/MySQL, also: pip install sqlalchemy
```

## What you'll learn

- `SQLQueryTool` — parameterized SELECT-only query execution
- `SQLSchemaInspectionTool` — automatic schema discovery for LLM context
- How to seed an in-memory SQLite database for demos
- Security: why read-only enforcement matters and how it works
- Connecting to real databases via SQLAlchemy connection strings

## Step 1: Import tools

```python
import asyncio
import sqlite3
from synapsekit.agents import (
    FunctionCallingAgent,
    SQLQueryTool,
    SQLSchemaInspectionTool,
)
from synapsekit.llms.openai import OpenAILLM
```

## Step 2: Create and seed a demo database

For production, point `connection_string` at your real database. For this guide we create an in-memory SQLite file on disk so both tools can connect independently.

```python
def create_demo_db(path: str = "demo.db") -> str:
    """Seed a demo database with orders, customers, and products."""
    conn = sqlite3.connect(path)
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            country TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY,
            customer_id INTEGER REFERENCES customers(id),
            product_id INTEGER REFERENCES products(id),
            quantity INTEGER NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
    """)

    customers = [
        (1, "Alice Johnson", "alice@example.com", "USA"),
        (2, "Bob Smith", "bob@example.com", "Canada"),
        (3, "Carlos Rivera", "carlos@example.com", "Mexico"),
        (4, "Diana Wei", "diana@example.com", "USA"),
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO customers VALUES (?, ?, ?, ?)", customers
    )

    products = [
        (1, "Wireless Headphones", "Electronics", 89.99),
        (2, "Standing Desk", "Furniture", 349.00),
        (3, "Python Book", "Books", 49.99),
        (4, "Coffee Maker", "Appliances", 129.00),
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO products VALUES (?, ?, ?, ?)", products
    )

    orders = [
        (1, 1, 1, 2, "shipped", "2025-04-01"),
        (2, 2, 3, 1, "pending", "2025-04-03"),
        (3, 1, 4, 1, "shipped", "2025-04-05"),
        (4, 3, 2, 1, "delivered", "2025-03-28"),
        (5, 4, 1, 3, "shipped", "2025-04-08"),
        (6, 2, 4, 2, "pending", "2025-04-09"),
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO orders VALUES (?, ?, ?, ?, ?, ?)", orders
    )

    conn.commit()
    conn.close()
    return path
```

## Step 3: Configure the SQL tools

`SQLQueryTool` enforces SELECT-only at the Python level before the query reaches the database driver — so even if the LLM hallucinates a DROP TABLE, it will be blocked.

```python
db_path = create_demo_db()

query_tool = SQLQueryTool(
    connection_string=db_path,
    max_rows=50,           # cap result size to prevent huge observations
)

schema_tool = SQLSchemaInspectionTool(
    connection_string=db_path,
)
```

## Step 4: Build the agent with schema context

The `SQLSchemaInspectionTool` lets the agent discover table names and column types on demand rather than requiring you to hard-code them in the system prompt. This is especially valuable when the schema changes or is too large to embed manually.

```python
agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=[schema_tool, query_tool],
    system_prompt=(
        "You are a data analyst assistant. "
        "Before writing any SQL query, always call sql_schema_inspection first "
        "to understand the available tables and columns. "
        "Only use SELECT statements — never modify data. "
        "Return results in a readable format and explain what they mean."
    ),
    max_iterations=8,
)
```

## Step 5: Query in natural language

```python
async def query(question: str) -> str:
    return await agent.run(question)
```

## Step 6: Connect to a real database

For PostgreSQL, MySQL, or other SQLAlchemy-supported databases, pass a full connection URL:

```python
# PostgreSQL
pg_query_tool = SQLQueryTool(
    connection_string="postgresql://user:password@localhost:5432/mydb",
    max_rows=100,
)

# MySQL
mysql_query_tool = SQLQueryTool(
    connection_string="mysql+pymysql://user:password@localhost/mydb",
    max_rows=100,
)
```

## Complete working example

```python
import asyncio
import sqlite3
from synapsekit.agents import (
    ActionEvent,
    FinalAnswerEvent,
    FunctionCallingAgent,
    ObservationEvent,
    SQLQueryTool,
    SQLSchemaInspectionTool,
)
from synapsekit.llms.openai import OpenAILLM


def seed_db(path: str = "demo.db") -> str:
    conn = sqlite3.connect(path)
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY, name TEXT, country TEXT);
        CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT, price REAL);
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY, customer_id INTEGER, product_id INTEGER,
            quantity INTEGER, status TEXT, created_at TEXT
        );
    """)
    c.executemany("INSERT OR IGNORE INTO customers VALUES (?,?,?)",
                  [(1,"Alice","USA"),(2,"Bob","Canada"),(3,"Carlos","Mexico")])
    c.executemany("INSERT OR IGNORE INTO products VALUES (?,?,?)",
                  [(1,"Headphones",89.99),(2,"Desk",349.00),(3,"Book",49.99)])
    c.executemany("INSERT OR IGNORE INTO orders VALUES (?,?,?,?,?,?)",
                  [(1,1,1,2,"shipped","2025-04-01"),
                   (2,2,3,1,"pending","2025-04-03"),
                   (3,1,2,1,"shipped","2025-04-05"),
                   (4,3,1,3,"delivered","2025-03-28")])
    conn.commit()
    conn.close()
    return path


def build_agent(db_path: str) -> FunctionCallingAgent:
    return FunctionCallingAgent(
        llm=OpenAILLM(model="gpt-4o-mini"),
        tools=[
            SQLSchemaInspectionTool(connection_string=db_path),
            SQLQueryTool(connection_string=db_path, max_rows=50),
        ],
        system_prompt=(
            "You are a SQL analytics assistant. "
            "Always inspect the schema before writing queries. "
            "Only use SELECT. Explain query results in plain English."
        ),
        max_iterations=8,
    )


async def main() -> None:
    db_path = seed_db()
    agent = build_agent(db_path)

    questions = [
        "How many orders are in each status category?",
        "Which customer has spent the most money in total?",
        "What are the top 3 products by total revenue?",
    ]

    for question in questions:
        print(f"\nQ: {question}")
        print("-" * 60)

        async for event in agent.stream_steps(question):
            if isinstance(event, ActionEvent):
                print(f"[{event.tool}] {str(event.tool_input)[:100]}")
            elif isinstance(event, ObservationEvent):
                print(f"  {event.observation[:200]}")
            elif isinstance(event, FinalAnswerEvent):
                print(f"\n{event.answer}")


asyncio.run(main())
```

## Expected output

```
Q: How many orders are in each status category?
------------------------------------------------------------
[sql_schema_inspection] {}
  orders: id, customer_id, product_id, quantity, status, created_at
[sql_query] SELECT status, COUNT(*) as count FROM orders GROUP BY status
  status | count
  --- | ---
  delivered | 1
  pending | 1
  shipped | 2

There are 2 shipped orders, 1 pending order, and 1 delivered order.

Q: Which customer has spent the most money in total?
------------------------------------------------------------
[sql_query] SELECT c.name, SUM(p.price * o.quantity) as total ...
  name | total
  --- | ---
  Alice | 528.98

Alice has spent the most, with a total of $528.98 across her orders.
```

## How it works

`SQLQueryTool` strips leading whitespace and checks that the query starts with `SELECT` before sending it to the database driver. Non-SELECT statements (INSERT, UPDATE, DELETE, DROP) are rejected with a `ToolResult` error before any database connection is opened. Parameters passed alongside the query are injected via the driver's native parameterized-query mechanism, preventing SQL injection regardless of what the LLM generates.

`SQLSchemaInspectionTool` uses `PRAGMA table_info` (SQLite) or `information_schema.columns` (SQLAlchemy) to discover the schema dynamically, then formats it as a compact text block that fits easily in the observation without blowing up the context window.

## Variations

**Hard-code the schema in the system prompt** when you want to save one tool call per query on stable schemas:

```python
schema_hint = """
Tables:
- customers(id, name, country)
- products(id, name, price)
- orders(id, customer_id, product_id, quantity, status, created_at)
"""
agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=[SQLQueryTool(connection_string=db_path)],
    system_prompt=f"You are a SQL assistant.\n\nSchema:\n{schema_hint}",
)
```

**Chain with CodeInterpreterTool** to visualize query results:

```python
from synapsekit.agents import CodeInterpreterTool

agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=[
        SQLSchemaInspectionTool(connection_string=db_path),
        SQLQueryTool(connection_string=db_path),
        CodeInterpreterTool(timeout=10.0),
    ],
    system_prompt=(
        "Query the database and then use code_interpreter to create a "
        "matplotlib chart of the results."
    ),
)
```

## Troubleshooting

**`Only SELECT queries are allowed` error** — the LLM generated a non-SELECT statement. Reinforce in `system_prompt`: "You may only use SELECT. Never generate INSERT, UPDATE, DELETE, or DROP."

**Schema tool returns empty tables** — the database file path is wrong or the file was not created before the agent started. Check that `seed_db()` runs before `build_agent()`.

**SQLAlchemy not found** — install it for non-SQLite databases: `pip install sqlalchemy`. Also install the driver for your database: `pip install psycopg2-binary` (PostgreSQL) or `pip install pymysql` (MySQL).

**Agent writes SQL with wrong column names** — the schema observation was cut off. Reduce `max_rows` or increase `max_iterations` so the agent has room to call the schema tool without running out of steps.

## Next steps

- [Code Execution Agent](./code-execution-agent) — visualize query results with matplotlib
- [Multi-Tool Orchestration](./multi-tool-orchestration) — combine SQL with web search for enriched analytics
- [Structured Output with Function Calling](./structured-output-function-calling) — return query results as typed Pydantic models
