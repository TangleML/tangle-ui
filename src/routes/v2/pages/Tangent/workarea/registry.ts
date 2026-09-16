import type { WorkareaViewKind } from "./types";

const workareaKinds = new Map<string, WorkareaViewKind>();

export function registerWorkareaKind(kind: WorkareaViewKind): void {
  workareaKinds.set(kind.kind, kind);
}

export function getWorkareaKind(kind: string): WorkareaViewKind | undefined {
  return workareaKinds.get(kind);
}
