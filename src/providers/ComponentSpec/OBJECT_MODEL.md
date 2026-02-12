# Component Spec Object Model

This document describes the architecture and principles of the Component Spec Object Model used to represent ML pipeline components in memory.

## Overview

The Component Spec Object Model is a **hierarchical, entity-based system** for representing ML pipeline component specifications. It provides:

- **Identity**: Every object has a unique `$id`
- **Indexing**: Fast lookups by indexed fields
- **Serialization**: Bidirectional conversion to/from YAML spec format
- **Relationships**: Explicit connections between entities (inputs, outputs, task arguments)

---

## Core Concepts

### Entities

Every domain object is an **Entity** implementing `BaseEntity<TScalar>`:

```typescript
type BaseEntity<TScalar> = {
  readonly $id: string;           // Unique identifier
  readonly $indexed: (keyof TScalar)[];  // Fields to index for fast lookup
  populate(scalar: TScalar): this;       // Hydrate with data
};
```

Entities also implement `SerializableEntity` for JSON export:

```typescript
interface SerializableEntity {
  toJson(): object | ScalarType;
}
```

### Scalars vs Entities

- **Scalar**: Plain TypeScript interface representing raw data shape (e.g., `InputScalarInterface`)
- **Entity**: Class instance with identity, behavior, and relationships (e.g., `InputEntity`)

This separation enables:
1. Loading YAML → scalars → entities via `populate()`
2. Saving entities → JSON via `toJson()` → YAML

### Collections

Every entity type has a corresponding **Collection** class extending `BaseCollection<TScalar, TEntity>`:

```typescript
abstract class BaseCollection<TScalar, TEntity> {
  add(spec: TScalar): TEntity;              // Create and register entity
  abstract createEntity(spec: TScalar): TEntity;  // Factory method
  getAll(): TEntity[];
  findById(id: EntityId): TEntity | undefined;
  findByIndex<K>(index: K, value: TEntity[K]): TEntity[];
}
```

### Contexts

Contexts form a **tree structure** providing:

- **ID Generation**: Hierarchical prefixes (e.g., `root.component.inputs_1`)
- **Entity Registration**: Entities register in their parent context
- **Scoping**: Nested components have isolated namespaces

```
RootContext ($name: "root")
└── ComponentSpecEntity ($name: "root.MyComponent")
    ├── InputsCollection ($name: "root.MyComponent.inputs")
    └── OutputsCollection ($name: "root.MyComponent.outputs")
```

---

## Object Hierarchy

```
RootContext
└── ComponentSpecEntity
    ├── inputs: InputsCollection
    │   └── InputEntity[]
    │       - name, type, description, default, optional, value
    │
    ├── outputs: OutputsCollection
    │   └── OutputEntity[]
    │       - name, type, description
    │
    └── implementation?: GraphImplementation
        └── tasks: TasksCollection
            └── TaskEntity[]
                ├── name, componentRef, isEnabled, executionOptions
                └── arguments: ArgumentsCollection
                    └── ArgumentEntity[]
                        - type: "graphInput" | "taskOutput" | "literal"
                        - connectTo(InputEntity | OutputEntity)
```

---

## Key Classes

| Class | Purpose | Location |
|-------|---------|----------|
| `RootContext` | Top-level context for ID generation | `context.ts` |
| `ComponentSpecEntity` | Main component representation | `componentSpec.ts` |
| `InputEntity` / `InputsCollection` | Component inputs | `inputs.ts` |
| `OutputEntity` / `OutputsCollection` | Component outputs | `outputs.ts` |
| `GraphImplementation` | Graph-based implementation | `graphImplementation.ts` |
| `TaskEntity` / `TasksCollection` | Tasks within a graph | `graphImplementation.ts` |
| `ArgumentEntity` / `ArgumentsCollection` | Task argument bindings | `graphImplementation.ts` |
| `AnnotationEntity` / `AnnotationsCollection` | Key-value annotations | `annotations.ts` |
| `YamlLoader` | Loads YAML into object model | `yamlLoader.ts` |

---

## Data Flow Connections

`ArgumentEntity` represents how data flows between tasks:

```typescript
class ArgumentEntity {
  name: string;
  
  // Connection type
  private _type: "graphInput" | "taskOutput" | "literal";
  
  // Connect to a source
  connectTo(source: InputEntity | OutputEntity): void;
  
  // Or set a literal value
  set value(value: ScalarValue);
}
```

**Types:**
- `graphInput`: Argument bound to a graph-level input
- `taskOutput`: Argument bound to another task's output
- `literal`: Static value

---

## Indexing System

Entities declare indexed fields via `$indexed`:

```typescript
class InputEntity {
  readonly $indexed = ["name" as const];
  name: string;
  // ...
}
```

Collections can then perform fast lookups:

```typescript
const input = inputs.findByIndex("name", "myInputName")[0];
```

The `IndexByKey` class maintains a `Map<fieldName, Map<fieldValue, Set<entityId>>>` structure for O(1) lookups.

---

## Creating New Entity Types

To add a new entity type:

1. **Define the scalar interface:**
```typescript
interface MyScalarInterface {
  name: string;
  // ... other fields
}
```

2. **Create the entity class:**
```typescript
class MyEntity implements BaseEntity<MyScalarInterface>, SerializableEntity {
  readonly $indexed = ["name" as const];
  name: string = "";

  constructor(readonly $id: string) {}

  populate(spec: MyScalarInterface) {
    this.name = spec.name;
    return this;
  }

  toJson() {
    return { name: this.name };
  }
}
```

3. **Create the collection class:**
```typescript
class MyCollection extends BaseCollection<MyScalarInterface, MyEntity> {
  constructor(parent: Context) {
    super("myEntities", parent);
  }

  createEntity(spec: MyScalarInterface): MyEntity {
    return new MyEntity(this.generateId()).populate(spec);
  }
}
```

---

## Loading from YAML

The `YamlLoader` class handles YAML → Object Model conversion:

```typescript
const loader = new YamlLoader();
const componentSpec = await loader.loadFromText(yamlString);
```

Key loading steps:
1. Parse YAML to raw spec object
2. Create `ComponentSpecEntity` with `RootContext`
3. Populate inputs and outputs
4. If graph implementation: create tasks and resolve argument connections

---

## Serialization

Call `toJson()` on any entity to get its spec representation:

```typescript
const json = componentSpec.toJson();
// {
//   name: "...",
//   description: "...",
//   inputs: [...],
//   outputs: [...],
//   implementation: { graph: { tasks: {...} } }
// }
```

---

## Important Notes

### Mutation Model
Entities are **mutable**. After creation, fields can be modified directly. However:
- Index updates are NOT automatic — if you change an indexed field after creation, the index may become stale
- For React integration, trigger re-renders manually after mutations

### Nested Components
When a graph task references a component, `YamlLoader` recursively creates a nested `ComponentSpecEntity`:

```typescript
await this.load(hydratedComponentRef.spec, taskId, rootSpecEntity);
```

This creates the full component tree in memory.

### ID Format
IDs follow the pattern: `{contextPath}_{counter}`
- Example: `root.MyPipeline.tasks_1`
- Useful for debugging and tracing entity origins

