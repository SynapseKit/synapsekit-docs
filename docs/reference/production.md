---
sidebar_position: 5
---

# Production Guide

Deploying SynapseKit reliably at scale.

---

## Docker

### Dockerfile

```dockerfile
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies before copying app code
# so Docker layer caching works on code-only changes
COPY requirements.txt .
RUN pip install --no-cache-dir synapsekit[openai,serve] gunicorn

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["gunicorn", "app:app", \
     "-w", "4", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120"]
```

### docker-compose.yml

A full stack with your application, Redis for caching and memory, and Postgres for checkpointing.

```yaml
version: '3.9'

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - REDIS_URL=redis://redis:6379/0
      - DATABASE_URL=postgresql://user:pass@postgres/synapsekit
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - redis_data:/data
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: synapsekit
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d synapsekit"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  redis_data:
  postgres_data:
```

```bash
# Start the stack
OPENAI_API_KEY=sk-proj-... docker compose up -d

# View logs
docker compose logs -f app

# Scale the app horizontally (see below)
docker compose up -d --scale app=3
```

---

## Logging Configuration

Structured JSON logging makes it easy to ingest into any log aggregator (Datadog, CloudWatch, ELK, Loki).

```python
# logging_config.py
import logging
import sys
import json
from datetime import datetime, timezone

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        })

def configure_logging(level: str = "INFO"):
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper()))
    root.handlers.clear()
    root.addHandler(handler)
```

```python
# app.py
from logging_config import configure_logging
import os

configure_logging(level=os.environ.get("LOG_LEVEL", "INFO"))
```

---

## OpenTelemetry Tracing

Export traces from every LLM call to your observability stack.

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource

def configure_otel(service_name: str):
    resource = Resource.create({"service.name": service_name})
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(endpoint=os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"])
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return trace.get_tracer(service_name)

tracer = configure_otel("synapsekit-prod")
```

```python
# Attach OTel tracer to SynapseKit
from synapsekit.observability import DistributedTracer

sk_tracer = DistributedTracer(
    service_name="synapsekit-prod",
    export_to="otlp",
    otlp_endpoint=os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"],
)

llm = OpenAILLM(model="gpt-4o-mini", tracer=sk_tracer)
```

---

## GitHub Actions — CI/CD

### Build and deploy workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install "synapsekit[all]" pytest
      - run: pytest tests/ -q
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: deploy
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            docker compose pull
            docker compose up -d --no-build
```

---

## Horizontal Scaling

SynapseKit is stateless at the request level (all state lives in Redis/Postgres). You can run multiple replicas behind a load balancer.

### Requirements for horizontal scaling

1. **Use persistent memory backends.** In-process `ConversationMemory` is not shared across replicas.

```python
# Replace this
from synapsekit.memory import ConversationMemory  # in-process

# With this
from synapsekit.memory import RedisConversationMemory  # shared
memory = RedisConversationMemory(redis_url=os.environ["REDIS_URL"], session_id=user_id)
```

2. **Use persistent checkpointers** for graph workflows.

```python
from synapsekit.graph.checkpointing import RedisCheckpointer
checkpointer = RedisCheckpointer(redis_url=os.environ["REDIS_URL"])
graph = workflow.compile(checkpointer=checkpointer)
```

3. **Use Redis LLM caching** to avoid duplicate embedding/completion calls.

```python
from synapsekit.llms.caching import RedisLLMCache
cache = RedisLLMCache(redis_url=os.environ["REDIS_URL"])
llm = OpenAILLM(model="gpt-4o-mini", cache=cache)
```

### Kubernetes deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: synapsekit-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: synapsekit
  template:
    metadata:
      labels:
        app: synapsekit
    spec:
      containers:
        - name: app
          image: ghcr.io/my-org/my-app:latest
          ports:
            - containerPort: 8000
          envFrom:
            - secretRef:
                name: synapsekit-secrets
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 15
            periodSeconds: 20
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: synapsekit-service
spec:
  selector:
    app: synapsekit
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8000
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: synapsekit-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: synapsekit-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## Health Checks

Expose a `/health` endpoint for load balancers and orchestrators.

```python
# app.py
from fastapi import FastAPI
from synapsekit.serve import create_app
import redis.asyncio as redis_client
import asyncpg

rag = RAGPipeline(...)
app = create_app(rag)

@app.get("/health")
async def health():
    checks = {}

    # Check Redis
    try:
        r = redis_client.from_url(os.environ["REDIS_URL"])
        await r.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {e}"

    # Check Postgres
    try:
        conn = await asyncpg.connect(os.environ["DATABASE_URL"])
        await conn.fetchval("SELECT 1")
        await conn.close()
        checks["postgres"] = "ok"
    except Exception as e:
        checks["postgres"] = f"error: {e}"

    all_ok = all(v == "ok" for v in checks.values())
    return {"status": "ok" if all_ok else "degraded", **checks}
```

---

## Environment-Specific Configuration

```python
# config.py
import os
from dataclasses import dataclass

@dataclass
class AppConfig:
    openai_api_key: str
    redis_url: str
    database_url: str
    log_level: str
    model: str
    max_retries: int
    requests_per_minute: int

def load_config() -> AppConfig:
    env = os.environ.get("APP_ENV", "development")
    defaults = {
        "development": {
            "model": "gpt-4o-mini",
            "max_retries": 2,
            "requests_per_minute": 30,
            "log_level": "DEBUG",
        },
        "production": {
            "model": "gpt-4o",
            "max_retries": 5,
            "requests_per_minute": 500,
            "log_level": "INFO",
        },
    }
    d = defaults.get(env, defaults["production"])
    return AppConfig(
        openai_api_key=os.environ["OPENAI_API_KEY"],
        redis_url=os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
        database_url=os.environ.get("DATABASE_URL", ""),
        **d,
    )
```

---

## Cost Management in Production

Cap spending at the infrastructure level, not just the application level.

```python
from synapsekit import BudgetGuard, BudgetLimit
from synapsekit.llms.config import LLMConfig

# Hard cap per request and per day
guard = BudgetGuard(BudgetLimit(
    per_request=0.10,   # 10 cents per call
    per_day=100.00,     # $100 / day
    per_month=2000.00,  # $2,000 / month
))

llm = OpenAILLM(
    model="gpt-4o",
    config=LLMConfig(
        max_retries=5,
        requests_per_minute=500,
    ),
    budget_guard=guard,
)
```

Set up budget alerts in your cloud provider's billing console as a secondary safety net.
