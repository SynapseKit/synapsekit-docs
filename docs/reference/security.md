---
sidebar_position: 4
---

# Security Guide

Best practices for running SynapseKit safely in production.

---

## Never Hardcode API Keys

API keys checked into source control are the most common cause of credential leaks. Use environment variables or a secrets manager instead.

### Development: .env files

```bash
# .env  — add to .gitignore immediately
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
REDIS_URL=redis://localhost:6379/0
```

```python
from dotenv import load_dotenv
load_dotenv()

from synapsekit.llms.openai import OpenAILLM
llm = OpenAILLM(model="gpt-4o-mini")  # reads OPENAI_API_KEY from environment
```

Add `.env` to `.gitignore` immediately:

```bash
echo ".env" >> .gitignore
```

### Production: Secrets Managers

**AWS Secrets Manager:**

```python
import boto3, os

def load_secrets():
    client = boto3.client("secretsmanager", region_name="us-east-1")
    secret = client.get_secret_value(SecretId="prod/synapsekit")
    import json
    secrets = json.loads(secret["SecretString"])
    for key, value in secrets.items():
        os.environ[key] = value

load_secrets()  # called once at startup
```

**GCP Secret Manager:**

```python
from google.cloud import secretmanager
import os

def load_gcp_secret(project_id: str, secret_id: str) -> str:
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
    return client.access_secret_version(request={"name": name}).payload.data.decode()

os.environ["OPENAI_API_KEY"] = load_gcp_secret("my-project", "openai-api-key")
```

**Azure Key Vault:**

```python
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential
import os

vault_client = SecretClient(
    vault_url="https://my-vault.vault.azure.net/",
    credential=DefaultAzureCredential()
)
os.environ["OPENAI_API_KEY"] = vault_client.get_secret("openai-api-key").value
```

### Secret Rotation

Rotate keys periodically and immediately if you suspect exposure:

```python
import os
from datetime import datetime

def rotate_key(new_key: str):
    """Hot-swap the API key without restarting the process."""
    os.environ["OPENAI_API_KEY"] = new_key
    # Re-initialise any cached clients
    global llm
    llm = OpenAILLM(model="gpt-4o-mini")

# Call from a management endpoint or cron job
rotate_key(vault_client.get_secret("openai-api-key").value)
```

---

## Detecting and Masking PII

Before sending user input to an external LLM, detect and redact personally identifiable information.

```python
from synapsekit.guardrails import PIIDetector, PIIAction

# Detect only
detector = PIIDetector()
result = detector.scan("My name is John Smith, email john@example.com, SSN 123-45-6789")
print(result.entities)
# [PIIEntity(type='PERSON', value='John Smith', ...),
#  PIIEntity(type='EMAIL', value='john@example.com', ...),
#  PIIEntity(type='SSN', value='123-45-6789', ...)]

# Redact before sending to LLM
detector = PIIDetector(action=PIIAction.REDACT)
safe_text = detector.redact("Call me at 555-867-5309")
# "Call me at [PHONE_NUMBER]"

llm_response = await llm.complete(safe_text)  # safe to send
```

**Supported entity types:** `PERSON`, `EMAIL`, `PHONE`, `SSN`, `CREDIT_CARD`, `IP_ADDRESS`, `DATE_OF_BIRTH`, `PASSPORT`, `DRIVER_LICENSE`, `BANK_ACCOUNT`, `ADDRESS`.

**Integration in a RAG pipeline:**

```python
from synapsekit.rag import RAGPipeline
from synapsekit.guardrails import PIIDetector, PIIAction

pii = PIIDetector(action=PIIAction.REDACT)

async def safe_query(user_input: str) -> str:
    clean_input = pii.redact(user_input)
    return await rag.run(clean_input)
```

---

## Content Filtering

Block harmful, abusive, or off-policy content from entering your pipeline.

```python
from synapsekit.guardrails import ContentFilter, ContentPolicy

policy = ContentPolicy(
    block_violence=True,
    block_hate_speech=True,
    block_self_harm=True,
    block_sexual_content=True,
    block_profanity=False,
)

content_filter = ContentFilter(policy=policy)

async def filtered_query(user_input: str) -> str:
    check = await content_filter.check(user_input)
    if check.blocked:
        return f"Request blocked: {check.reason}"
    return await rag.run(user_input)
```

**Checking LLM output as well:**

```python
async def safe_pipeline(user_input: str) -> str:
    # Filter input
    input_check = await content_filter.check(user_input)
    if input_check.blocked:
        return "I can't help with that."

    response = await rag.run(user_input)

    # Filter output
    output_check = await content_filter.check(response)
    if output_check.blocked:
        return "I can't return that response."

    return response
```

---

## Topic Restriction for Compliance

Restrict your assistant to a defined set of topics. Useful for regulated industries (finance, legal, healthcare) where you must prevent the model from opining outside its intended domain.

```python
from synapsekit.guardrails import TopicRestrictor

# Allow-list approach: only answer questions about your product
restrictor = TopicRestrictor(
    allowed_topics=["product features", "billing", "technical support"],
    rejection_message="I can only assist with product-related questions.",
)

async def restricted_query(user_input: str) -> str:
    check = await restrictor.check(user_input)
    if not check.allowed:
        return check.rejection_message
    return await agent.run(user_input)
```

