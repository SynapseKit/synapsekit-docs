---
sidebar_position: 9
title: "Streaming Agent Responses"
description: "Display an agent's live thought process using stream_steps() and typed StepEvent classes in SynapseKit."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Streaming Agent Responses

<ColabBadge path="agents/streaming-agent.ipynb" />

Waiting for an agent to finish before showing any output makes it feel slow and opaque. Streaming step events lets users see the agent's reasoning in real time — which tool it chose, what it observed, and how its thinking evolved toward a final answer. **What you'll build:** a streaming agent display that shows thoughts, tool calls, observations, and tokens as they arrive — suitable for both terminal output and real-time web UIs. **Time:** ~15 min. **Difficulty:** Beginner

## Prerequisites

```bash
pip install synapsekit
export OPENAI_API_KEY="sk-..."
```

## What you'll learn

- The difference between `agent.run()` (blocking) and `agent.stream_steps()` (streaming)
- All six `StepEvent` types: `ThoughtEvent`, `ActionEvent`, `ObservationEvent`, `TokenEvent`, `FinalAnswerEvent`, `ErrorEvent`
- How to build a formatted terminal display for step events
- How `ReActAgent` and `FunctionCallingAgent` differ in what events they emit
- How to pipe events to a WebSocket or SSE endpoint

## Step 1: Import event types

```python
import asyncio
from synapsekit.agents import (
    ReActAgent,
    FunctionCallingAgent,
    DuckDuckGoSearchTool,
    CalculatorTool,
    WikipediaTool,
    # Step event types
    ActionEvent,
    ErrorEvent,
    FinalAnswerEvent,
    ObservationEvent,
    ThoughtEvent,
    TokenEvent,
)
from synapsekit.llms.openai import OpenAILLM
```

## Step 2: Understand the event types

`stream_steps()` yields a union type `StepEvent`. Each concrete type carries different fields:

| Event | Fields | When emitted |
|---|---|---|
| `ThoughtEvent` | `thought: str` | LLM produces a Thought line (ReActAgent only) |
| `ActionEvent` | `tool: str`, `tool_input` | LLM decides to call a tool |
| `ObservationEvent` | `observation: str`, `tool: str` | Tool execution completes |
| `TokenEvent` | `token: str` | A single text token from the LLM |
| `FinalAnswerEvent` | `answer: str` | Agent has a complete final answer |
| `ErrorEvent` | `error: str` | A tool raised an exception |

```python
# ReActAgent emits ThoughtEvent + TokenEvent (it streams live LLM tokens)
# FunctionCallingAgent emits ActionEvent + ObservationEvent + TokenEvent + FinalAnswerEvent
```

## Step 3: Build a terminal renderer

A simple renderer maps each event type to a distinct visual prefix, making the agent's reasoning easy to follow at a glance.

```python
COLORS = {
    "thought":      "\033[36m",  # cyan
    "action":       "\033[33m",  # yellow
    "observation":  "\033[32m",  # green
    "token":        "\033[0m",   # default
    "final_answer": "\033[1;32m",# bold green
    "error":        "\033[31m",  # red
}
RESET = "\033[0m"


def render_event(event) -> None:
    if isinstance(event, ThoughtEvent):
        print(f"{COLORS['thought']}Thought:{RESET} {event.thought}")
    elif isinstance(event, ActionEvent):
        input_preview = str(event.tool_input)[:80]
        print(f"{COLORS['action']}Action:{RESET}  {event.tool}({input_preview})")
    elif isinstance(event, ObservationEvent):
        preview = event.observation[:150]
        print(f"{COLORS['observation']}Result:{RESET}  {preview}{'...' if len(event.observation) > 150 else ''}")
    elif isinstance(event, TokenEvent):
        # Print tokens inline without newline — forms a continuous stream
        print(event.token, end="", flush=True)
    elif isinstance(event, FinalAnswerEvent):
        print(f"\n{COLORS['final_answer']}Answer:{RESET}\n{event.answer}")
    elif isinstance(event, ErrorEvent):
        print(f"{COLORS['error']}Error:{RESET}   {event.error}")
```

## Step 4: Stream a ReActAgent

`ReActAgent` streams LLM tokens live as they are generated. The full response is then parsed for Thought/Action/Final Answer structure. This means you see the LLM "typing" in real time.

```python
react_agent = ReActAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=[DuckDuckGoSearchTool(), WikipediaTool(), CalculatorTool()],
    max_iterations=6,
)

async def stream_react(question: str) -> None:
    print(f"Q: {question}\n")
    async for event in react_agent.stream_steps(question):
        render_event(event)
```

## Step 5: Stream a FunctionCallingAgent

`FunctionCallingAgent` does not stream raw tokens during tool-selection turns — the LLM response is processed as a complete JSON object. It emits `TokenEvent` for the final answer only. The trade-off is more reliable tool parsing.

```python
fc_agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=[DuckDuckGoSearchTool(), CalculatorTool()],
    system_prompt="You are a helpful research assistant.",
    max_iterations=6,
)

async def stream_fc(question: str) -> None:
    print(f"Q: {question}\n")
    async for event in fc_agent.stream_steps(question):
        render_event(event)
```

## Step 6: Collect the full answer from the stream

When you need both the streaming display and the final answer string, accumulate `FinalAnswerEvent`:

```python
async def stream_and_collect(agent, question: str) -> str:
    final_answer = ""
    async for event in agent.stream_steps(question):
        render_event(event)
        if isinstance(event, FinalAnswerEvent):
            final_answer = event.answer
    return final_answer
```

## Complete working example

