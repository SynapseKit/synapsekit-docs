---
sidebar_position: 15
---

# Neuro-Symbolic Agent

Pairs an LLM with a formal solver. The LLM reads a natural-language problem and extracts formal constraints; a symbolic backend (Z3, SymPy, MiniZinc, or Prolog) solves and independently verifies them; and the LLM only renders a final answer once the solver has confirmed a satisfiable model. Every run carries a `ProofTrace` describing the solver status and model, so answers are checkable rather than merely plausible. Unverified answers are handled by an explicit `on_unverified` policy — retry, reject, or flag.

**Import:**
```python
from synapsekit.symbolic import (
    NeuroSymbolicAgent,
    NeuroSymbolicResult,
    ProofTrace,
    ConstraintSet,
    ConstraintExtractor,
    Z3Backend,
    SympyBackend,
    MiniZincBackend,
    PrologBackend,
    VerificationFailure,
    verified_tool,
    VerifiedTool,
)
```

Install the solvers with `pip install synapsekit[symbolic]` (z3-solver, sympy, minizinc). `PrologBackend` also requires the `swipl` executable on PATH.

---

## Quickstart

```python
import asyncio
from synapsekit.llm.openai import OpenAILLM
from synapsekit.llm.base import LLMConfig
from synapsekit.symbolic import NeuroSymbolicAgent, Z3Backend

async def main():
    llm = OpenAILLM(LLMConfig(model="gpt-4o-mini", api_key="sk-..."))

    agent = NeuroSymbolicAgent(
        llm=llm,
        verifier=Z3Backend(),
        on_unverified="retry",
        max_proposals=3,
    )

    result = await agent.solve(
        "Find integers x and y with x + y = 10 and x - y = 4."
    )
    print(result.verified)          # True
    print(result.answer)            # rendered from the verified model
    print(result.proof.status)      # "sat"
    print(result.proof.model)       # {"x": 7, "y": 3}
    print(result.backend, result.attempts)

asyncio.run(main())
```

---

## How it works

For each attempt (up to `max_proposals`):

1. **Extract** — `ConstraintExtractor` asks the LLM to emit JSON with a `language`, a formal `source` program, and an optional `objective`, producing a `ConstraintSet`. On a retry, the previous solver error is fed back so the LLM can correct its formalization.
2. **Solve** — the backend runs the constraints and returns a `ProofTrace` (`status` is `sat`, `unsat`, `unknown`, or `error`).
3. **Translate** — if satisfiable, the LLM renders the solver model into a final answer.
4. **Verify** — the backend re-checks that the answer is consistent with the proof. Only `verified and status == "sat"` counts as verified.

---

## `on_unverified` policy

Controls what happens when the solver cannot verify an answer:

| Value | Behavior |
|---|---|
| `"retry"` (default) | Re-extract with the error fed back, up to `max_proposals`; if all fail, return an unverified result |
| `"reject"` | Raise `VerificationFailure` immediately |
| `"flag"` | Return a `NeuroSymbolicResult` with `verified=False` and the `error` attached |

---

## Symbolic backends

| Backend | `language` | Solves | Notes |
|---|---|---|---|
| `Z3Backend()` | `smtlib` | SMT-LIB constraint sets | Powered by z3-solver; honors `timeout_seconds` |
| `SympyBackend()` | `sympy` | Symbolic math expressions | AST-allowlisted eval (see below) |
| `MiniZincBackend(solver_name="gecode")` | `minizinc` | Constraint-programming models | Requires the `minizinc` package and a solver |
| `PrologBackend(executable="swipl")` | `prolog` | Logic queries | Shells out to SWI-Prolog |

### AST-allowlist hardening (v2.0)

`SympyBackend` evaluates the extracted expression, so in v2.0 the calculator/eval path was hardened with a strict AST allowlist: before evaluation, the source is parsed and every node is checked against a fixed whitelist of node types (calls, names, constants, arithmetic ops) and a whitelist of allowed SymPy names (`Eq`, `Symbol`, `symbols`, `solve`, `simplify`, `factor`, `expand`). Anything else raises `ValueError`, and evaluation runs with empty builtins. This closes the arbitrary-code-execution surface that an LLM-authored expression would otherwise open.

---

## Verified tools

Wrap any tool so its output must clear a symbolic check before it is returned. `@verified_tool` builds a `VerifiedTool` from a function or `BaseTool`; you supply a `constraint_builder(inputs, output) -> ConstraintSet`:

```python
from synapsekit.symbolic import verified_tool, Z3Backend, ConstraintSet

def build_constraints(inputs: dict, output: str) -> ConstraintSet:
    return ConstraintSet(language="smtlib", source=f"...{output}...")

@verified_tool(Z3Backend(), build_constraints, name="solve_eq",
               description="Solve a linear system")
async def solve_eq(a: int, b: int) -> str:
    ...
```

If verification passes, the `ToolResult` includes the `ProofTrace` in its metadata; if it fails, the tool returns an error result with the proof attached — never an unverified value.

---

## API reference

### `NeuroSymbolicAgent`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `llm` | `BaseLLM` | required | Extracts constraints and renders answers |
| `verifier` | `SymbolicBackend` | required | Solver/verifier backend |
| `on_unverified` | `"retry" \| "reject" \| "flag"` | `"retry"` | Unverified-answer policy |
| `max_proposals` | `int` | `3` | Max extract→solve→verify attempts |
| `timeout_seconds` | `float \| None` | `10.0` | Per-solve timeout |
| `extractor` | `ConstraintExtractor \| None` | `None` | Custom extractor (built from `llm` if omitted) |

Method: `async solve(problem: str) -> NeuroSymbolicResult`.

### `NeuroSymbolicResult`

| Field | Type | Description |
|---|---|---|
| `answer` | `str` | Final rendered answer |
| `proof` | `ProofTrace` | Verifying solver trace |
| `verified` | `bool` | Whether the answer is solver-verified |
| `constraints` | `ConstraintSet` | Constraints that were solved |
| `attempts` | `int` | Number of attempts taken |
| `backend` | `str` | Backend name |
| `error` | `str \| None` | Reason when unverified |

### `ProofTrace`

Fields: `status` (`sat`/`unsat`/`unknown`/`error`), `model`, `raw_output`, `backend`, `error`, `verified`; property `is_verified` (`verified and status == "sat"`).

### `verified_tool(verifier, constraint_builder, *, name=None, description=None, timeout_seconds=10.0)`

Returns a decorator that wraps a function or `BaseTool` into a `VerifiedTool`.

---

## See also

- [Agents overview](overview)
- [Reasoning agent](reasoning-agent)
- [Built-in tools](tools)
