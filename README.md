<div align="center">
  <img src="https://raw.githubusercontent.com/SynapseKit/SynapseKit/main/assets/banner.svg" alt="SynapseKit" width="100%"/>
</div>

<div align="center">

[![Live](https://img.shields.io/badge/docs-live-0a7bbd?logo=github&logoColor=white)](https://synapsekit.github.io/synapsekit-docs/)
[![Built with Docusaurus](https://img.shields.io/badge/built%20with-Docusaurus%203-25c2a0?logo=docusaurus&logoColor=white)](https://docusaurus.io/)
[![Deploy](https://img.shields.io/badge/deploy-GitHub%20Pages-181717?logo=github&logoColor=white)](https://pages.github.com/)

**[Live Site](https://synapsekit.github.io/synapsekit-docs/) · [Getting Started](https://synapsekit.github.io/synapsekit-docs/docs/getting-started/quickstart) · [API Reference](https://synapsekit.github.io/synapsekit-docs/docs/api/llm) · [Main Repo](https://github.com/SynapseKit/SynapseKit)**

</div>

---

Official documentation site for [SynapseKit](https://github.com/SynapseKit/SynapseKit) — async-first Python framework for building LLM applications with RAG pipelines, agents, and graph workflows.

---

## What's documented

| Section | Coverage |
|---|---|
| [Getting Started](https://synapsekit.github.io/synapsekit-docs/docs/getting-started/installation) | Installation, quickstart, all install extras |
| [RAG Pipelines](https://synapsekit.github.io/synapsekit-docs/docs/rag/pipeline) | Loaders, chunking, embeddings, retrieval, vector stores, memory |
| [Agents](https://synapsekit.github.io/synapsekit-docs/docs/agents/overview) | ReAct, function calling, built-in tools, custom tools, executor |
| [Graph Workflows](https://synapsekit.github.io/synapsekit-docs/docs/graph/overview) | StateGraph, parallel execution, conditional routing, Mermaid export |
| [LLM Providers](https://synapsekit.github.io/synapsekit-docs/docs/llms/overview) | All 34 providers with configuration examples |
| [API Reference](https://synapsekit.github.io/synapsekit-docs/docs/api/llm) | Full class and method reference |

---

## Run locally

```bash
git clone https://github.com/SynapseKit/synapsekit-docs
cd synapsekit-docs
npm install
npm start
```

Opens at http://localhost:3000 with hot reload.

## Build

```bash
npm run build
```

Output goes to `build/`. Serve locally with `npm run serve`.

## Deploy

Pushes to `main` auto-deploy to GitHub Pages via GitHub Actions. No manual steps needed.

---

## Contributing

Found a typo, outdated example, or a missing section? PRs and issues are welcome here.

For bugs or features in the library itself, open an issue in the [main repo](https://github.com/SynapseKit/SynapseKit/issues).

---

## License

[Apache 2.0](https://github.com/SynapseKit/SynapseKit/blob/main/LICENSE)
