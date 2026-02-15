/**
 * Task entities for graph implementations.
 *
 * TaskEntity represents a task (node) in a pipeline graph.
 * ArgumentEntity represents a task input argument with optional literal value.
 */

import { proxy } from "valtio";

import type {
  ArgumentType,
  GraphInputArgument,
  TaskOutputArgument,
  TaskSpec,
} from "@/utils/componentSpec";

import { AnnotationsCollection } from "./annotations";
import { BaseCollection, type Context } from "./context";
import type {
  ArgumentScalarInterface,
  ArgumentScalarValue,
  BaseEntity,
  ComponentReference,
  ExecutionOptionsSpec,
  GraphContext,
  NestedContext,
  PredicateType,
  RequiredProperties,
  SerializableEntity,
  TaskPopulateInput,
  TaskScalarInterface,
} from "./types";

/**
 * TaskEntity represents a task in a graph implementation.
 *
 * Tasks reference a component and have arguments that can be:
 * - Literal values (stored in ArgumentEntity.value)
 * - Connections from graph inputs or other task outputs (stored in BindingsCollection)
 */
export class TaskEntity
  implements BaseEntity<TaskScalarInterface>, SerializableEntity
{
  readonly $indexed = ["name" as const];

  name: string;
  componentRef: ComponentReference;

  isEnabled?: PredicateType;
  executionOptions?: ExecutionOptionsSpec;

  readonly annotations: AnnotationsCollection;
  readonly arguments: ArgumentsCollection;

  constructor(
    readonly $id: string,
    private readonly context: GraphContext,
    required: RequiredProperties<TaskScalarInterface>,
  ) {
    this.name = required.name;
    this.componentRef = required.componentRef;

    // Wrap collections with proxy() to ensure Valtio tracks mutations
    this.annotations = proxy(new AnnotationsCollection(this.context));
    this.arguments = proxy(new ArgumentsCollection(this.context));
  }

  populate(input: TaskPopulateInput) {
    this.name = input.name;
    this.isEnabled = input.isEnabled;
    this.executionOptions = input.executionOptions;
    this.componentRef = input.componentRef;

    // Populate annotations collection from input Record
    if (input.annotations) {
      for (const [key, value] of Object.entries(input.annotations)) {
        this.annotations.add({ key, value });
      }
    }

    return this;
  }

  /**
   * Serializes the task to schema-compliant TaskSpec format.
   * Note: The task name is NOT included here - it's used as the key in the tasks map.
   */
  toJson(): TaskSpec {
    const json: TaskSpec = {
      componentRef: this.serializeComponentRef(),
    };

    // Build arguments from both literal values and bindings
    const argsJson = this.serializeArguments();
    if (Object.keys(argsJson).length > 0) {
      json.arguments = argsJson;
    }

    if (this.isEnabled !== undefined) {
      json.isEnabled = this.isEnabled;
    }

    if (this.executionOptions !== undefined) {
      json.executionOptions = this.executionOptions;
    }

    const annotationsJson = this.annotations.toJson();
    if (Object.keys(annotationsJson).length > 0) {
      json.annotations = annotationsJson;
    }

    return json;
  }

  /**
   * Serializes arguments by combining literal values with binding information.
   */
  private serializeArguments(): Record<string, ArgumentType> {
    const result: Record<string, ArgumentType> = {};
    const { bindings, tasks, inputs } = this.context;

    // Get all bindings targeting this task
    const taskBindings = bindings.findByTarget(this.$id);

    // Build a map of portName -> binding for quick lookup
    const bindingsByPort = new Map(
      taskBindings.map((b) => [b.targetPortName, b]),
    );

    // Serialize each argument
    for (const arg of this.arguments.getAll()) {
      const binding = bindingsByPort.get(arg.name);

      if (binding) {
        // This argument is bound - serialize based on binding type
        if (binding.bindingType === "graphInput") {
          // Look up the actual input entity to get its current name (in case it was renamed)
          const sourceInput = inputs.findById(binding.sourceEntityId);
          if (sourceInput) {
            const graphInputArg: GraphInputArgument = {
              graphInput: {
                // Use sourceInput.name (current name) instead of binding.sourcePortName (name at bind-time)
                inputName: sourceInput.name,
              },
            };
            result[arg.name] = graphInputArg;
          }
        } else if (binding.bindingType === "taskOutput") {
          // Find the source task name
          const sourceTask = tasks.findById(binding.sourceEntityId);
          if (sourceTask) {
            const taskOutputArg: TaskOutputArgument = {
              taskOutput: {
                taskId: sourceTask.name,
                outputName: binding.sourcePortName,
              },
            };
            result[arg.name] = taskOutputArg;
          }
        }
      } else {
        // No binding - serialize as literal value
        result[arg.name] = String(arg.value ?? "");
      }
    }

    return result;
  }

  /**
   * Serializes the componentRef, excluding internal fields not in the schema.
   */
  private serializeComponentRef(): ComponentReference {
    const ref: ComponentReference = {};

    if (this.componentRef.name) {
      ref.name = this.componentRef.name;
    }
    if (this.componentRef.digest) {
      ref.digest = this.componentRef.digest;
    }
    if (this.componentRef.tag) {
      ref.tag = this.componentRef.tag;
    }
    if (this.componentRef.url) {
      ref.url = this.componentRef.url;
    }
    // Note: spec and text are typically not serialized back to avoid duplication

    return ref;
  }
}

