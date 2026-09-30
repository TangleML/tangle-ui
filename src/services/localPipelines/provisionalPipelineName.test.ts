import { describe, expect, it } from "vitest";

import {
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import { PROVISIONAL_NAME_ANNOTATION } from "@/utils/annotationKeys";
import { defaultPipelineYamlWithName } from "@/utils/constants";
import { componentSpecFromYaml } from "@/utils/yaml";

import {
  clearProvisionalName,
  specNameIsProvisional,
} from "./provisionalPipelineName";

function specFromYaml(yaml: string) {
  return new YamlDeserializer(new IncrementingIdGenerator()).deserialize(
    componentSpecFromYaml(yaml),
  );
}

describe("provisional pipeline names", () => {
  it("marks a pipeline created from the opening prompt", () => {
    const spec = specFromYaml(
      defaultPipelineYamlWithName("Build a pipeline that scrapes wikipedia", {
        provisionalName: true,
      }),
    );

    expect(specNameIsProvisional(spec)).toBe(true);
  });

  /** A pipeline the user made by hand carries no mark and is left alone. */
  it("leaves an ordinary new pipeline unmarked", () => {
    const spec = specFromYaml(defaultPipelineYamlWithName("Churn model"));

    expect(specNameIsProvisional(spec)).toBe(false);
  });

  it("drops the mark once something has been named", () => {
    const spec = specFromYaml(
      defaultPipelineYamlWithName("Draft", { provisionalName: true }),
    );

    clearProvisionalName(spec);

    expect(specNameIsProvisional(spec)).toBe(false);
    expect(spec.annotations.has(PROVISIONAL_NAME_ANNOTATION)).toBe(false);
  });

  it("does nothing to a pipeline that was never marked", () => {
    const spec = specFromYaml(defaultPipelineYamlWithName("Churn model"));

    expect(() => clearProvisionalName(spec)).not.toThrow();
    expect(spec.name).toBe("Churn model");
  });
});
