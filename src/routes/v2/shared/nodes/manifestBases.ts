import type { NodeTypeManifest } from "./types";

export type ManifestPartial = Omit<
  NodeTypeManifest,
  | "updatePosition"
  | "deleteNode"
  | "drop"
  | "cloneHandler"
  | "contextPanelComponent"
>;
