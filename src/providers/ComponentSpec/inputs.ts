import type { InputSpec, TypeSpecType } from "@/utils/componentSpec";

import { BaseCollection, type Context } from "./context";
import type { BaseEntity, SerializableEntity } from "./types";

export type InputScalarInterface = Pick<
  InputSpec,
  "name" | "type" | "description" | "default" | "optional" | "value"
>;

export class InputEntity
  implements BaseEntity<InputScalarInterface>, SerializableEntity
{
  readonly $indexed = ["name" as const];

  name: string = "";

  type?: TypeSpecType;
  description?: string;
  default?: string;
  optional?: boolean;
  value?: string;

  constructor(readonly $id: string) {}

  populate(spec: InputScalarInterface) {
    this.name = spec.name;
    this.type = spec.type;
    this.description = spec.description;
    this.default = spec.default;
    this.optional = spec.optional;
    this.value = spec.value;

    return this;
  }

  toJson() {
    return {
      name: this.name,
      type: this.type,
      description: this.description,
      default: this.default,
      optional: this.optional,
      value: this.value,
    };
  }
}

export class InputsCollection
  extends BaseCollection<InputScalarInterface, InputEntity>
  implements SerializableEntity
{
  constructor(parent: Context) {
    super("inputs", parent);
  }

  createEntity(spec: InputScalarInterface): InputEntity {
    return new InputEntity(this.generateId()).populate(spec);
  }

  toJson() {
    return this.getAll().map((input) => input.toJson());
  }
}
