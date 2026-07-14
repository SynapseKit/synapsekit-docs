---
sidebar_position: 6
---

**Tutorial Progress: Step 5 of 5**  
[← Previous: Building a Graph Workflow](./building-graph-workflow) | [Back to Tutorial Index](./index)

# Step 5: Deploying to Production

Congratulations on reaching the final step! In this page we turn your local application into a production-ready, observable, and maintainable system.

## 1. Observability & Cost Tracking

Never deploy without visibility.

```python
from synapsekit.observability import CostTracker, TokenUsageLogger

tracker = CostTracker()
logger = TokenUsageLogger()

rag = RAGPipeline(
    model="gpt-4o-mini",
    callbacks=[tracker, logger],
)
```

You can also export metrics to Prometheus, LangSmith, or your own dashboard.

## 2. Evaluation

Automated evaluation is critical.

```python
from synapsekit.evaluation import RAGEvaluator, FaithfulnessMetric, RelevanceMetric

evaluator = RAGEvaluator(metrics=[FaithfulnessMetric(), RelevanceMetric()])

results = await evaluator.evaluate(
    pipeline=rag,
    test_cases=[{"question": "...", "expected": "..."}]
)
print(results.summary())
```

## 3. Configuration management

Use Pydantic settings for all configuration.

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openai_api_key: str
    vector_store: str = "chroma"
    log_level: str = "INFO"
    max_tokens_per_turn: int = 8000

    class Config:
        env_file = ".env"

settings = Settings()
```

## 4. Containerization (Docker)

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY pyproject.toml .
RUN pip install uv && uv pip install -e ".[all]"

COPY src/ ./src/
COPY .env .env

CMD ["python", "-m", "myapp.main"]
```

## 5. Production checklist

- [ ] All API keys in environment variables / secret manager
- [ ] Rate limiting and budget guards enabled
- [ ] Comprehensive logging + tracing
- [ ] Automated evaluation in CI
- [ ] Graceful degradation when LLM providers fail
- [ ] Health check endpoint (`/health`)
- [ ] Structured output validation with Pydantic
- [ ] Retry + fallback strategies
- [ ] Monitoring dashboards (cost, latency, error rate)

## 6. Example production entrypoint

```python
# src/myapp/main.py
import asyncio
from fastapi import FastAPI
from synapsekit import RAGPipeline, FunctionCallingAgent
from synapsekit.observability import setup_prometheus

app = FastAPI()
setup_prometheus(app)

rag = RAGPipeline(...)  # configured from settings
agent = FunctionCallingAgent(...)

@app.post("/chat")
async def chat(payload: dict):
    result = await agent.run(payload["message"])
    return {"response": result}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## 7. Next steps after this tutorial

- Explore the full [Guides](/docs/guides) section
- Read the [Architecture](/docs/architecture) deep dive
- Join the community discussions
- Contribute a tutorial or improvement

**You have completed the full Getting Started Tutorial!**

You now have the foundation to build reliable, observable, and maintainable LLM applications with SynapseKit.

**Tutorial Progress: Step 5 of 5**  
[← Previous: Building a Graph Workflow](./building-graph-workflow) | [Back to Tutorial Index](./index)
```

**Congratulations — tutorial complete.**