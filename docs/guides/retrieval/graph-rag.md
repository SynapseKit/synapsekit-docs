---
sidebar_position: 3
title: "GraphRAG: Entity-Aware Retrieval"
description: "Build a knowledge graph from your documents and answer multi-hop questions by traversing entity relationships with SynapseKit's GraphRAGPipeline."
---

import ColabBadge from '@site/src/components/ColabBadge';

# GraphRAG: Entity-Aware Retrieval

<ColabBadge path="retrieval/graph-rag.ipynb" />

Standard vector search retrieves documents that are semantically close to the query but has no concept of relationships between entities. When a user asks "Which companies partnered with the organization that acquired Acme Corp?", flat retrieval can find documents mentioning Acme Corp's acquisition — but it cannot traverse the graph to find the acquiring organization's other partnerships. GraphRAG solves this by building a knowledge graph during ingestion and using it to answer multi-hop questions that require following chains of entity relationships.

**What you'll build:** An ingestion pipeline that extracts named entities and relationships from documents, stores them in a graph, and a query pipeline that routes entity-centric questions through graph traversal rather than (or in addition to) vector search. **Time:** ~30 min. **Difficulty:** Advanced

## Prerequisites

- Completed the [Basic RAG](../rag/) guide
- Understanding of graph data structures (nodes, edges, traversal)
- `pip install synapsekit`
- `OPENAI_API_KEY` set in your environment

## What you'll learn

- How `GraphRAGPipeline` extracts entities and relationships during ingestion
- How to configure entity types and relationship schemas
- How multi-hop queries traverse the graph to retrieve context across documents
- When GraphRAG outperforms and underperforms standard vector retrieval

## Step 1: Install and configure

```python
import asyncio
import os

from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.pipelines import GraphRAGPipeline

llm = OpenAILLM(model="gpt-4o-mini")
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = InMemoryVectorStore(embeddings=embeddings)
```

## Step 2: Define your entity schema

Constraining the entity types prevents the extractor from producing a noisy, unconstrained graph. Only define types that are meaningful for your domain and that users will actually query.

```python
entity_schema = {
    "entity_types": ["PERSON", "ORGANIZATION", "PRODUCT", "TECHNOLOGY", "LOCATION"],
    "relationship_types": [
        "WORKS_AT", "FOUNDED", "ACQUIRED", "PARTNERED_WITH",
        "BUILT_ON", "COMPETES_WITH", "LOCATED_IN",
    ],
}
```

## Step 3: Initialize the GraphRAG pipeline

```python
pipeline = GraphRAGPipeline(
    llm=llm,
    embeddings=embeddings,
    vectorstore=vectorstore,
    entity_schema=entity_schema,
    max_hops=2,          # how deep to traverse from a matched entity
    top_k_vector=5,      # fallback vector results for non-entity queries
    community_summary=True,  # summarize dense entity clusters during ingestion
)
```

## Step 4: Ingest documents

During ingestion, `GraphRAGPipeline` runs two passes: vector embedding (same as standard RAG) and entity/relationship extraction. The extraction pass is LLM-driven and proportional to document volume — batch your documents to avoid unnecessary API calls.

```python
docs = [
    "OpenAI was founded by Sam Altman, Greg Brockman, and Elon Musk in 2015. "
    "OpenAI developed GPT-4, which is built on transformer architecture.",

    "Microsoft acquired a major stake in OpenAI in 2019 and again in 2023. "
    "Microsoft integrated GPT-4 into its Copilot product suite.",

    "Anthropic was founded by Dario Amodei and Daniela Amodei, former OpenAI researchers. "
    "Anthropic built Claude, which competes with GPT-4.",

    "Google DeepMind partnered with Google Cloud to deploy Gemini, "
    "a multimodal model that competes with both GPT-4 and Claude.",

    "Sam Altman previously worked at Y Combinator before co-founding OpenAI. "
    "Y Combinator is located in San Francisco.",
]

async def ingest():
    result = await pipeline.aadd(docs)
    print(f"Ingested {result.num_documents} documents")
    print(f"Extracted {result.num_entities} entities, {result.num_relationships} relationships")

asyncio.run(ingest())
```

