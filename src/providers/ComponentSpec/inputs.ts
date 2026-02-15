/**
 * Input entities for component specifications.
 *
 * InputEntity represents an input parameter of a component.
 * InputsCollection manages all inputs for a component.
 */

import { proxy } from "valtio";

import type { InputSpec } from "@/utils/componentSpec";

import { AnnotationsCollection } from "./annotations";
import { BaseCollection, type Context } from "./context";
import type {
  BaseEntity,
  InputScalarInterface,
  InputScalarWithAnnotations,
  RequiredProperties,
  SerializableEntity,
  TypeSpecType,
} from "./types";

/**
 * InputEntity represents an input parameter of a component.
 */
export class InputEntity
  implements BaseEntity<InputScalarInterface>, SerializableEntity
{
  readonly $indexed = ["name" as const];

  name: string;

  type?: TypeSpecType;
  description?: string;
  default?: string;
  optional?: boolean;

  /**
   * Internal runtime value. NOT serialized to JSON (not part of schema).
   */
  value?: string;

  readonly annotations: AnnotationsCollection;

  constructor(
    readonly $id: string,
    private readonly context: Context,
    required: RequiredProperties<InputScalarInterface>,
  ) {
    this.name = required.name;
    // Wrap collection with proxy() to ensure Valtio tracks mutations
    this.annotations = proxy(new AnnotationsCollection(this.context));
  }

  populate(spec: InputScalarWithAnnotations) {
    this.name = spec.name;
    this.type = spec.type;
    this.description = spec.description;
    this.default = spec.default;
    this.optional = spec.optional;
    this.value = spec.value;

    if (spec.annotations) {
      for (const [key, value] of Object.entries(spec.annotations)) {
        this.annotations.add({ key, value });
      }
    }

    return this;
  }

  /**
   * Serializes to schema-compliant InputSpec format.
   * Note: `value` is intentionally excluded as it's not part of the schema.
   */
  toJson(): InputSpec {
    const json: InputSpec = {
      name: this.name,
    };

    if (this.type !== undefined) {
      json.type = this.type;
    }
    if (this.description !== undefined) {
      json.description = this.description;
    }
    if (this.default !== undefined) {
      json.default = this.default;
    }
    if (this.optional !== undefined) {
      json.optional = this.optional;
    }

    const annotationsJson = this.annotations.toJson();
    if (Object.keys(annotationsJson).length > 0) {
      json.annotations = annotationsJson;
    }

    return json;
  }
}

/**
 * Collection of inputs for a component.
 */
export class InputsCollection
  extends BaseCollection<InputScalarInterface, InputEntity>
  implements SerializableEntity
{
  constructor(parent: Context) {
    super("inputs", parent);
  }

  /**
   * Override add to accept InputScalarWithAnnotations which includes annotations.
   */
  add(spec: InputScalarWithAnnotations): InputEntity {
    return super.add(spec as InputScalarInterface);
  }

  createEntity(spec: InputScalarInterface): InputEntity {
    return new InputEntity(this.generateId(), this, spec).populate(
      spec as InputScalarWithAnnotations,
    );
  }

  toJson(): InputSpec[] {
    return this.getAll().map((input) => input.toJson());
  }
}
