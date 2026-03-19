import { outputManifestBase } from "@/routes/v2/shared/nodes/IONode/outputManifestBase";
import type { NodeTypeManifest } from "@/routes/v2/shared/nodes/types";

export const outputManifest: NodeTypeManifest = {
  ...outputManifestBase,

  updatePosition() {},
  deleteNode() {},
};
