---
sidebar_position: 5
title: "Docker — SynapseKit Official Images"
description: "Run SynapseKit with no local Python setup. Official multi-arch images on GitHub Container Registry (GHCR): ghcr.io/synapsekit/synapsekit core + :all extras variants, published on every release."
keywords: [synapsekit docker, ghcr synapsekit, synapsekit container image, docker pull synapsekit, synapsekit ghcr.io]
---

# Docker

SynapseKit publishes official images to the **GitHub Container Registry (GHCR)** so you can run the CLI or serve an app with no local Python setup. Images are multi-stage, [`uv`](https://github.com/astral-sh/uv)-built, and run as a **non-root** user.

## Image

All images live under a single path:

```
ghcr.io/synapsekit/synapsekit
```

## Variants and tags

Two variants are produced from one Dockerfile via the `EXTRAS` build arg:

| Tag | Contains | Platforms |
|---|---|---|
| `:latest` | Core library + CLI (no extras) | `linux/amd64`, `linux/arm64` |
| `:<version>` | Core, pinned to a release (e.g. `:2.0.1`) | `linux/amd64`, `linux/arm64` |
| `:all` | Batteries-included — every optional extra baked in | `linux/amd64` |
| `:<version>-all` | All extras, pinned to a release (e.g. `:2.0.1-all`) | `linux/amd64` |

- **Core** (`:latest` / `:<version>`) is small and imports with **no extras** installed — the same guarantee the core-import release check enforces. Add extras yourself at build time, or reach for the `all` variant.
- **All** (`:all` / `:<version>-all`) bundles every extra (all LLM providers, loaders, vector stores, observability, etc.). It pulls heavy/native wheels, so it is published for `linux/amd64` only.

Every core image is **multi-arch** (amd64 + arm64), so it runs natively on Apple Silicon and ARM servers as well as x86.

## Pull

```bash
# Core library + CLI
docker pull ghcr.io/synapsekit/synapsekit:latest

# Pin to a specific release
docker pull ghcr.io/synapsekit/synapsekit:2.0.1

# Batteries-included (all extras)
docker pull ghcr.io/synapsekit/synapsekit:all
docker pull ghcr.io/synapsekit/synapsekit:2.0.1-all
```

## Run

The image's entrypoint is the `synapsekit` CLI, so anything after the image name is passed straight to it.

**Check the version:**

```bash
docker run --rm ghcr.io/synapsekit/synapsekit:latest --version
```

**Run a Python one-liner** (override the entrypoint to reach `python`):

```bash
docker run --rm --entrypoint python ghcr.io/synapsekit/synapsekit:latest \
  -c "import synapsekit; print(synapsekit.__version__)"
```

**Pass an API key via an environment variable:**

```bash
docker run --rm -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  ghcr.io/synapsekit/synapsekit:all \
  chat "Summarize the SynapseKit project in one sentence"
```

**Serve a SynapseKit app as an HTTP API** — mount your code and bind to `0.0.0.0` inside the container:

```bash
docker run --rm -p 8000:8000 -v "$PWD:/app" -w /app \
  ghcr.io/synapsekit/synapsekit:latest serve my_module:rag --host 0.0.0.0
```

## Release cadence

A matching Docker image is published **automatically on every GitHub Release** — the same event that drives the PyPI publish — so a container version ships with every release. Each image is **smoke-tested** (`synapsekit --version` plus `import synapsekit`) before it is pushed, so a broken build never reaches the registry.

## Building locally

You can build either variant yourself from the repo's `Dockerfile`:

```bash
# Core
docker build -t synapsekit:latest .

# All extras
docker build --build-arg EXTRAS="[all]" -t synapsekit:all .
```

### `PYTHON_VERSION` build arg

The base Python version is a build arg (`PYTHON_VERSION`, default `3.12`), so images can target Python 3.11–3.14. The official core images build on **3.13** and the all-extras image on **3.12**. SynapseKit is verified to import on Python 3.12/3.13/3.14.

```bash
docker build --build-arg PYTHON_VERSION=3.13 -t synapsekit:py313 .
```

> The optional Rust-accelerated chunker (`synapsekit._rust_core`) is **not** included in these images — SynapseKit falls back to its pure-Python chunker automatically.

See the [installation guide](./installation.md) for the full list of optional extras.
