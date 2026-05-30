---
sidebar_position: 100
---

# Changelog

A visual timeline of SynapseKit releases. Each entry shows version, date, type, key highlights, and notable changes.

:::info
This page is curated for readability. For the complete raw changelog, see the [main SynapseKit repository](https://github.com/SynapseKit/SynapseKit/blob/main/CHANGELOG.md).
:::

<div className="changelog-timeline">

### v1.9.1 — Patch Release

<div className="version-header">
  <span className="version-number">v1.9.1</span>
  <span className="version-date">May 28, 2026</span>
  <span className="badge badge--secondary">Patch</span>
</div>

**Highlights**
- Fixed async streaming issues with Ollama provider
- Lazy imports for voice-related modules
- Resolved `__version__` mismatch
- Improved uv.lock drift handling

**Full Changes**
- `ollama` provider: Fixed streaming token handling in async mode
- Core: Added lazy loading for optional voice dependencies
- CLI: Better error messages when version detection fails

---

### v1.9.0 — Minor Release

<div className="version-header">
  <span className="version-number">v1.9.0</span>
  <span className="version-date">May 20, 2026</span>
  <span className="badge badge--primary">Minor</span>
</div>

**Highlights**
- New `CostTracker` observability component
- Added support for 3 new LLM providers (Cerebras, Novita, Writer)
- Graph checkpointing performance improved by ~40%
- Official Docker images now available

**Breaking Changes**
- `RAGPipeline` constructor now requires explicit `embedder` parameter in some configurations

---

### v1.8.2 — Patch Release

<div className="version-header">
  <span className="version-number">v1.8.2</span>
  <span className="version-date">May 12, 2026</span>
  <span className="badge badge--secondary">Patch</span>
</div>

**Highlights**
- Critical fix for Pinecone vector store connection pooling
- Improved error handling in multi-agent handoff chains
- Documentation improvements across 12 pages

---

### v1.8.0 — Minor Release

<div className="version-header">
  <span className="version-number">v1.8.0</span>
  <span className="version-date">April 28, 2026</span>
  <span className="badge badge--primary">Minor</span>
</div>

**Highlights**
- Full async support across all core components
- New `StateGraph` API (replacing legacy graph builder)
- Added `human-in-the-loop` primitives with `interrupt()`
- 29 built-in tools now available

**Migration**
See the [Migration Guide](/docs/how-to/migrate-from-langchain).

---

### v1.7.0 — Initial Public Release

<div className="version-header">
  <span className="version-number">v1.7.0</span>
  <span className="version-date">April 10, 2026</span>
  <span className="badge badge--success">Major</span>
</div>

**Highlights**
- First public release of SynapseKit
- Core RAG, Agent, and Graph primitives
- Support for 15 LLM providers
- Basic evaluation and guardrail modules

</div>

## Badge Legend

- <span className="badge badge--success">Major</span> — Breaking changes + new architecture
- <span className="badge badge--primary">Minor</span> — New features, backward compatible
- <span className="badge badge--secondary">Patch</span> — Bug fixes & improvements

---

**Contributing**  
Want to help maintain this page? Open a PR updating this file or the raw `CHANGELOG.md` in the main repository.