## Step 5: Inspect the graph

Before querying, verify that the graph contains the entities and relationships you expect. Missing relationships are almost always a sign that the entity schema needs adjustment.

```python
async def inspect_graph():
    graph = await pipeline.aget_graph()

    print("Entities:")
    for entity in graph.entities[:10]:
        print(f"  [{entity.type}] {entity.name}")

    print("\nRelationships:")
    for rel in graph.relationships[:10]:
        print(f"  {rel.source} --[{rel.type}]--> {rel.target}")

asyncio.run(inspect_graph())
```

## Step 6: Run a single-hop query

```python
async def single_hop():
    result = await pipeline.aquery("What did Microsoft build using GPT-4?")
    print(result.answer)
    print("\nSources:", [s.text[:60] for s in result.sources])

asyncio.run(single_hop())
```

## Step 7: Run a multi-hop query

Multi-hop queries require the pipeline to traverse relationships. The traversal starts from entities matched in the query, follows edges up to `max_hops` deep, and collects the text of all reachable document nodes.

```python
async def multi_hop():
    # Answering this requires: query -> OpenAI -> founded_by -> Sam Altman -> works_at -> Y Combinator -> located_in -> San Francisco
    result = await pipeline.aquery(
        "Where was Sam Altman based before he co-founded OpenAI?"
    )
    print(result.answer)
    print("\nTraversal path:", result.traversal_path)

asyncio.run(multi_hop())
```

## Step 8: Stream a complex analytical question

```python
async def stream_analysis():
    question = "Which organizations are competing with OpenAI, and what products are involved?"
    print(f"Q: {question}\n")
    async for chunk in pipeline.astream(question):
        print(chunk, end="", flush=True)
    print()

asyncio.run(stream_analysis())
```

## Complete working example

```python
import asyncio
import os

from synapsekit.llms.openai import OpenAILLM
from synapsekit.embeddings.openai import OpenAIEmbeddings
from synapsekit.vectorstores.memory import InMemoryVectorStore
from synapsekit.pipelines import GraphRAGPipeline

DOCS = [
    "OpenAI was founded by Sam Altman, Greg Brockman, and Elon Musk in 2015. "
    "OpenAI developed GPT-4, which is built on transformer architecture.",
    "Microsoft acquired a major stake in OpenAI in 2019 and again in 2023. "
    "Microsoft integrated GPT-4 into its Copilot product suite.",
    "Anthropic was founded by Dario Amodei and Daniela Amodei, former OpenAI researchers. "
    "Anthropic built Claude, which competes with GPT-4.",
    "Google DeepMind partnered with Google Cloud to deploy Gemini, "
    "a multimodal model that competes with both GPT-4 and Claude.",
    "Sam Altman previously worked at Y Combinator before co-founding OpenAI. "
    "Y Combinator is located in San Francisco.",
]

ENTITY_SCHEMA = {
    "entity_types": ["PERSON", "ORGANIZATION", "PRODUCT", "TECHNOLOGY", "LOCATION"],
    "relationship_types": [
        "WORKS_AT", "FOUNDED", "ACQUIRED", "PARTNERED_WITH",
        "BUILT_ON", "COMPETES_WITH", "LOCATED_IN",
    ],
}


async def main():
    llm = OpenAILLM(model="gpt-4o-mini")
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = InMemoryVectorStore(embeddings=embeddings)

    pipeline = GraphRAGPipeline(
        llm=llm,
        embeddings=embeddings,
        vectorstore=vectorstore,
        entity_schema=ENTITY_SCHEMA,
        max_hops=2,
        top_k_vector=5,
        community_summary=True,
    )

    result = await pipeline.aadd(DOCS)
    print(f"Extracted {result.num_entities} entities, {result.num_relationships} relationships\n")

    questions = [
        "What did Microsoft build using GPT-4?",
        "Where was Sam Altman based before he co-founded OpenAI?",
        "Which organizations are competing with OpenAI, and what products are involved?",
    ]

    for question in questions:
        print(f"Q: {question}")
        result = await pipeline.aquery(question)
        print(f"A: {result.answer}\n")


asyncio.run(main())
```

