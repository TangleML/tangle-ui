import { NODE_TYPE_REGISTRY } from "@/routes/v2/shared/nodes/registry";

import { conduitManifest } from "./ConduitNode/conduitNode.manifest";
import { inputManifest } from "./IONode/inputNode.manifest";
import { outputManifest } from "./IONode/outputNode.manifest";
import { taskManifest } from "./TaskNode/taskNode.manifest";

NODE_TYPE_REGISTRY.register(taskManifest);
NODE_TYPE_REGISTRY.register(inputManifest);
NODE_TYPE_REGISTRY.register(outputManifest);
NODE_TYPE_REGISTRY.register(conduitManifest);
