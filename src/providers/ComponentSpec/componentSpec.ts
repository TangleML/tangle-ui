import type { ComponentSpec } from "@/utils/componentSpec";

import { BaseNestedContext, type Context } from "./context";
import type { GraphImplementation } from "./graphImplementation";
import { InputsCollection } from "./inputs";
import { OutputsCollection } from "./outputs";
import type {
  BaseEntity,
  RequiredProperties,
  SerializableEntity,
} from "./types";

export type ComponentSpecScalarInterface = Pick<
  ComponentSpec,
  "description"
> & { name: string };

export class ComponentSpecEntity
  extends BaseNestedContext
  implements BaseEntity<ComponentSpecScalarInterface>, SerializableEntity
{
  readonly $indexed = ["name" as const];

  name: string;
  description?: string;

  implementation?: GraphImplementation;

  readonly inputs: InputsCollection;
  readonly outputs: OutputsCollection;

  constructor(
    public readonly $id: string,
    parent: Context,
    required: RequiredProperties<ComponentSpecScalarInterface>,
  ) {
    super(required.name, parent);

    this.name = required.name;

    this.inputs = new InputsCollection(this);
    this.outputs = new OutputsCollection(this);
  }

  findComponentSpecEntity(name: string): ComponentSpecEntity | undefined {
    return this.entities.findByIndex("name", name)[0] as
      | ComponentSpecEntity
      | undefined;
  }

  populate(scalar: ComponentSpecScalarInterface) {
    this.name = scalar.name;
    this.description = scalar.description;

    return this;
  }

  toJson() {
    return {
      name: this.name,
      description: this.description,
      implementation: this.implementation?.toJson(),
      inputs: this.inputs.toJson(),
      outputs: this.outputs.toJson(),
    };
  }
}
