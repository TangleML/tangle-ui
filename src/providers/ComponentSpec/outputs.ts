import type { OutputSpec, TypeSpecType } from "@/utils/componentSpec";

import { AnnotationsCollection } from "./annotations";
import { type Context, EntityIndex } from "./context";
import type { SerializableEntity } from "./types";

/**
 * Scalar interface for OutputEntity - represents the data used to populate an output.
 * Note: `annotations` is handled separately by AnnotationsCollection on the entity.
 */
export type OutputScalarInterface = Pick<
  OutputSpec,
  "name" | "type" | "description"
>;

/**
 * Interface for creating an OutputEntity with annotations.
 */
export interface OutputScalarWithAnnotations extends OutputScalarInterface {
  annotations?: Record<string, unknown>;
}

export class OutputEntity implements SerializableEntity {
  readonly $id: string;
  readonly $indexed = ["name" as const];

  name: string = "";

  type?: TypeSpecType;
  description?: string;

  readonly annotations: AnnotationsCollection;

  /**
   * The name of the parent ComponentSpec that owns this output.
   * This is the task ID when the output belongs to a task's component.
   */
  private _parentComponentName?: string;

  constructor($id: string, parent: Context) {
    this.$id = $id;
    this.annotations = new AnnotationsCollection(parent);
  }

  /**
   * Sets the parent component name (task ID in graph context).
   * Called by OutputsCollection when creating the entity.
   */
  setParentComponentName(name: string) {
    this._parentComponentName = name;
  }

  /**
   * Gets the parent component name (task ID in graph context).
   * Used by ArgumentEntity when serializing taskOutput arguments.
   */
  get parentComponentName(): string | undefined {
    return this._parentComponentName;
  }

  populate(spec: OutputScalarWithAnnotations) {
    this.name = spec.name;
    this.type = spec.type;
    this.description = spec.description;

    if (spec.annotations) {
      for (const [key, value] of Object.entries(spec.annotations)) {
        this.annotations.add({ key, value });
      }
    }

    return this;
  }

  toJson(): OutputSpec {
    const json: OutputSpec = {
      name: this.name,
    };

    if (this.type !== undefined) {
      json.type = this.type;
    }
    if (this.description !== undefined) {
      json.description = this.description;
    }

    const annotationsJson = this.annotations.toJson();
    if (Object.keys(annotationsJson).length > 0) {
      json.annotations = annotationsJson;
    }

    return json;
  }
}

export class OutputsCollection implements SerializableEntity {
  private readonly index = new EntityIndex<OutputEntity>();
  private readonly parentComponentName: string;
  private readonly context: { $name: string; generateId(): string };

  /**
   * Direct access to entities for valtio reactivity.
   * Access this property to ensure valtio tracks entity changes.
   */
  get entities() {
    return this.index.entities;
  }

  constructor(parent: Context) {
    this.parentComponentName = parent.$name.split(".").pop() || "";
    const $name = `${parent.$name}.outputs`;
    let counter = 0;
    this.context = {
      $name,
      generateId: () => `${$name}_${++counter}`,
    };
  }

  add(spec: OutputScalarWithAnnotations): OutputEntity {
    const entity = new OutputEntity(
      this.context.generateId(),
      this.context as Context,
    ).populate(spec);
    entity.setParentComponentName(this.parentComponentName);
    this.index.add(entity);
    return entity;
  }

  getAll(): OutputEntity[] {
    return this.index.getAll();
  }

  findByIndex<K extends keyof OutputEntity>(
    indexKey: K,
    value: OutputEntity[K],
  ): OutputEntity[] {
    return this.index.findByIndex(indexKey, value);
  }

  toJson(): OutputSpec[] {
    return this.getAll().map((output) => output.toJson());
  }
}
