---
name: Tangle Pipeline Best Practices
description: Guidelines for building well-structured, maintainable ML pipelines in Tangle
---

# Tangle Pipeline Best Practices

## Pipeline Structure

1. **Logical Stages**: Organize pipelines into clear stages — data ingestion, preprocessing, training, evaluation, deployment.
2. **Subgraph Grouping**: Group related tasks into subgraphs. Each subgraph should represent one logical stage.
3. **Size Limits**: Keep subgraphs under 7 nodes. If a subgraph grows larger, split it.
4. **Naming**: Use descriptive, human-readable names for tasks. "Preprocess Training Data" not "preprocess_1".

## Component Selection

1. **Search First**: Always check the component registry before creating new components.
2. **Single Responsibility**: Prefer components that do one thing well over monolithic ones.
3. **Type Compatibility**: Verify input/output types match when connecting components.
4. **Reuse**: If a component exists that's close to what you need, prefer it over creating a new one.

## Data Flow

1. **No Cycles**: Pipeline graphs must be directed acyclic graphs (DAGs).
2. **Explicit Connections**: Always use bindings to connect data flow — avoid implicit dependencies.
3. **Pipeline Inputs**: Use pipeline-level inputs for configurable parameters that should be settable at run time.
4. **Pipeline Outputs**: Define pipeline-level outputs for results that need to be accessible after the run.

## Common Patterns

- **Fan-out**: One source feeding multiple processors (e.g., train/test split).
- **Fan-in**: Multiple sources feeding into one aggregator.
- **Chain**: Linear sequence of transforms (most common).
- **Conditional**: Use task-level `isEnabled` for optional processing steps.
