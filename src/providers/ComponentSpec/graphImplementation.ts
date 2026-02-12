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
import { BaseCollection, type Context, type NestedContext } from "./context";
import { InputEntity } from "./inputs";
import { OutputEntity } from "./outputs";
import type {
  BaseEntity,
  RequiredProperties,
  SerializableEntity,
} from "./types";

interface OutputValueBinding {
  outputName: string;
  taskId: string;
  taskOutputName: string;
}

export class GraphImplementation implements SerializableEntity {
  readonly tasks: TasksCollection;

  /**
   * Maps graph output names to task output sources.
   * Used to expose task outputs as graph-level outputs.
   */
  private readonly _outputValues: Map<string, OutputValueBinding> = new Map();

  constructor(private readonly context: Context) {
    this.tasks = new TasksCollection(this.context);
  }

  /**
   * Sets a graph output value to reference a task output.
   * @param graphOutputName - The name of the graph output
   * @param taskId - The task ID that produces the output
   * @param taskOutputName - The name of the task's output
   */
  setOutputValue(
    graphOutputName: string,
    taskId: string,
    taskOutputName: string,
  ): void {
    this._outputValues.set(graphOutputName, {
      outputName: graphOutputName,
      taskId,
      taskOutputName,
    });
  }

  /**
   * Removes a graph output value binding.
   */
  removeOutputValue(graphOutputName: string): void {
    this._outputValues.delete(graphOutputName);
  }

  /**
   * Gets all output value bindings.
   */
  getOutputValues(): OutputValueBinding[] {
    return Array.from(this._outputValues.values());
  }

  toJson(): GraphImplementationType {
    const json: GraphImplementationType = {
      graph: {
        tasks: this.tasks.toJson(),
      },
    };

    if (this._outputValues.size > 0) {
      const outputValues: Record<string, TaskOutputArgument> = {};
      for (const binding of this._outputValues.values()) {
        outputValues[binding.outputName] = {
          taskOutput: {
            taskId: binding.taskId,
            outputName: binding.taskOutputName,
          },
        };
      }
      json.graph.outputValues = outputValues;
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
    private readonly context: Context,
    required: RequiredProperties<TaskScalarInterface>,
  ) {
    this.name = required.name;
    this.componentRef = required.componentRef;

    this.annotations = new AnnotationsCollection(this.context);
    this.arguments = new ArgumentsCollection(this.context);
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

    const argsJson = this.arguments.toJson();
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
  constructor(parent: Context) {
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
    return new TaskEntity(this.generateId(), this, spec).populate(
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

interface ArgumentScalarInterface {
  name: string;
}

type ScalarValue = string | number | boolean | null | undefined;

export class ArgumentEntity
  implements BaseEntity<ArgumentScalarInterface>, SerializableEntity
{
  readonly $indexed = ["name" as const];

  name: string;

  private _type: "graphInput" | "taskOutput" | "literal" = "literal";
  private _source: InputEntity | OutputEntity | undefined;
  private _sourceTaskId?: string; // For taskOutput: the task ID that owns the output

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

  /**
   * Connect this argument to a graph input.
   */
  connectTo(input: InputEntity): void;
  /**
   * Connect this argument to a task output.
   * The taskId is inferred from the output's parent component spec.
   */
  connectTo(output: OutputEntity): void;
  connectTo(source: InputEntity | OutputEntity): void {
    if (source instanceof InputEntity) {
      this._type = "graphInput";
      this._sourceTaskId = undefined;
    } else {
      this._type = "taskOutput";
      // Extract task ID from the output's parent component name
      this._sourceTaskId = source.parentComponentName;
    }
    this._source = source;
    this._value = undefined;
  }

  get value(): ScalarValue {
    if (this._type === "literal") {
      return this._value;
    }
    return undefined;
  }

  set value(value: ScalarValue) {
    this._type = "literal";
    this._value = value;
    this._source = undefined;
    this._sourceTaskId = undefined;
  }

  get type(): "graphInput" | "taskOutput" | "literal" {
    return this._type;
  }

  /**
   * Returns the argument in the schema-compliant ArgumentType format:
   * - Literal: returns the string/number/boolean value directly
   * - GraphInput: returns { graphInput: { inputName: string } }
   * - TaskOutput: returns { taskOutput: { taskId: string, outputName: string } }
   */
  toJson(): ArgumentType {
    switch (this._type) {
      case "literal":
        // Return the literal value directly (must be string per schema)
        return String(this._value ?? "");

      case "graphInput": {
        if (!this._source) {
          throw new Error(
            `ArgumentEntity ${this.name}: graphInput source is not set`,
          );
        }
        const graphInputArg: GraphInputArgument = {
          graphInput: {
            inputName: this._source.name,
          },
        };
        return graphInputArg;
      }

      case "taskOutput": {
        if (!this._source || !this._sourceTaskId) {
          throw new Error(
            `ArgumentEntity ${this.name}: taskOutput source or taskId is not set`,
          );
        }
        const taskOutputArg: TaskOutputArgument = {
          taskOutput: {
            taskId: this._sourceTaskId,
            outputName: this._source.name,
          },
        };
        return taskOutputArg;
      }
    }
  }
}

export class ArgumentsCollection
  extends BaseCollection<ArgumentScalarInterface, ArgumentEntity>
  implements SerializableEntity
{
  constructor(parent: Context) {
    super("arguments", parent);
  }

  createEntity(spec: ArgumentScalarInterface): ArgumentEntity {
    return new ArgumentEntity(this.generateId(), spec).populate(spec);
  }

  toJson(): Record<string, ArgumentType> {
    return this.getAll().reduce(
      (acc, argument) => {
        acc[argument.name] = argument.toJson();
        return acc;
      },
      {} as Record<string, ArgumentType>,
    );
  }
}
