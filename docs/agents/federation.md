---
sidebar_position: 11
---

# Agent Federation

Distributed agent routing across a registry of named agents. `AgentFederation` selects an agent based on tags, tools, and a routing strategy, then dispatches the prompt to that agent's client.

**Import:**
```python
from synapsekit.agents import AgentFederation, AgentMetadata, InMemoryAgentRegistry, LocalAgentClient, RoutingStrategy
```

Redis-backed registry: `pip install synapsekit[redis]`

---

## `AgentMetadata`

Describes a registered agent.

```python
from synapsekit.agents import AgentMetadata
from dataclasses import dataclass, field

@dataclass(slots=True)
class AgentMetadata:
    id: str
    model: str
    tools: list[str] = field(default_factory=list)
    capacity: int = 1
    cost_multiplier: float = 1.0
    tags: list[str] = field(default_factory=list)
    endpoint: str | None = None
    last_heartbeat: float | None = None
```

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | `str` | required | Unique agent identifier |
| `model` | `str` | required | Model this agent uses |
| `tools` | `list[str]` | `[]` | Tool names this agent supports |
| `capacity` | `int` | `1` | Maximum concurrent requests; used by `CAPACITY_AWARE` routing |
| `cost_multiplier` | `float` | `1.0` | Relative cost weight; used by `COST_AWARE` routing |
| `tags` | `list[str]` | `[]` | Arbitrary labels for discovery filtering |
| `endpoint` | `str \| None` | `None` | HTTP endpoint (for remote agents) |
| `last_heartbeat` | `float \| None` | `None` | Unix timestamp of the last heartbeat |

---

## `RoutingStrategy`

```python
from synapsekit.agents import RoutingStrategy

class RoutingStrategy(str, Enum):
    ROUND_ROBIN = "round_robin"       # Cycle across all matching agents
    CAPACITY_AWARE = "capacity_aware" # Prefer agents with highest capacity
    COST_AWARE = "cost_aware"         # Prefer agents with lowest cost_multiplier
```

---

## `InMemoryAgentRegistry`

Thread-safe in-process registry with heartbeat-based health checks.

```python
from synapsekit.agents import InMemoryAgentRegistry

registry = InMemoryAgentRegistry(
    stale_timeout: float = 30.0,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `stale_timeout` | `float` | `30.0` | Seconds after which an agent with no heartbeat is considered unhealthy |

### Methods

- `register(agent: AgentMetadata) -> AgentMetadata` — register an agent; sets `last_heartbeat` if not already set
- `unregister(agent_id: str) -> bool` — remove an agent; returns `True` if it existed
- `get(agent_id: str) -> AgentMetadata | None` — look up a single agent
- `list() -> list[AgentMetadata]` — all registered agents
- `heartbeat(agent_id: str, timestamp: float | None = None) -> AgentMetadata` — update an agent's heartbeat
- `is_healthy(agent_id: str) -> bool` — check heartbeat freshness
- `discover(*, tools=None, tags=None, min_capacity=None, healthy_only=True) -> list[AgentMetadata]` — filter agents by criteria
- `prune_stale(*, stale_timeout=None) -> list[str]` — remove stale agents, return their IDs

---

## `RedisAgentRegistry`

Redis-backed registry for multi-process or multi-host deployments.

```python
from synapsekit.agents.agent_registry import RedisAgentRegistry

