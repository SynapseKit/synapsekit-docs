---
sidebar_position: 1
---

# CLI

SynapseKit includes a command-line interface for deploying apps and running evaluations. Install with:

```bash
pip install synapsekit
```

The CLI is registered as the `synapsekit` command and provides two subcommands:

| Command | Description |
|---|---|
| `synapsekit serve` | Deploy any RAG/Agent/Graph app as a FastAPI server |
| `synapsekit test` | Discover and run `@eval_case`-decorated evaluation suites |

```bash
# Check version
synapsekit --version

# Get help
synapsekit --help
```