```python
import asyncio
from synapsekit.agents import (
    ActionEvent,
    CalculatorTool,
    DuckDuckGoSearchTool,
    ErrorEvent,
    FinalAnswerEvent,
    FunctionCallingAgent,
    ObservationEvent,
    ReActAgent,
    ThoughtEvent,
    TokenEvent,
    WikipediaTool,
)
from synapsekit.llms.openai import OpenAILLM

RESET = "\033[0m"


def render_event(event) -> None:
    if isinstance(event, ThoughtEvent):
        print(f"\033[36m[thought]\033[0m {event.thought}")
    elif isinstance(event, ActionEvent):
        print(f"\033[33m[tool]\033[0m    {event.tool}({str(event.tool_input)[:70]})")
    elif isinstance(event, ObservationEvent):
        print(f"\033[32m[result]\033[0m  {event.observation[:120]}...")
    elif isinstance(event, TokenEvent):
        print(event.token, end="", flush=True)
    elif isinstance(event, FinalAnswerEvent):
        print(f"\n\033[1;32m[answer]\033[0m\n{event.answer}")
    elif isinstance(event, ErrorEvent):
        print(f"\033[31m[error]\033[0m   {event.error}")


async def demo_react(question: str) -> None:
    agent = ReActAgent(
        llm=OpenAILLM(model="gpt-4o-mini"),
        tools=[DuckDuckGoSearchTool(), WikipediaTool(), CalculatorTool()],
        max_iterations=6,
    )
    print(f"\n--- ReActAgent ---\nQ: {question}\n")
    async for event in agent.stream_steps(question):
        render_event(event)


async def demo_function_calling(question: str) -> None:
    agent = FunctionCallingAgent(
        llm=OpenAILLM(model="gpt-4o-mini"),
        tools=[DuckDuckGoSearchTool(), CalculatorTool()],
        system_prompt="You are a concise assistant.",
        max_iterations=6,
    )
    print(f"\n--- FunctionCallingAgent ---\nQ: {question}\n")
    async for event in agent.stream_steps(question):
        render_event(event)


async def main() -> None:
    await demo_react(
        "What is the population of Tokyo according to Wikipedia, and what is 10% of that number?"
    )
    await demo_function_calling(
        "Search for the latest Python release version and calculate how many months ago it was released from today (April 2026)."
    )


asyncio.run(main())
```

## Expected output

```
--- ReActAgent ---
Q: What is the population of Tokyo...

[thought] I need to look up Tokyo's population on Wikipedia, then calculate 10%.
[tool]    wikipedia(Tokyo)
[result]  Tokyo is the capital and most populous city of Japan...
[thought] Wikipedia says Tokyo has about 13.96 million people in the city proper.
[tool]    calculator(13960000 * 0.10)
[result]  1396000.0
[thought] I now know the final answer.
[answer]
Tokyo's population is approximately 13.96 million. 10% of that is 1,396,000 people.

--- FunctionCallingAgent ---
Q: Search for the latest Python release version...

[tool]    duck_duck_go_search(latest Python release 2025)
[result]  Python 3.13.2 released February 4, 2025...
[tool]    calculator(14 months from Feb 2025 to April 2026)
[result]  14
Python 3.13.2 was released in February 2025, approximately 14 months ago.
```

## How it works

`ReActAgent.stream_steps()` calls `self._llm.stream_with_messages()` which yields tokens one by one. After the full response is assembled, it parses the text for Thought, Action, and Final Answer markers, emitting typed events. Token events are yielded during streaming; Thought/Action/FinalAnswer events are emitted after parsing.

`FunctionCallingAgent.stream_steps()` calls `self._llm.call_with_tools()` which returns a complete JSON response (not a token stream) on tool-selection turns. Token events are only yielded when emitting the final answer, which is split word-by-word to simulate streaming.

## Variations

**Stream to a WebSocket** (FastAPI example):

```python
from fastapi import WebSocket

async def ws_endpoint(websocket: WebSocket, question: str):
    await websocket.accept()
    async for event in agent.stream_steps(question):
        if isinstance(event, TokenEvent):
            await websocket.send_text(event.token)
        elif isinstance(event, FinalAnswerEvent):
            await websocket.send_json({"type": "done", "answer": event.answer})
    await websocket.close()
```

**Stream to a Server-Sent Events endpoint:**

```python
from fastapi.responses import StreamingResponse

async def sse_stream(question: str):
    async def generate():
        async for event in agent.stream_steps(question):
            if isinstance(event, TokenEvent):
                yield f"data: {event.token}\n\n"
            elif isinstance(event, FinalAnswerEvent):
                yield f"data: [DONE]\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")
```

**Suppress thought events** for cleaner user-facing output:

```python
async for event in agent.stream_steps(question):
    if not isinstance(event, ThoughtEvent):
        render_event(event)
```

## Troubleshooting

**No events are yielded** — ensure you are iterating with `async for` inside an `async` function, and the function is called with `asyncio.run()`.

**Token events appear as a wall of text** — add `print()` with `end=""` and `flush=True` rather than `print(event.token)` which adds a newline after each token.

**`FunctionCallingAgent` never emits ThoughtEvent** — this is by design. `ThoughtEvent` is only emitted by `ReActAgent` which parses Thought lines from text responses. Use `ReActAgent` if you need live thought streaming.

**Stream cuts off before FinalAnswerEvent** — `max_iterations` was reached. Increase it or simplify the query.

## Next steps

- [ReAct Research Assistant](./react-research-assistant) — build a full research agent with streaming step display
- [Multi-Tool Orchestration](./multi-tool-orchestration) — stream a complex multi-tool pipeline
- [Structured Output with Function Calling](./structured-output-function-calling) — enforce typed output schemas while still streaming intermediate steps
