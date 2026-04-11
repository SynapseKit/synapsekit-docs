---
sidebar_position: 5
title: "Agent-to-Agent Communication"
description: "Build agents that send messages directly to each other, share mutable state, and pass structured results without a central orchestrator."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Agent-to-Agent Communication

<ColabBadge path="multi-agent/a2a-communication.ipynb" />

Most multi-agent patterns route messages through a central coordinator. Agent-to-agent (A2A) communication lets agents address each other directly — one agent sends a query to another and awaits a reply before continuing. This enables negotiation, critique loops, and peer-to-peer delegation without a supervisor in the middle.

**What you'll build:** A two-agent debate system where an advocate and a critic exchange messages, challenge each other's arguments, and arrive at a synthesized conclusion via a shared state object. **Time:** ~25 min. **Difficulty:** Advanced

## Prerequisites

```bash
pip install synapsekit[openai]
```

## What you'll learn

- Use `AgentMessenger` to send typed messages between agents
- Share mutable state across agents using a thread-safe `SharedState`
- Build a critique loop where agents respond to each other's output
- Collect and merge the conversation history into a final result

## Step 1: Define shared state

```python
# a2a_communication.py

from __future__ import annotations
import asyncio
from dataclasses import dataclass, field

from synapsekit.agents import Agent, AgentMessenger, SharedState
from synapsekit.llms.openai import OpenAILLM
from synapsekit import LLMConfig

# SharedState is a thread-safe container. Agents access it via .get() and .set().
# All mutations are serialized, so concurrent agents don't race on the same key.
@dataclass
class DebateState:
    topic: str
    rounds: int = 3

    # The conversation history, appended to by both agents
    transcript: list[dict] = field(default_factory=list)

    # Final output assembled after all rounds
    synthesis: str = ""
```

## Step 2: Create agents with messaging capability

```python
llm = OpenAILLM(model="gpt-4o-mini", config=LLMConfig(temperature=0.8))

advocate = Agent(
    name="advocate",
    instructions=(
        "You argue in favor of the given position. "
        "Be persuasive but concise — limit each response to 3 sentences. "
        "When responding to a critique, acknowledge the strongest point before rebutting."
    ),
    llm=llm,
)

critic = Agent(
    name="critic",
    instructions=(
        "You challenge arguments by identifying weaknesses, counterexamples, "
        "and unstated assumptions. Limit each response to 3 sentences. "
        "End each critique with a specific question the advocate must address."
    ),
    llm=llm,
)

synthesizer = Agent(
    name="synthesizer",
    instructions=(
        "You read a debate transcript and produce a balanced, nuanced synthesis. "
        "Acknowledge valid points from both sides and identify where they agree. "
        "Return a single paragraph of 4–6 sentences."
    ),
    llm=llm,
)
```

## Step 3: Set up the messenger and shared state

```python
async def run_debate(topic: str, rounds: int = 3) -> DebateState:
    state = DebateState(topic=topic, rounds=rounds)
    shared = SharedState(initial=state)

    # AgentMessenger is the communication bus. Agents call messenger.send() to
    # direct a message at another agent by name and await the reply.
    messenger = AgentMessenger(
        agents={
            "advocate":    advocate,
            "critic":      critic,
            "synthesizer": synthesizer,
        },
        shared_state=shared,
    )

    await run_rounds(messenger, shared, topic, rounds)
    await synthesize(messenger, shared)

    return await shared.get_state()
```

## Step 4: Implement the exchange loop