registry = RedisAgentRegistry(
    url: str | None = None,
    redis_client: Any | None = None,
    prefix: str = "synapsekit:agent_registry",
    stale_timeout: float = 30.0,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `url` | `str \| None` | `None` | Redis URL, e.g. `"redis://localhost:6379"` |
| `redis_client` | `Any \| None` | `None` | Pre-constructed `redis.Redis` client; takes precedence over `url` |
| `prefix` | `str` | `"synapsekit:agent_registry"` | Redis key namespace |
| `stale_timeout` | `float` | `30.0` | Heartbeat staleness threshold in seconds |

**Extra dependency:** `pip install synapsekit[redis]`

---

## `AgentFederation`

Discovers agents in a registry and dispatches prompts to them.

```python
from synapsekit.agents import AgentFederation

federation = AgentFederation(
    registry: AgentRegistry | InMemoryAgentRegistry | None = None,
    *,
    clients: dict[str, Any] | None = None,
    default_strategy: RoutingStrategy | str = RoutingStrategy.ROUND_ROBIN,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `registry` | `AgentRegistry \| InMemoryAgentRegistry \| None` | `None` | Registry backend; defaults to a new `InMemoryAgentRegistry` |
| `clients` | `dict[str, Any] \| None` | `None` | Pre-registered `{agent_id: client}` mapping |
| `default_strategy` | `RoutingStrategy \| str` | `"round_robin"` | Default routing strategy for `run()` |

### Methods

- `register_agent(agent: AgentMetadata, *, client: Any | None = None) -> AgentMetadata` — register an agent; optionally attach a client
- `unregister_agent(agent_id: str) -> bool` — remove an agent and its client
- `add_client(agent_id: str, client: Any) -> None` — attach a client to an already-registered agent
- `discover(*, tools=None, tags=None, min_capacity=None, healthy_only=True) -> list[AgentMetadata]` — list agents matching filters
- `select_agent(*, strategy=None, tags=None, tools=None, min_capacity=None, healthy_only=True) -> AgentMetadata` — select one agent using the routing strategy
- `async run(prompt: str, *, agent_id=None, strategy=None, tags=None, tools=None, min_capacity=None, healthy_only=True, **kwargs) -> Any` — select an agent and dispatch the prompt
- `async negotiate(initial: NegotiationMessage, *, max_rounds=10, deliver_terminal=True) -> Negotiation` — exchange bounded price/SLA offers between two registered clients

## Price and SLA negotiation

Negotiation is an explicit operation; accepted agreements can optionally be supplied to sealed-bid market routing as described below. Both agents must already be registered, healthy, and provide a client implementing `negotiate(message)`. `BoundedNegotiationPolicy` makes deterministic decisions against each participant's own reservation bounds:

```python
import asyncio
from decimal import Decimal
from synapsekit.agents import (
    AgentFederation, AgentMetadata, BoundedNegotiationPolicy,
    NegotiationMessage, NegotiationMessageKind, NegotiationRole, NegotiationTerms,
)

def terms(price, latency_ms, availability):
    return NegotiationTerms(
        Decimal(price), "USD", Decimal(latency_ms), Decimal(availability), Decimal("3600")
    )

buyer_policy = BoundedNegotiationPolicy(
    NegotiationRole.BUYER, terms("15", "200", "99.9")
)
seller_policy = BoundedNegotiationPolicy(
    NegotiationRole.SELLER, terms("12", "150", "99.95")
)

class Participant:
    def __init__(self, policy, role):
        self.policy = policy
        self.role = role
        self.terminal = None

    async def run(self, prompt, **kwargs):
        return prompt  # Normal execution is separate from negotiation.

    async def negotiate(self, message):
        can_counter = self.role == NegotiationRole.SELLER
        return self.policy.respond(
            message,
            message_id=f"{message.message_id}-response",
            can_counter=can_counter,
        )

    async def receive_negotiation(self, message):
        self.terminal = message

async def main():
    buyer = Participant(buyer_policy, NegotiationRole.BUYER)
    seller = Participant(seller_policy, NegotiationRole.SELLER)
    federation = AgentFederation(clients={"buyer": buyer, "seller": seller})
    federation.register_agent(AgentMetadata(id="buyer", model="local"))
    federation.register_agent(AgentMetadata(id="seller", model="local"))
    initial = NegotiationMessage(
        "neg-1", "offer-1", "buyer", "seller", NegotiationMessageKind.OFFER,
        terms("10", "200", "99.9"),
    )
    session = await federation.negotiate(initial, max_rounds=4, deliver_terminal=True)
    assert session.agreement == seller_policy.reservation
    assert seller.terminal.kind == NegotiationMessageKind.ACCEPT

asyncio.run(main())
```

By default, both clients must implement `receive_negotiation(message)`; the final ACCEPT or REJECT is delivered to its recipient, and delivery errors propagate. Explicit `deliver_terminal=False` selects transcript-only mode, which does not deliver the terminal response. Delivery is in-memory, not durable or exactly-once.

`NegotiationTerms` uses finite `Decimal` values: nonnegative price per task with a three-letter uppercase currency code; maximum latency in milliseconds; and availability percentage over a window in seconds. The bounded policy checks the receiving party's price/SLA bounds, counters with its reservation if permitted, or rejects. The caller must ensure its first offer meets its own limits. These terms record agreement only—no authentication, payment, measurement, SLA enforcement, or dispute resolution is provided.

### Opt-in market routing

Pass `negotiated_agreements={seller_id: accepted_session}`, `negotiation_buyer=buyer_id`, and `negotiation_requirements=buyer_terms` to `federation.run(..., strategy="market")` or `AgentSwarm.execute(...)`. In this mode only sellers with matching accepted agreements within the buyer's price/SLA bounds and market budget compete; accepted prices influence bid scoring and sealed-bid settlement estimates. Other auction types are rejected. Ordinary market routing remains unchanged when no agreements are supplied.

The caller must verify transcript authenticity, delivery, freshness, task scope and replay policy. Agreements do not prove identity or enforce payment or SLA fulfillment; the market's float estimates may be rounded, and reported actual cost may differ from the estimate.

---

## `LocalAgentClient`

Wraps a local `AgentExecutor`-like object or a callable into an `AgentClient`.

```python
from synapsekit.agents import LocalAgentClient

client = LocalAgentClient(executor: Any)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `executor` | `Any` | required | Object with `run()`, `arun()`, `invoke()`, or a plain callable |

### Methods

- `async run(prompt: str, **kwargs) -> Any` — dispatch to the executor's async or sync run method

---

## Example

```python
import asyncio
from synapsekit import OpenAILLM, LLMConfig
from synapsekit.agents import (
    AgentFederation, AgentMetadata, InMemoryAgentRegistry,
    LocalAgentClient, RoutingStrategy, ReasoningAgent, ReasoningAgentConfig,
)
from synapsekit.agents.tools import CalculatorTool, WebSearchTool

async def main():
    fast_llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

    # Build two local agents
    research_agent = ReasoningAgent(ReasoningAgentConfig(
        fast_llm=fast_llm,
        reasoning_llm=fast_llm,  # use fast_llm for the example
        tools=[WebSearchTool()],
        system_prompt="You are a research assistant.",
    ))
    math_agent = ReasoningAgent(ReasoningAgentConfig(
        fast_llm=fast_llm,
        reasoning_llm=fast_llm,
        tools=[CalculatorTool()],
        system_prompt="You are a math assistant.",
    ))

    registry = InMemoryAgentRegistry(stale_timeout=60.0)
    federation = AgentFederation(
        registry=registry,
        default_strategy=RoutingStrategy.ROUND_ROBIN,
    )

    # Register agents with metadata
    federation.register_agent(
        AgentMetadata(
            id="research-1",
            model="gpt-4o-mini",
            tools=["web_search"],
            tags=["research", "general"],
            capacity=5,
        ),
        client=LocalAgentClient(research_agent),
    )
    federation.register_agent(
        AgentMetadata(
            id="math-1",
            model="gpt-4o-mini",
            tools=["calculator"],
            tags=["math", "analysis"],
            capacity=10,
            cost_multiplier=0.5,
        ),
        client=LocalAgentClient(math_agent),
    )

    # Route by tag
    result = await federation.run(
        "What is 42 * 1337?",
        tags=["math"],
    )
    print(result)

    # Discover all research agents
    agents = federation.discover(tags=["research"])
    print(f"Research agents: {[a.id for a in agents]}")

asyncio.run(main())
```

---

## See also

- [Agents overview](overview)
- [Reasoning agent](reasoning-agent)
- [Multi-agent overview](../multi-agent/overview)
