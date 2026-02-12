import type { ComponentSpec, MetadataSpec } from "@/utils/componentSpec";

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
> & {
  name: string;
  metadata?: MetadataSpec;
};

export class ComponentSpecEntity
  extends BaseNestedContext
  implements BaseEntity<ComponentSpecScalarInterface>, SerializableEntity
{
  readonly $indexed = ["name" as const];

  name: string;
  description?: string;
  metadata?: MetadataSpec;

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
    this.metadata = scalar.metadata;

    return this;
  }

  /**
   * Serializes to schema-compliant ComponentSpec format.
   * Only includes defined properties to avoid undefined values in JSON.
   */
  toJson(): ComponentSpec {
    const json: ComponentSpec = {
      implementation: this.implementation?.toJson() ?? {
        graph: { tasks: {} },
      },
    };

    if (this.name) {
      json.name = this.name;
    }

    if (this.description !== undefined) {
      json.description = this.description;
    }

    if (this.metadata !== undefined) {
      json.metadata = this.metadata;
    }

    const inputsJson = this.inputs.toJson();
    if (inputsJson.length > 0) {
      json.inputs = inputsJson;
    }

    const outputsJson = this.outputs.toJson();
    if (outputsJson.length > 0) {
      json.outputs = outputsJson;
    }

    return json;
  }
}
