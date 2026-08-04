---
sidebar_position: 18
---

# Signed Agent Marketplace

Package an agent as a portable, cryptographically signed `.agent` bundle, verify it end to end, install it safely, and share it through a self-hostable registry with signed reviews and eval-based ranking. A bundle is a deterministic ZIP whose `manifest.json` inventories every file with a per-file SHA-256 digest, and whose manifest is signed with an Ed25519 publisher key. Nothing in a bundle is ever imported or executed during verification or installation — an installed agent is **inert** and can only run once you attach an explicit sandbox.

**Import:**
```python
from synapsekit.marketplace import (
    pack_agent,
    verify_agent_bundle,
    unpack_agent,
    install_agent,
    AgentBundleVerification,
    AgentManifest,
    AgentBundleFile,
    PublisherIdentity,
    InstalledAgent,
    AgentSandbox,
    FileAgentRegistry,
    RegistryEntry,
    RankedRegistryEntry,
    SignedAgentReview,
)
```

Signing uses the same `Ed25519SigningProvider` as the audit subsystem:

```python
from synapsekit.audit.signer import Ed25519SigningProvider
```

No extra dependency beyond the core install.

---

## The `.agent` bundle format

A `.agent` file is a ZIP archive containing exactly:

- `manifest.json` — pretty-printed, sorted-key JSON: agent metadata plus a `files` inventory where every content file is listed with its `path`, `sha256`, and `size`.
- `signature.ed25519` — 64 raw bytes: an Ed25519 signature over the **canonical** JSON encoding of the manifest.
- Your content files (e.g. `README.md`, `evals/…`, `agent.py`, `memory/…`, `router/…`).

The archive is **deterministic**: every entry is written with a fixed timestamp and fixed permissions, so packing the same source twice yields byte-identical output. Two schema constants pin the format:

```python
from synapsekit.marketplace import AGENT_BUNDLE_FORMAT, AGENT_BUNDLE_SCHEMA_VERSION
# "synapsekit-agent", "1.0"
```

Every bundle is required to include a `README.md` and at least one file under `evals/` — the eval suite travels with the agent so a consumer can reproduce its quality claim. An optional `entrypoint` uses the form `FILE:SYMBOL` and must reference a bundled file. Bundles that ship a `memory/` tree are tagged with the `ump/1.0` memory protocol, and a `router/` tree is recorded under `router_path`.

Limits are enforced at pack and verify time: at most **2048** files, **64 MiB** per file, and **256 MiB** total.

---

## Quickstart (end-to-end shell)

The full lifecycle from the CLI — generate a key, pack and sign, verify, install, and publish to a registry:

```bash
# 1. Generate an Ed25519 publisher key (private key written 0o600).
#    Prints a "Trusted key: KEY_ID:BASE64" line — share the public half.
synapsekit agent keygen publisher.key --public-key publisher.pub --key-id acme

# 2. Pack and sign a source directory. It MUST contain README.md and evals/.
#    Output must use the .agent extension and live outside the source dir.
synapsekit agent pack ./my-agent \
    --output pr-reviewer.agent \
    --name pr-reviewer \
    --agent-version 1.2.0 \
    --author "Acme AI" \
    --private-key publisher.key \
    --key-id acme \
    --description "Reviews pull requests" \
    --entrypoint agent.py:build \
    --tag review --tag engineering \
    --eval-score 0.91

# 3. Verify hashes + signature, and pin the publisher key you trust.
#    Exit code 0 = accepted. --require-trusted fails if the key is unpinned.
TRUSTED="acme:$(cat publisher.pub)"
synapsekit agent verify pr-reviewer.agent --trusted-key "$TRUSTED" --require-trusted

# 4. Install under <install-root>/<name>/<version>. The agent stays inert.
synapsekit agent install pr-reviewer.agent \
    --install-root ~/.synapsekit/agents \
    --trusted-key "$TRUSTED" --require-trusted

# 5. Publish to a self-hostable file-backed registry (pinned key required
#    unless you opt into an open registry with --allow-untrusted).
synapsekit agent publish pr-reviewer.agent \
    --registry ./registry \
    --trusted-key "$TRUSTED" --require-trusted
```

The `keygen` step prints a `Trusted key: acme:<base64>` line; that `KEY_ID:BASE64` string is exactly what `--trusted-key` expects. Distribute the public key out of band (not inside the bundle) so consumers can independently pin it.

---

## Packing a bundle in Python

`pack_agent` walks a source directory, hashes each file, builds and signs the manifest, and writes the deterministic archive:

