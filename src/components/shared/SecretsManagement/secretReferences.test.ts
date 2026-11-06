import { describe, expect, it } from "vitest";

import type { ComponentSpec } from "@/utils/componentSpec";

import { missingSecretNames, referencedSecretNames } from "./secretReferences";
import { createSecretArgument } from "./types";

const pipelineWithSecrets: ComponentSpec = {
  name: "pipeline",
  implementation: {
    graph: {
      tasks: {
        train: {
          componentRef: {
            spec: {
              name: "train",
              implementation: {
                graph: {
                  tasks: {
                    fetch: {
                      componentRef: {},
                      arguments: {
                        token: createSecretArgument("HF_TOKEN"),
                      },
                    },
                  },
                },
              },
            },
          },
          arguments: {
            api_key: createSecretArgument("OPENAI_API_KEY"),
            epochs: "3",
          },
        },
        evaluate: {
          componentRef: {},
          arguments: { api_key: createSecretArgument("OPENAI_API_KEY") },
        },
      },
    },
  },
};

describe("referencedSecretNames", () => {
  it("finds every secret a pipeline's tasks take, nested subgraphs included, once each", () => {
    expect(referencedSecretNames(pipelineWithSecrets)).toEqual([
      "HF_TOKEN",
      "OPENAI_API_KEY",
    ]);
  });

  it("includes the secrets passed as run arguments", () => {
    expect(
      referencedSecretNames(pipelineWithSecrets, {
        db_password: createSecretArgument("DB_PASSWORD"),
        region: "us-east1",
      }),
    ).toEqual(["HF_TOKEN", "OPENAI_API_KEY", "DB_PASSWORD"]);
  });

  it("is empty for a pipeline that takes no secrets", () => {
    expect(
      referencedSecretNames({
        name: "plain",
        implementation: { container: { image: "test:latest" } },
      }),
    ).toEqual([]);
  });
});

describe("missingSecretNames", () => {
  it("lists the referenced secrets the account does not have", () => {
    expect(
      missingSecretNames(
        ["HF_TOKEN", "OPENAI_API_KEY"],
        [{ name: "OPENAI_API_KEY" }, { name: "UNUSED" }],
      ),
    ).toEqual(["HF_TOKEN"]);
  });

  it("is empty when every referenced secret exists", () => {
    expect(missingSecretNames(["HF_TOKEN"], [{ name: "HF_TOKEN" }])).toEqual(
      [],
    );
  });
});
