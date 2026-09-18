---
sidebar_position: 1
title: "Agent OS Shell — Safe Natural-Language Shell for Agents"
description: "Local-first hybrid shell mixing shell syntax and quoted natural language. Argv-only execution, fail-closed destructive-command gate, signed audit receipts."
---

# Agent OS Shell

The Agent OS Shell is a local-first hybrid shell that mixes ordinary shell syntax with quoted natural-language requests on the same line, for example `git status && "why did that fail?"`. Shell text runs as-is. Quoted natural-language spans are sent to a planner, which translates them into explicit, reviewable command steps before anything executes. The shell is built for agents and humans working side by side in a terminal: every command it runs, whether typed directly or planned from a request, passes through the same safety gate and the same audit trail.

**Import:**
```python
from synapsekit.shell import ShellSession, RuleBasedPlanner
```

---

## Safety model

This is the most safety-critical part of the shell, so it is worth stating precisely.

**Argv-only execution, never `shell=True`.** Commands are lexed and split into argv tuples (`ShellCommand.argv`) with a hand-written parser (`split_shell_commands`) that recognizes `&&`, `||`, `;`, and `|` without ever handing a string to a shell interpreter. `DirectShellExecutor` starts processes with `asyncio.create_subprocess_exec(*argv, ...)`, so there is no command-substitution or injection surface from planner- or user-supplied text.

**A fail-closed safety gate blocks destructive commands unless signed.** `SafetyAnalyzer.assess(command)` classifies each planned command against a fixed list of destructive markers (`git reset`, `git clean`, `git push --force`, `git rm`, `rm`, `docker system prune`, `kubectl delete`, `terraform destroy`, output redirection, force flags, and more) and returns a `SafetyAssessment(destructive, reasons, preview)`. `SafetyPolicy` defaults to `allow_destructive=True` and `require_signed_approval=True`: a destructive step still requires a human `confirm` callback (or `--yes`), and `ShellSession.run` refuses to execute it at all unless a `signing_policy` (an Ed25519 key) is configured — with no signing key, destructive commands are unconditionally blocked, not just unconfirmed.

**Every run writes a signed, verifiable audit receipt.** `ShellSession` drives a `synapsekit.audit.AuditTracer`, recording `USER_INPUT`, `RETRIEVAL`, `STATE_CHANGE`, `DECISION`, `TOOL_CALL`, and `TOOL_RESULT` events for each `plan()`/`run()`. When a `signing_policy` is set, `_export_audit` signs and writes a bundle (`export_audit_bundle`) to `<audit_dir>/<run_id>-<suffix>.audit.zip` at each meaningful checkpoint: a `preflight` receipt before a destructive command executes, a `denied`/`abort` receipt if it's refused, and a `final` receipt (with a post-execution `git diff --stat`) once commands complete. Generate a local signing key with `synapsekit shell keygen <private_key_path>`.

**Output is streamed under a hard byte cap.** This closes a real bug (#929): the executor used to buffer a child process's entire stdout/stderr via `communicate()` before applying `max_output_bytes`, so an unbounded producer like `cat /dev/zero` could exhaust memory, and `yes | head -1` could hang forever because the producer never received `SIGPIPE`. `DirectShellExecutor._drain` now reads both streams incrementally and kills the child as soon as either stream exceeds `max_output_bytes` (default 1,000,000 bytes), appending `[output truncated]`. In a pipeline, a stage killed for exceeding the cap still feeds its truncated output to the next stage instead of aborting outright.

A related lexer fix (#930) is worth knowing about too: a quoted argument that happens to start with a cue word, like `git commit -m "find and fix the bug"` or `grep "search term" file`, is no longer misclassified as natural language and dropped. The cue-word/bare-phrase heuristics only apply when the quote opens a command (line start or right after a connector); explicit `nl:`/`ask:` sentinels are still recognized unconditionally, anywhere.

---

## Quickstart

```python
import asyncio
from synapsekit.shell import ShellSession, RuleBasedPlanner

async def main():
    session = ShellSession(
        planner=RuleBasedPlanner(),
        cwd=".",
        timeout=30.0,
        max_output_bytes=1_000_000,
    )

    result = await session.run('git status && "why did that fail?"')
    for item in result.commands:
        print(item.command, "->", item.exit_code)
    print(result.ok, result.audit_path)

asyncio.run(main())
```

`ShellSession.run` plans the input, previews and (if a `confirm` callback or `assume_yes=True` is supplied) approves any destructive steps, executes the remaining steps with `DirectShellExecutor`, and returns a `ShellRunResult(plan, commands, aborted, error, audit_path)`. Pass `dry_run=True` to plan and preview without executing anything.

---

## Planners

Natural-language segments are translated into `PlannedStep`s by a planner implementing the `ShellPlanner` protocol (`async def plan(request, context) -> list[PlannedStep]`).

- **`RuleBasedPlanner`** — a deterministic, offline planner for common intents (repo status, directory-size checks, opening a PR, rerunning the most relevant test, searching tracked text, listing files). It raises `PlanningError` for anything it can't confidently translate, rather than guessing.
- **`LLMShellPlanner(llm, *, model_name="configured")`** — wraps any SynapseKit LLM and asks it to return strict JSON (`{"steps": [{"command": ..., "explanation": ...}]}`). It never executes or approves its own output; every step it proposes still passes through the same `SafetyAnalyzer` as a rule-planned or hand-typed command.
- **`CachedPlanner(planner, cache, *, model)`** — wraps either planner with a `TranslationCache`, a small SQLite cache keyed on the request, cwd, shell, and model name. Translations that mention destructive markers (`reset`, `clean`, `--force`, `remove`, `delete`) are never cached.

---

## CLI

`synapsekit shell` and the standalone `synshell` entry point share the same options (`--cwd`, `--shell`, `--timeout`, `--max-output`, `--signing-key`, `--key-id`, `--audit-dir`, `--yes`, `--dry-run`, `--json`, `--planner-module`, `--mesh-root`/`--no-mesh`, `--ambient-status`, `--history-path`, `--translation-cache`).

```bash
# Plan and execute one mixed input line
synapsekit shell run git status "&&" "why did that fail?"

# Or, once sourced, just:
synshell git status && "why did that fail?"

# Interactive REPL (no subcommand / no text)
synapsekit shell

# Print the shell integration script to source
synapsekit shell init bash   # or zsh, fish, powershell

# Local + mesh-enriched completions
synapsekit shell complete "git sta"

# Search or list local, redacted shell history
synapsekit shell history search "pytest"
synapsekit shell history recent --limit 10

# Generate a local Ed25519 signing key for destructive-command receipts
synapsekit shell keygen ~/.synapsekit/shell/signing_key

# Show shell integration and context status
synapsekit shell status
```

Source `synapsekit shell init <shell>` in your shell profile to get the `synshell` function, a `synapse` alias, and tab completion wired to `synapsekit shell complete`.

---

## Wired into SynapseKit Live

`ShellSession.plan` and `ShellSession.run` are instrumented for [SynapseKit Live](../observability/live.md): each call publishes a `shell.plan` / `shell.run` event, including the input text, so shell activity streams to the glass-box dashboard alongside every other agent action.

---

## See also

- [SynapseKit Live](../observability/live.md) — the glass-box dashboard `shell.plan`/`shell.run` events stream to
- [Audit and verifiable receipts](../observability/audit-log.md)
