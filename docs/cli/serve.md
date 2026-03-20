---
sidebar_position: 2
---

# synapsekit serve

Deploy any SynapseKit app as a FastAPI server in one command. Auto-detects the object type and creates appropriate endpoints.

```bash
pip install synapsekit[serve]
```

## Quick start

```bash
synapsekit serve my_app:rag --host 0.0.0.0 --port 8000
```

Where `my_app:rag` is a `module:attribute` import path pointing to a SynapseKit object (RAGPipeline, CompiledGraph, ReActAgent, FunctionCallingAgent, etc.).

## CLI options

| Option | Default | Description |
|---|---|---|
| `app` | (required) | Import path in `module:attribute` format |
| `--host` | `127.0.0.1` | Bind host |
| `--port` | `8000` | Bind port |
| `--reload` | `false` | Enable auto-reload for development |

## Auto-detected endpoints

The CLI auto-detects the type of your object and creates type-appropriate endpoints:

### RAG (RAGPipeline, RAG)

| Method | Path | Description |
|---|---|---|
| `POST` | `/query` | Send a query, get an answer |
| `GET` | `/health` | Health check |

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is SynapseKit?"}'
```

### Graph (CompiledGraph)

| Method | Path | Description |
|---|---|---|
| `POST` | `/run` | Run the graph with initial state |
| `GET` | `/stream` | Stream graph events via SSE |
| `GET` | `/health` | Health check |

```bash
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{"state": {"messages": ["hello"]}}'
```

### Agent (ReActAgent, FunctionCallingAgent)

| Method | Path | Description |
|---|---|---|
| `POST` | `/run` | Run the agent with a prompt |
| `GET` | `/health` | Health check |

```bash
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Search for Python tutorials"}'
```

## OpenAPI docs

Every served app automatically includes OpenAPI documentation at `/docs` (Swagger UI) and `/redoc` (ReDoc).

## Example: serving a RAG pipeline

```python
# my_app.py
from synapsekit import RAG

rag = RAG(model="gpt-4o-mini", api_key="sk-...")
rag.add("SynapseKit is an async-first Python framework for LLM applications.")
```

```bash
synapsekit serve my_app:rag --port 8000
```

## Programmatic usage

You can also build the FastAPI app programmatically:

```python
from synapsekit.cli.serve import build_app

app = build_app(my_rag_pipeline, app_type="rag")

# Use with any ASGI server
import uvicorn
uvicorn.run(app, host="0.0.0.0", port=8000)
```