```python
from pathlib import Path
from synapsekit.audit.signer import Ed25519SigningProvider
from synapsekit.marketplace import pack_agent

provider = Ed25519SigningProvider(key_id="acme")

bundle: Path = pack_agent(
    "./my-agent",                     # source dir (must have README.md + evals/)
    "pr-reviewer.agent",              # output (must end in .agent, outside source)
    name="pr-reviewer",
    version="1.2.0",
    author="Acme AI",
    signing_provider=provider,        # SigningProvider, or 32 raw private-key bytes
    description="Reviews pull requests",
    entrypoint="agent.py:build",      # optional FILE:SYMBOL referencing a bundled file
    tags=("review", "engineering"),
    eval_score=0.91,                  # optional, 0.0–1.0
)
```

`signing_provider` accepts either a `SigningProvider` instance or the 32 raw private-key bytes (the CLI reads them from `--private-key`). Only Ed25519 is supported by schema `1.0`.

---

## Verifying integrity and trust

`verify_agent_bundle` reads the archive into memory and checks, in order: safe archive paths, no duplicate or case-colliding entries, no directory/symlink entries, size and count limits, the manifest inventory matches the archive exactly, every file's SHA-256 and size match, and the Ed25519 signature is valid over the canonical manifest. It returns an `AgentBundleVerification` and never raises for a bad bundle:

```python
from synapsekit.marketplace import verify_agent_bundle

result = verify_agent_bundle("pr-reviewer.agent")
result.integrity_valid   # archive is structurally valid and untampered
result.trusted           # True only if a pinned key matched (see below)
result.bundle_sha256     # SHA-256 of the whole .agent file
result.errors            # tuple of human-readable failure reasons
result.manifest          # AgentManifest, or None on failure
```

**Trust is separate from integrity.** A valid signature only proves the manifest was signed by *some* key embedded in the bundle. To establish *who* signed it, pin the publisher's independently obtained public key:

```python
trusted_keys = {"acme": provider.public_key_bytes()}   # key_id -> 32 raw bytes
result = verify_agent_bundle("pr-reviewer.agent", trusted_keys=trusted_keys)
assert result.integrity_valid and result.trusted
```

If a pinned key exists for the publisher's `key_id` but does not match the bundle's embedded key, verification fails outright. Convenience guards raise instead of returning a flag:

```python
manifest = result.require_valid()     # raises InvalidAgentBundleError if tampered
manifest = result.require_trusted()   # also raises UntrustedPublisherError if unpinned
```

The CLI mirrors this — `verify` exits `0` when the bundle is intact (and, with `--require-trusted`, only when the publisher is pinned), `1` otherwise, and supports `--format json`:

```bash
synapsekit agent verify pr-reviewer.agent --format json \
    --trusted-key "acme:$(cat publisher.pub)"
```

---

## The safe install flow

`install_agent` verifies the bundle from an immutable in-memory snapshot of the raw bytes, then extracts into a **staging temp directory** and atomically `replace()`s it into `NAME/VERSION`. If any step fails, staging is discarded and nothing partial is left behind.

```python
from synapsekit.marketplace import install_agent

installed = install_agent(
    "pr-reviewer.agent",
    install_root="~/.synapsekit/agents",   # default: ~/.synapsekit/agents
    trusted_keys={"acme": provider.public_key_bytes()},
    require_trusted=True,
)
installed.path              # <install_root>/pr-reviewer/1.2.0
installed.manifest          # AgentManifest
installed.trusted           # publisher trust outcome
installed.bundle_sha256     # recorded in .synapsekit-install.json
installed.sandbox_required  # True unless the publisher was trusted
```

Because verification runs against the in-memory bytes *before* extraction, the following are all rejected before a single file touches disk:

- **Path traversal** — absolute paths, `..` segments, or backslashes.
- **Symlinks and directory entries** — only regular files are extracted.
- **Windows device names / ADS** — reserved names (`CON`, `NUL`, `COM1`…`LPT9`) and any `:` in a path component.
- **Duplicates and case collisions** — a repeated path, or two paths that differ only in case, are refused (protects case-insensitive filesystems).
- **Size / count limits** — the 2048-file, 64 MiB-per-file, 256 MiB-total caps.
- **Inventory drift** — the set of archive files must equal the manifest inventory exactly (no missing, no extra), and every hash must match.

Reinstalling the identical bundle over an existing `NAME/VERSION` is idempotent (the recorded `bundle_sha256` matches, so it returns the existing install). A **different** bundle at the same `NAME/VERSION` raises `FileExistsError` — installs are immutable.

To unpack into an arbitrary fresh directory instead of the versioned install root, use `unpack_agent` (the CLI `unpack` subcommand); it applies the same verification and atomic extraction and refuses to overwrite an existing destination.

---

## Running an installed agent (sandbox required)

An installed bundle is inert by design. `InstalledAgent.run` refuses to execute unless you pass an `AgentSandbox` — the execution boundary is your responsibility, so packaging never becomes an arbitrary-code-execution vector:

