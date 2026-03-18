---
sidebar_position: 1
---

# Observability

SynapseKit provides built-in observability through OpenTelemetry-compatible tracing, automatic LLM call instrumentation, and an HTML dashboard for viewing traces.

## TracingMiddleware

Auto-trace all LLM calls with zero code changes:

```python
from synapsekit import TracingMiddleware, OpenAILLM

middleware = TracingMiddleware()

llm = OpenAILLM(model="gpt-4o")
traced_llm = middleware.wrap(llm)

# All calls are automatically traced
result = await traced_llm.generate("Hello!")

# View collected spans
for span in middleware.spans:
    print(f"{span.name}: {span.duration_ms:.1f}ms")
```

## Span

Individual trace spans contain timing, metadata, and parent-child relationships:

```python
from synapsekit import Span

span = Span(name="llm.generate", attributes={"model": "gpt-4o"})
span.start()
# ... do work ...
span.end()

print(span.duration_ms)    # 245.3
print(span.attributes)     # {"model": "gpt-4o"}
print(span.trace_id)       # "abc123..."
print(span.span_id)        # "def456..."
```

## OTelExporter

Export traces in OpenTelemetry format for integration with Jaeger, Zipkin, Grafana Tempo, or any OTLP-compatible backend:

```python
from synapsekit import OTelExporter, TracingMiddleware

exporter = OTelExporter(endpoint="http://localhost:4318/v1/traces")
middleware = TracingMiddleware(exporter=exporter)

llm = middleware.wrap(llm)
result = await llm.generate("Hello!")

# Traces are automatically exported to the configured backend
```

## TracingUI

View traces in a local HTML dashboard:

```python
from synapsekit import TracingUI, TracingMiddleware

middleware = TracingMiddleware()

# ... run some LLM calls ...

ui = TracingUI(middleware.spans)
ui.save("traces.html")  # Open in browser
```

The dashboard shows:
- Timeline view of all spans
- Duration and latency breakdown
- Token usage and cost per call
- Parent-child span relationships

## Distributed Tracing

For multi-service architectures, use `DistributedTracer` to trace requests across services:

```python
from synapsekit import DistributedTracer, TraceSpan

tracer = DistributedTracer(service_name="my-service")

with tracer.start_span("handle_request") as span:
    span.set_attribute("user_id", "123")

    with tracer.start_span("call_llm", parent=span) as child:
        result = await llm.generate("Hello!")
        child.set_attribute("tokens", result.usage.total_tokens)

# Export trace context for propagation to other services
trace_context = tracer.get_trace_context()
```

`DistributedTracer` and `TraceSpan` support W3C Trace Context propagation for cross-service correlation.
