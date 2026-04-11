---
sidebar_position: 5
title: "Code Execution Agent"
description: "Build an agent that writes and runs Python in a sandboxed subprocess, capturing stdout, plots, and dataframes."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Code Execution Agent

<ColabBadge path="agents/code-execution-agent.ipynb" />

An LLM can write Python — but only a code execution agent can verify that the code actually runs correctly. `CodeInterpreterTool` runs each snippet in a subprocess with no access to the host filesystem or network, captures stdout, stderr, generated files, matplotlib plots, and pandas DataFrames, and returns them all as structured JSON. **What you'll build:** an agent that can answer data analysis questions by writing Python, executing it safely, and interpreting the results. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit
export OPENAI_API_KEY="sk-..."
# For data analysis examples:
pip install pandas matplotlib
```

## What you'll learn

- How `CodeInterpreterTool` isolates code in a subprocess
- What `timeout` and `memory_limit_mb` guard against
- How to parse the structured JSON output (stdout, stderr, files, plots, dataframes)
- How to build a data analysis agent that iterates on failing code

## Step 1: Import and configure the tool

```python
import asyncio
import json
from synapsekit.agents import CodeInterpreterTool, FunctionCallingAgent
from synapsekit.llms.openai import OpenAILLM
```

`timeout` limits wall-clock execution time. `memory_limit_mb` caps the subprocess RSS to prevent runaway memory allocation. Both limits kill the subprocess cleanly and return a `ToolResult` with `error` set.

```python
code_tool = CodeInterpreterTool(
    timeout=10.0,        # abort after 10 seconds — prevents infinite loops
    memory_limit_mb=256, # cap at 256 MB — prevents OOM from large datasets
)
```

## Step 2: Understand the output format

`CodeInterpreterTool` returns a JSON string in `ToolResult.output`. The keys are:

| Key | Type | Description |
|---|---|---|
| `stdout` | string | Everything printed to stdout |
| `stderr` | string | Tracebacks and warnings |
| `files` | array | `{path, size}` for each file written |
| `plots` | array | `{path, size}` for each matplotlib figure saved |
| `dataframes` | array | `{name, repr}` for each pandas DataFrame in scope |

```python
async def run_code(code: str) -> dict:
    result = await code_tool.run(code=code)
    if result.is_error:
        return {"error": result.error}
    return json.loads(result.output)
```

## Step 3: Build a data analysis agent

The system prompt should explicitly tell the agent to write executable Python and to interpret the output after execution. Without this guidance, the LLM tends to answer from training data rather than running code.

```python
agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=[code_tool],
    system_prompt=(
        "You are a data analysis assistant. Always answer quantitative questions "
        "by writing Python code and executing it with the code_interpreter tool. "
        "Parse the JSON output to extract stdout and any dataframe reprs. "
        "If code fails with an error in stderr, fix it and retry once."
    ),
    max_iterations=6,
)
```

## Step 4: Ask a calculation question

```python
async def analyze(question: str) -> str:
    return await agent.run(question)
```

## Step 5: Handle multi-step analysis

For questions that require building up state across multiple code cells — loading data, transforming it, then visualizing — instruct the agent to write self-contained scripts that load and process data in a single execution.

```python
DATA_ANALYSIS_PROMPT = """
You are a data analysis assistant. Follow these rules:
1. Always write self-contained Python scripts — load data and perform analysis in one block.
2. Print a summary of results to stdout so they appear in the output.
3. If matplotlib is used, call plt.savefig('output.png') before plt.show().
4. Interpret the captured stdout and dataframe reprs in your final answer.
"""

analysis_agent = FunctionCallingAgent(
    llm=OpenAILLM(model="gpt-4o-mini"),
    tools=[CodeInterpreterTool(timeout=15.0, memory_limit_mb=512)],
    system_prompt=DATA_ANALYSIS_PROMPT,
    max_iterations=8,
)
```

## Step 6: Parse plots and file artifacts

After a run, check whether the agent wrote plot files or other artifacts by examining `agent.memory.steps`:

```python
def extract_artifacts(agent: FunctionCallingAgent) -> list[dict]:
    artifacts = []
    for step in agent.memory.steps:
        try:
            payload = json.loads(step.observation)
            artifacts.extend(payload.get("plots", []))
            artifacts.extend(payload.get("files", []))
        except (json.JSONDecodeError, AttributeError):
            pass
    return artifacts
```

## Complete working example

```python
import asyncio
import json
from synapsekit.agents import (
    ActionEvent,
    CodeInterpreterTool,
    FinalAnswerEvent,
    FunctionCallingAgent,
    ObservationEvent,
)
from synapsekit.llms.openai import OpenAILLM


def build_agent() -> FunctionCallingAgent:
    return FunctionCallingAgent(
        llm=OpenAILLM(model="gpt-4o-mini"),
        tools=[CodeInterpreterTool(timeout=10.0, memory_limit_mb=256)],
        system_prompt=(
            "You are a Python data analysis assistant. "
            "Always execute code to answer quantitative questions. "
            "Print results to stdout. If code fails, fix and retry once."
        ),
        max_iterations=6,
    )


