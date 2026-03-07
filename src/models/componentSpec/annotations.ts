import type { XYPosition } from "@xyflow/react";
import { computed } from "mobx";
import { Model, model, modelAction, prop } from "mobx-keystone";

import type { Annotation } from "./entities/types";

// -- Registry: known annotation key → typed value --

interface AnnotationTypeMap {
  "editor.position": XYPosition;
  "tangleml.com/editor/task-color": string;
}

type KnownAnnotationKey = keyof AnnotationTypeMap;

interface AnnotationCodec<T> {
  serialize(value: T): unknown;
  deserialize(raw: unknown): T;
  defaultValue: T;
}

const codecs: {
  [K in KnownAnnotationKey]: AnnotationCodec<AnnotationTypeMap[K]>;
} = {
  "editor.position": {
    serialize: (pos) => JSON.stringify(pos),
    deserialize: (raw) => {
      if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw);
          return { x: Number(parsed.x) || 0, y: Number(parsed.y) || 0 };
        } catch {
          return { x: 0, y: 0 };
        }
      }
      if (typeof raw === "object" && raw !== null && "x" in raw && "y" in raw) {
        const r = raw as Record<string, unknown>;
        return { x: Number(r.x) || 0, y: Number(r.y) || 0 };
      }
      return { x: 0, y: 0 };
    },
    defaultValue: { x: 0, y: 0 },
  },
  "tangleml.com/editor/task-color": {
    serialize: (color) => color,
    deserialize: (raw) => (typeof raw === "string" ? raw : "transparent"),
    defaultValue: "transparent",
  },
};

// -- Helpers for serialization layer --

export function deserializeAnnotationValue(key: string, raw: unknown): unknown {
  const codec = codecs[key as KnownAnnotationKey];
  return codec ? codec.deserialize(raw) : raw;
}

export function serializeAnnotationValue(key: string, value: unknown): unknown {
  const codec = codecs[key as KnownAnnotationKey];
  return codec ? codec.serialize(value as never) : value;
}

// -- Annotations Model --

@model("spec/Annotations")
export class Annotations extends Model({
  items: prop<Annotation[]>(() => []),
}) {
  static from(items: Annotation[]): Annotations {
    return new Annotations({ items });
  }

  get<K extends KnownAnnotationKey>(key: K): AnnotationTypeMap[K];
  get(key: string): unknown;
  get(key: string): unknown {
    const ann = this.items.find((a) => a.key === key);
    const codec = codecs[key as KnownAnnotationKey];
    if (!ann) return codec?.defaultValue;
    return ann.value;
  }

  @modelAction
  set<K extends string>(
    key: K,
    value: K extends KnownAnnotationKey ? AnnotationTypeMap[K] : unknown,
  ) {
    const idx = this.items.findIndex((a) => a.key === key);
    if (idx >= 0) {
      Object.assign(this.items[idx], { value });
    } else {
      this.items.push({ key, value });
    }
  }

  has(key: string): boolean {
    return this.items.some((a) => a.key === key);
  }

  @modelAction
  add(annotation: Annotation) {
    this.items.push(annotation);
  }

  @modelAction
  remove(key: string) {
    const idx = this.items.findIndex((a) => a.key === key);
    if (idx >= 0) this.items.splice(idx, 1);
  }

  @modelAction
  updateAt(index: number, updates: Partial<Annotation>) {
    const ann = this.items[index];
    if (ann) Object.assign(ann, updates);
  }

  @modelAction
  removeAt(index: number) {
    this.items.splice(index, 1);
  }

  // -- Array-like delegation (backward compat for legacy consumers) --

  @computed
  get length(): number {
    return this.items.length;
  }

  find(fn: (a: Annotation) => boolean) {
    return this.items.find(fn);
  }

  findIndex(fn: (a: Annotation) => boolean) {
    return this.items.findIndex(fn);
  }

  filter(fn: (a: Annotation) => boolean) {
    return this.items.filter(fn);
  }

  map<U>(fn: (a: Annotation, i: number) => U): U[] {
    return this.items.map(fn);
  }

  some(fn: (a: Annotation) => boolean) {
    return this.items.some(fn);
  }

  [Symbol.iterator]() {
    return this.items[Symbol.iterator]();
  }
}
