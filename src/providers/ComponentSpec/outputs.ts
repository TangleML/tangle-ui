import type { OutputSpec, TypeSpecType } from "@/utils/componentSpec";

import { BaseCollection, type Context } from "./context";
import type { BaseEntity, SerializableEntity } from "./types";

export type OutputScalarInterface = Pick<
  OutputSpec,
  "name" | "type" | "description"
>;

export class OutputEntity
  implements BaseEntity<OutputScalarInterface>, SerializableEntity
{
  readonly $indexed = ["name" as const];

  name: string = "";

  type?: TypeSpecType;
  description?: string;

  constructor(readonly $id: string) {}

  populate(spec: OutputScalarInterface) {
    this.name = spec.name;
    this.type = spec.type;
    this.description = spec.description;

    return this;
  }

  toJson() {
    return {
      name: this.name,
      type: this.type,
      description: this.description,
    };
  }
}

export class OutputsCollection
  extends BaseCollection<OutputScalarInterface, OutputEntity>
  implements SerializableEntity
{
  constructor(parent: Context) {
    super("outputs", parent);
  }

  createEntity(spec: OutputScalarInterface): OutputEntity {
    return new OutputEntity(this.generateId()).populate(spec);
  }

  toJson() {
    return this.getAll().map((output) => output.toJson());
  }
}
