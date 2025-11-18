import type {
  ComponentReference,
  ExecutionOptionsSpec,
  PredicateType,
  TaskSpec,
} from "@/utils/componentSpec";

import { BaseCollection, type Context, type NestedContext } from "./context";
import { InputEntity } from "./inputs";
import type { OutputEntity } from "./outputs";
import type {
  BaseEntity,
  RequiredProperties,
  ScalarType,
  SerializableEntity,
} from "./types";

export class GraphImplementation implements SerializableEntity {
  readonly tasks: TasksCollection;

  constructor(private readonly context: Context) {
    this.tasks = new TasksCollection(this.context);
  }

  toJson() {
    return {
      graph: {
        tasks: this.tasks.toJson(),
      },
    };
  }
}

type TaskScalarInterface = Pick<TaskSpec, "isEnabled" | "executionOptions"> & {
  name: string;
  componentRef: ComponentReference;
};

export class TaskEntity
  implements BaseEntity<TaskScalarInterface>, SerializableEntity
{
  readonly $indexed = ["name" as const];

  name: string;
  componentRef: ComponentReference;

  isEnabled?: PredicateType;
  executionOptions?: ExecutionOptionsSpec;

  readonly arguments: ArgumentsCollection;

  constructor(
    readonly $id: string,
    private readonly context: Context,
    required: RequiredProperties<TaskScalarInterface>,
  ) {
    this.name = required.name;
    this.componentRef = required.componentRef;

    this.arguments = new ArgumentsCollection(this.context);
  }

  populate(scalar: TaskScalarInterface) {
    this.name = scalar.name;
    this.isEnabled = scalar.isEnabled;
    this.executionOptions = scalar.executionOptions;
    this.componentRef = scalar.componentRef;

    return this;
  }

  toJson() {
    return {
      taskId: this.name,
      componentRef: this.componentRef,
      isEnabled: this.isEnabled,
      executionOptions: this.executionOptions,
      arguments: this.arguments.toJson(),
    };
  }
}

export class TasksCollection
  extends BaseCollection<TaskScalarInterface, TaskEntity>
  implements SerializableEntity, NestedContext
{
  constructor(parent: Context) {
    super("tasks", parent);
  }

  createEntity(spec: TaskScalarInterface): TaskEntity {
    return new TaskEntity(this.generateId(), this, spec).populate(spec);
  }

  toJson() {
    return this.getAll().reduce(
      (acc, task) => {
        acc[task.name] = task.toJson();
        return acc;
      },
      {} as Record<string, object>,
    );
  }
}

interface ArgumentScalarInterface {
  // type: "graphInput" | "taskOutput" | "literal";
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

  connectTo(output: OutputEntity): void;
  connectTo(input: InputEntity): void;
  connectTo(source: InputEntity | OutputEntity): void {
    if (source instanceof InputEntity) {
      this._type = "graphInput";
    } else {
      this._type = "taskOutput";
    }
    this._source = source;
    this._value = undefined;
  }

  get value(): ScalarValue {
    if (this._type === "literal") {
      return this._value;
    }

    // todo: return the value of the source?
    // return this._source?.value;
    return undefined;
  }

  set value(value: ScalarValue) {
    this._type = "literal";
    this._value = value;
  }

  get type(): "graphInput" | "taskOutput" | "literal" {
    return this._type;
  }

  toJson() {
    // todo: fix to return according to Spec
    return {
      __argument: {
        name: this.name,
        type: this.type,
        value: this.value,
      },
    };
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

  toJson() {
    return this.getAll().reduce(
      (acc, argument) => {
        acc[argument.name] = argument.toJson();
        return acc;
      },
      {} as Record<string, object>,
    );
  }
}
