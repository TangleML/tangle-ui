import { BaseCollection, type Context } from "./context";
import type {
  BaseEntity,
  RequiredProperties,
  SerializableEntity,
} from "./types";

interface AnnotationScalarInterface {
  key: string;
  value?: unknown;
}

export class AnnotationEntity
  implements SerializableEntity, BaseEntity<AnnotationScalarInterface>
{
  $indexed: never[];

  key: string;
  value?: unknown;

  constructor(
    public readonly $id: string,
    required: RequiredProperties<AnnotationScalarInterface>,
  ) {
    this.$id = $id;
    this.$indexed = [];

    this.key = required.key;
  }

  populate(scalar: AnnotationScalarInterface) {
    this.key = scalar.key;
    this.value = scalar.value;

    return this;
  }

  /**
   * Returns the annotation value directly (not stringified).
   */
  toJson(): object | string | number | boolean | null | undefined {
    return this.value as object | string | number | boolean | null | undefined;
  }
}

export class AnnotationsCollection
  extends BaseCollection<AnnotationScalarInterface, AnnotationEntity>
  implements SerializableEntity
{
  constructor(parent: Context) {
    super("annotations", parent);
  }

  createEntity(spec: AnnotationScalarInterface): AnnotationEntity {
    return new AnnotationEntity(this.generateId(), spec).populate(spec);
  }

  /**
   * Returns annotations as a plain object (not stringified).
   */
  toJson(): Record<string, unknown> {
    return this.getAll().reduce(
      (acc, annotation) => {
        acc[annotation.key] = annotation.toJson();
        return acc;
      },
      {} as Record<string, unknown>,
    );
  }
}
