import type { HostResourceInput } from "@tangent/embed-react";
import yaml from "js-yaml";

import { projectRunAnnotations } from "@/utils/projectRunAnnotation";

const ROOT_CONFIG_FILENAME = "tangle-deploy-root-config.yaml";

interface RootConfigSeed {
  resource: HostResourceInput;
  env: Record<string, string>;
}

function rootConfigContent(projectId: string): string {
  const annotations = projectRunAnnotations([projectId]);
  return yaml.dump({
    commands: {
      "tangle-deploy pipeline-run submit": { annotations },
      "tangle-deploy pipeline-run submit-from-python": { annotations },
    },
  });
}

/**
 * The file and the env that points at it are returned together because neither
 * works alone: the env without the file makes `tangle-deploy` fail closed on a
 * missing path, and the file without the env is never read.
 *
 * `tangle-deploy` stamps these annotations on every submit it runs under this
 * session, so an agent that submits from its own sandbox attributes the run to
 * the project without being asked. The id lives in the annotation key, which is
 * why the file is authored here rather than templated from an env value.
 */
export function rootConfigSeed(projectId: string): RootConfigSeed {
  return {
    resource: {
      kind: "file",
      path: ROOT_CONFIG_FILENAME,
      content: rootConfigContent(projectId),
    },
    env: { TANGLE_ROOT_CONFIG: `{{uploadsPath}}/${ROOT_CONFIG_FILENAME}` },
  };
}