**Block-list approach:**

```python
restrictor = TopicRestrictor(
    blocked_topics=["medical diagnosis", "legal advice", "financial advice"],
    rejection_message="Please consult a qualified professional for this topic.",
)
```

---

## Audit Logging

Log every LLM call, including the model, token counts, and cost, for compliance and debugging.

```python
from synapsekit.observability import DistributedTracer
import logging

logging.basicConfig(level=logging.INFO)

tracer = DistributedTracer(
    service_name="my-rag-service",
    export_to="otlp",                 # or "jaeger", "zipkin", "console"
    otlp_endpoint="http://otel-collector:4317",
)

llm = OpenAILLM(
    model="gpt-4o-mini",
    tracer=tracer,
)

# Every call is now traced with:
# - span name, trace ID, model name, token counts, latency, cost
```

**Structured logging for SIEM integration:**

```python
import structlog

logger = structlog.get_logger()

async def audited_query(user_id: str, query: str) -> str:
    response = await rag.run(query)
    logger.info(
        "llm_call",
        user_id=user_id,
        query_hash=hash(query),   # don't log raw PII
        model="gpt-4o-mini",
        tokens=response.usage.total_tokens,
        cost_usd=response.cost,
    )
    return response.content
```

---

## Rate Limiting to Prevent Abuse

Prevent runaway costs and service abuse with per-user rate limits.

```python
from synapsekit.llms.config import LLMConfig

llm = OpenAILLM(
    model="gpt-4o-mini",
    config=LLMConfig(
        requests_per_minute=60,
        tokens_per_minute=90_000,
        max_retries=3,
    )
)
```

**Per-user rate limiting with Redis (FastAPI example):**

```python
import redis.asyncio as redis
from fastapi import HTTPException, Request

r = redis.from_url("redis://localhost:6379")

async def check_rate_limit(user_id: str, limit: int = 10) -> None:
    key = f"ratelimit:{user_id}"
    count = await r.incr(key)
    if count == 1:
        await r.expire(key, 60)  # 1-minute window
    if count > limit:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

@app.post("/query")
async def query(request: Request, q: str, user_id: str):
    await check_rate_limit(user_id, limit=10)
    return await rag.run(q)
```

---

## Securing synapsekit serve

`synapsekit serve` starts an unauthenticated HTTP server by default. Add authentication middleware before exposing it publicly.

**API key auth middleware:**

```python
# app.py — wrap your pipeline with auth
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.base import BaseHTTPMiddleware
import os

VALID_API_KEYS = set(os.environ.get("API_KEYS", "").split(","))

class APIKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/health":
            return await call_next(request)
        key = request.headers.get("X-API-Key")
        if key not in VALID_API_KEYS:
            raise HTTPException(status_code=401, detail="Invalid API key")
        return await call_next(request)

from synapsekit import RAGPipeline
from synapsekit.serve import create_app

rag = RAGPipeline(...)
app = create_app(rag)
app.add_middleware(APIKeyMiddleware)
```

**JWT auth (OAuth2 Bearer):**

```python
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from fastapi import Depends, HTTPException

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
SECRET_KEY = os.environ["JWT_SECRET"]

async def verify_token(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.post("/query")
async def query(q: str, _=Depends(verify_token)):
    return await rag.run(q)
```

**TLS termination.** Always run behind a reverse proxy (nginx, Caddy) that handles TLS. Never expose the raw uvicorn port to the internet.

```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## OWASP Considerations for AI Endpoints

The [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) identifies the most critical risks for systems like SynapseKit. Key mitigations:

| OWASP Risk | Mitigation |
|---|---|
| LLM01: Prompt Injection | Validate and sanitise all user input. Use `ContentFilter` and `TopicRestrictor`. Never interpolate raw user input directly into system prompts. |
| LLM02: Insecure Output Handling | Treat LLM output as untrusted. Escape HTML, validate JSON schemas before using output programmatically. |
| LLM03: Training Data Poisoning | Use reputable embedding models; audit your document corpus before indexing. |
| LLM06: Sensitive Information Disclosure | Use `PIIDetector` on both inputs and outputs. Never store raw user queries in logs. |
| LLM07: Insecure Plugin Design | Validate tool inputs and outputs. Use the minimum permission principle for tool access. |
| LLM08: Excessive Agency | Set `max_steps` on all agents. Use `BudgetGuard` to cap costs. Require human approval for high-impact actions. |
| LLM09: Overreliance | Display confidence scores and source citations. Instruct users that LLM output should be verified. |

**Prompt injection example — what NOT to do:**

```python
# UNSAFE — user can override the system prompt
system = f"You are a helpful assistant. Context: {user_provided_context}"

# SAFER — keep user content in a clearly labelled slot
system = "You are a helpful assistant. Answer only from the provided context."
user_message = f"Context:\n{retrieved_context}\n\nQuestion: {user_query}"
```

**Tool permission scoping:**

```python
from synapsekit.agents.tools import SQLTool

# Give agents read-only access
sql_tool = SQLTool(
    connection_string=DATABASE_URL,
    allowed_operations=["SELECT"],  # no INSERT, UPDATE, DELETE, DROP
)
```