/**
 * Collection of tasks in a graph implementation.
 */
export class TasksCollection
  extends BaseCollection<TaskScalarInterface, TaskEntity>
  implements SerializableEntity, NestedContext
{
  constructor(
    parent: Context,
    private readonly graphContext: GraphContext,
  ) {
    super("tasks", parent);
  }

  /**
   * Override add to accept TaskPopulateInput which includes annotations.
   * Uses type assertion since parent expects TaskScalarInterface but we accept extended type.
   */
  add(spec: TaskPopulateInput): TaskEntity {
    return super.add(spec as TaskScalarInterface);
  }

  createEntity(spec: TaskScalarInterface): TaskEntity {
    // Cast back to TaskPopulateInput since we know it may include annotations
    return new TaskEntity(this.generateId(), this.graphContext, spec).populate(
      spec as TaskPopulateInput,
    );
  }

  toJson(): Record<string, TaskSpec> {
    return this.getAll().reduce(
      (acc, task) => {
        acc[task.name] = task.toJson();
        return acc;
      },
      {} as Record<string, TaskSpec>,
    );
  }
}

/**
 * ArgumentEntity represents a task input argument.
 *
 * For literal values, the value is stored directly on this entity.
 * For connections (graphInput, taskOutput), use BindingsCollection.bind() instead.
 * The TaskEntity.serializeArguments() method combines literal values with
 * binding information during serialization.
 */
class ArgumentEntity implements BaseEntity<ArgumentScalarInterface> {
  readonly $indexed = ["name" as const];

  name: string;
  private _value: ArgumentScalarValue | undefined;

  constructor(
    readonly $id: string,
    required: RequiredProperties<ArgumentScalarInterface>,
  ) {
    this.name = required.name;
  }

  populate(scalar: ArgumentScalarInterface) {
    this.name = scalar.name;
    return this;
  }

  get value(): ArgumentScalarValue {
    return this._value;
  }

  set value(value: ArgumentScalarValue) {
    this._value = value;
  }
}

/**
 * Collection of arguments for a task.
 */
class ArgumentsCollection extends BaseCollection<
  ArgumentScalarInterface,
  ArgumentEntity
> {
  constructor(parent: Context) {
    super("arguments", parent);
  }

  createEntity(spec: ArgumentScalarInterface): ArgumentEntity {
    return new ArgumentEntity(this.generateId(), spec).populate(spec);
  }
}
