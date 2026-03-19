import { NodeTypeRegistry } from "@/routes/v2/shared/nodes/registry";

import { conduitManifest } from "./ConduitNode/conduitNode.manifest";
import { inputManifest } from "./IONode/inputNode.manifest";
import { outputManifest } from "./IONode/outputNode.manifest";
import { taskManifest } from "./TaskNode/taskNode.manifest";

export const runViewRegistry = new NodeTypeRegistry();
runViewRegistry.register(taskManifest);
runViewRegistry.register(inputManifest);
runViewRegistry.register(outputManifest);
runViewRegistry.register(conduitManifest);
