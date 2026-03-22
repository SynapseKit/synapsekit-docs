---
sidebar_position: 9
---

# Streaming Agent Steps

Both `ReActAgent` and `FunctionCallingAgent` support `stream_steps()`, an async generator that yields structured step events as the agent reasons through a task. This enables real-time UIs, logging, and debugging.

## Quick start

```python
from synapsekit import FunctionCallingAgent, CalculatorTool
from synapsekit.agents.step_events import ThoughtEvent, ActionEvent, TokenEvent, FinalAnswerEvent

agent = FunctionCallingAgent(llm=llm, tools=[CalculatorTool()])

async for event in agent.stream_steps("What is 2 ** 10?"):
    if isinstance(event, ThoughtEvent):
        print(f"Thinking: {event.text}")
    elif isinstance(event, ActionEvent):
        print(f"Calling: {event.tool}({event.tool_input})")
    elif isinstance(event, TokenEvent):
        print(event.token, end="")
    elif isinstance(event, FinalAnswerEvent):
        print(f"\nAnswer: {event.text}")
```

## Event types

All events are dataclasses imported from `synapsekit.agents.step_events`:

| Event | Fields | Description |
|---|---|---|
| `ThoughtEvent` | `text`, `step` | Agent's reasoning (ReAct only) |
| `ActionEvent` | `tool`, `tool_input`, `step` | Tool call about to execute |
| `ObservationEvent` | `text`, `step` | Tool result |
| `TokenEvent` | `token`, `step` | Individual token from LLM |
| `FinalAnswerEvent` | `text` | Final answer |
| `ErrorEvent` | `error`, `step` | Error during execution |

`StepEvent` is the union type of all events.

## ReActAgent

The ReAct agent emits the full Thought/Action/Observation loop:

```python
from synapsekit import ReActAgent

agent = ReActAgent(llm=llm, tools=[WebSearchTool()])

async for event in agent.stream_steps("Latest Python release?"):
    match event:
        case ThoughtEvent(text=t):
            print(f"[Thought] {t}")
        case ActionEvent(tool=name, tool_input=inp):
            print(f"[Action] {name}: {inp}")
        case ObservationEvent(text=t):
            print(f"[Observation] {t}")
        case TokenEvent(token=tok):
            print(tok, end="", flush=True)
        case FinalAnswerEvent(text=t):
            print(f"\n[Final] {t}")
```

## FunctionCallingAgent

The function calling agent emits `ActionEvent` per tool call and `ObservationEvent` per result:

```python
from synapsekit import FunctionCallingAgent

agent = FunctionCallingAgent(llm=llm, tools=[CalculatorTool(), WebSearchTool()])

async for event in agent.stream_steps("What is sqrt(144)?"):
    print(type(event).__name__, getattr(event, "text", getattr(event, "token", "")))
```

## Building a streaming UI

```python
import json

async def stream_to_websocket(ws, agent, query):
    async for event in agent.stream_steps(query):
        msg = {
            "type": type(event).__name__,
            "step": getattr(event, "step", None),
        }
        if hasattr(event, "text"):
            msg["text"] = event.text
        elif hasattr(event, "token"):
            msg["token"] = event.token
        elif hasattr(event, "tool"):
            msg["tool"] = event.tool
            msg["tool_input"] = event.tool_input

        await ws.send(json.dumps(msg))
```

## See also

- [ReAct Agent](./react) — prompt-based reasoning loop
- [Function Calling Agent](./function-calling) — native tool_calls
- [AgentExecutor](./executor) — unified runner with streaming
- [How-to: Streaming](../how-to/streaming) — streaming patterns for LLMs and pipelines
