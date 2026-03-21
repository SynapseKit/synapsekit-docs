---
sidebar_position: 9
---

# Production Deployment

This guide covers packaging a SynapseKit application for production: Docker, gunicorn, health checks, CI/CD deployment, logging, and observability.

## Prerequisites

```bash
pip install synapsekit[openai,serve] gunicorn uvicorn
```

---

## 1. Application structure

A minimal production-ready FastAPI app powered by SynapseKit:

```
my_app/
├── app.py              # FastAPI application
├── pipeline.py         # SynapseKit pipeline setup
├── config.py           # Settings from environment variables
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── gunicorn.conf.py
└── .github/
    └── workflows/
        └── deploy.yml
```

### `config.py` — environment-based settings

```python
# config.py
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    openai_api_key: str
    redis_url: str = "redis://localhost:6379"
    log_level: str = "INFO"
    max_budget_usd: float = 10.0
    environment: str = "production"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

### `pipeline.py` — singleton RAG pipeline

```python
# pipeline.py
from synapsekit import RAG
from synapsekit.llms.openai import OpenAILLM
from synapsekit.llms.base import LLMConfig
from synapsekit.memory import RedisConversationMemory
from synapsekit.observability import CostTracker
from synapsekit.guardrails import BudgetGuard
from config import get_settings
import logging

logger = logging.getLogger(__name__)
_pipeline: RAG | None = None


async def get_pipeline() -> RAG:
    """Return the singleton RAG pipeline, initializing if needed."""
    global _pipeline
    if _pipeline is None:
        settings = get_settings()
        llm = OpenAILLM(
            model="gpt-4o-mini",
            config=LLMConfig(
                max_retries=3,
                retry_delay=1.0,
                retry_backoff=2.0,
                timeout=30.0,
            ),
        )
        tracker = CostTracker()
        guard = BudgetGuard(tracker=tracker, budget_usd=settings.max_budget_usd)
        guarded_llm = guard.wrap(llm)
        _pipeline = RAG(llm=guarded_llm)
        logger.info("Pipeline initialized")
    return _pipeline
```

### `app.py` — FastAPI application

```python
# app.py
import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from pipeline import get_pipeline
from config import get_settings

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


class QueryRequest(BaseModel):
    question: str
    session_id: str = "default"
    stream: bool = False


class QueryResponse(BaseModel):
    answer: str
    latency_ms: float


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: warm up pipeline
    logger.info("Starting up — warming pipeline...")
    await get_pipeline()
    logger.info("Pipeline ready")
    yield
    # Shutdown
    logger.info("Shutting down")


app = FastAPI(title="SynapseKit API", lifespan=lifespan)


@app.get("/health")
async def health():
    """Health check endpoint for load balancers and container orchestrators."""
    return {"status": "ok", "service": "synapsekit-api"}


@app.get("/ready")
async def readiness():
    """Readiness probe — returns 503 if pipeline is not initialized."""
    try:
        pipeline = await get_pipeline()
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Not ready: {e}")


@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    """Answer a question using the RAG pipeline."""
    start = time.perf_counter()
    try:
        pipeline = await get_pipeline()
        answer = await pipeline.aquery(request.question)
        latency_ms = (time.perf_counter() - start) * 1000
        logger.info("Query completed", extra={"latency_ms": latency_ms})
        return QueryResponse(answer=answer, latency_ms=latency_ms)
    except Exception as e:
        logger.exception("Query failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query/stream")
async def query_stream(request: QueryRequest):
    """Stream a RAG answer token-by-token as SSE."""
    pipeline = await get_pipeline()

    async def event_generator():
        try:
            async for token in pipeline.astream(request.question):
                yield f"data: {token}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.exception("Streaming failed")
            yield f"data: [ERROR] {e}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

---

## 2. Dockerfile

```dockerfile
FROM python:3.12-slim

# Security: run as non-root
RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir synapsekit[openai,serve] gunicorn uvicorn pydantic-settings

# Copy application code
COPY . .

# Fix ownership
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Health check — Docker will mark container unhealthy if this fails
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["gunicorn", "app:app", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--config", "gunicorn.conf.py"]
```

### `requirements.txt`

```
synapsekit[openai,serve]>=1.2.0
gunicorn>=21.0
uvicorn[standard]>=0.27.0
pydantic-settings>=2.0
```

