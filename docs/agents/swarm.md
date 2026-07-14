---
sidebar_position: 13
---

# Agent Swarm

Market-based orchestration over an `AgentFederation`. Instead of round-robin or capacity routing, `AgentSwarm` runs an auction for every task: candidate agents submit bids describing estimated cost, quality, and confidence; a `BidStrategy` scores those bids against each agent's learned `Reputation`; and winners are selected by the configured `AuctionType`. Outcomes feed back into reputation (via UCB or Thompson sampling), so agents that consistently deliver win more of their category over time. Runs are deterministic when you set a `seed`.

**Import:**
```python
from synapsekit.agents import (
    AgentSwarm,
    MarketPolicy,
    AuctionType,
    BidStrategy,
    Bid,
    Reputation,
    RedisReputation,
    AgentMetadata,
    RoutingStrategy,
)
```

No extra dependency for the in-memory market. `RedisReputation` (and `RedisAgentRegistry`) require `pip install synapsekit[redis]`.

---

## Quickstart

```python
import asyncio
from synapsekit.agents import AgentSwarm, MarketPolicy, BidStrategy, AuctionType

async def main():
    async def fast_agent(task: str, **kw):
        return {"answer": f"[fast] {task}", "quality": 0.7, "cost": 1.0}

    async def strong_agent(task: str, **kw):
        return {"answer": f"[strong] {task}", "quality": 0.95, "cost": 4.0}

    swarm = AgentSwarm(
        agents=[fast_agent, strong_agent],
        market=MarketPolicy(
            bid_strategy=BidStrategy.ucb(),
            auction_type=AuctionType.SEALED_BID,
            budget_per_task=10.0,
            seed=7,              # deterministic auctions
        ),
    )

    result = await swarm.run("Summarize the Q4 report")
    print(result.winners)        # winning agent ids
    print(result.output)         # winning agent's output
    print(result.reward, result.actual_cost, result.actual_quality)

asyncio.run(main())
```

Agents may be plain callables, `AgentExecutor`-like objects, or `AgentMetadata` records. Callables and executors are wrapped as clients automatically; each is given a synthesized `AgentMetadata` id.

---

## Bidding

An agent can submit its own bid by exposing a `bid(task, ...)` method (returning a `Bid` or a dict), otherwise the swarm synthesizes a bid from the agent's metadata and reputation. A `Bid` carries:

| Field | Type | Description |
|---|---|---|
| `agent_id` | `str` | Bidding agent |
| `estimated_cost` | `float` | Estimated cost (clamped ≥ 0) |
| `estimated_quality` | `float` | Estimated quality in `[0, 1]` |
| `confidence` | `float` | Bidder confidence in `[0, 1]` |
| `task_category` | `str` | Category used to bucket reputation |

The task category defaults to the first word of the task; override it with `execute(task, task_category="billing")`.

---

## Market policy and auction types

`MarketPolicy` configures the market:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `bid_strategy` | `BidStrategy \| str \| None` | `None` | Scoring strategy (default cost/quality Pareto) |
| `auction_type` | `AuctionType \| str` | `SEALED_BID` | Winner-selection mode |
| `budget_per_task` | `float` | `10000.0` | Bids above budget are deprioritized |
| `learning_rate` | `float` | `0.1` | EMA rate for reputation updates |
| `seed` | `int \| None` | `None` | Deterministic RNG seed |
| `max_winners` | `int` | `1` | Winners for `MULTI_WINNER` |
| `coalition_size` | `int` | `2` | Members for `COALITION` |
| `exploration_rate` | `float` | `0.05` | Chance of forcing an exploratory winner |
| `cold_start_quality` | `float` | `0.6` | Assumed quality before any history |
| `max_agent_task_share` | `float` | `0.70` | Cap on any one agent's share of wins |

`AuctionType` values:

