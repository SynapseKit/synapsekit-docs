---
sidebar_position: 14
---

# Computer Use Agent

Drives a screen with a provider-agnostic observe → plan → act loop. `ComputerUseAgent` captures screen state through a `ScreenProvider`, asks a `ComputerUseProvider` for the next step, normalizes every provider's output into a single `ComputerAction` schema, runs it through a conservative `SafetyPolicy`, and executes it — pausing for human confirmation on risky actions. The same agent code runs against Anthropic computer-use, OpenAI's computer tool, or an open-source local model, and can record every session to JSONL for exact replay.

**Import:**
```python
from synapsekit.agents import (
    ComputerUseAgent,
    SafetyPolicy,
    ComputerAction,
    ComputerActionType,
    ComputerObservation,
    BrowserScreenProvider,
    LocalScreenProvider,
    VNCScreenProvider,
    AnthropicComputerUseProvider,
    OpenAIComputerUseProvider,
    OpenSourceComputerUseProvider,
    SessionRecorder,
    requires_human_confirmation,
)
from synapsekit.computer_use import RecordedSession
```

Install the drivers with `pip install synapsekit[computer-use]` (Playwright + PyAutoGUI).

---

## Quickstart

```python
import asyncio
from synapsekit.agents import (
    ComputerUseAgent,
    SafetyPolicy,
    BrowserScreenProvider,
    AnthropicComputerUseProvider,
)

async def main():
    agent = ComputerUseAgent(
        provider=AnthropicComputerUseProvider(client, model="claude-..."),
        screen=BrowserScreenProvider(),               # Playwright-backed
        safety=SafetyPolicy(
            allowed_domains=["example.com"],
            confirm_before=("delete", "send", "purchase"),
        ),
        recorder="sessions/checkout.jsonl",           # JSONL session log
        max_steps=15,
    )

    result = await agent.run("Open example.com and read the pricing page")
    print(result.completed, result.output)
    for step in result.steps:
        print(step.action.action_type, step.safety.decision)

asyncio.run(main())
```

`run(task)` loops up to `max_steps`, stopping when the provider emits a `done` action, a safety gate blocks, confirmation is denied, or an error occurs. It always closes the screen provider (unless `close_screen=False`).

---

## The unified action schema

Every provider's output is normalized into `ComputerAction` via `normalize_action(...)`, so agent and safety logic are provider-independent. `ComputerActionType` values: `CLICK`, `DOUBLE_CLICK`, `RIGHT_CLICK`, `MOVE`, `DRAG`, `TYPE_TEXT`, `KEY`, `HOTKEY`, `SCROLL`, `WAIT`, `NAVIGATE`, `SCREENSHOT`, `DONE`. A `ComputerObservation` captures the screenshot, extracted text, app name, window title, URL, and dimensions.

Providers:

- **`AnthropicComputerUseProvider(client, model=...)`** — adapts an Anthropic client's `messages.create` (or a `next_action` method).
- **`OpenAIComputerUseProvider(client, model=...)`** — adapts an OpenAI client's `responses.create` computer tool.
- **`OpenSourceComputerUseProvider(model)`** — for local/OSS models that return JSON actions from `generate()`.

---

## Safety policy

`SafetyPolicy` is conservative by default. For each action it returns `ALLOWED`, `BLOCKED`, or `NEEDS_CONFIRMATION`:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `confirm_before` | `Sequence[str]` | `("delete", "send", "purchase")` | Keywords that force confirmation |
| `forbidden_apps` | `Sequence[str]` | password managers | Apps/windows that block the run |
| `allowed_apps` | `Sequence[str] \| None` | `None` | If set, other apps are blocked |
| `allowed_domains` | `Sequence[str] \| None` | `None` | Navigations outside require confirmation |
| `blocked_domains` | `Sequence[str]` | `()` | Navigations to these are blocked |
| `require_confirmation_for_text` | `bool` | `True` | Confirm when typed text looks secret-like |
| `record_session` | `bool` | `True` | Hint that runs should be recorded |
| `audit_log` | `list[AuditEntry]` | `[]` | Populated with every decision |

Credential managers (1Password, Bitwarden, Keychain, LastPass, Keeper) are in `forbidden_apps` by default. `NAVIGATE` actions are validated against `allowed_domains`/`blocked_domains`, and PII-detection heuristics flag secret-like text (`sk-...`, `ghp_...`, `password`, tokens) for confirmation.

### Confirmation callback and decorator

Provide a `confirm` callback (sync or async) to `ComputerUseAgent` — it is invoked when a step needs confirmation and must return a truthy value to proceed. Mark helper functions that always require a human with `@requires_human_confirmation`:

```python
from synapsekit.agents import requires_human_confirmation

@requires_human_confirmation("submits a payment")
async def submit_payment(...):
    ...
```

---

## Session recording and replay

Pass `recorder=` a path (or a `SessionRecorder`) to log start, observations, actions with their safety decision, steps, and finish events as newline-delimited JSON. Screenshots are base64-encoded inline. Replay a recording later:

```python
from synapsekit.computer_use import SessionRecorder

session = SessionRecorder.load("sessions/checkout.jsonl")   # -> RecordedSession
for observation in session.observations:
    ...
for action in session.actions:
    ...
```

---

## Screen providers

- **`BrowserScreenProvider(**browser_kwargs)`** — backed by the Playwright `BrowserTool`. Executes `navigate`, `click`, `type_text`, `screenshot`, and `wait`. **In v2.0 the underlying browser tool was hardened against SSRF**: hosts that are or resolve to private, loopback, link-local, or otherwise-reserved IP ranges (including the cloud metadata endpoint `169.254.169.254`) are rejected unless you explicitly pass `allow_private_ips=True`.
- **`LocalScreenProvider(pyautogui_module=None)`** — drives the local desktop via `pyautogui`.
- **`VNCScreenProvider(client)`** — wraps a remote VNC client exposing `screenshot()` and `execute(action)`.

---

## API reference

### `ComputerUseAgent(*, provider, screen, safety=None, recorder=None, max_steps=20, confirm=None, close_screen=True)`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `provider` | `ComputerUseProvider` | required | Model adapter returning `ComputerAction`s |
| `screen` | `ScreenProvider` | required | Observes and executes on a screen |
| `safety` | `SafetyPolicy \| None` | `None` | Defaults to a conservative policy |
| `recorder` | `SessionRecorder \| str \| Path \| None` | `None` | JSONL recording target |
| `max_steps` | `int` | `20` | Loop cap |
| `confirm` | `ConfirmationCallback \| None` | `None` | Called on `NEEDS_CONFIRMATION` |
| `close_screen` | `bool` | `True` | Close the screen provider after the run |

### Methods

- `async run(task: str) -> ComputerUseResult`

### `ComputerUseResult`

| Field | Type | Description |
|---|---|---|
| `task` | `str` | The task |
| `completed` | `bool` | Whether the provider emitted `done` |
| `steps` | `list[ComputerStep]` | Per-step observation/action/safety records |
| `output` | `str` | Final output text |
| `error` | `str \| None` | Error / block / denial reason |
| `recording_path` | `Path \| None` | JSONL path if recorded |

---

## See also

- [Agents overview](overview)
- [Built-in tools](tools)
- [Self-improving agent](self-improving)
