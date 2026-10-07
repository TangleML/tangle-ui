import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import { projectRunAnnotationKey } from "@/utils/projectRunAnnotation";

import { rootConfigSeed } from "./sessionRunConfig";

describe("rootConfigSeed", () => {
  it("writes a TANGLE_ROOT_CONFIG file keyed by the submit commands", () => {
    const { resource } = rootConfigSeed("project-1");

    expect(resource).toMatchObject({
      kind: "file",
      path: "tangle-deploy-root-config.yaml",
    });
    if (resource.kind !== "file") throw new Error("expected a file resource");

    const parsed = yaml.load(resource.content);
    const annotations = { [projectRunAnnotationKey("project-1")]: "true" };
    expect(parsed).toEqual({
      commands: {
        "tangle-deploy pipeline-run submit": { annotations },
        "tangle-deploy pipeline-run submit-from-python": { annotations },
      },
    });
  });

  it("points TANGLE_ROOT_CONFIG at the uploaded file", () => {
    expect(rootConfigSeed("project-1").env).toEqual({
      TANGLE_ROOT_CONFIG: "{{uploadsPath}}/tangle-deploy-root-config.yaml",
    });
  });
});
