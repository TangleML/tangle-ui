import type { WorkareaViewKind, WorkareaViewKindName } from "./types";

const workareaKinds = new Map<WorkareaViewKindName, WorkareaViewKind>();

export function registerWorkareaKind(kind: WorkareaViewKind): void {
  workareaKinds.set(kind.type, kind);
}

export function getWorkareaKind(
  type: WorkareaViewKindName,
): WorkareaViewKind | undefined {
  return workareaKinds.get(type);
}