- **`SEALED_BID`** — single best-scoring bid wins.
- **`VICKREY`** — best bid wins but settles at the second-highest price.
- **`ENGLISH`** — best affordable bid within budget wins.
- **`MULTI_WINNER`** — top `max_winners` bids all win; results are combined.
- **`COALITION`** — a `CoalitionFormer` builds the best `coalition_size` team; results are combined.

---

## Reputation with UCB / Thompson sampling

`BidStrategy` blends the raw bid with the agent's learned `ReputationSnapshot`:

- `BidStrategy.cost_quality_pareto()` — cost-vs-quality tradeoff (default)
- `BidStrategy.ucb(exploration_weight=0.35)` — upper-confidence-bound exploration for rarely-used agents
- `BidStrategy.thompson_sampling(samples=8)` — samples from each agent's Beta quality posterior

After each execution the swarm calls `Reputation.record_outcome(...)`, updating attempts/wins, EMA of cost/quality/reward, and the Beta `quality_alpha`/`quality_beta` used by Thompson sampling.

### Redis-backed reputation

For a shared, multi-process market, back reputation with Redis:

```python
from synapsekit.agents import AgentSwarm, RedisReputation, MarketPolicy

swarm = AgentSwarm(
    agents=[...],
    market=MarketPolicy(seed=1),
    reputation=RedisReputation(url="redis://localhost:6379/0"),
)
```

---

## Market routing via AgentFederation

An `AgentSwarm` is built on `AgentFederation`. You can also trigger market routing directly through the federation using `RoutingStrategy.MARKET`, which spins up a swarm internally:

```python
from synapsekit.agents import AgentFederation, MarketPolicy

federation = AgentFederation(registry, clients=clients)
result = await federation.run(
    "Classify this ticket",
    strategy="market",
    market=MarketPolicy(seed=42),
)
```

`select_agent(strategy="market")` is not supported — market routing must go through `run(..., strategy="market")` because it requires execution to settle bids. Other strategies (`round_robin`, `capacity_aware`, `cost_aware`) select without executing.

---

## Tracing

```python
swarm.trace()             # list of per-task auction records
swarm.trace_to_mermaid()  # Mermaid flowchart of tasks → bids → winners
```

---

## API reference

### `AgentSwarm(agents=None, *, market=None, registry=None, clients=None, reputation=None, metrics=None)`

| Parameter | Type | Description |
|---|---|---|
| `agents` | `Iterable[Any] \| None` | Callables, executors, or `AgentMetadata` |
| `market` | `MarketPolicy \| None` | Market configuration |
| `registry` | `AgentRegistry \| ... \| None` | Agent registry backend (in-memory default) |
| `clients` | `dict[str, Any] \| None` | Explicit agent-id → client map |
| `reputation` | `Reputation \| None` | Reputation store (`Reputation()` default) |
| `metrics` | `Any \| None` | Optional metrics recorder |

### Methods

- `async run(task, **kwargs) -> SwarmResult` — alias of `execute`
- `async execute(task, *, task_category=None, tools=None, tags=None, reward=None, quality=None, **kwargs) -> SwarmResult`
- `async auction(task, candidates, *, task_category=None) -> AuctionResult`
- `register_agent(agent, *, client=None)`, `add_client(agent_id, client)`
- `trace()`, `trace_to_mermaid()`

### `SwarmResult`

| Field | Type | Description |
|---|---|---|
| `output` | `Any` | Winning agent output (combined for multi-winner) |
| `winners` | `list[str]` | Winning agent ids |
| `auction` | `AuctionResult` | Full auction record |
| `results` | `dict[str, Any]` | Per-winner outputs |
| `reward` | `float` | Realized reward |
| `actual_cost` | `float` | Realized cost |
| `actual_quality` | `float` | Realized quality |

### `AuctionResult`

Fields: `task`, `task_category`, `auction_type`, `bids`, `winners`, `scores`, `settlement_cost`, `latency_ms`, `coalition`; property `winner_ids`.

---

## See also

- [Agent federation](federation)
- [Agents overview](overview)
- [Self-improving agent](self-improving)
