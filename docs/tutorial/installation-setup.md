---
sidebar_position: 2
---

**Tutorial Progress: Step 1 of 5**  
[Next: Your First RAG Pipeline →](./first-rag-pipeline)

# Step 1: Installation & Setup

This page gets your development environment ready and verifies that SynapseKit is working correctly.

## 1. Create a virtual environment (recommended)

Using a virtual environment keeps your dependencies isolated.

```bash
# Using venv (built-in)
python -m venv .venv
source .venv/bin/activate      # macOS / Linux
.venv\Scripts\activate         # Windows

# Or using uv (fast modern alternative)
uv venv
source .venv/bin/activate
```

## 2. Install SynapseKit

SynapseKit supports multiple installation profiles depending on which LLM providers and features you need.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs groupId="install-method">
<TabItem value="pip" label="pip">

```bash
# Core + OpenAI (most common starting point)
pip install "synapsekit[openai]"

# Or install everything (recommended for the full tutorial)
pip install "synapsekit[all]"
```

</TabItem>
<TabItem value="uv" label="uv (recommended)">

```bash
uv add "synapsekit[openai]"
# or
uv add "synapsekit[all]"
```

</TabItem>
<TabItem value="poetry" label="Poetry">

```bash
poetry add "synapsekit[openai]"
# or
poetry add "synapsekit[all]"
```

</TabItem>
</Tabs>

**Common extras** (you can combine them):
- `openai`, `anthropic`, `ollama`, `gemini`, `cohere`
- `chroma`, `qdrant`, `pinecone` (vector stores)
- `eval`, `guardrails`, `observability`

## 3. Configure your API keys

The cleanest way is using environment variables.

```bash
# .env file (never commit this)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
```

SynapseKit automatically loads `.env` files if `python-dotenv` is installed:

```bash
pip install python-dotenv
```

Or set them in your shell:

```bash
export OPENAI_API_KEY="sk-..."
```

## 4. Verify the installation

Create a file `verify.py`:

```python
from synapsekit import __version__
from synapsekit.llms import OpenAIProvider

print(f"SynapseKit version: {__version__}")

# Quick smoke test
provider = OpenAIProvider(model="gpt-4o-mini")
print("Provider initialized successfully")
print(f"Model: {provider.model}")
```

Run it:

```bash
python verify.py
```

**Expected output**
```
SynapseKit version: 0.9.2
Provider initialized successfully
Model: gpt-4o-mini
```

## 5. Optional but recommended: Project layout

For the rest of this tutorial we recommend the following structure:

```
my-synapsekit-project/
├── .env
├── pyproject.toml
├── src/
│   └── myapp/
│       ├── __init__.py
│       ├── pipelines/
│       ├── agents/
│       └── graphs/
├── tests/
└── README.md
```

## Troubleshooting

**"No module named 'synapsekit'"**
- Make sure you activated the virtual environment
- Try `pip install -e .` if you are developing locally

**API key errors**
- Double-check the environment variable name (case-sensitive)
- Use `synapsekit config show` to debug loaded providers

**Async warnings**
- SynapseKit is async-first. Always use `asyncio.run()` or `await` in async contexts.

**Next step**: In the next page we will build our first RAG pipeline using the environment we just set up.

**Tutorial Progress: Step 1 of 5**  
[← Back to Tutorial Index](./index) | [Next: Your First RAG Pipeline →](./first-rag-pipeline)