```python
async def run_rounds(
    messenger: AgentMessenger,
    shared: SharedState,
    topic: str,
    rounds: int,
) -> None:
    # The advocate opens with an initial argument
    opening = await messenger.send(
        from_agent="advocate",
        to_agent="advocate",          # Self-addressed to generate an opening statement
        message=f"Make an opening argument in favor of: {topic}",
    )

    state = await shared.get_state()
    state.transcript.append({"speaker": "advocate", "text": opening.text})
    await shared.set_state(state)

    print(f"[advocate] {opening.text}\n")

    # Alternate between critic and advocate for `rounds` exchanges
    for i in range(rounds):
        # Critic reads the last advocate message and challenges it
        last_advocate_msg = state.transcript[-1]["text"]
        critique = await messenger.send(
            from_agent="critic",
            to_agent="critic",
            message=(
                f"Topic: {topic}\n\n"
                f"Critique this argument:\n{last_advocate_msg}"
            ),
        )
        state.transcript.append({"speaker": "critic", "text": critique.text})
        await shared.set_state(state)
        print(f"[critic] {critique.text}\n")

        # Advocate reads the critique and responds
        rebuttal = await messenger.send(
            from_agent="advocate",
            to_agent="advocate",
            message=(
                f"Topic: {topic}\n\n"
                f"Respond to this critique:\n{critique.text}"
            ),
        )
        state.transcript.append({"speaker": "advocate", "text": rebuttal.text})
        await shared.set_state(state)
        print(f"[advocate] {rebuttal.text}\n")


async def synthesize(messenger: AgentMessenger, shared: SharedState) -> None:
    state = await shared.get_state()

    # Format the transcript for the synthesizer
    formatted = "\n\n".join(
        f"{entry['speaker'].upper()}: {entry['text']}"
        for entry in state.transcript
    )

    result = await messenger.send(
        from_agent="synthesizer",
        to_agent="synthesizer",
        message=f"Synthesize the following debate:\n\n{formatted}",
    )
    state.synthesis = result.text
    await shared.set_state(state)
    print(f"\n[synthesizer] {result.text}")
```

## Complete working example

```python
async def main():
    topic = "Remote work improves overall productivity more than office work does"
    print(f"Topic: {topic}\n{'='*70}\n")

    final_state = await run_debate(topic, rounds=2)

    print("\n--- TRANSCRIPT ---")
    for entry in final_state.transcript:
        print(f"\n{entry['speaker'].upper()}:")
        print(f"  {entry['text']}")

    print("\n--- SYNTHESIS ---")
    print(final_state.synthesis)

asyncio.run(main())
```

## Expected output

```
Topic: Remote work improves overall productivity more than office work does
======================================================================

[advocate] Remote work eliminates commute time, giving employees 1–2 extra hours
per day that can be redirected to focused work...

[critic] While eliminating commutes saves time, research shows remote workers
often struggle with collaboration and spontaneous innovation...

[advocate] That's a fair point about collaboration, but modern async tools...

[synthesizer] Both sides agree that individual focus work benefits from remote
arrangements while collaborative creativity benefits from in-person settings...
```

## How it works

`AgentMessenger.send()` is an `async` method that:

1. Looks up the target agent by name in the `agents` dict.
2. Calls `agent.arun(message)` and awaits the response.
3. Returns an `AgentMessage` with `.text`, `.agent_name`, and `.metadata`.

`SharedState` wraps the state dataclass with an `asyncio.Lock` so that concurrent agents reading and writing the same object do not produce race conditions. Use `.get_state()` and `.set_state()` rather than mutating the dataclass directly.

## Variations

**Direct peer-to-peer messaging**

If you want agent A to literally send a message to agent B's queue (rather than the messenger routing it), use `messenger.post()` and `messenger.receive()` for an inbox/outbox model. This is useful when agents run on separate event loops or in different processes.

**Conditional escalation**

```python
critique_reply = await messenger.send(...)
# If the critic finds a fatal flaw, escalate to a fact-checker agent
if "factually incorrect" in critique_reply.text.lower():
    fact_check = await messenger.send(
        from_agent="fact_checker",
        to_agent="fact_checker",
        message=f"Verify: {last_advocate_msg}",
    )
```

**Streaming A2A responses**

```python
async for chunk in messenger.stream(from_agent="advocate", to_agent="advocate", message="..."):
    print(chunk.text, end="", flush=True)
```

## Troubleshooting

**Shared state is stale after a concurrent update**
Always `await shared.get_state()` immediately before reading state inside a node — do not cache a reference across `await` boundaries.

**Agents talk past each other (no real back-and-forth)**
The key is including the other agent's exact message in the prompt. Pass the full text of the last message as part of `message=`, not just a summary.

**The synthesizer produces a one-sided conclusion**
Ensure the transcript includes an equal number of advocate and critic turns before calling the synthesizer. Odd-numbered round counts leave the advocate with the last word.

## Next steps

- [Parallel Agent Execution](./parallel-agent-execution) — run independent agents concurrently
- [Supervisor Agent Routing](./supervisor-routing) — centralized dispatch for simpler topologies
- [Graph Workflows](../graph/) — model complex agent interactions as an explicit directed graph
