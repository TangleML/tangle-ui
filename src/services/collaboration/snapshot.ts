import { fromSnapshot, getSnapshot, type SnapshotInOf } from "mobx-keystone";

import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";

import type {
  CollabJsonObject,
  CollabJsonValue,
  CollabSnapshot,
} from "./protocol";
import { COLLAB_MODEL_VERSION } from "./protocol";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toCollabJsonValue(value: unknown): CollabJsonValue {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(toCollabJsonValue);
  if (isRecord(value)) {
    const out: CollabJsonObject = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) continue;
      out[key] = toCollabJsonValue(entry);
    }
    return out;
  }
  throw new Error(`Non-serializable value in snapshot: ${typeof value}`);
}

export function toCollabJsonObject(value: unknown): CollabJsonObject {
  const json = toCollabJsonValue(value);
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("Expected snapshot to be a JSON object");
  }
  return json;
}

export function toCollabSnapshot(spec: ComponentSpec): CollabSnapshot {
  return {
    modelVersion: COLLAB_MODEL_VERSION,
    spec: toCollabJsonObject(getSnapshot(spec)),
  };
}

function isComponentSpecSnapshot(
  value: unknown,
): value is SnapshotInOf<ComponentSpec> {
  return isRecord(value) && value.$modelType === "spec/ComponentSpec";
}

export function fromCollabSnapshot(snapshot: CollabSnapshot): ComponentSpec {
  if (!isComponentSpecSnapshot(snapshot.spec)) {
    throw new Error("Collab snapshot is not a ComponentSpec snapshot");
  }
  return fromSnapshot<ComponentSpec>(snapshot.spec);
}

function stableStringify(value: CollabJsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`,
  );
  return `{${entries.join(",")}}`;
}

export function canonicalHash(spec: ComponentSpec): string {
  return stableStringify(toCollabJsonObject(getSnapshot(spec)));
}
