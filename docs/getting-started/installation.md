---
sidebar_position: 1
---

# Installation

SynapseKit uses optional dependency groups so you only install what you need.

## Requirements

- Python 3.10+

## Install

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs groupId="pkg-manager">
<TabItem value="pip" label="pip">

```bash
pip install synapsekit[openai]       # OpenAI
pip install synapsekit[anthropic]    # Anthropic
pip install synapsekit[all]          # Everything
```

</TabItem>
<TabItem value="uv" label="uv">

```bash
uv add synapsekit[openai]            # OpenAI
uv add synapsekit[anthropic]         # Anthropic
uv add synapsekit[all]               # Everything
```

</TabItem>
<TabItem value="poetry" label="Poetry">

```bash
poetry add synapsekit[openai]        # OpenAI
poetry add synapsekit[anthropic]     # Anthropic
poetry add "synapsekit[all]"         # Everything
```

</TabItem>
</Tabs>

## Optional extras

### LLM providers

| Extra | Installs | Use case |
|---|---|---|
| `openai` | `openai` | GPT-4o, GPT-4o-mini, etc. |
| `anthropic` | `anthropic` | Claude 3.5, Claude 4, etc. |
| `ollama` | `ollama` | Local models via Ollama |
| `cohere` | `cohere` | Cohere Command R+ |
| `mistral` | `mistralai` | Mistral Large, Small, etc. |
| `gemini` | `google-generativeai` | Gemini 1.5 Pro/Flash |
| `bedrock` | `boto3` | AWS Bedrock (Claude/Titan/Llama) |
| `lmstudio` | `openai` | LM Studio local server |

### Document loaders

| Extra | Installs | Use case |
|---|---|---|
| `pdf` | `pypdf` | `PDFLoader` |
| `html` | `beautifulsoup4`, `lxml` | `HTMLLoader` |
| `web` | `httpx`, `beautifulsoup4` | `WebLoader` (async URL fetch) |
| `s3` | `boto3` | `S3Loader` — Amazon S3 |
| `azure` | `azure-storage-blob` | `AzureBlobLoader` |
| `mongodb` | `pymongo` | `MongoDBLoader` |
| `dropbox` | `dropbox` | `DropboxLoader` |
| `teams` | `httpx` | `TeamsLoader` — Microsoft Teams |
| `onedrive` | *(stdlib only)* | `OneDriveLoader` — OneDrive/SharePoint |
| `rtf` | `striprtf` | `RTFLoader` |
| `epub` | `ebooklib` | `EPUBLoader` |

### Vector store backends

| Extra | Installs | Use case |
|---|---|---|
| `chroma` | `chromadb` | `ChromaVectorStore` |
| `faiss` | `faiss-cpu` | `FAISSVectorStore` |
| `qdrant` | `qdrant-client` | `QdrantVectorStore` |
| `pinecone` | `pinecone` | `PineconeVectorStore` |

### Search

| Extra | Installs | Use case |
|---|---|---|
| `search` | `duckduckgo-search` | `WebSearchTool`, `DuckDuckGoSearchTool` |
| `tavily` | `tavily-python` | `TavilySearchTool` (AI-optimized search) |

### Embeddings

| Extra | Installs | Use case |
|---|---|---|
| `semantic` | `sentence-transformers` | Local embedding models |

## Combining extras

<Tabs groupId="pkg-manager">
<TabItem value="pip" label="pip">

```bash
pip install synapsekit[openai,pdf,chroma]
pip install synapsekit[ollama,faiss,semantic]
```

</TabItem>
<TabItem value="uv" label="uv">

```bash
uv add synapsekit[openai,pdf,chroma]
uv add synapsekit[ollama,faiss,semantic]
```

</TabItem>
<TabItem value="poetry" label="Poetry">

```bash
poetry add "synapsekit[openai,pdf,chroma]"
poetry add "synapsekit[ollama,faiss,semantic]"
```

</TabItem>
</Tabs>

## Verify installation

```python
import synapsekit
print(synapsekit.__version__)  # 1.5.5
```
