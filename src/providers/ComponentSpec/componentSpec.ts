/**
 * ComponentSpecEntity - the main representation of a component specification.
 *
 * This is the root entity that contains inputs, outputs, and an optional
 * graph implementation with tasks and bindings.
 */

import { proxy } from "valtio";

import type { ComponentSpec, MetadataSpec } from "@/utils/componentSpec";

import { BaseNestedContext, type Context } from "./context";
import type { GraphImplementation } from "./graphImplementation";
import { InputsCollection } from "./inputs";
import { OutputsCollection } from "./outputs";
import type {
  BaseEntity,
  ComponentSpecScalarInterface,
  RequiredProperties,
  SerializableEntity,
} from "./types";

/**
 * ComponentSpecEntity represents a complete component specification.
 *
 * Structure:
 * - inputs: Input parameters for the component
 * - outputs: Output values from the component
 * - implementation: Optional GraphImplementation with tasks and bindings
 *
 * Collections (inputs, outputs) use lazy initialization to ensure Valtio
 * properly tracks them in the reactive subscription tree. This is necessary
 * because collections created in the constructor before proxy() wrapping
 * would not be linked to the parent's subscription.
 *
 * NOTE: We use manual getters instead of decorators because the assignment
 * must happen on `this` (the proxied object) for Valtio to track it.
 * A decorator with WeakMap storage bypasses Valtio's reactivity.
 */
export class ComponentSpecEntity
  extends BaseNestedContext
  implements BaseEntity<ComponentSpecScalarInterface>, SerializableEntity
{
  readonly $indexed = ["name" as const];

  name: string;
  description?: string;
  metadata?: MetadataSpec;

  implementation?: GraphImplementation;

  private _inputs?: InputsCollection;
  private _outputs?: OutputsCollection;

  get inputs(): InputsCollection {
    if (!this._inputs) {
      this._inputs = proxy(new InputsCollection(this));
    }
    return this._inputs;
  }

  get outputs(): OutputsCollection {
    if (!this._outputs) {
      this._outputs = proxy(new OutputsCollection(this));
    }
    return this._outputs;
  }

  constructor(
    public readonly $id: string,
    parent: Context,
    required: RequiredProperties<ComponentSpecScalarInterface>,
  ) {
    super(required.name, parent);

    this.name = required.name;
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
