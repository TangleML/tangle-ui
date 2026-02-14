import { proxy } from "valtio";

import type {
  ArgumentType,
  ComponentReference,
  ExecutionOptionsSpec,
  GraphImplementation as GraphImplementationType,
  GraphInputArgument,
  PredicateType,
  TaskOutputArgument,
  TaskSpec,
} from "@/utils/componentSpec";

import { AnnotationsCollection } from "./annotations";
import { BindingsCollection, type BindingsContext } from "./bindings";
import { BaseCollection, type Context, type NestedContext } from "./context";
import type { InputsCollection } from "./inputs";
import type { OutputsCollection } from "./outputs";
import type {
  BaseEntity,
  RequiredProperties,
  SerializableEntity,
} from "./types";

/**
 * Context interface for GraphImplementation.
 * Requires access to inputs and outputs collections for binding watches.
 */
interface GraphImplementationContext extends Context {
  inputs: InputsCollection;
  outputs: OutputsCollection;
}

/**
 * Context interface for TaskEntity.
 * Provides access to collections needed for serialization.
 */
export interface TaskEntityContext extends Context {
  bindings: BindingsCollection;
  tasks: TasksCollection;
  inputs: InputsCollection;
}

export class GraphImplementation implements SerializableEntity {
  readonly tasks: TasksCollection;
  readonly bindings: BindingsCollection;

  constructor(private readonly context: GraphImplementationContext) {
    // Create context getter for TaskEntity - provides access to all collections needed for serialization
    // Uses arrow function to capture `this` and defer resolution until after all collections are initialized
    const getTaskContext = (): TaskEntityContext => ({
      ...this.context,
      bindings: this.bindings,
      tasks: this.tasks,
      inputs: this.context.inputs,
    });

    // Create context getter for BindingsCollection - provides access to collections for entity resolution
    const getBindingsContext = (): BindingsContext => ({
      ...this.context,
      tasks: this.tasks,
    });

    // Wrap collections with proxy() to ensure Valtio tracks mutations
    this.tasks = proxy(new TasksCollection(this.context, getTaskContext));
    this.bindings = proxy(new BindingsCollection(this.context, getBindingsContext));

    // Wire up reactive cleanup for bindings
    // When entities are deleted, bindings referencing them are auto-removed
    this.bindings.watchCollection(context.inputs, "source");
    this.bindings.watchCollection(context.outputs, "target");
    this.bindings.watchCollection(this.tasks, "both");
  }

  toJson(): GraphImplementationType {
    const json: GraphImplementationType = {
      graph: {
        tasks: this.tasks.toJson(),
      },
    };

    // Build outputValues from bindings where target is a graph output
    const outputValueBindings = this.bindings
      .getAll()
      .filter((b) => b.bindingType === "outputValue");

    if (outputValueBindings.length > 0) {
      const outputValues: Record<string, TaskOutputArgument> = {};

      for (const binding of outputValueBindings) {
        // Find the source task name by $id
        const sourceTask = this.tasks.findById(binding.sourceEntityId);
        // Look up the actual output entity to get its current name (in case it was renamed)
        const targetOutput = this.context.outputs.findById(
          binding.targetEntityId,
        );

        if (sourceTask && targetOutput) {
          // Use targetOutput.name (current name) instead of binding.targetPortName (name at bind-time)
          outputValues[targetOutput.name] = {
            taskOutput: {
              taskId: sourceTask.name,
              outputName: binding.sourcePortName,
            },
          };
        }
      }

      if (Object.keys(outputValues).length > 0) {
        json.graph.outputValues = outputValues;
      }
    }

    return json;
  }
}

type TaskScalarInterface = Pick<TaskSpec, "isEnabled" | "executionOptions"> & {
  name: string;
  componentRef: ComponentReference;
};

/**
 * Input type for populating a TaskEntity from raw spec data.
 * Extends the scalar interface with annotations in their raw format.
 */
type TaskPopulateInput = TaskScalarInterface & {
  annotations?: Record<string, unknown>;
};

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
    private readonly getContext: () => TaskEntityContext,
    required: RequiredProperties<TaskScalarInterface>,
  ) {
    this.name = required.name;
    this.componentRef = required.componentRef;

    // Wrap collections with proxy() to ensure Valtio tracks mutations
    // Use getter for context since collections may not be fully initialized at construction time
    this.annotations = proxy(new AnnotationsCollection(this.getContext()));
    this.arguments = proxy(new ArgumentsCollection(this.getContext()));
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
    const { bindings, tasks, inputs } = this.getContext();

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

export class TasksCollection
  extends BaseCollection<TaskScalarInterface, TaskEntity>
  implements SerializableEntity, NestedContext
{
  constructor(
    parent: Context,
    private readonly getTaskContext: () => TaskEntityContext,
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
    // Pass context getter to enable serialization with access to bindings, tasks, and inputs
    return new TaskEntity(
      this.generateId(),
      this.getTaskContext,
      spec,
    ).populate(spec as TaskPopulateInput);
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

interface ArgumentScalarInterface {
  name: string;
}

type ScalarValue = string | number | boolean | null | undefined;

/**
 * ArgumentEntity represents a task input argument.
 *
 * For literal values, the value is stored directly on this entity.
 * For connections (graphInput, taskOutput), use BindingsCollection.bind() instead.
 * The TaskEntity.serializeArguments() method combines literal values with
 * binding information during serialization.
 */
export class ArgumentEntity implements BaseEntity<ArgumentScalarInterface> {
  readonly $indexed = ["name" as const];

  name: string;
  private _value: ScalarValue | undefined;

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

  get value(): ScalarValue {
    return this._value;
  }

  set value(value: ScalarValue) {
    this._value = value;
  }
}

export class ArgumentsCollection extends BaseCollection<
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