## Expected output

```
Extracted 12 entities, 14 relationships

Q: What did Microsoft build using GPT-4?
A: Microsoft integrated GPT-4 into its Copilot product suite after acquiring a major stake in OpenAI.

Q: Where was Sam Altman based before he co-founded OpenAI?
A: Sam Altman worked at Y Combinator, which is located in San Francisco, before co-founding OpenAI in 2015.

Q: Which organizations are competing with OpenAI, and what products are involved?
A: Two organizations compete directly with OpenAI. Anthropic — founded by former OpenAI researchers — built Claude, which competes with GPT-4. Google DeepMind deployed Gemini via Google Cloud, which also competes with both GPT-4 and Claude.
```

## How it works

**Ingestion.** Each document is processed by an LLM-driven entity extractor that identifies spans matching the configured entity types and the relationships between them. The result is a directed property graph stored alongside the vector index. Documents are also embedded normally so non-entity queries can fall back to vector search.

**Community summarization.** When `community_summary=True`, the pipeline detects densely connected clusters of entities (communities) using a graph partitioning algorithm and generates a short summary for each. These summaries are stored as synthetic documents and retrieved when a query touches multiple members of the same community.

**Query routing.** At query time, the pipeline first checks whether the query contains recognizable entity mentions. If it does, it uses those as traversal seeds. If not, it falls back to standard vector retrieval. Queries that mention entities but also require general knowledge use both paths and merge the context.

**Multi-hop traversal.** Starting from the seed entities, the pipeline performs a breadth-first traversal up to `max_hops` edges. Each visited node contributes its source document text to the context window. Visited nodes are deduplicated so the same text is not passed to the LLM twice.

## Variations

**Persist the graph across sessions.** Swap `InMemoryVectorStore` for a persistent store and supply a `graph_store` parameter pointing to a Neo4j or NetworkX backend:

```python
from synapsekit.graphstores import Neo4jGraphStore

graph_store = Neo4jGraphStore(uri="bolt://localhost:7687", user="neo4j", password="...")
pipeline = GraphRAGPipeline(..., graph_store=graph_store)
```

**Increase extraction quality.** For domains with rare terminology, provide few-shot extraction examples in the entity schema:

```python
entity_schema = {
    "entity_types": ["DRUG", "DISEASE", "GENE", "PATHWAY"],
    "relationship_types": ["TREATS", "CAUSES", "INHIBITS", "ACTIVATES"],
    "examples": [
        {"text": "Metformin treats type 2 diabetes", "entities": [...], "relationships": [...]},
    ],
}
```

**Limit traversal to specific relationship types.** Constrain multi-hop traversal to prevent irrelevant hops:

```python
result = await pipeline.aquery(
    "Who founded organizations that compete with OpenAI?",
    traverse_only=["FOUNDED", "COMPETES_WITH"],
)
```

## Troubleshooting

**Entity extraction is slow.** Extraction is linear in document count. For large corpora, use `batch_size` to control how many documents are extracted per LLM call, and enable async batching to parallelize across documents.

**Multi-hop queries return no graph context.** The traversal seed requires at least one entity in the query to match an entity in the graph. Check spelling and capitalization, or inspect `pipeline.aget_graph()` to verify the entity was extracted.

**Extracted relationships are wrong or hallucinated.** LLM-based extraction is not perfect. Constrain the relationship types to the minimum needed for your use case, and consider adding a verification step that cross-checks extracted relationships against the source text.

**Community summaries are off-topic.** This usually means the graph has low-quality entity clusters because similar entities were extracted under different names (e.g., "OpenAI" and "Open AI"). Enable entity deduplication with `deduplicate_entities=True` in the pipeline config.

## Next steps

- [Self-RAG](./self-rag) — add relevance grading on top of graph-retrieved context
- [Query Decomposition](./query-decomposition) — break multi-hop questions into explicit sub-queries before graph traversal
- [Adaptive RAG](./adaptive-rag) — route graph queries to a stronger model while keeping vector-only queries on a cheaper one
