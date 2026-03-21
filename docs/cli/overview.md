---
sidebar_position: 1
---

# CLI Overview

SynapseKit ships a command-line interface for two core tasks: **serving** any pipeline as a REST API and **running** evaluation test suites.

## Installation

The CLI is installed automatically with the `synapsekit` package:

```bash
pip install synapsekit
synapsekit --version
# Expected output:
# synapsekit 1.2.0
```

The `serve` subcommand requires the `[serve]` extra:

```bash
pip install synapsekit[serve]
```

## Subcommands

| Command | Description |
|---|---|
| [`synapsekit serve`](./serve) | Deploy a RAG pipeline, graph workflow, or agent as a FastAPI REST API |
| [`synapsekit test`](./test) | Discover and run `@eval_case`-decorated evaluation suites |

## Global flags

```bash
synapsekit --version     # Print version and exit
synapsekit --help        # Show help
synapsekit serve --help  # Subcommand help
synapsekit test --help   # Subcommand help
```

## Quick examples

```bash
# Serve a RAG pipeline
synapsekit serve my_app:rag --port 8000

# Serve with hot reload (development)
synapsekit serve my_app:rag --reload

# Run evaluation suite
synapsekit test tests/evals/ --threshold 0.8

# Run with JSON output (for CI)
synapsekit test tests/evals/ --format json
```

## Auto-detection

`synapsekit serve` inspects the object you point it at and auto-detects its type:

| Detected type | Endpoints created |
|---|---|
| RAG pipeline | `POST /query`, `POST /stream`, `GET /health` |
| Graph workflow | `POST /run`, `POST /stream`, `GET /health` |
| Agent | `POST /run`, `POST /stream`, `GET /health` |

Detection is based on class name and MRO — any class named `RAG*`, `*RAGPipeline`, `*Graph*`, or `*Agent*` is detected automatically. You can override with `--type rag|graph|agent`.

## Environment variables

| Variable | Description |
|---|---|
| `SYNAPSEKIT_LOG_LEVEL` | Log level for CLI output (`DEBUG`, `INFO`, `WARNING`) |

## See also

- [serve](./serve) — full `synapsekit serve` reference
- [test](./test) — full `synapsekit test` reference