```python
from pathlib import Path
from synapsekit.marketplace import AgentManifest, AgentSandbox

class MySandbox:                       # satisfies the AgentSandbox protocol
    async def run(self, agent_path: Path, manifest: AgentManifest,
                  prompt: str, **kwargs):
        # Load and execute manifest.entrypoint inside your isolation of choice
        # (subprocess, container, gVisor, WASM, …) and return the result.
        ...

result = await installed.run("Review PR #42", sandbox=MySandbox())
```

Calling `installed.run(prompt)` **without** a sandbox raises `SandboxRequiredError`. `installed.sandbox_required` is `True` whenever the publisher was not independently trusted (and the manifest still requires sandboxing for untrusted agents — schema `1.0` always does).

---

## Self-hostable registry

`FileAgentRegistry` is a registry backed by a plain directory and a static `index.json` — host it on any static file server, object store, or Git repo. Publishing re-verifies the bundle, copies it immutably under `packages/NAME/VERSION/NAME-VERSION.agent`, re-verifies the *copy*, and only then appends to the index under a lock.

```python
from synapsekit.marketplace import FileAgentRegistry

registry = FileAgentRegistry("./registry")

entry = registry.publish(
    "pr-reviewer.agent",
    trusted_keys={"acme": provider.public_key_bytes()},   # pinned by default
)
entry.name, entry.version, entry.bundle_sha256, entry.eval_score

registry.list()                       # all RegistryEntry, sorted by (name, version)
registry.get("pr-reviewer", "1.2.0")  # one entry or None
registry.bundle_path("pr-reviewer", "1.2.0")   # safe, root-confined Path
```

By default publishing requires a pinned publisher key; pass `allow_untrusted=True` to intentionally run an open registry. Republishing the same bytes at the same version is idempotent; different bytes at an existing version raise `FileExistsError`.

### Signed reviews and eval-based ranking

Reviews are themselves Ed25519-signed, so a registry mirror can't forge or tamper with them. Build one with `SignedAgentReview.sign` and add it to the registry:

```python
from synapsekit.audit.signer import Ed25519SigningProvider
from synapsekit.marketplace import SignedAgentReview

reviewer = Ed25519SigningProvider(key_id="independent-lab")

review = SignedAgentReview.sign(
    agent_name="pr-reviewer",
    agent_version="1.2.0",
    reviewer="Independent Lab",
    rating=5,                 # 1–5
    eval_score=1.0,           # 0.0–1.0, reproduced independently
    comment="Reproduced the eval suite.",
    signing_provider=reviewer,
)

registry.add_review(review, trusted_keys={"independent-lab": reviewer.public_key_bytes()})
registry.reviews("pr-reviewer", "1.2.0")   # verifies each stored signature on read
```

`add_review` rejects reviews for unpublished agents, rejects invalid signatures, and (like publishing) requires a pinned reviewer key unless `allow_untrusted=True`. Each review's signature is re-verified whenever `reviews()` reads it back.

`ranked()` returns a deterministic quality ordering. Each review contributes `(eval_score + rating / 5) / 2`; a version's score is its own `eval_score` (weighted `0.7`) blended with the mean review score (weighted `0.3`), falling back to whichever is available:

```python
for ranked in registry.ranked():
    print(ranked.entry.name, ranked.entry.version, ranked.score, ranked.review_count)
```

Ties break by name then version, so the ordering is reproducible across mirrors.

The CLI `publish` subcommand wraps `FileAgentRegistry.publish`; reviews and ranking are Python-only APIs.

---

## CLI reference

All subcommands live under `synapsekit agent`.

| Subcommand | Purpose |
|---|---|
| `keygen PRIVATE_KEY` | Generate an Ed25519 publisher key |
| `pack SOURCE` | Pack and sign a portable `.agent` bundle |
| `verify BUNDLE` | Verify hashes, signature, and publisher trust |
| `unpack BUNDLE OUTPUT` | Verify and unpack into a fresh directory |
| `install BUNDLE` | Verify and install an inert bundle under `NAME/VERSION` |
| `publish BUNDLE` | Publish a bundle to a file-backed registry |

**`keygen PRIVATE_KEY`**

| Flag | Default | Description |
|---|---|---|
| `PRIVATE_KEY` (positional) | required | New raw private-key file (refuses to overwrite) |
| `--public-key` | `None` | Optional base64 public-key output file |
| `--key-id` | `None` | Optional stable publisher key id |

**`pack SOURCE`**

