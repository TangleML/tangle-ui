import { NodeTypeRegistry } from "@/routes/v2/shared/nodes/registry";

import { conduitManifest } from "./ConduitNode/conduitNode.manifest";
import { flexNodeManifest } from "./FlexNode/flexNode.manifest";
import { ghostManifest } from "./GhostNode/ghostNode.manifest";
import { inputManifest } from "./IONode/inputNode.manifest";
import { outputManifest } from "./IONode/outputNode.manifest";
import { taskManifest } from "./TaskNode/taskNode.manifest";

export const editorRegistry = new NodeTypeRegistry();
editorRegistry.register(taskManifest);
editorRegistry.register(inputManifest);
editorRegistry.register(outputManifest);
editorRegistry.register(conduitManifest);
editorRegistry.register(ghostManifest);
editorRegistry.register(flexNodeManifest);
