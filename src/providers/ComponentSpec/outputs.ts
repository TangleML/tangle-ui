import type { OutputSpec, TypeSpecType } from "@/utils/componentSpec";

import { AnnotationsCollection } from "./annotations";
import { BaseCollection, type Context } from "./context";
import type {
  BaseEntity,
  RequiredProperties,
  SerializableEntity,
} from "./types";

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

export class OutputEntity
  implements BaseEntity<OutputScalarInterface>, SerializableEntity
{
  readonly $indexed = ["name" as const];

  name: string;

  type?: TypeSpecType;
  description?: string;

  readonly annotations: AnnotationsCollection;

  /**
   * The name of the parent ComponentSpec that owns this output.
   * This is the task ID when the output belongs to a task's component.
   */
  private _parentComponentName?: string;

  constructor(
    readonly $id: string,
    private readonly context: Context,
    required: RequiredProperties<OutputScalarInterface>,
  ) {
    this.name = required.name;
    this.annotations = new AnnotationsCollection(this.context);
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

/**
 * Input type for populating an OutputEntity from raw spec data.
 * Extends the scalar interface with annotations in their raw format.
 */
type OutputPopulateInput = OutputScalarInterface & {
  annotations?: Record<string, unknown>;
};

export class OutputsCollection
  extends BaseCollection<OutputScalarInterface, OutputEntity>
  implements SerializableEntity
{
  private readonly parentComponentName: string;

  constructor(parent: Context) {
    super("outputs", parent);
    this.parentComponentName = parent.$name.split(".").pop() || "";
  }

  /**
   * Override add to accept OutputScalarWithAnnotations and set parent component name.
   */
  add(spec: OutputScalarWithAnnotations): OutputEntity {
    const entity = super.add(spec as OutputScalarInterface);
    // Set parent component name on the proxied entity returned from super.add()
    entity.setParentComponentName(this.parentComponentName);
    return entity;
  }

  createEntity(spec: OutputScalarInterface): OutputEntity {
    return new OutputEntity(this.generateId(), this, spec).populate(
      spec as OutputPopulateInput,
    );
  }

  toJson(): OutputSpec[] {
    return this.getAll().map((output) => output.toJson());
  }
}
