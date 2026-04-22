import type { XYPosition } from "@xyflow/react";
import { computed } from "mobx";
import { Model, model, modelAction, prop } from "mobx-keystone";
import { z } from "zod";

import type { FlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";
import { isFlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";

import type { Annotation } from "./entities/types";

// -- Zod schemas --

const xyPositionSchema = z.object({
  x: z.coerce.number().default(0),
  y: z.coerce.number().default(0),
});

const edgeConduitSchema = z.object({
  id: z.string(),
  orientation: z.enum(["horizontal", "vertical"]),
  coordinate: z.number(),
  color: z.string(),
  edgeIds: z.array(z.string()),
});

const flexNodeDataSchema: z.ZodType<FlexNodeData> =
  z.custom<FlexNodeData>(isFlexNodeData);

// -- Registry: known annotation key → typed value --

export type GuidelineOrientation = "horizontal" | "vertical";
export type EdgeConduit = z.infer<typeof edgeConduitSchema>;

interface AnnotationTypeMap {
  "editor.position": XYPosition;
  "tangleml.com/editor/task-color": string;
  "tangleml.com/editor/edge-conduits": EdgeConduit[];
  "flex-nodes": FlexNodeData[];
  notes: string;
  tags: string[];
}

type KnownAnnotationKey = keyof AnnotationTypeMap;

interface AnnotationCodec<T> {
  serialize(value: T): unknown;
  deserialize(raw: unknown): T;
  defaultValue: T;
}

// -- JSON codec helpers --

function safeJsonParse(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return undefined;
  }
}

function parseJsonArray(raw: unknown): unknown[] {
  if (typeof raw === "string") {
    const parsed = safeJsonParse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }
  return Array.isArray(raw) ? raw : [];
}

function jsonArrayCodec<T>(schema: z.ZodType<T>): AnnotationCodec<T[]> {
  return {
    serialize: (items) => JSON.stringify(items),
    deserialize: (raw) =>
      parseJsonArray(raw).flatMap((item) => {
        const result = schema.safeParse(item);
        return result.success ? [result.data] : [];
      }),
    defaultValue: [],
  };
}

function jsonObjectCodec<T>(
  schema: z.ZodType<T>,
  defaultValue: T,
): AnnotationCodec<T> {
  return {
    serialize: (value) => JSON.stringify(value),
    deserialize: (raw) => {
      const obj = typeof raw === "string" ? safeJsonParse(raw) : raw;
      const result = schema.safeParse(obj);
      return result.success ? result.data : defaultValue;
    },
    defaultValue,
  };
}

// -- Codecs --

const codecs = {
  "editor.position": jsonObjectCodec(xyPositionSchema, { x: 0, y: 0 }),
  "tangleml.com/editor/task-color": {
    serialize: (color: string) => color,
    deserialize: (raw: unknown) =>
      typeof raw === "string" ? raw : "transparent",
    defaultValue: "transparent",
  },
  "tangleml.com/editor/edge-conduits": jsonArrayCodec(edgeConduitSchema),
  "flex-nodes": jsonArrayCodec(flexNodeDataSchema),
  notes: {
    serialize: (value: string) => value,
    deserialize: (raw: unknown) => (typeof raw === "string" ? raw : ""),
    defaultValue: "",
  },
  tags: {
    serialize: (value: string[]) =>
      value
        .map((t) => t.trim())
        .filter(Boolean)
        .join(","),
    deserialize: (raw: unknown) =>
      typeof raw === "string"
        ? raw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    defaultValue: [] as string[],
  },
} satisfies {
  [K in KnownAnnotationKey]: AnnotationCodec<AnnotationTypeMap[K]>;
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
