---
sidebar_position: 5
---

# SynapseKit Live

**A zero-dependency, real-time view of what your agent, RAG pipeline, or graph is actually doing — live in your browser.**

Everything SynapseKit does — spans, LLM calls, retrieval, tool calls, memory/DB reads and writes, knowledge-graph queries, cost and tokens — is published to a single in-process `EventBus`. When Live is enabled, a tiny stdlib `http.server` streams those events over **Server-Sent Events** to a single self-contained `dashboard.html`. There is **no FastAPI, no uvicorn, no websockets, no new dependencies** — just Python's standard library — and publishing is a no-op when Live is disabled, so there is zero overhead in production.

It is a **glass box**: instead of guessing what happened inside a run, you watch it happen.

**Import:**
```python
import synapsekit.live as live
# live.enable / live.serve / live.new_run / live.publish_graph / live.request_approval / live.bus
```

## Enable it

Three equivalent ways — pick whichever fits:

```bash
# 1. Environment variable — auto-starts on the first published event
export SYNAPSEKIT_LIVE=1
python my_agent.py

# 2. From the CLI
synapsekit ui --live
```

```python
# 3. Explicit, from code — returns the dashboard URL and opens the browser
import synapsekit.live as live

url = live.enable()          # e.g. http://127.0.0.1:8765/?token=…
print(f"dashboard: {url}")
```

`enable()` starts the server, turns on span instrumentation with a silent in-memory exporter, auto-instruments the subsystems that spans miss (tools, MCP, memory/DB, graphs, mesh, loaders, embeddings), and bridges Python `logging` into the feed — so a normal run streams end to end with no extra setup. It is idempotent.

:::note Security
The server binds to `127.0.0.1` only, and the `/events` stream requires a per-process token that is injected into the served HTML. Nothing leaves your machine, and another local process can't read the stream without the token.
:::

## Quickstart

```python
import asyncio
import synapsekit.live as live
from synapsekit import AgentExecutor, AgentConfig, CalculatorTool
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.base import LLMConfig


async def main() -> None:
    live.enable()  # dashboard opens in your browser

    agent = AgentExecutor(
        AgentConfig(
            llm=OpenAILLM(LLMConfig(model="gpt-4o-mini")),
            tools=[CalculatorTool()],
            system_prompt="You are a helpful assistant.",
        )
    )
    # Every LLM call, tool call, and span below streams to the dashboard live.
    print(await agent.arun("What is 47 * 53 minus 100?"))


asyncio.run(main())
```

Run it and the browser shows each step as it happens — the model thinking, the calculator tool firing, tokens and cost ticking up.

## What streams to the dashboard

Live auto-instruments the whole stack. Each event carries a `kind`, a status, a duration, and attributes:

| Event kind | What it is |
|---|---|
| `llm.call` / `llm.generate` | model calls, with prompt, response, tokens, and cost |
| `tool.call` | any `BaseTool` (and MCP tools) |
| `retriever.search` | retrieval / RAG lookups |
| `memory.read` / `memory.write` | agent memory & DB reads/writes |
| `graph.query` / `graph.ingest` | knowledge-graph (`WorldModelRAG`, property graphs) |
| `mesh.query` / `mesh.ingest` | the personal knowledge mesh |
| `loader.load` / `embeddings.embed` | ingestion pipeline |
| `agent.evolve` / `agent.rollback` | [self-evolving agent](/docs/agents/self-improving) cycles & rollbacks |
| `budget` / `audit` / `swarm` | budget gauge, signed audit entries, swarm auctions |
| `approval.request` / `approval.result` | human-in-the-loop approvals (see below) |

The dashboard groups these into **Activity / Logs / Errors** tabs with click-to-expand detail (full LLM prompt + response, tracebacks, attributes), a subsystem activity strip, cost/token meters, a latency sparkline, a daily-budget gauge, a flame graph of nested spans, and a force-directed knowledge/run graph canvas. A **Runs** dropdown browses past runs, and **Export** downloads a run as JSON.

## Human-in-the-loop approvals

Pause a run until a human clicks **Approve** or **Deny** in the browser:

```python
import synapsekit.live as live

async def send_email(to: str, body: str) -> None:
    ok = await live.request_approval(
        "send_email",
        detail=f"To: {to}\n\n{body}",
        timeout=300.0,   # seconds to wait for a decision
        default=False,   # what to return if Live is off or the wait times out
    )
    if not ok:
        raise PermissionError("email not approved")
    ...  # actually send
```

`request_approval(action, detail="", *, timeout=300.0, default=False) -> bool` blocks (without holding the event loop) until you decide in the dashboard. When Live is disabled it immediately returns `default`, so the same code is safe in production. See `examples/live_hitl.py`.

## Marking runs and feeding the graph

```python
import synapsekit.live as live

live.new_run("nightly-report")   # demarcate a run so the Runs dropdown can group it

# Push your own nodes/edges onto the graph canvas
live.publish_graph(
    nodes=[{"id": "user"}, {"id": "invoice", "group": "doc"}],
    edges=[{"source": "user", "target": "invoice", "label": "uploaded"}],
)
```

`WorldModelRAG` / property-graph ingest populate this canvas automatically with real entities and relations; `publish_graph` is for feeding it manually.

## Examples

Runnable demos ship in the repo:

- `examples/live_dashboard.py` — the minimal one-agent demo
- `examples/live_all_features.py` — a full run (loader → embeddings → vector search → tools/MCP → memory/DB → knowledge graph → LLM) streaming end to end
- `examples/live_hitl.py` — human-in-the-loop approvals
- `examples/live_showcase.py` — a paced, narrated walk through every subsystem and UI feature, across labelled runs (great for demos/recordings)

## API reference

### `synapsekit.live`

- `enable(*, open_browser=True, quiet=False) -> str` — start the dashboard, turn on instrumentation, return the URL. Idempotent.
- `serve(*, host="127.0.0.1", …) -> str` — start just the server and return the URL.
- `new_run(label="") -> None` — mark the start of a new run (also emits the version/Python banner).
- `publish_graph(nodes, edges) -> None` — push a knowledge-graph snapshot to the canvas.
- `request_approval(action, detail="", *, timeout=300.0, default=False) -> bool` — block until a human approves in the browser (async).
- `bus` — the process-wide `EventBus`. `bus.publish(event)` emits a custom event; `bus.enabled` is `False` until Live starts, so publishing is a no-op otherwise.

### Enabling without any code

- `SYNAPSEKIT_LIVE=1` — auto-start on the first published event.
- `synapsekit ui --live` — start the dashboard from the CLI.

## See also

- [Observability overview](/docs/observability/overview) — spans, exporters, and cost tracking
- [Self-Improving Agent](/docs/agents/self-improving) — whose evolution cycles stream here as `agent.evolve` / `agent.rollback`
- [Verifiable Agents](/docs/audit/) — signed audit entries also surface in the feed
