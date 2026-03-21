---
sidebar_position: 1
---

# Environment Variables

Complete reference for all environment variables read by SynapseKit.

## LLM Provider API Keys

| Variable | Provider | Example |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI | `sk-proj-...` |
| `ANTHROPIC_API_KEY` | Anthropic | `sk-ant-...` |
| `COHERE_API_KEY` | Cohere | `...` |
| `MISTRAL_API_KEY` | Mistral | `...` |
| `GROQ_API_KEY` | Groq | `gsk_...` |
| `DEEPSEEK_API_KEY` | DeepSeek | `...` |
| `OPENROUTER_API_KEY` | OpenRouter | `sk-or-...` |
| `TOGETHER_API_KEY` | Together AI | `...` |
| `FIREWORKS_API_KEY` | Fireworks AI | `...` |
| `PERPLEXITY_API_KEY` | Perplexity | `pplx-...` |
| `CEREBRAS_API_KEY` | Cerebras | `...` |
| `GOOGLE_API_KEY` | Gemini | `AIza...` |
| `TAVILY_API_KEY` | TavilySearchTool | `tvly-...` |
| `BRAVE_SEARCH_API_KEY` | BraveSearchTool | `BSA...` |
| `GITHUB_TOKEN` | GitHubAPITool | `ghp_...` |

## AWS Bedrock

| Variable | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_DEFAULT_REGION` | AWS region (e.g. `us-east-1`) |
| `AWS_PROFILE` | Named profile from `~/.aws/credentials` |

## Azure OpenAI

| Variable | Description |
|---|---|
| `AZURE_OPENAI_API_KEY` | Azure OpenAI key |
| `AZURE_OPENAI_ENDPOINT` | `https://your-resource.openai.azure.com/` |
| `AZURE_OPENAI_API_VERSION` | API version (e.g. `2024-10-21`) |

## Backends

| Variable | Module | Description |
|---|---|---|
| `REDIS_URL` | RedisConversationMemory, RedisCheckpointer, RedisLLMCache | `redis://localhost:6379/0` |
| `DATABASE_URL` | PostgresCheckpointer | `postgresql://user:pass@localhost/dbname` |
| `OLLAMA_BASE_URL` | OllamaLLM | `http://localhost:11434` (default) |

## Email Tool

| Variable | Description |
|---|---|
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password |
| `SMTP_FROM` | Default from address |

## Slack Tool

| Variable | Description |
|---|---|
| `SLACK_WEBHOOK_URL` | Incoming webhook URL |
| `SLACK_BOT_TOKEN` | Bot token (starts with `xoxb-`) |

## Jira Tool

| Variable | Description |
|---|---|
| `JIRA_URL` | Jira instance URL |
| `JIRA_USER` | Jira username / email |
| `JIRA_API_TOKEN` | Jira API token |

## PromptHub

| Variable | Default | Description |
|---|---|---|
| `PROMPT_HUB_DIR` | `~/.synapsekit/prompts` | Override hub storage directory |

## Managing API Keys

### .env file (development)

```bash
# .env
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
REDIS_URL=redis://localhost:6379/0
```

```python
from dotenv import load_dotenv
load_dotenv()  # pip install python-dotenv

from synapsekit.llms.openai import OpenAILLM
llm = OpenAILLM(model="gpt-4o-mini")  # reads OPENAI_API_KEY automatically
```

### Secrets manager (production)

Use a secrets manager so keys are never stored in files or environment at rest.

**AWS Secrets Manager:**

```python
import boto3, os

def get_secret(name: str) -> str:
    client = boto3.client("secretsmanager")
    return client.get_secret_value(SecretId=name)["SecretString"]

os.environ["OPENAI_API_KEY"] = get_secret("prod/openai-api-key")
os.environ["ANTHROPIC_API_KEY"] = get_secret("prod/anthropic-api-key")
```

**GCP Secret Manager:**

```python
from google.cloud import secretmanager
import os

def get_gcp_secret(project_id: str, secret_id: str) -> str:
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")

os.environ["OPENAI_API_KEY"] = get_gcp_secret("my-project", "openai-api-key")
```

**Azure Key Vault:**

```python
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential
import os

client = SecretClient(
    vault_url="https://my-vault.vault.azure.net/",
    credential=DefaultAzureCredential()
)
os.environ["OPENAI_API_KEY"] = client.get_secret("openai-api-key").value
```

### Passing keys explicitly (avoid — prefer env vars)

```python
# Only do this for testing or when env vars are impossible.
# Hardcoding keys in source code is a security risk.
llm = OpenAILLM(model="gpt-4o-mini", api_key="sk-...")
```

### Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: synapsekit-secrets
type: Opaque
stringData:
  OPENAI_API_KEY: "sk-proj-..."
  ANTHROPIC_API_KEY: "sk-ant-..."
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: app
          envFrom:
            - secretRef:
                name: synapsekit-secrets
```

### Docker secrets (compose)

```yaml
services:
  app:
    environment:
      OPENAI_API_KEY_FILE: /run/secrets/openai_key
    secrets:
      - openai_key
secrets:
  openai_key:
    file: ./secrets/openai_key.txt
```

## Validation at startup

It is good practice to validate required variables early so your app fails fast with a clear message rather than at the first LLM call.

```python
import os
from synapsekit.utils import require_env

# Raises EnvironmentError with a helpful message if variable is missing
OPENAI_API_KEY = require_env("OPENAI_API_KEY")
REDIS_URL = require_env("REDIS_URL", default="redis://localhost:6379/0")
```

Or roll your own:

```python
import os

def require_env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None:
        raise EnvironmentError(
            f"Required environment variable '{name}' is not set. "
            f"See https://synapsekit.github.io/synapsekit-docs/reference/env-vars"
        )
    return value
```