---

## 3. `gunicorn.conf.py`

```python
# gunicorn.conf.py
import multiprocessing
import os

# Workers: 2 * CPU cores + 1 is a common rule of thumb
workers = int(os.getenv("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1))
worker_class = "uvicorn.workers.UvicornWorker"
bind = "0.0.0.0:8000"
timeout = 120          # Request timeout in seconds
keepalive = 5          # Keep-alive connections
max_requests = 1000    # Restart worker after 1000 requests (prevents memory leaks)
max_requests_jitter = 50  # Stagger restarts to avoid thundering herd
graceful_timeout = 30  # Time allowed for graceful shutdown
preload_app = True     # Load app before forking workers (saves memory)

# Logging
accesslog = "-"        # stdout
errorlog = "-"         # stdout
loglevel = os.getenv("LOG_LEVEL", "info").lower()
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(D)sµs'
```

---

## 4. `docker-compose.yml`

```yaml
version: "3.9"

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - REDIS_URL=redis://redis:6379
      - LOG_LEVEL=INFO
      - GUNICORN_WORKERS=4
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c",
             "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    restart: unless-stopped
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

Build and run locally:

```bash
docker compose up --build
# Expected output:
# [+] Building 23.4s (10/10) FINISHED
# [+] Running 2/2
#  ✔ Container myapp-redis-1  Healthy
#  ✔ Container myapp-app-1    Healthy

# Test it:
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is RAG?"}'
# Expected output:
# {"answer":"RAG (Retrieval-Augmented Generation) is...","latency_ms":342.1}
```

---

## 5. GitHub Actions deployment pipeline

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install synapsekit[openai] pytest pytest-asyncio
      - run: pytest tests/ -m "not integration" -q

  build-and-push:
    name: Build Docker Image
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      image-digest: ${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}

  deploy:
    name: Deploy to Production
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
            docker compose -f /opt/myapp/docker-compose.yml up -d --no-deps app
            docker system prune -f
```

---

## 6. Structured logging with JSON

```python
# logging_config.py
import logging
import json
import sys
from datetime import datetime


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        # Include any extra fields passed to the logger
        for key, value in record.__dict__.items():
            if key not in (
                "name", "msg", "args", "levelname", "levelno", "pathname",
                "filename", "module", "exc_info", "exc_text", "stack_info",
                "lineno", "funcName", "created", "msecs", "relativeCreated",
                "thread", "threadName", "processName", "process", "message",
            ):
                log_entry[key] = value
        return json.dumps(log_entry)


def setup_logging(level: str = "INFO"):
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    logging.basicConfig(level=getattr(logging, level.upper()), handlers=[handler])
```

---

## 7. OpenTelemetry tracing

```python
# otel.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
import os


def setup_tracing():
    provider = TracerProvider()
    exporter = OTLPSpanExporter(
        endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317"),
    )
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return trace.get_tracer("synapsekit-app")


# In app.py startup:
# tracer = setup_tracing()
#
# @app.post("/query")
# async def query(request: QueryRequest):
#     with tracer.start_as_current_span("rag_query") as span:
#         span.set_attribute("question.length", len(request.question))
#         answer = await pipeline.aquery(request.question)
#         span.set_attribute("answer.length", len(answer))
#         return QueryResponse(answer=answer, latency_ms=0)
```

---

## 8. Production checklist

- [ ] Set `OPENAI_API_KEY` (and other secrets) via environment variables — never hard-code
- [ ] Configure `LLMConfig` with retries and timeouts
- [ ] Add `BudgetGuard` with a monthly budget limit
- [ ] Use Redis memory for stateful sessions across multiple workers
- [ ] Set `HEALTHCHECK` in Dockerfile
- [ ] Add `/health` and `/ready` endpoints
- [ ] Enable structured JSON logging
- [ ] Limit `gunicorn` workers to `2 * CPU + 1`
- [ ] Set `max_requests=1000` to prevent memory leaks
- [ ] Use `preload_app=True` for memory efficiency
- [ ] Add rate limiting (e.g., with `slowapi` or a reverse proxy)
- [ ] Pin dependency versions in `requirements.txt`
- [ ] Run containers as non-root user
- [ ] Store secrets in GitHub Actions secrets, not in code
