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
  readonly $id: string; // Unique identifier
  readonly $indexed: (keyof TScalar)[]; // Fields to index for fast lookup
  populate(scalar: TScalar): this; // Hydrate with data
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
  add(spec: TScalar): TEntity; // Create and register entity
  abstract createEntity(spec: TScalar): TEntity; // Factory method
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
        ├── tasks: TasksCollection
        │   └── TaskEntity[]
        │       ├── name, componentRef, isEnabled, executionOptions
        │       └── arguments: ArgumentsCollection
        │           └── ArgumentEntity[]
        │               - name, literalValue (for static values)
        │
        └── bindings: BindingsCollection
            └── BindingEntity[]
                - sourceEntityId, sourcePortName
                - targetEntityId, targetPortName
                - bindingType: "graphInput" | "taskOutput" | "outputValue"
```

---

## Key Classes

| Class                                        | Purpose                              | Location                 |
| -------------------------------------------- | ------------------------------------ | ------------------------ |
| `RootContext`                                | Top-level context for ID generation  | `context.ts`             |
| `ComponentSpecEntity`                        | Main component representation        | `componentSpec.ts`       |
| `InputEntity` / `InputsCollection`           | Component inputs                     | `inputs.ts`              |
| `OutputEntity` / `OutputsCollection`         | Component outputs                    | `outputs.ts`             |
| `GraphImplementation`                        | Graph-based implementation           | `graphImplementation.ts` |
| `TaskEntity` / `TasksCollection`             | Tasks within a graph                 | `graphImplementation.ts` |
| `ArgumentEntity` / `ArgumentsCollection`     | Task argument values (literals only) | `graphImplementation.ts` |
| `BindingEntity` / `BindingsCollection`       | Data flow connections                | `bindings.ts`            |
| `AnnotationEntity` / `AnnotationsCollection` | Key-value annotations                | `annotations.ts`         |
| `YamlLoader`                                 | Loads YAML into object model         | `yamlLoader.ts`          |

---

## Data Flow Bindings

`BindingEntity` represents data flow connections in the graph. This is a first-class entity with full lifecycle management.

### Hybrid ID/Entity Design

Bindings store entity IDs internally for serialization, but provide `source` and `target` getters that resolve to actual entity objects:

```typescript
class BindingEntity {
  $id: string;
  $indexed = ["sourceEntityId", "targetEntityId"];

  // Internal ID storage (for serialization)
  sourceEntityId: string;
  sourcePortName: string;
  targetEntityId: string;
  targetPortName: string;

  // Resolved entity getters (for user-land code)
  get source(): InputEntity | TaskEntity;  // Resolves from context
  get target(): TaskEntity | OutputEntity; // Resolves from context

  // Type-safe binding type (determined from context, not string patterns)
  get bindingType(): "graphInput" | "taskOutput" | "outputValue";
}
```

**Benefits of hybrid approach:**

- **Serialization**: IDs stay for `toJson()` without transformation
- **User ergonomics**: `binding.source.name` works directly
- **Type safety**: `bindingType` uses `instanceof` checks, not string matching

**Binding Types:**

- `graphInput`: ComponentSpec Input → Task Input
- `taskOutput`: Task Output → Task Input
- `outputValue`: Task Output → ComponentSpec Output

### Creating Bindings

The `bind()` method accepts either entity objects (preferred) or ID references:

```typescript
// Preferred: Using entity objects directly
const binding = implementation.bindings.bind(
  { entity: input, portName: input.name },
  { entity: task, portName: "inputArg" }
);

// Legacy: Using entity IDs
const binding = implementation.bindings.bind(
  { entityId: input.$id, portName: input.name },
  { entityId: task.$id, portName: "inputArg" }
);
```

### Accessing Source/Target Entities

```typescript
// Get resolved entities directly from the binding
const sourceEntity = binding.source;  // InputEntity or TaskEntity
const targetEntity = binding.target;  // TaskEntity or OutputEntity

// Access properties without manual lookups
console.log(sourceEntity.name);
console.log(targetEntity.name);
```

### Querying Bindings

```typescript
// Find bindings by source or target
const outgoingBindings = bindings.findBySource(task.$id);
const incomingBindings = bindings.findByTarget(task.$id);
```

### Reactive Cleanup

Bindings are automatically removed when their source or target entities are deleted. This is achieved via Valtio subscriptions:

```typescript
class BindingsCollection {
  // Watch collections for entity deletions
  watchCollection(collection: EntityIndex, role: "source" | "target" | "both"): void;
}

// In GraphImplementation constructor:
this.bindings.watchCollection(context.inputs, "source");
this.bindings.watchCollection(context.outputs, "target");
this.bindings.watchCollection(this.tasks, "both");
```

When an Input, Output, or Task is deleted, all bindings referencing it are automatically cleaned up.

### Literal Argument Values

For static/literal values (not connections), use `ArgumentEntity`:

```typescript
const argument = task.arguments.add({ name: "myArg" });
argument.value = "literal string value";
```

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
4. If graph implementation:
   - Create tasks
   - Create bindings for `graphInput` and `taskOutput` arguments
   - Create bindings for `outputValues` (task output → graph output)
   - Set literal values on `ArgumentEntity` for static arguments

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

Entities are **mutable**. After creation, fields can be modified directly.

- **Index updates ARE automatic**: Valtio subscriptions detect changes to indexed fields and update indexes automatically
- **Binding cleanup is automatic**: When entities are deleted, related bindings are automatically removed via Valtio subscriptions
- For React integration, use `useSnapshot()` from Valtio for automatic re-renders

### Nested Components

When a graph task references a component, `YamlLoader` recursively creates a nested `ComponentSpecEntity`:

```typescript
await this.load(hydratedComponentRef.spec, taskId, rootSpecEntity);
```

This creates the full component tree in memory.

### ID Format

IDs follow the pattern: `{contextPath}_{counter}`

- Example: `root.MyPipeline.tasks_1`
- Example: `root.MyPipeline.bindings_3`
- Useful for debugging and tracing entity origins

### Binding Type Inference

The binding type is inferred from entity ID patterns:

- Source contains `.inputs_` → `graphInput`
- Target contains `.outputs_` → `outputValue`
- Otherwise → `taskOutput`
