---
name: tangle-domain
description: Domain terminology and concepts for Tangle. Use whenever discussing, naming, or working with pipelines, runs, components, tasks, inputs, outputs, executions, or any Tangle domain concepts.
---

# Tangle Domain Terminology

This application is called **Tangle** (or **Tangle-UI** for the frontend). Never refer to it as "Pipeline Studio" — that is a legacy name.

- **tangle-ui**: This frontend repo (React + TypeScript)
- **tangle**: The backend orchestration system
- Together they form the **Tangle platform** for building and running ML pipelines

## Core Concepts

### Pipeline

A **pipeline** is a directed acyclic graph (DAG) of components connected to produce a workflow. Represented as a `ComponentSpec` with a `GraphImplementation`. A pipeline defines:

- **Inputs**: Data entry points (graph-level inputs)
- **Outputs**: Data exit points (graph-level outputs)
- **Tasks**: Configured component instances
- **Connections**: Edges linking outputs to inputs

### Component

A **component** is a reusable unit of computation defined by a `ComponentSpec`. Every component has:

- `name`, `description`
- `inputs`: Array of `InputSpec`
- `outputs`: Array of `OutputSpec`
- `implementation`: Either **container** (Docker) or **graph** (subgraph)
- `metadata`: Annotations, author, etc.

### Component Spec (ComponentSpec)

The canonical data structure that fully describes a component's interface, implementation, and metadata. Compatible with Google Cloud Vertex AI Pipelines and Kubeflow v1 formats. Stored/shared as YAML (`component.yaml`). The TypeScript type definitions live in `componentSpec.ts`. **Do not modify the ComponentSpec structure** without express permission.

### Task

A **task** is a configured instance of a component within a pipeline. A `TaskSpec` includes:

- `componentRef`: Reference to the component definition
- `arguments`: Configured input values (literals, graph input references, upstream task output references, or secrets)
- `isEnabled`: Optional conditional execution predicate
- `executionOptions`: Retry and caching strategies
- `annotations`: Metadata

### Task Node

The visual representation of a task on the canvas. Has position, handles, and interaction callbacks. Node ID format: `task_{taskId}`.

### Flex Node

A **flex node** is a freeform annotation element on the canvas (like a sticky note). It has a title, content, customizable colors, and font sizes. Flex nodes are purely decorative — they do not participate in task execution or data flow. Stored in ComponentSpec metadata annotations under the `"flex-nodes"` key. They can be locked to prevent accidental edits.

### Ghost Node

A **ghost node** is a temporary, semi-transparent preview node that appears while the user is dragging to create a connection (with Meta key held). It shows what Input/Output node would be created if the user drops at that position. Ghost nodes are never persisted — they exist only during the drag interaction.

### Input vs Input Component

These are different things:

- **Input** (`InputSpec`): A parameter definition on a component — has name, type, description, default value, optional flag
- **Input Component** (Input Node): A visual node on the canvas representing a **graph-level input**. It serves as a data source that feeds into task inputs. Node ID format: `input_{inputName}`

### Output vs Output Component

Same distinction:

- **Output** (`OutputSpec`): A parameter definition on a component — has name, type, description
- **Output Component** (Output Node): A visual node on the canvas representing a **graph-level output**. It collects data from upstream task outputs. Node ID format: `output_{outputName}`

### Task Type

The `TaskType` union: `"task" | "input" | "output"` — used to distinguish node types on the canvas.

### Subgraph

A task whose component has a `GraphImplementation` instead of a `ContainerImplementation`. This enables nested pipelines. When viewing a subgraph, you navigate into its internal graph structure. Check with `isSubgraph()` from `src/utils/subgraphUtils.ts`.

### Run / Pipeline Run

A **run** is a submitted instance of a pipeline for execution. Each run has:

- `id`: Unique identifier
- `root_execution_id`: The root execution
- `pipeline_name`, `pipeline_digest`
- `status`, `statusCounts`
- `created_at`, `created_by`

### Execution

An **execution** is a lower-level entity — the execution of a single task within a run. Executions form a tree:

- A run has one **root execution**
- The root execution branches into **child executions** for each task
- Subgraph tasks have their own child execution trees

**Run vs Execution**: A run is the top-level container users interact with. Executions are the internal task-level tracking.

**`run_id` vs `execution_id`**: Use `run_id` (the `id` field on `PipelineRunResponse`) for run-level operations — listing, canceling, fetching metadata, and URL routes (`/runs/$id`). Use `execution_id` for task-level operations — fetching execution details, artifacts, logs, and container state (`/api/executions/{id}/...`). A run's `root_execution_id` bridges the two: it points to the root of the execution tree. Child execution IDs are found via `details.child_task_execution_ids[taskId]`.

### Execution Status

`ContainerExecutionStatus`: PENDING, RUNNING, SUCCEEDED, FAILED, etc. Runs aggregate these via `TaskStatusCounts`.

### Edge / Connection

A directed connection in the graph. Three types:

- **Task Output → Task Input**: Data flows between tasks (`TaskOutputArgument`)
- **Graph Input → Task Input**: Pipeline inputs feed into tasks (`GraphInputArgument`)
- **Task Output → Graph Output**: Task outputs become pipeline outputs

Edge IDs are generated from source/target handle and input/output names.

### Handle

A connection point on a node where edges attach:

- **Input handles** (target): Left side of task nodes, one per task input. ID: `input_{inputName}`
- **Output handles** (source): Right side of task nodes, one per task output. ID: `output_{outputName}`
- **IO node handles**: Input nodes have a source handle; output nodes have a target handle

### Component Library

A hierarchical collection of components organized in folders. Types:

- **Preloaded**: Built-in components
- **User Libraries**: Custom user components
- **Remote Libraries**: Fetched from external sources
- **GitHub Libraries**: Components from GitHub repos

### Annotations

Arbitrary key-value metadata (`Record<string, unknown>`) on components, tasks, inputs, outputs, and graph nodes. Used for canvas position/layout, z-index, visual styling, and custom metadata.

### Secrets

Sensitive values (API keys, credentials) stored securely in the backend and referenced by name in task arguments via `SecretArgument`. Resolved at runtime — never embedded in pipeline definitions or exports.

```typescript
// SecretArgument structure
{
  secret: {
    name: "my-api-key";
  }
}
```
