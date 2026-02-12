import type { InputSpec, TypeSpecType } from "@/utils/componentSpec";

import { AnnotationsCollection } from "./annotations";
import { type Context, EntityIndex } from "./context";
import type { SerializableEntity } from "./types";

/**
 * Scalar interface for InputEntity - represents the data used to populate an input.
 * Note: `annotations` is handled separately by AnnotationsCollection on the entity.
 */
export type InputScalarInterface = Pick<
  InputSpec,
  "name" | "type" | "description" | "default" | "optional"
> & {
  /**
   * Internal value for runtime use. NOT part of the ComponentSpec schema.
   */
  value?: string;
};

/**
 * Interface for creating an InputEntity with annotations.
 */
export interface InputScalarWithAnnotations extends InputScalarInterface {
  annotations?: Record<string, unknown>;
}

export class InputEntity implements SerializableEntity {
  readonly $id: string;
  readonly $indexed = ["name" as const];

  name: string = "";

  type?: TypeSpecType;
  description?: string;
  default?: string;
  optional?: boolean;

  /**
   * Internal runtime value. NOT serialized to JSON (not part of schema).
   */
  value?: string;

  readonly annotations: AnnotationsCollection;

  constructor($id: string, parent: Context) {
    this.$id = $id;
    this.annotations = new AnnotationsCollection(parent);
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

export class InputsCollection implements SerializableEntity {
  private readonly index = new EntityIndex<InputEntity>();
  private readonly context: { $name: string; generateId(): string };

  /**
   * Direct access to entities for valtio reactivity.
   * Access this property to ensure valtio tracks entity changes.
   */
  get entities() {
    return this.index.entities;
  }

  constructor(parent: Context) {
    const $name = `${parent.$name}.inputs`;
    let counter = 0;
    this.context = {
      $name,
      generateId: () => `${$name}_${++counter}`,
    };
  }

  add(spec: InputScalarWithAnnotations): InputEntity {
    const entity = new InputEntity(
      this.context.generateId(),
      this.context as Context,
    ).populate(spec);
    this.index.add(entity);
    return entity;
  }

  getAll(): InputEntity[] {
    return this.index.getAll();
  }

  findByIndex<K extends keyof InputEntity>(
    indexKey: K,
    value: InputEntity[K],
  ): InputEntity[] {
    return this.index.findByIndex(indexKey, value);
  }

  toJson(): InputSpec[] {
    return this.getAll().map((input) => input.toJson());
  }
}
