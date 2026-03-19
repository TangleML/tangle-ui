import { inputManifestBase } from "@/routes/v2/shared/nodes/IONode/inputManifestBase";
import type { NodeTypeManifest } from "@/routes/v2/shared/nodes/types";

export const inputManifest: NodeTypeManifest = {
  ...inputManifestBase,

  updatePosition() {},
  deleteNode() {},
};
