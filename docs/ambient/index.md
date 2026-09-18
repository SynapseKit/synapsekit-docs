---
sidebar_position: 1
title: "Ambient Daemon — Local Risky-Command Watchdog"
description: "Opt-in background daemon that watches a git repo for dirty state and the terminal for destructive commands, firing a local notification before damage happens."
---

# Ambient Daemon

`AmbientDaemon` is an opt-in background process that watches a git repo for uncommitted (dirty) state and the terminal for risky commands, then fires a local notification when the two coincide. The canonical trigger is running something destructive, `rm -rf`, `git reset --hard`, a force-push, or `git clean -f`, against a repo that has uncommitted work. It is rule-based: a small, auditable pattern table, not a machine-learned classifier. This is the MVP slice of issue #743.

**Import:**
```python
from synapsekit.ambient import AmbientDaemon, AmbientDaemonConfig
```

Requires the `ambient` extra for desktop notifications: `pip install synapsekit[ambient]` (adds `plyer`).

---

## Quickstart

```python
import asyncio
from pathlib import Path
from synapsekit.ambient import AmbientDaemon, AmbientDaemonConfig

async def main():
    daemon = AmbientDaemon(config=AmbientDaemonConfig(repo_root=Path.cwd()))
    status = await daemon.start()   # blocks, polling until stopped
    print(status.state, status.pid)

asyncio.run(main())
```

Sync callers can use `daemon.start_sync()` / `daemon.stop_sync()` instead of the coroutine forms. `start()` prints a startup notice, then polls its sources every `poll_interval` seconds (default `2.0`) until `stop()` is called or the process receives `SIGTERM`/`SIGINT`.

---

## How it works

**Sources.** Two `AmbientSourcePlugin` implementations ship today: `GitSourcePlugin` polls `git status` in `repo_root` and reports dirty state, changed files, branch, and head; `TerminalSourcePlugin` polls shell history for newly run commands. Each tick, git-status events update an in-memory `AmbientState`; terminal events are checked against that state.

**Rules.** `evaluate(event, state)` in `synapsekit.ambient.rules` only fires when the event source is `terminal` and `state.git_dirty` is true. It matches the command text against a fixed pattern table:

| Pattern | Rule label | Confidence |
|---|---|---|
| `rm -rf` / `rm -fr` (any flag order) | `destructive-delete` | `0.9` |
| PowerShell `Remove-Item -Recurse -Force` | `destructive-delete` | `0.9` |
| `git reset --hard` | `git-reset-hard` | `0.85` |
| `git push --force` / `-f` | `git-force-push-or-clean` | `0.8` |
| `git clean -f...` | `git-force-push-or-clean` | `0.8` |

A match produces an `Intervention(rule, confidence, message, event)`. The daemon only fires it if `intervention.confidence >= config.min_confidence` (default `0.6`, set via `AmbientDaemonConfig.min_confidence`).

**Firing.** On a qualifying match, the daemon sends a Windows toast (`notify_windows_toast`, via `plyer`; failures are logged and swallowed, never crash the daemon) and writes a redacted entry to its `AuditLog`. Both the toast call and the audit write are blocking, so they're offloaded with `asyncio.to_thread` to keep the daemon's event loop unblocked.

---

## Privacy model

- **Command text is redacted before it is ever written to disk.** The daemon holds a `MeshPrivacyFilter` (the same secret-redaction filter used by the [Personal Knowledge Mesh](../mesh/index.md)) and passes the raw command through `redactor.redact_text(...)` before it enters the `AuditLog`. Only the rule name, confidence, and source are recorded as structured metadata.
- **Per-source opt-out.** Both sources are enabled by default. List a source name (`git` or `terminal`) on its own line in `~/.synapsekit/ambient.ignore` to disable it; `load_disabled_sources()` reads that file at daemon construction. Override the path with `AmbientDaemonConfig.privacy_file` (or pass `None` to disable filtering).
- **Explicit shell-history disclosure.** Because a background daemon can't prompt interactively, `start()` prints a notice at startup whenever the `terminal` source is active, stating that shell history is read, that command text is redacted before auditing, and how to opt out.
- **Async-first IO.** Status-file reads/writes (`read_status`/`write_status`) and the toast/audit write in `_fire` all run through `asyncio.to_thread`, keeping blocking file and notification IO off the event loop.

---

## `AmbientDaemonConfig`

| Field | Default | Description |
|---|---|---|
| `repo_root` | `Path.cwd()` | Repo the `git` source watches |
| `poll_interval` | `2.0` | Seconds between polling ticks |
| `min_confidence` | `0.6` | Minimum `Intervention.confidence` required to fire |
| `privacy_file` | `~/.synapsekit/ambient.ignore` | Per-source opt-out file (`None` disables filtering) |
| `status_path` | `~/.synapsekit/ambient.status.json` | Where daemon state/pid is persisted |
| `audit_path` | `~/.synapsekit/ambient_audit.jsonl` | Redacted intervention audit trail |
| `terminal_history_path` | `None` | Override for the shell-history file the terminal source reads |

---

## CLI reference

```bash
# Start the daemon against the current directory (or --repo PATH)
synapsekit ambient start
synapsekit ambient start --poll-interval 5 --min-confidence 0.75

# Stop a running daemon (signals it by pid, then reconciles status)
synapsekit ambient stop

# Show current daemon status (state, pid, started_at)
synapsekit ambient status

# Show recent fired interventions from the audit log
synapsekit ambient log
synapsekit ambient log --limit 50
```

Global options apply to every subcommand: `--repo DIR` (defaults to cwd) and `--json` (emit machine-readable output instead of `key: value` lines).

`stop()`/`status()` reconcile the persisted status file against real process liveness, so a daemon that exited or was `kill -9`'d is never misreported as still running.

---

## Scope and limits

This is an MVP. Today the daemon covers two sources (`git`, `terminal`), a fixed rule table, and a Windows toast notifier. Not yet shipped:

- `editor` and `browser` sources
- an ML-based intent classifier (the rule table stays the primary trigger even after one lands)
- macOS and Linux native notifiers (Windows toast via `plyer` is the only backend today)

---

## SynapseKit Live

Every fired intervention publishes an `ambient.intervene` event to the [SynapseKit Live](../observability/live.md) event bus, carrying the rule name, confidence, and source, never the raw command text. The dashboard renders it as, for example, `Ambient flagged git-reset-hard (terminal) · 85%`.

---

## See also

- [Personal Knowledge Mesh](../mesh/index.md) — the `MeshPrivacyFilter` used to redact command text
- [SynapseKit Live](../observability/live.md)