async def main() -> None:
    agent = build_agent()

    questions = [
        "What is the sum of squares of all prime numbers below 50?",
        (
            "Generate a list of 20 random integers between 1 and 100 using seed 42, "
            "then compute mean, median, and standard deviation."
        ),
        "Write Python to create a simple bar chart of [3, 7, 2, 9, 5] and save it as chart.png.",
    ]

    for question in questions:
        print(f"\nQ: {question}")
        print("-" * 60)

        async for event in agent.stream_steps(question):
            if isinstance(event, ActionEvent):
                code = str(event.tool_input)
                # Show only the first 3 lines of code to keep output readable
                preview = "\n".join(code.splitlines()[:3])
                print(f"[code]\n{preview}\n...")
            elif isinstance(event, ObservationEvent):
                try:
                    payload = json.loads(event.observation)
                    if payload.get("stdout"):
                        print(f"[stdout] {payload['stdout'].strip()}")
                    if payload.get("stderr"):
                        print(f"[stderr] {payload['stderr'].strip()[:100]}")
                    if payload.get("plots"):
                        print(f"[plots]  {[p['path'] for p in payload['plots']]}")
                except json.JSONDecodeError:
                    print(f"[obs] {event.observation[:100]}")
            elif isinstance(event, FinalAnswerEvent):
                print(f"\nAnswer: {event.answer}")

    # Inspect artifacts produced across all questions
    artifacts = []
    for step in agent.memory.steps:
        try:
            payload = json.loads(step.observation)
            artifacts.extend(payload.get("files", []))
            artifacts.extend(payload.get("plots", []))
        except (json.JSONDecodeError, AttributeError):
            pass

    if artifacts:
        print(f"\nArtifacts produced: {[a['path'] for a in artifacts]}")


asyncio.run(main())
```

## Expected output

```
Q: What is the sum of squares of all prime numbers below 50?
------------------------------------------------------------
[code]
def is_prime(n):
    if n < 2: return False
    ...
[stdout] 1060
Answer: The sum of squares of all prime numbers below 50 is 1060.
(Primes: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47)

Q: Generate a list of 20 random integers...
------------------------------------------------------------
[stdout] Mean: 54.35  Median: 56.5  Std: 27.82
Answer: With seed 42, the 20 random integers have mean 54.35, median 56.5, std dev 27.82.
```

## How it works

`CodeInterpreterTool` writes the code to execute into a fresh `tempfile.TemporaryDirectory`. It then launches a worker script — `_code_interpreter_worker.py` — as a subprocess using `sys.executable`. The worker calls `exec()` inside captured `io.StringIO` buffers for stdout and stderr, then serializes everything (including discovered pandas DataFrames and matplotlib figures) as JSON to stdout. The parent process reads that JSON and returns it as `ToolResult.output`.

This design means:
- The agent's Python environment is completely isolated from the worker's `exec()` scope
- `sys.modules` modifications, `os.environ` changes, and file writes in the worker do not affect the host process
- `subprocess.TimeoutExpired` is caught cleanly and reported as a `ToolResult` error

## Variations

**Pass data into the execution context** by embedding it as a literal in the code string:

```python
import json as _json
data = [1, 2, 3, 4, 5]
code = f"data = {_json.dumps(data)}\nprint(sum(data))"
result = await code_tool.run(code=code)
```

**Allow longer-running analysis** by increasing timeout:

```python
slow_tool = CodeInterpreterTool(timeout=60.0, memory_limit_mb=1024)
```

**Add PythonREPLTool for non-sandboxed use** when you trust the LLM's output and need access to the host environment:

```python
from synapsekit.agents import PythonREPLTool
# Warning: PythonREPLTool executes code in the current process with no isolation
repl_tool = PythonREPLTool()
```

## Troubleshooting

**Code times out immediately** — the default `timeout=5.0` seconds is short for import-heavy code like pandas. Increase to `timeout=15.0` for data analysis.

**`memory_limit_mb` causes silent failures on macOS** — `resource.setrlimit(RLIMIT_AS)` is not supported on macOS. Memory limits are silently ignored; they work on Linux.

**Plots not captured** — ensure the code calls `plt.savefig(...)` before `plt.show()`. The worker hooks into `matplotlib.pyplot.get_fignums()` to find unsaved figures, but `plt.show()` clears them on some backends.

**Agent writes code that imports from synapsekit** — the worker subprocess does not inherit the host's imports. Make all data available as literals embedded in the code string.

## Next steps

- [Multi-Tool Orchestration](./multi-tool-orchestration) — combine code execution with web search and database queries
- [SQL Database Agent](./sql-database-agent) — query a database and pass results to the code interpreter for analysis
- [Tool Error Handling and Retries](./tool-error-handling) — build retry logic for code that fails on the first attempt