| Flag | Default | Description |
|---|---|---|
| `SOURCE` (positional) | required | Agent source directory |
| `--output` | required | Output `.agent` path |
| `--name` | required | Portable agent name |
| `--agent-version` | required | Portable agent version |
| `--author` | required | Publisher or author name |
| `--private-key` | required | Raw Ed25519 private-key file (exactly 32 bytes) |
| `--key-id` | `None` | Publisher key id |
| `--description` | `""` | Agent description |
| `--entrypoint` | `None` | Optional bundled `FILE:SYMBOL` |
| `--tag` | `[]` | Agent tag (repeatable) |
| `--eval-score` | `None` | Eval score from 0 to 1 |

**Trust options** (shared by `verify`, `unpack`, `install`, `publish`):

| Flag | Description |
|---|---|
| `--trusted-key KEY_ID:BASE64_PUBLIC_KEY` | Pin an independently obtained publisher key (repeatable) |
| `--require-trusted` | Reject bundles whose publisher key is not pinned |

**`verify BUNDLE`** adds `--format {text,json}` (default `text`). Exits `0` when accepted, `1` otherwise.

**`unpack BUNDLE OUTPUT`** — `OUTPUT` is a new destination directory (must not already exist).

**`install BUNDLE`** adds `--install-root` (default `~/.synapsekit/agents`).

**`publish BUNDLE`** adds `--registry` (required, registry root dir) and `--allow-untrusted` (allow self-signed publishers in an intentionally open registry — mutually exclusive with `--require-trusted`).

---

## API reference

### Bundle functions

- `pack_agent(source, output, *, name, version, author, signing_provider, description="", entrypoint=None, tags=(), eval_score=None, key_id=None) -> Path`
- `verify_agent_bundle(bundle, *, trusted_keys=None) -> AgentBundleVerification`
- `unpack_agent(bundle, output, *, trusted_keys=None, require_trusted=False) -> AgentManifest`
- `install_agent(bundle, *, install_root=None, trusted_keys=None, require_trusted=False) -> InstalledAgent`

### `AgentBundleVerification`

Fields: `integrity_valid`, `trusted`, `errors`, `manifest`, `bundle_sha256`. Property `ok` (alias for `integrity_valid`). Methods `require_valid() -> AgentManifest`, `require_trusted() -> AgentManifest`.

### `AgentManifest`

Fields: `name`, `version`, `author`, `publisher`, `files`, `description`, `entrypoint`, `tags`, `eval_score`, `memory_format`, `router_path`, `format`, `schema_version`, `sandbox_required_for_untrusted`. Methods: `to_dict()`, `from_dict()`.

### `AgentBundleFile`

Fields: `path`, `sha256`, `size`. Methods: `to_dict()`, `from_dict()`.

### `PublisherIdentity`

Fields: `algorithm` (`"ed25519"`), `key_id`, `public_key_b64`. Property `public_key_bytes -> bytes`.

### `InstalledAgent`

Fields: `path`, `manifest`, `trusted`, `bundle_sha256`. Property `sandbox_required -> bool`. Method `async run(prompt, *, sandbox=None, **kwargs)` — raises `SandboxRequiredError` when `sandbox` is `None`.

### `AgentSandbox` (Protocol)

`async run(agent_path: Path, manifest: AgentManifest, prompt: str, **kwargs) -> Any`

### `FileAgentRegistry(root)`

- `publish(bundle, *, trusted_keys=None, allow_untrusted=False) -> RegistryEntry`
- `get(name, version) -> RegistryEntry | None`
- `list() -> list[RegistryEntry]`
- `bundle_path(name, version) -> Path`
- `add_review(review, *, trusted_keys=None, allow_untrusted=False) -> Path`
- `reviews(name, version) -> list[SignedAgentReview]`
- `ranked() -> list[RankedRegistryEntry]`

### `RegistryEntry`

Fields: `name`, `version`, `author`, `description`, `tags`, `publisher_key_id`, `bundle_sha256`, `bundle_path`, `published_at`, `eval_score`.

### `RankedRegistryEntry`

Fields: `entry` (`RegistryEntry`), `score` (`float`), `review_count` (`int`).

### `SignedAgentReview`

Fields: `agent_name`, `agent_version`, `reviewer`, `rating` (1–5), `eval_score` (0.0–1.0), `comment`, `signed_at`, `reviewer_identity` (`PublisherIdentity`), `signature_b64`, `schema_version`. Classmethod `sign(*, agent_name, agent_version, reviewer, rating, eval_score, signing_provider, comment="", signed_at=None)`. Methods `verify(trusted_keys=None) -> tuple[bool, bool]`, `to_dict()`, `from_dict()`.

### Exceptions

`AgentMarketplaceError` (base), `InvalidAgentBundleError`, `UntrustedPublisherError`, `SandboxRequiredError`.

---

## See also

- [Self-Improving Agent](self-improving)
- [Agents overview](overview)
- [Agent federation](federation)
